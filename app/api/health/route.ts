import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getSupabaseServerConfig } from '@/lib/env/server';
import { createRequestId, safeServerError } from '@/lib/server/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const requestId = createRequestId();
  const checkedAt = new Date().toISOString();

  try {
    const config = getSupabaseServerConfig();
    const supabase = createClient(config.url, config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const healthCheck = supabase
      .from('beta_waitlist')
      .select('id', { head: true })
      .limit(1);
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('health timeout')), 3000);
    });
    const { error } = await Promise.race([healthCheck, timeout]);
    if (error) throw new Error('database unavailable');

    return NextResponse.json(
      { status: 'ok', checkedAt, requestId },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    safeServerError('health_check_failed', requestId, 503);
    return NextResponse.json(
      { status: 'degraded', checkedAt, requestId },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
