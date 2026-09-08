import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import {
  getFeedbackEmailServerConfig,
  getSafeConfigurationMessage,
  getSupabaseServerConfig,
} from '@/lib/env/server';
import { deliverFeedbackEmail } from '@/lib/email/feedback-delivery.mjs';
import { createRequestId, safeServerError } from '@/lib/server/request';

const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 4000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const DUPLICATE_WINDOW_MS = 60 * 1000;
const FEEDBACK_CATEGORIES = ['bug', 'account_access', 'privacy_export_deletion', 'general'] as const;

export const runtime = 'nodejs';

type FeedbackPayload = {
  userEmail?: unknown;
  loggedInUserEmail?: unknown;
  userRole?: unknown;
  category?: unknown;
  title?: unknown;
  description?: unknown;
  pagePath?: unknown;
  context?: unknown;
  timestamp?: unknown;
  appContext?: unknown;
  website?: unknown;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();
const recentSubmissionDigests = new Map<string, number>();

function sanitizeString(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getClientKey(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip')?.trim();
  return forwardedFor || realIp || 'unknown';
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const current = rateLimitStore.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }

  current.count += 1;
  rateLimitStore.set(key, current);
  return current.count > RATE_LIMIT_MAX_REQUESTS;
}

function formatAppContext(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Not provided';

  const context = value as Record<string, unknown>;
  return ['language', 'timezone', 'userAgent']
    .map((key) => [key, sanitizeString(context[key], 300)] as const)
    .filter(([, entry]) => entry)
    .map(([key, entry]) => `${key}: ${entry}`)
    .join('\n');
}

function buildEmailText(params: {
  enteredUserEmail: string;
  loggedInUserEmail: string;
  userRole: string;
  category: string;
  title: string;
  description: string;
  pagePath: string;
  context: string;
  timestamp: string;
  appContext: string;
}) {
  return [
    'Lodario Beta Feedback',
    '',
    `Logged-in user email: ${params.loggedInUserEmail || 'Not provided'}`,
    `Entered user email: ${params.enteredUserEmail || 'Not provided'}`,
    `User role: ${params.userRole || 'Not provided'}`,
    `Category: ${params.category}`,
    `Title: ${params.title}`,
    `Page/path: ${params.pagePath || 'Not provided'}`,
    `Context: ${params.context || 'Not provided'}`,
    `Timestamp: ${params.timestamp}`,
    '',
    'App context:',
    params.appContext,
    '',
    'Description:',
    params.description,
  ].join('\n');
}

function buildEmailHtml(text: string): string {
  return `<pre style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: pre-wrap; line-height: 1.5;">${escapeHtml(text)}</pre>`;
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  const responseHeaders = { 'X-Request-ID': requestId, 'Cache-Control': 'no-store' };
  let supabaseConfig;
  try {
    supabaseConfig = getSupabaseServerConfig();
  } catch (error) {
    return NextResponse.json(
      { error: getSafeConfigurationMessage(error, 'Age verification is unavailable.') },
      { status: 500, headers: responseHeaders },
    );
  }
  const authorization = request.headers.get('authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Authentication required.', requestId }, { status: 401, headers: responseHeaders });
  }

  const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Authentication required.', requestId }, { status: 401, headers: responseHeaders });
  }

  const { data: ageStatus, error: ageError } = await supabase.rpc('public_beta_get_my_age_status');
  if (
    ageError
    || !ageStatus
    || typeof ageStatus !== 'object'
    || Array.isArray(ageStatus)
    || ageStatus.eligible !== true
  ) {
    return NextResponse.json({ error: 'The Lodario beta is only available to users aged 18 or older.', requestId }, { status: 403, headers: responseHeaders });
  }

  let emailConfig;
  try {
    emailConfig = getFeedbackEmailServerConfig();
  } catch (error) {
    return NextResponse.json(
      { error: getSafeConfigurationMessage(error, 'Feedback email is unavailable.') },
      { status: 500, headers: responseHeaders },
    );
  }

  const origin = request.headers.get('origin');
  if (origin) {
    const requestOrigin = new URL(request.url).origin;
    if (origin !== requestOrigin) {
      return NextResponse.json({ error: 'Invalid request origin.', requestId }, { status: 403, headers: responseHeaders });
    }
  }

  const clientKey = getClientKey(request);
  if (isRateLimited(clientKey)) {
    return NextResponse.json(
      { error: 'Too many feedback attempts. Please try again later.' },
      { status: 429, headers: responseHeaders }
    );
  }

  let payload: FeedbackPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.', requestId }, { status: 400, headers: responseHeaders });
  }

  if (typeof payload.website === 'string' && payload.website.trim()) {
    return NextResponse.json({ error: 'Unable to send feedback.', requestId }, { status: 400, headers: responseHeaders });
  }

  const category = sanitizeString(payload.category, 40);
  const title = sanitizeHeaderValue(sanitizeString(payload.title, MAX_TITLE_LENGTH));
  const description = sanitizeString(payload.description, MAX_DESCRIPTION_LENGTH);
  const enteredUserEmail = sanitizeHeaderValue(sanitizeString(payload.userEmail, 254));
  const loggedInUserEmail = user.email ?? '';
  const statusRole = ageStatus.role === 'player' || ageStatus.role === 'coach' ? ageStatus.role : '';
  const userRole = statusRole;
  const pagePath = sanitizeString(payload.pagePath, 200);
  const context = sanitizeString(payload.context, 200);
  const timestamp = new Date().toISOString();
  const appContext = formatAppContext(payload.appContext);

  if (!FEEDBACK_CATEGORIES.includes(category as (typeof FEEDBACK_CATEGORIES)[number])) {
    return NextResponse.json(
      { error: 'Choose a valid feedback category.', requestId },
      { status: 400, headers: responseHeaders },
    );
  }

  if (!title || !description) {
    return NextResponse.json(
      { error: 'Feedback title and description are required.', requestId },
      { status: 400, headers: responseHeaders }
    );
  }
  if (enteredUserEmail && !isValidEmail(enteredUserEmail)) {
    return NextResponse.json(
      { error: 'Enter a valid reply email address.', requestId },
      { status: 400, headers: responseHeaders },
    );
  }

  const submissionDigest = createHash('sha256')
    .update(`${user.id}\n${category}\n${title}\n${description}`)
    .digest('hex');
  const previousSubmission = recentSubmissionDigests.get(submissionDigest);
  if (previousSubmission && previousSubmission > Date.now() - DUPLICATE_WINDOW_MS) {
    return NextResponse.json(
      { error: 'This feedback was already submitted. Wait before sending it again.', requestId },
      { status: 409, headers: responseHeaders },
    );
  }
  recentSubmissionDigests.set(submissionDigest, Date.now());

  const text = buildEmailText({
    enteredUserEmail,
    loggedInUserEmail,
    userRole,
    category,
    title,
    description,
    pagePath,
    context,
    timestamp,
    appContext,
  });

  const replyTo = enteredUserEmail || loggedInUserEmail || undefined;

  try {
    await deliverFeedbackEmail({
      createTransport: nodemailer.createTransport,
      config: emailConfig,
      message: {
        replyTo,
        subject: `Lodario Beta Feedback [${category}]: ${title}`,
        text,
        html: buildEmailHtml(text),
      },
    });
  } catch {
    recentSubmissionDigests.delete(submissionDigest);
    safeServerError('feedback_delivery_failed', requestId, 502);
    await supabase.rpc('public_beta_record_my_operational_event', {
      p_event_type: 'feedback_failed',
      p_request_id: requestId,
    });
    return NextResponse.json(
      { error: 'Unable to send feedback right now. Retry later or use the support email.', requestId },
      { status: 502, headers: responseHeaders }
    );
  }

  await supabase.rpc('public_beta_record_my_operational_event', {
    p_event_type: 'feedback_submitted',
    p_request_id: requestId,
  });
  return NextResponse.json({ ok: true, requestId }, { headers: responseHeaders });
}
