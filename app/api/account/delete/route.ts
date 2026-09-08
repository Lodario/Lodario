import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getSafeConfigurationMessage, getSupabaseServerConfig } from '@/lib/env/server';
import { createRequestId, safeServerError } from '@/lib/server/request';

export const runtime = 'nodejs';

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;

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

  let body: { confirmation?: unknown };
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
