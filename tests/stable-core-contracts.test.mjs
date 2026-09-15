import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const rootUrl = new URL('../', import.meta.url);

async function source(relativePath) {
  return readFile(new URL(relativePath, rootUrl), 'utf8');
}

test('new registration, existing-account bootstrap, role selection, and password reset remain wired', async () => {
  const auth = await source('lib/AuthContext.tsx');
  const gate = await source('components/AuthGate.tsx');
  const roleRouting = await source('lib/roleRouting.mjs');

  assert.match(auth, /supabase\.auth\.signUp\(/);
  assert.match(auth, /supabase\.auth\.signInWithPassword\(/);
  assert.match(auth, /supabase\.auth\.getSession\(\)/);
  assert.match(auth, /supabase\.auth\.onAuthStateChange/);
  assert.match(auth, /\.from\('profiles'\)/);
  assert.match(auth, /\.from\('user_account_roles'\)/);
  assert.match(auth, /resetPasswordForEmail\(email,[\s\S]*?\/reset-password/);
  assert.match(gate, /handleSelectRole\('player'\)/);
  assert.match(gate, /handleSelectRole\('coach'\)/);
  assert.match(roleRouting, /if \(role === 'coach'\) return '\/coach\/dashboard'/);
  assert.match(roleRouting, /return '\/';/);
});

test('Player onboarding is gated and Coach entry uses the stable role-to-workspace flow', async () => {
  const rootShell = await source('components/RootAppShell.tsx');
  const onboardingGate = await source('components/OnboardingGate.tsx');
  const onboardingFlow = await source('components/OnboardingFlow.tsx');

  assert.match(rootShell, /<AuthGate requiredRole="coach">[\s\S]*?<PublicBetaAgeGate>/);
  assert.match(rootShell, /<AuthGate requiredRole="player">[\s\S]*?<PlayerAccessGate>[\s\S]*?<DataProvider>[\s\S]*?<OnboardingGate>/);
  assert.match(onboardingGate, /!profile\?\.onboardingCompleted/);
  assert.match(onboardingFlow, /normalizePlayerDisplayName/);
  assert.match(onboardingFlow, /onboarding-display-name/);
  assert.match(onboardingFlow, /onboarding-height/);
  assert.match(onboardingFlow, /onboarding-weight/);
  assert.match(onboardingFlow, /WeeklyAvailabilityGrid/);
  assert.match(onboardingFlow, /TrainingResourcePicker/);
  assert.match(onboardingFlow, /CalendarWeek/);
});

test('team creation, joining, and Coach-Player membership use persisted database paths', async () => {
  const selectedTeam = await source('lib/coach/selectedTeam.tsx');
  const membership = await source('lib/teamMembership.ts');
  const migration = await source('supabase/migrations/20260527113000_player_team_join_flow.sql');

  assert.match(selectedTeam, /\.from\('teams'\)[\s\S]*?\.insert\(/);
  assert.match(selectedTeam, /\.from\('team_memberships'\)\.upsert\(/);
  assert.match(membership, /\.rpc\('join_team_by_invite_code'/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.join_team_by_invite_code/);
  assert.match(migration, /role[\s\S]*?'player'/);
});

test('wellness, training, readiness, load, recommendation, injury, and pain contracts remain connected', async () => {
  const storage = await source('lib/storage.ts');
  const readiness = await source('lib/readiness.ts');
  const load = await source('lib/training-load.ts');
  const recommendations = await source('lib/recommendations.ts');
  const injuryStatus = await source('lib/injury-status.ts');
  const dataContext = await source('lib/DataContext.tsx');

  assert.match(storage, /\.from\('wellness_logs'\)/);
  assert.match(storage, /\.from\('training_logs'\)/);
  assert.match(storage, /\.from\('injuries'\)/);
  assert.match(dataContext, /StorageService\.getWellnessLogs\(\)/);
  assert.match(dataContext, /StorageService\.getTrainingLogs\(\)/);
  assert.match(dataContext, /StorageService\.getInjuries\(\)/);
  assert.match(readiness, /export function calculatePlayerReadinessForDate/);
  assert.match(load, /export function calculateSessionLoad/);
  assert.match(load, /export function analyzeTrainingLoad/);
  assert.match(recommendations, /export function generateRecommendation/);
  assert.match(recommendations, /Pain or injury was reported/);
  assert.match(injuryStatus, /export function shouldTreatPainAsInjury/);
  assert.match(injuryStatus, /export function isAutomaticInjuryPainLevel/);
});

test('calendar events, RSVP, attendance, and analytics use real Supabase-backed data', async () => {
  const storage = await source('lib/storage.ts');
  const attendance = await source('lib/calendar/attendance.ts');
  const playerAnalytics = await source('app/analytics/page.tsx');
  const charts = await source('components/Charts.tsx');
  const coachAnalytics = await source('components/coach/analytics/CoachAnalyticsPage.tsx');
  const playerData = await source('components/coach/players/realData.ts');

  assert.match(storage, /\.from\('calendar_events'\)/);
  assert.match(attendance, /\.rpc\('set_my_calendar_event_rsvp'/);
  assert.match(attendance, /\.rpc\('set_calendar_event_attendance'/);
  assert.match(attendance, /\.rpc\('get_calendar_event_attendance_roster'/);
  assert.match(playerData, /\.from\('calendar_event_attendance'\)/);
  assert.match(playerAnalytics, /ReadinessChart/);
  assert.match(playerAnalytics, /LoadChart/);
  assert.match(charts, /useData\(\)/);
  assert.match(charts, /calculatePlayerReadinessForDate/);
  assert.match(charts, /calculateSessionLoad/);
  assert.match(coachAnalytics, /useCoachSelectedTeamInsights/);
  assert.doesNotMatch(coachAnalytics, /mockData|placeholderData/);
});

test('Guardian direct access and under-18 core access fail closed at application and database boundaries', async () => {
  const scope = await source('lib/betaScope.mjs');
  const middleware = await source('middleware.ts');
  const migration = await source('supabase/migrations/20260723210000_public_beta_18_plus_gate.sql');
  const shell = await source('components/RootAppShell.tsx');

  assert.match(scope, /guardianAndMinorAccounts: true/);
  assert.match(scope, /PUBLIC_BETA_DISABLED_ROUTE_RULES = Object.freeze\(\[\]\)/);
  assert.match(shell, /<PlayerAccessGate>/);
  assert.match(middleware, /status: 404/);
  assert.match(middleware, /NextResponse\.redirect/);
  assert.match(shell, /<PublicBetaAgeGate>/);
  assert.match(migration, /AS RESTRICTIVE FOR ALL TO authenticated/);
  assert.match(migration, /CREATE TRIGGER enforce_public_beta_adult_write/);
  assert.match(migration, /REVOKE ALL PRIVILEGES ON TABLE public\./);
});

test('feedback is authenticated, age-checked, bounded, rate-limited, and delivered only server-side', async () => {
  const route = await source('app/api/feedback/route.ts');
  const modal = await source('components/FeedbackModal.tsx');
  const delivery = await source('lib/email/feedback-delivery.mjs');

  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /public_beta_get_my_access_status/);
  assert.match(route, /RATE_LIMIT_MAX_REQUESTS/);
  assert.match(route, /MAX_TITLE_LENGTH/);
  assert.match(route, /MAX_DESCRIPTION_LENGTH/);
  assert.match(route, /payload\.website/);
  assert.match(route, /deliverFeedbackEmail/);
  assert.match(modal, /Authorization: `Bearer \$\{session\.access_token\}`/);
  assert.match(delivery, /smtp\.gmail\.com/);
  assert.doesNotMatch(delivery, /console\./);
});
