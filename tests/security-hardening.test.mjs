import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rootUrl = new URL('../', import.meta.url);
const source = (path) => readFile(new URL(path, rootUrl), 'utf8');

test('RLS contracts fail closed for consent, operational, core, and guardian resources', async () => {
  const [privacyMigration, ageMigration] = await Promise.all([
    source('supabase/migrations/20260723230000_beta_privacy_operations.sql'),
    source('supabase/migrations/20260723210000_public_beta_18_plus_gate.sql'),
  ]);

  for (const table of ['beta_required_documents', 'user_consent_acceptances', 'beta_operational_events']) {
    assert.match(privacyMigration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
  }
  assert.match(privacyMigration, /Users can read own consent history/);
  assert.match(privacyMigration, /auth\.uid\(\) = user_id/);
  assert.doesNotMatch(privacyMigration, /CREATE POLICY[\s\S]{0,160}beta_operational_events[\s\S]{0,160}TO (anon|authenticated)/);

  const adultTables = [
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
  ];
  for (const table of adultTables) {
    assert.match(ageMigration, new RegExp(`'${table}'`));
  }
  assert.match(ageMigration, /18\+ public beta access required/);
  assert.match(ageMigration, /REVOKE ALL PRIVILEGES ON TABLE public\.\%I FROM anon, authenticated/);
});

test('direct API bypass does not allow Guardian, cross-owner export, or cross-owner deletion', async () => {
  const [scope, middleware, guardianApi, exportApi, deletionApi] = await Promise.all([
    source('lib/betaScope.mjs'),
    source('middleware.ts'),
    source('app/api/guardian/invitations/route.ts'),
    source('app/api/account/export/route.ts'),
    source('app/api/account/delete/route.ts'),
  ]);

  assert.match(scope, /guardianAndMinorAccounts: true/);
  assert.match(middleware, /'api'[\s\S]*status: 404/);
  assert.match(guardianApi, /if \(!PUBLIC_BETA_FEATURES\.guardianAndMinorAccounts\)/);

  for (const route of [exportApi, deletionApi]) {
    assert.match(route, /authorization/);
    assert.match(route, /auth\.getUser/);
    assert.match(route, /Invalid request origin/);
    assert.doesNotMatch(route, /service[_-]?role/i);
  }
  assert.doesNotMatch(exportApi, /target(User|Account|Player)|p_user_id/i);
  assert.doesNotMatch(deletionApi, /target(User|Account|Player)|p_user_id/i);
});

test('feedback validates category, headers, email, origin, duplicates and sensitive-data warning', async () => {
  const [route, modal] = await Promise.all([
    source('app/api/feedback/route.ts'),
    source('components/FeedbackModal.tsx'),
  ]);

  assert.match(route, /FEEDBACK_CATEGORIES/);
  assert.match(route, /sanitizeHeaderValue/);
  assert.match(route, /isValidEmail/);
  assert.match(route, /isRateLimited/);
  assert.match(route, /recentSubmissionDigests/);
  assert.match(route, /createHash\('sha256'\)/);
  assert.match(route, /Invalid request origin/);
  assert.match(route, /public_beta_record_my_operational_event/);
  assert.doesNotMatch(route, /console\.error\([^)]*(error|payload|description|email)/i);

  assert.match(modal, /Bug or broken feature/);
  assert.match(modal, /Privacy, export or deletion/);
  assert.match(modal, /Never submit passwords, access tokens, payment details, or highly sensitive medical information/);
  assert.doesNotMatch(modal, /attachments?/i);
});

test('health and error handling expose correlation only, not private configuration or stack traces', async () => {
  const [health, errorBoundary, globalBoundary, safeLogger] = await Promise.all([
    source('app/api/health/route.ts'),
    source('app/error.tsx'),
    source('app/global-error.tsx'),
    source('lib/server/request.ts'),
  ]);

  assert.match(health, /status: 'ok'/);
  assert.match(health, /status: 'degraded'/);
  assert.match(health, /Cache-Control': 'no-store'/);
  assert.doesNotMatch(health, /process\.env|stack|error\.message/);
  assert.match(health, /\{ status: 'ok', checkedAt, requestId \}/);
  assert.match(health, /\{ status: 'degraded', checkedAt, requestId \}/);
  assert.doesNotMatch(errorBoundary, /\{error\.(message|stack)\}/);
  assert.doesNotMatch(globalBoundary, /\{error\.(message|stack)\}/);
  assert.match(safeLogger, /request_id=\$\{requestId\} status=\$\{status\}/);
});

test('client logs never serialize database errors or health-query identifiers', async () => {
  const files = [
    'lib/storage.ts',
    'lib/AuthContext.tsx',
    'lib/coach/teamInsights.ts',
    'lib/coach/selectedTeam.tsx',
    'components/coach/players/realData.ts',
  ];
  for (const file of files) {
    const content = await source(file);
    assert.doesNotMatch(content, /console\.(error|warn)\([^;]*(?:,\s*(?:error|[A-Za-z]+Error)|teamId|playerIds|userIds)/);
  }
});
