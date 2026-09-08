import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { calculatePlayerReadinessForDate } from '@/lib/readiness';
import { generateRecommendation } from '@/lib/recommendations';
import type {
  CalendarEvent,
  InjuryRecord,
  TrainingLog,
  UserProfile,
  WellnessLog,
} from '@/lib/types';
import { getSafeConfigurationMessage, getSupabaseServerConfig } from '@/lib/env/server';
import { createRequestId, safeServerError } from '@/lib/server/request';

export const runtime = 'nodejs';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 3;
const requestWindows = new Map<string, { count: number; resetAt: number }>();

function getClientKey(request: NextRequest, userId: string): string {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return `${userId}:${forwardedFor || 'unknown'}`;
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const current = requestWindows.get(key);
  if (!current || current.resetAt <= now) {
    requestWindows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > MAX_REQUESTS;
}

function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

function toWellnessLog(row: Record<string, unknown>): WellnessLog {
  return {
    date: String(row.date),
    sleepTime: String(row.sleep_time ?? ''),
    wakeTime: String(row.wake_time ?? ''),
    sleepDuration: Number(row.sleep_duration ?? 0),
    sleepQuality: Number(row.sleep_quality ?? 0),
    energy: Number(row.energy ?? 0),
    fatigue: Number(row.fatigue ?? 0),
    stress: Number(row.stress ?? 0),
    painActive: row.pain_active === true,
    painLevel: row.pain_level == null ? undefined : Number(row.pain_level),
    painNotes: typeof row.pain_notes === 'string' ? row.pain_notes : undefined,
    isInjury: row.is_injury === true,
    notes: typeof row.notes === 'string' ? row.notes : undefined,
  };
}

function toTrainingLog(row: Record<string, unknown>): TrainingLog {
  return {
    id: String(row.id),
    date: String(row.date),
    sessionType: String(row.session_type) as TrainingLog['sessionType'],
    duration: Number(row.duration ?? 0),
    distance: row.distance == null ? undefined : Number(row.distance),
    intensity: Number(row.intensity ?? 0),
    sprinting: String(row.sprinting ?? 'no') as TrainingLog['sprinting'],
    performance: row.performance == null ? undefined : Number(row.performance),
    painActive: row.pain_active === true,
    painLevel: row.pain_level == null ? undefined : Number(row.pain_level),
    painNotes: typeof row.pain_notes === 'string' ? row.pain_notes : undefined,
    isInjury: row.is_injury === true,
    notes: typeof row.notes === 'string' ? row.notes : undefined,
  };
}

function addCurrentRecommendation(payload: Record<string, unknown>): Record<string, unknown> {
  if ((payload.account as { role?: unknown } | undefined)?.role !== 'player') return payload;

  try {
    const wellnessRows = Array.isArray(payload.wellnessLogs) ? payload.wellnessLogs : [];
    const trainingRows = Array.isArray(payload.trainingLogs) ? payload.trainingLogs : [];
    const injuryRows = Array.isArray(payload.injuries) ? payload.injuries : [];
    const eventRows = Array.isArray(payload.calendarEvents) ? payload.calendarEvents : [];
    const profileRow = payload.profile && typeof payload.profile === 'object'
      ? payload.profile as Record<string, unknown>
      : null;

    const wellnessLogs = wellnessRows.map((row) => toWellnessLog(row as Record<string, unknown>));
    const trainingLogs = trainingRows.map((row) => toTrainingLog(row as Record<string, unknown>));
    const injuries: InjuryRecord[] = injuryRows.map((row) => {
      const value = row as Record<string, unknown>;
      return {
        id: String(value.id),
        description: String(value.description ?? ''),
        doctorNotes: typeof value.doctor_notes === 'string' ? value.doctor_notes : undefined,
        expectedReturn: typeof value.expected_return === 'string' ? value.expected_return : undefined,
        status: String(value.status) as InjuryRecord['status'],
        createdAt: String(value.created_at),
        autoTracked: value.auto_tracked === true,
      };
    });
    const profile: UserProfile | null = profileRow ? {
      age: Number(profileRow.age ?? 18),
      dateOfBirth: typeof profileRow.date_of_birth === 'string' ? profileRow.date_of_birth : undefined,
      role: 'player',
      displayName: typeof profileRow.display_name === 'string' ? profileRow.display_name : undefined,
      positions: Array.isArray(profileRow.positions) ? profileRow.positions as UserProfile['positions'] : [],
      priorities: Array.isArray(profileRow.priorities) ? profileRow.priorities as UserProfile['priorities'] : [],
    } : null;
    const calendarEvents: CalendarEvent[] = eventRows.map((row) => {
      const value = row as Record<string, unknown>;
      return {
        id: String(value.id),
        eventTypeId: String(value.event_type_id),
        title: typeof value.title === 'string' ? value.title : undefined,
        start: String(value.start_time),
        end: String(value.end_time),
        recurrence: String(value.recurrence ?? 'none') as CalendarEvent['recurrence'],
        anticipatedIntensity: value.anticipated_intensity as CalendarEvent['anticipatedIntensity'],
      };
    });
    const asOf = new Date();
    const readinessLoad = calculatePlayerReadinessForDate(wellnessLogs, trainingLogs, asOf);
    const dateKey = asOf.toISOString().slice(0, 10);
    const recommendation = generateRecommendation(
      readinessLoad.readiness,
      readinessLoad.load,
      injuries.filter((injury) => injury.status !== 'resolved'),
      profile,
      calendarEvents.filter((event) => event.start.startsWith(dateKey)),
      {
        todayWellness: wellnessLogs.find((log) => log.date === dateKey),
        recentTrainingLogs: trainingLogs,
      },
    );

    return {
      ...payload,
      recommendations: {
        stored: false,
        generatedAt: asOf.toISOString(),
        current: recommendation,
        explanation: 'Calculated during export with Lodario’s existing readiness, load, injury, and recommendation functions.',
      },
    };
  } catch {
    return {
      ...payload,
      recommendations: {
        stored: false,
        current: null,
        explanation: 'Recommendations are not stored independently. Source records are included, but the current recommendation could not be regenerated.',
      },
    };
  }
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  const responseHeaders = { 'X-Request-ID': requestId, 'Cache-Control': 'no-store' };

  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.', requestId }, { status: 403, headers: responseHeaders });
  }

  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Authentication required.', requestId }, { status: 401, headers: responseHeaders });
  }

  let config;
  try {
    config = getSupabaseServerConfig();
  } catch (error) {
    return NextResponse.json(
      { error: getSafeConfigurationMessage(error), requestId },
      { status: 500, headers: responseHeaders },
    );
  }

  const supabase = createClient(config.url, config.anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Authentication required.', requestId }, { status: 401, headers: responseHeaders });
  }

  if (isRateLimited(getClientKey(request, user.id))) {
    return NextResponse.json(
      { error: 'Too many export requests. Please wait and try again.', requestId },
      { status: 429, headers: responseHeaders },
    );
  }

  const { data, error } = await supabase.rpc('public_beta_export_my_data', {
    p_request_id: requestId,
  });
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
    safeServerError('account_export_failed', requestId, 500);
    await supabase.rpc('public_beta_record_my_operational_event', {
      p_event_type: 'export_failed',
      p_request_id: requestId,
    });
    return NextResponse.json(
      { error: 'Your export could not be generated. Please retry later or contact support.', requestId },
      { status: 500, headers: responseHeaders },
    );
  }

  const exportPayload = addCurrentRecommendation(data as Record<string, unknown>);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    status: 200,
    headers: {
      ...responseHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="lodario-data-export-${timestamp}.json"`,
    },
  });
}
