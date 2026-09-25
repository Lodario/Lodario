import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { NextRequest, NextResponse } from 'next/server';
import {
  getAccountDeletionEmailServerConfig,
  getSafeConfigurationMessage,
  getSupabaseServerConfig,
} from '@/lib/env/server';
import { deliverFeedbackEmail } from '@/lib/email/feedback-delivery.mjs';
import { createRequestId, safeServerError } from '@/lib/server/request';

export const runtime = 'nodejs';

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_SUBJECT_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 4000;

type DeletionPayload = {
  confirmation?: unknown;
  email?: unknown;
  subject?: unknown;
  message?: unknown;
};

function sanitizeString(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
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

function buildDeletionRequestText(params: {
  accountEmail: string;
  accountRole: string;
  subject: string;
  message: string;
  requestId: string;
}): string {
  return [
    'Lodario Account and Data Deletion Request',
    '',
    `Account email: ${params.accountEmail}`,
    `Account role: ${params.accountRole || 'Not available'}`,
    `Subject: ${params.subject}`,
    `Request ID: ${params.requestId}`,
    '',
    'Message / feedback:',
    params.message || 'Not provided',
  ].join('\n');
}

function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const current = attempts.get(userId);
  if (!current || current.resetAt <= now) {
    attempts.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > 3;
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  const headers = { 'X-Request-ID': requestId, 'Cache-Control': 'no-store' };

  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.', requestId }, { status: 403, headers });
  }

  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Authentication required.', requestId }, { status: 401, headers });
  }

  let body: DeletionPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.', requestId }, { status: 400, headers });
  }
  if (body.confirmation !== 'DELETE MY LODARIO ACCOUNT') {
    return NextResponse.json({ error: 'Type the full confirmation phrase.', requestId }, { status: 400, headers });
  }

  let config;
  try {
    config = getSupabaseServerConfig();
  } catch (error) {
    return NextResponse.json(
      { error: getSafeConfigurationMessage(error), requestId },
      { status: 500, headers },
    );
  }

  const supabase = createClient(config.url, config.anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Authentication required.', requestId }, { status: 401, headers });
  }
  if (isRateLimited(user.id)) {
    return NextResponse.json(
      { error: 'Too many deletion attempts. Wait before retrying.', requestId },
      { status: 429, headers },
    );
  }

  const submittedEmail = normalizeEmail(sanitizeString(body.email, 254));
  const accountEmail = normalizeEmail(user.email ?? '');
  const subject = sanitizeHeaderValue(sanitizeString(body.subject, MAX_SUBJECT_LENGTH));
  const message = sanitizeString(body.message, MAX_MESSAGE_LENGTH);

  if (!isValidEmail(submittedEmail) || !accountEmail || submittedEmail !== accountEmail) {
    return NextResponse.json(
      {
        error: 'Please enter the email associated with your Lodario account or check the email for spelling errors.',
        code: 'account_email_mismatch',
        requestId,
      },
      { status: 400, headers },
    );
  }
  if (!subject) {
    return NextResponse.json({ error: 'A deletion request subject is required.', requestId }, { status: 400, headers });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const profileRole = profile && ['player', 'coach', 'guardian'].includes(profile.role) ? profile.role : '';
  const metadataRole = ['player', 'coach', 'guardian'].includes(user.user_metadata?.role)
    ? user.user_metadata.role
    : '';
  const accountRole = profileRole || metadataRole;

  let emailConfig;
  try {
    emailConfig = getAccountDeletionEmailServerConfig();
  } catch (error) {
    return NextResponse.json(
      { error: getSafeConfigurationMessage(error, 'Deletion request email is unavailable.'), requestId },
      { status: 500, headers },
    );
  }

  const emailText = buildDeletionRequestText({ accountEmail, accountRole, subject, message, requestId });
  try {
    await deliverFeedbackEmail({
      createTransport: nodemailer.createTransport,
      config: emailConfig,
      message: {
        replyTo: accountEmail,
        subject: `Lodario deletion request: ${subject}`,
        text: emailText,
        html: `<pre style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: pre-wrap; line-height: 1.5;">${escapeHtml(emailText)}</pre>`,
      },
    });
  } catch {
    safeServerError('account_deletion_failed', requestId, 502);
    await supabase.rpc('public_beta_record_my_operational_event', {
      p_event_type: 'deletion_failed',
      p_request_id: requestId,
    });
    return NextResponse.json(
      { error: 'The deletion request could not be sent, so your account was not deleted. Please try again later.', requestId },
      { status: 502, headers },
    );
  }

  const { data, error } = await supabase.rpc('public_beta_delete_my_account', {
    p_confirmation: body.confirmation,
    p_request_id: requestId,
  });
  if (error || !data || typeof data !== 'object' || Array.isArray(data) || data.deleted !== true) {
    safeServerError('account_deletion_failed', requestId, 409);
    await supabase.rpc('public_beta_record_my_operational_event', {
      p_event_type: 'deletion_failed',
      p_request_id: requestId,
    });
    const ownershipBlocked = error?.message?.includes('Transfer or close teams');
    const recentAuthRequired = error?.message?.includes('Recent authentication');
    const message = ownershipBlocked
      ? 'Transfer or close every team containing another member before deleting your Coach account.'
      : recentAuthRequired
        ? 'For security, sign out, sign in again, and repeat the deletion request within 15 minutes.'
        : 'Account deletion could not be confirmed. Do not retry until you sign in again or contact support with the request ID.';
    return NextResponse.json({ error: message, requestId }, { status: 409, headers });
  }

  return NextResponse.json({ deleted: true, requestId }, { status: 200, headers });
}
