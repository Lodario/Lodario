import { supabase } from '@/lib/supabase';
import {
  PUBLIC_BETA_FEATURES,
  PUBLIC_BETA_UNAVAILABLE_MESSAGE,
} from '@/lib/betaScope.mjs';
import type {
  GuardianEvent,
  GuardianBillingSummary,
  GuardianLinkedPlayer,
  GuardianNotificationPreferences,
  GuardianPermission,
  GuardianPlayerProfileSummary,
  GuardianPlayerOverview,
  GuardianProfileRow,
  GuardianUpdate,
} from './types';

export interface GuardianResult<T> { data: T; error: string | null }

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to load Guardian information.';
}

export async function loadLinkedPlayers(): Promise<GuardianResult<GuardianLinkedPlayer[]>> {
  if (!PUBLIC_BETA_FEATURES.guardianAndMinorAccounts) {
    return { data: [], error: PUBLIC_BETA_UNAVAILABLE_MESSAGE };
  }

  const { data, error } = await supabase.rpc('guardian_get_linked_players');
  return { data: (data ?? []) as GuardianLinkedPlayer[], error: error?.message ?? null };
}

export async function loadPlayerOverview(playerId: string): Promise<GuardianResult<GuardianPlayerOverview | null>> {
  if (!PUBLIC_BETA_FEATURES.guardianAndMinorAccounts) {
    return { data: null, error: PUBLIC_BETA_UNAVAILABLE_MESSAGE };
  }

  const { data, error } = await supabase.rpc('guardian_get_player_overview', { p_player_id: playerId });
  return { data: (data as GuardianPlayerOverview | null) ?? null, error: error?.message ?? null };
}

export async function loadGuardianBillingSummary(playerId: string): Promise<GuardianResult<GuardianBillingSummary | null>> {
  if (
    !PUBLIC_BETA_FEATURES.guardianAndMinorAccounts
    || !PUBLIC_BETA_FEATURES.subscriptionsAndPayments
  ) {
    return { data: null, error: PUBLIC_BETA_UNAVAILABLE_MESSAGE };
  }

  const { data, error } = await supabase.rpc('guardian_get_billing_summary', { p_player_id: playerId });
  return { data: (data as GuardianBillingSummary | null) ?? null, error: error?.message ?? null };
}

export async function loadGuardianPlayerProfileSummary(playerId: string): Promise<GuardianResult<GuardianPlayerProfileSummary | null>> {
  if (!PUBLIC_BETA_FEATURES.guardianAndMinorAccounts) {
    return { data: null, error: PUBLIC_BETA_UNAVAILABLE_MESSAGE };
  }

  const { data, error } = await supabase.rpc('guardian_get_player_profile_summary', { p_player_id: playerId });
  return { data: (data as GuardianPlayerProfileSummary | null) ?? null, error: error?.message ?? null };
}

export async function loadGuardianEvents(from: string, to: string, playerId?: string): Promise<GuardianResult<GuardianEvent[]>> {
  if (!PUBLIC_BETA_FEATURES.guardianAndMinorAccounts) {
    return { data: [], error: PUBLIC_BETA_UNAVAILABLE_MESSAGE };
  }

  const { data, error } = await supabase.rpc('guardian_get_events', {
    p_from: from,
    p_to: to,
    p_player_id: playerId ?? null,
  });
  return { data: (data ?? []) as GuardianEvent[], error: error?.message ?? null };
}

export async function loadGuardianPermissions(): Promise<GuardianResult<GuardianPermission[]>> {
  if (!PUBLIC_BETA_FEATURES.guardianAndMinorAccounts) {
    return { data: [], error: PUBLIC_BETA_UNAVAILABLE_MESSAGE };
  }

  const { data, error } = await supabase.rpc('guardian_get_permissions');
  return { data: (data ?? []) as GuardianPermission[], error: error?.message ?? null };
}

export async function loadGuardianUpdates(): Promise<GuardianResult<GuardianUpdate[]>> {
  if (!PUBLIC_BETA_FEATURES.guardianAndMinorAccounts) {
    return { data: [], error: PUBLIC_BETA_UNAVAILABLE_MESSAGE };
  }

  const { data, error } = await supabase
    .from('guardian_updates')
    .select('id, update_type, title, message, related_player_id, related_team_id, related_event_id, importance, is_read, read_at, acknowledgement_required, acknowledged_at, created_at')
    .order('created_at', { ascending: false });
  return { data: (data ?? []) as GuardianUpdate[], error: error?.message ?? null };
}

export async function markGuardianUpdateRead(updateId: string): Promise<string | null> {
  if (!PUBLIC_BETA_FEATURES.guardianAndMinorAccounts) {
    return PUBLIC_BETA_UNAVAILABLE_MESSAGE;
  }

  const { error } = await supabase.rpc('guardian_mark_update_read', { p_update_id: updateId });
  return error?.message ?? null;
}

export async function acknowledgeGuardianUpdate(updateId: string): Promise<string | null> {
  if (!PUBLIC_BETA_FEATURES.guardianAndMinorAccounts) {
    return PUBLIC_BETA_UNAVAILABLE_MESSAGE;
  }

  const { error } = await supabase.rpc('guardian_acknowledge_update', { p_update_id: updateId });
  return error?.message ?? null;
}

export async function loadGuardianProfile(userId: string): Promise<GuardianResult<GuardianProfileRow | null>> {
  if (!PUBLIC_BETA_FEATURES.guardianAndMinorAccounts) {
    return { data: null, error: PUBLIC_BETA_UNAVAILABLE_MESSAGE };
  }

  const { data, error } = await supabase.from('guardian_profiles').select('*').eq('user_id', userId).maybeSingle();
  return { data: (data as GuardianProfileRow | null) ?? null, error: error?.message ?? null };
}

export async function saveGuardianProfile(
  userId: string,
  values: Pick<GuardianProfileRow, 'display_name' | 'phone_number' | 'preferred_language' | 'time_zone'>,
): Promise<string | null> {
  if (!PUBLIC_BETA_FEATURES.guardianAndMinorAccounts) {
    return PUBLIC_BETA_UNAVAILABLE_MESSAGE;
  }

  const { error } = await supabase.from('guardian_profiles').upsert({ user_id: userId, ...values }, { onConflict: 'user_id' });
  return error?.message ?? null;
}

export async function loadNotificationPreferences(userId: string): Promise<GuardianResult<GuardianNotificationPreferences | null>> {
  if (!PUBLIC_BETA_FEATURES.guardianAndMinorAccounts) {
    return { data: null, error: PUBLIC_BETA_UNAVAILABLE_MESSAGE };
  }

  const { data, error } = await supabase.from('guardian_notification_preferences').select('guardian_user_id, in_app, email, push').eq('guardian_user_id', userId).maybeSingle();
  return { data: (data as GuardianNotificationPreferences | null) ?? null, error: error?.message ?? null };
}

export async function saveNotificationPreferences(preferences: GuardianNotificationPreferences): Promise<string | null> {
  if (!PUBLIC_BETA_FEATURES.guardianAndMinorAccounts) {
    return PUBLIC_BETA_UNAVAILABLE_MESSAGE;
  }

  try {
    const { error } = await supabase.from('guardian_notification_preferences').upsert(preferences, { onConflict: 'guardian_user_id' });
    return error?.message ?? null;
  } catch (error) {
    return message(error);
  }
}
