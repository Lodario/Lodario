import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const DEFAULT_FEEDBACK_TO = 'contact.lodario@gmail.com';
const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 4000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;

export const runtime = 'nodejs';

type FeedbackPayload = {
  userEmail?: unknown;
  loggedInUserEmail?: unknown;
  userRole?: unknown;
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

function sanitizeString(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
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

  return Object.entries(value as Record<string, unknown>)
    .map(([key, entry]) => `${key}: ${typeof entry === 'string' ? entry : JSON.stringify(entry)}`)
    .join('\n');
}

function buildEmailText(params: {
  enteredUserEmail: string;
  loggedInUserEmail: string;
  userRole: string;
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
  const smtpUser = process.env.GMAIL_SMTP_USER;
  const smtpAppPassword = process.env.GMAIL_SMTP_APP_PASSWORD;
  const to = process.env.FEEDBACK_EMAIL_TO || DEFAULT_FEEDBACK_TO;
  const from = process.env.EMAIL_FROM;

  if (!smtpUser || !smtpAppPassword || !from) {
    return NextResponse.json(
      { error: 'Feedback email is not configured.' },
      { status: 500 }
    );
  }

  const origin = request.headers.get('origin');
  if (origin) {
    const requestOrigin = new URL(request.url).origin;
    if (origin !== requestOrigin) {
      return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
    }
  }

  const clientKey = getClientKey(request);
  if (isRateLimited(clientKey)) {
    return NextResponse.json(
      { error: 'Too many feedback attempts. Please try again later.' },
      { status: 429 }
    );
  }

  let payload: FeedbackPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (typeof payload.website === 'string' && payload.website.trim()) {
    return NextResponse.json({ error: 'Unable to send feedback.' }, { status: 400 });
  }

  const title = sanitizeString(payload.title, MAX_TITLE_LENGTH);
  const description = sanitizeString(payload.description, MAX_DESCRIPTION_LENGTH);
  const enteredUserEmail = sanitizeString(payload.userEmail, 254);
  const loggedInUserEmail = sanitizeString(payload.loggedInUserEmail, 254);
  const userRole = sanitizeString(payload.userRole, 40);
  const pagePath = sanitizeString(payload.pagePath, 200);
  const context = sanitizeString(payload.context, 200);
  const timestamp = sanitizeString(payload.timestamp, 80) || new Date().toISOString();
  const appContext = formatAppContext(payload.appContext);

  if (!title || !description) {
    return NextResponse.json(
      { error: 'Feedback title and description are required.' },
      { status: 400 }
    );
  }

  const text = buildEmailText({
    enteredUserEmail,
    loggedInUserEmail,
    userRole,
    title,
    description,
    pagePath,
    context,
    timestamp,
    appContext,
  });

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: smtpUser,
      pass: smtpAppPassword,
    },
  });

  const replyTo = enteredUserEmail || loggedInUserEmail || undefined;

  try {
    await transporter.sendMail({
      from,
      to,
      replyTo,
      subject: `Lodario Beta Feedback: ${title}`,
      text,
      html: buildEmailHtml(text),
    });
  } catch (error) {
    console.error('[feedback] Gmail SMTP email failed:', error);
    return NextResponse.json(
      { error: 'Unable to send feedback right now.' },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
