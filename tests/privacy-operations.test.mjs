import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rootUrl = new URL('../', import.meta.url);
const source = (path) => readFile(new URL(path, rootUrl), 'utf8');

const migrationPath = 'supabase/migrations/20260723230000_beta_privacy_operations.sql';

test('required consent versions are exact, current, server-recorded, and immutable', async () => {
  const [migration, legal, gate, privacy, terms, health] = await Promise.all([
    Promise.all([source(migrationPath), source('supabase/migrations/20260914120000_country_beta_access.sql')]).then(parts => parts.join('\n')),
    source('lib/legal.ts'),
    source('components/RequiredConsentGate.tsx'),
    source('app/privacy/page.tsx'),
    source('app/terms/page.tsx'),
    source('app/health-disclaimer/page.tsx'),
  ]);

  const versions = [
    'terms-2026-09-14-v1.1',
    'privacy-2026-09-14-v1.1',
    'health-data-2026-09-14-v1.1',
    'coach-sharing-2026-09-14-v1.1',
  ];
  for (const version of versions) {
    assert.match(migration, new RegExp(version.replaceAll('.', '\\.')));
    assert.match(legal, new RegExp(version.replaceAll('.', '\\.')));
  }

  assert.match(migration, /accepted_at TIMESTAMPTZ NOT NULL DEFAULT now\(\)/);
  assert.match(migration, /UNIQUE \(user_id, document_type, document_version\)/);
  assert.match(migration, /prevent_consent_acceptance_update/);
  assert.match(migration, /Consent acceptance records are immutable/);
  assert.match(migration, /auth\.uid\(\) = user_id/);
  assert.match(migration, /REVOKE ALL ON public\.user_consent_acceptances FROM anon, authenticated/);
  assert.doesNotMatch(migration, /marketing_consent|optional_marketing/);

  assert.match(gate, /type="checkbox"/);
  assert.doesNotMatch(gate, /defaultChecked|checked=\{true\}/);
  assert.match(gate, /Decline for now/);
  assert.match(gate, /AccountPrivacyActions/);
  assert.match(gate, /public_beta_get_my_consent_status/);
  assert.match(gate, /public_beta_accept_required_consents/);
  assert.match(gate, /Object\.fromEntries/);

  assert.match(privacy, /privacyVersion/);
  assert.match(privacy, /healthDataVersion/);
  assert.match(privacy, /coachSharingVersion/);
  assert.match(terms, /termsVersion/);
  assert.match(health, /healthDataVersion/);
});

test('consent blocks core data providers until every current document is accepted', async () => {
  const [shell, migration] = await Promise.all([
    source('components/RootAppShell.tsx'),
    source(migrationPath),
  ]);

  assert.match(shell, /<PublicBetaAgeGate>[\s\S]*?<RequiredConsentGate>[\s\S]*?<DataProvider>/);
  assert.match(shell, /requiredRole="coach"[\s\S]*?<PublicBetaAgeGate>[\s\S]*?<RequiredConsentGate>/);
  assert.match(
    migration,
    /\(SELECT count\(\*\) FROM jsonb_object_keys\(p_acceptances\)\) <> required_count/,
  );
  assert.match(migration, /p_acceptances ->> required_document\.document_type IS DISTINCT FROM required_document\.document_version/);
  assert.match(migration, /ON CONFLICT \(user_id, document_type, document_version\) DO NOTHING/);
});

test('data export is authenticated, owner-scoped, rate-limited, and excludes unrelated Coach health data', async () => {
  const [migration, route, actions] = await Promise.all([
    source(migrationPath),
    source('app/api/account/export/route.ts'),
    source('components/AccountPrivacyActions.tsx'),
  ]);

  assert.match(route, /authorization\?\.startsWith\('Bearer '\)/);
  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /isSameOrigin/);
  assert.match(route, /isRateLimited/);
  assert.match(route, /public_beta_export_my_data/);
  assert.doesNotMatch(route, /p_user_id|targetUserId|service.role|service_role/i);
  assert.match(route, /Content-Disposition/);
  assert.match(route, /lodario-data-export-/);
  assert.match(route, /calculatePlayerReadinessForDate/);
  assert.match(route, /generateRecommendation/);

  assert.match(migration, /active_user UUID := auth\.uid\(\)/);
  assert.match(migration, /'wellnessLogs', CASE WHEN active_role = 'player'/);
  assert.match(migration, /'trainingLogs', CASE WHEN active_role = 'player'/);
  assert.match(migration, /'injuries', CASE WHEN active_role = 'player'/);
  assert.match(migration, /'coachOwnedTeams', CASE WHEN active_role = 'coach'/);
  assert.match(migration, /'consentHistory'/);
  assert.match(migration, /'rsvpAndAttendance'/);
  assert.doesNotMatch(migration, /SELECT jsonb_agg\(to_jsonb\(attendance_row\)[\s\S]{0,120}FROM public\.calendar_event_attendance attendance_row/);
  assert.doesNotMatch(migration, /attendance_recorded_by/);
  assert.match(migration, /event\.event_type = 'export_completed'/);
  assert.doesNotMatch(migration, /password_hash|encrypted_password|refresh_token/);
  assert.match(actions, /Download my data/);
});

test('account deletion cannot target another user and protects teams and Player-owned data', async () => {
  const [migration, route, actions] = await Promise.all([
    source(migrationPath),
    source('app/api/account/delete/route.ts'),
    source('components/AccountPrivacyActions.tsx'),
  ]);

  assert.match(migration, /p_confirmation TEXT,\s*p_request_id UUID/);
  assert.doesNotMatch(migration, /public_beta_delete_my_account\(\s*p_user_id|p_target_user/i);
  assert.match(migration, /p_confirmation IS DISTINCT FROM 'DELETE MY LODARIO ACCOUNT'/);
  assert.match(migration, /issued_at < now\(\) - INTERVAL '15 minutes'/);
  assert.match(migration, /membership\.user_id <> active_user/);
  assert.match(migration, /membership\.status <> 'removed'/);
  assert.match(migration, /Transfer or close teams containing other members/);
  assert.match(
    migration,
    /set_config\('lodario\.public_beta_self_delete_user_id', active_user::TEXT, TRUE\)/,
  );
  assert.match(migration, /DELETE FROM auth\.users WHERE id = active_user/);
  assert.match(migration, /DELETE FROM public\.guardian_consent_history/);
  assert.match(migration, /DELETE FROM public\.guardian_audit_events/);
  assert.match(migration, /BEGIN;[\s\S]*COMMIT;/);

  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.doesNotMatch(route, /targetId|targetUser|p_user_id|service.role|service_role/i);
  assert.match(route, /let body: \{ confirmation\?: unknown \}/);
  assert.match(route, /public_beta_delete_my_account/);
  assert.match(route, /isRateLimited/);
  assert.match(actions, /DELETE MY LODARIO ACCOUNT/);
  assert.match(actions, /signed in within the last 15 minutes/);
  assert.match(actions, /Player-owned health logs are never deleted with a Coach account/);
});

test('privacy operations retain only minimal allowlisted measurement data', async () => {
  const [migration, metrics] = await Promise.all([
    source(migrationPath),
    source('supabase/beta_metrics_report.sql'),
  ]);

  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.beta_operational_events/);
  assert.match(migration, /event_type TEXT NOT NULL CHECK/);
  assert.doesNotMatch(migration, /beta_operational_events[\s\S]{0,500}(notes|email|description|properties) (TEXT|JSONB)/i);
  assert.match(migration, /ALTER TABLE public\.beta_operational_events ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON public\.beta_operational_events FROM anon, authenticated/);
  assert.match(metrics, /returns counts only/i);
  assert.doesNotMatch(metrics, /SELECT\s+(email|date_of_birth|pain_notes|notes)\b/i);
});
