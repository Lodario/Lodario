import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const rootUrl = new URL('../', import.meta.url);
const migrationUrl = new URL('../supabase/migrations/20260723210000_public_beta_18_plus_gate.sql', import.meta.url);

function parseIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('invalid DOB');
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new Error('invalid DOB');
  }
  return { year, month, day, date };
}

function completedAge(dateOfBirth, asOf) {
  if (!dateOfBirth) return null;
  const birth = parseIsoDate(dateOfBirth);
  const current = parseIsoDate(asOf);
  if (birth.date > current.date) throw new Error('future DOB');
  let age = current.year - birth.year;
  if (current.month < birth.month || (current.month === birth.month && current.day < birth.day)) {
    age -= 1;
  }
  if (age < 0 || age > 99) throw new Error('impossible DOB');
  return age;
}

test('age boundaries use completed years and the exact eighteenth birthday', () => {
  assert.equal(completedAge('2008-07-23', '2026-07-23'), 18, 'turns 18 today');
  assert.equal(completedAge('2008-07-24', '2026-07-23'), 17, 'turns 18 tomorrow');
  assert.equal(completedAge('1988-04-12', '2026-07-23'), 38, 'already over 18');
  assert.equal(completedAge('2012-04-12', '2026-07-23'), 14, 'under 18');
});

test('leap-day, missing, invalid, impossible, and future DOB cases are explicit', () => {
  assert.equal(completedAge('2008-02-29', '2026-07-23'), 18);
  assert.equal(completedAge('2010-02-01', '2026-07-23'), 16);
  assert.equal(completedAge(null, '2026-07-23'), null);
  assert.throws(() => completedAge('2026-02-30', '2026-07-23'), /invalid/);
  assert.throws(() => completedAge('1900-01-01', '2026-07-23'), /impossible/);
  assert.throws(() => completedAge('2027-01-01', '2026-07-23'), /future/);
});

test('database gate trusts stored DOB only and exposes narrow self-service RPCs', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.public_beta_get_my_age_status\(\)/);
  assert.match(
    sql,
    /CREATE OR REPLACE FUNCTION public\.public_beta_get_my_age_status\(\)[\s\S]*?RETURNS JSONB[\s\S]*?STABLE[\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path = public/,
  );
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION public\.public_beta_get_my_age_status\(\) FROM PUBLIC, anon, authenticated/,
  );
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION public\.public_beta_get_my_age_status\(\) TO authenticated/,
  );
  assert.doesNotMatch(
    sql,
    /GRANT EXECUTE ON FUNCTION public\.public_beta_get_my_age_status\(\) TO (?:PUBLIC|anon)/,
  );
  assert.match(sql, /NOTIFY pgrst, 'reload schema'/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.public_beta_set_my_date_of_birth\(p_date_of_birth DATE\)/);
  assert.match(sql, /public\.calculate_player_age\(stored_date_of_birth, current_date\)/);
  assert.match(sql, /completed_age >= 18/);
  assert.match(sql, /SECURITY DEFINER/);
  assert.doesNotMatch(sql, /p_is_adult|p_age INTEGER|localStorage/i);
  assert.match(sql, /date_of_birth IS DISTINCT FROM p_date_of_birth/);
  assert.match(sql, /Contact Lodario support to request a correction/);
});

test('direct Supabase writes and privileged team/attendance paths fail closed', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  for (const table of [
    'wellness_logs',
    'training_logs',
    'calendar_events',
    'custom_event_types',
    'injuries',
    'teams',
    'team_memberships',
    'event_attendance',
    'calendar_event_attendance',
    'player_calendar_event_color_overrides',
  ]) {
    assert.match(sql, new RegExp(`'${table}'`), table);
  }
  assert.match(sql, /AS RESTRICTIVE FOR ALL TO authenticated/);
  assert.match(sql, /CREATE TRIGGER enforce_public_beta_adult_write/);
  assert.match(
    sql,
    /current_setting\('lodario\.public_beta_self_delete_user_id', TRUE\) = auth\.uid\(\)::TEXT/,
  );
  assert.match(sql, /public\.public_beta_current_user_is_adult\(\)/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.can_manage_team/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.is_active_team_player/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.get_coach_calendar_event_scope/);
});

test('player and coach routes are gated before onboarding or data providers', async () => {
  const shell = await readFile(new URL('components/RootAppShell.tsx', rootUrl), 'utf8');
  const gate = await readFile(new URL('components/PublicBetaAgeGate.tsx', rootUrl), 'utf8');
  assert.match(shell, /<AuthGate requiredRole="coach">[\s\S]*?<PublicBetaAgeGate>/);
  assert.match(shell, /<AuthGate requiredRole="player">[\s\S]*?<PublicBetaAgeGate>[\s\S]*?<DataProvider>/);
  assert.match(gate, /getPublicBetaAgeStatus\(\)/);
  assert.match(gate, /confirmPublicBetaDateOfBirth\(dateOfBirth\)/);
  assert.match(gate, /only available to people aged 18 or older/);
});

test('feedback API authenticates and verifies stored age instead of trusting payload fields', async () => {
  const route = await readFile(new URL('app/api/feedback/route.ts', rootUrl), 'utf8');
  const modal = await readFile(new URL('components/FeedbackModal.tsx', rootUrl), 'utf8');
  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /supabase\.rpc\('public_beta_get_my_age_status'\)/);
  assert.match(route, /ageStatus\.eligible !== true/);
  assert.match(modal, /Authorization: `Bearer \$\{session\.access_token\}`/);
});

test('guardian and country-minor systems remain stored but disabled for beta users', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  assert.match(sql, /UPDATE public\.guardian_feature_flags[\s\S]*?SET enabled = FALSE/);
  assert.match(sql, /'public_beta_18_plus_enabled',[\s\S]*?TRUE/);
  assert.match(sql, /proc\.proname LIKE 'guardian_%'/);
  assert.match(sql, /'evaluate_player_age_policy'/);
  assert.match(sql, /REVOKE ALL PRIVILEGES ON TABLE public\./);
  assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE|DELETE FROM public\.guardian/i);
});

test('production-only AI, rewarded-ad, and test surfaces retain data but lose beta-user access', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  for (const table of [
    'ai_conversations',
    'ai_entitlements',
    'ai_free_message_credits',
    'ai_messages',
    'ai_rewarded_ad_grants',
    'ai_usage',
    'ai_usage_reservations',
    'test',
  ]) {
    assert.match(sql, new RegExp(`'${table}'`), table);
  }
  for (const functionName of [
    'complete_player_ai_message_reservation',
    'consume_player_ai_free_message',
    'reserve_player_ai_message',
  ]) {
    assert.match(sql, new RegExp(`'${functionName}'`), functionName);
  }
  assert.match(
    sql,
    /REVOKE ALL PRIVILEGES ON TABLE public\.%I FROM PUBLIC, anon, authenticated/,
  );
  assert.match(
    sql,
    /REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated/,
  );
  assert.match(sql, /GRANT ALL PRIVILEGES ON TABLE public\.%I TO service_role/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION %s TO service_role/);
  assert.doesNotMatch(sql, /DROP TABLE public\.ai_|DELETE FROM public\.ai_/i);
});
