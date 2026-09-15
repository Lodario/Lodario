> Historical 18+ release record. The [country-policy release record](country-beta-status.md) supersedes this scope, checklist and deployment status.

# Lodario 18+ beta manual test checklist

Run this checklist only against local development, a Vercel Preview connected to an isolated Supabase project, or another explicitly approved test environment. Do not use real health details or arbitrary email recipients.

## Automated evidence recorded

Latest local verification: **8 September 2026**, Windows 11, Docker Desktop 4.83.0, Supabase CLI 2.109.1, PostgreSQL 17.6.

- PASS: all 29 repository migrations applied to a freshly recreated local database.
- PASS: missing, future, malformed, impossible, adult, minor, exact-18th-birthday, turns-18-tomorrow and leap-day DOB cases.
- PASS: the no-argument age-status RPC is in `public`, is `SECURITY DEFINER`, is executable by `authenticated` and `service_role`, and is not executable by `anon`.
- PASS: adult owner writes, minor/missing-DOB denial, unrelated-user privacy, Coach/team isolation, team joins, calendars, RSVP and attendance.
- PASS: consent rejection/acceptance/version/idempotency/immutability, owner export, Player deletion, empty-team Coach deletion and occupied-team Coach deletion block.
- PASS: authenticated beta users cannot directly access Guardian tables; all excluded Guardian flags are off locally.
- PASS: a production roles/public-schema/public-data backup was created, hashed, kept outside Git and restored to the local stack without restoring internal schemas or production Auth users.
- PASS: representative restored data contained adult, minor, missing-DOB, team, core and Guardian-history cases; both pending migrations reapplied successfully in order.
- PASS: production-only AI/rewarded-ad tables and RPCs plus the legacy `test` table are conditionally denied to beta users while service-role access and data are preserved.
- PASS: 72 contract/unit tests, TypeScript, ESLint, production build and `git diff --check`.
- PASS on 24 July 2026: production-mode local browser smoke for missing DOB, minor block, adult consent/onboarding, Player/Coach workspaces and Guardian route/API denial.

These results cover the database-backed and contract cases below but do not replace the unchecked physical-device, assistive-technology, email-delivery, hosted-Preview or human visual-review items.

## Prerequisites

- [ ] Put these values in the ignored `.env.local` file:

  ```env
  LEGAL_OPERATOR_NAME=[MY FULL LEGAL NAME]
  NEXT_PUBLIC_SITE_URL=https://lodario.vercel.app
  ```

- [ ] Confirm the remaining required Supabase and SMTP variable names are configured without displaying their values.
- [ ] Confirm AI and PostHog variables are absent from the test deployment.
- [ ] Prepare disposable Player and Coach email accounts controlled by the tester.
- [ ] For database migration testing, use a restored local/isolated database—not production.

## Public pages and responsive layout

Test at approximately 375×812 mobile, 768×1024 tablet, and 1440×900 desktop dimensions:

- [ ] `/privacy`
- [ ] `/terms`
- [ ] `/health-disclaimer`
- [ ] `/cookies`
- [ ] `/support`
- [ ] `/beta`
- [ ] Sign-in, sign-up, forgot-password, and reset-password screens

For each:

- [ ] Page title and content are correct.
- [ ] Legal operator name renders correctly and no placeholder remains.
- [ ] No horizontal scrollbar or clipped text appears.
- [ ] Long pages scroll to the footer.
- [ ] Legal/support links work and remain usable without authentication.
- [ ] Browser zoom at 200% remains usable.
- [ ] Text/background contrast is reviewed with a contrast-analysis tool.

## Keyboard and accessibility

- [ ] Traverse each public/auth form using only `Tab` and `Shift+Tab`.
- [ ] Focus is always visibly indicated.
- [ ] Focus order follows the visual order.
- [ ] `Enter` and `Space` activate buttons appropriately.
- [ ] Escape/close behaviour is understandable in the feedback modal.
- [ ] Screen-reader software announces labels for auth, onboarding, feedback, and Coach password fields.
- [ ] Validation errors are announced and identify the field/action that failed.
- [ ] Touch targets are comfortable on a physical phone.
- [ ] Reduced-motion and high-contrast operating-system settings do not make the app unusable.

## Registration, authentication, and age gate

Use disposable accounts for each scenario:

- [ ] New Player registration.
- [ ] New Coach registration.
- [ ] Existing Player account.
- [ ] Existing Coach account.
- [ ] Password reset link returns to `/reset-password`.
- [ ] Incorrect/expired reset link shows a safe error.
- [ ] User turning 18 today is accepted.
- [ ] User turning 18 tomorrow is blocked.
- [ ] User older than 18 is accepted.
- [ ] User younger than 18 is blocked.
- [ ] Missing DOB opens the one-time DOB screen.
- [ ] Invalid, impossible, and future DOBs are rejected.
- [ ] Leap-day DOB calculates completed years correctly.
- [ ] A recorded valid DOB cannot be replaced through the normal client.
- [ ] Under-18 direct navigation to Player or Coach routes does not mount core data screens.
- [ ] Guardian pages redirect and Guardian APIs return 404.

There is no separate guided Coach onboarding wizard in the current product. Coach onboarding is account creation → role selection → age confirmation → Coach workspace/profile. Confirm this is acceptable for the beta.

## Player stable core

- [ ] Complete Player profile onboarding.
- [ ] Save availability and training resources.
- [ ] Join a team with a valid code.
- [ ] Invalid team code fails safely.
- [ ] Save/edit/delete wellness logs.
- [ ] Save/edit/delete training logs.
- [ ] Verify readiness and load update from the saved inputs.
- [ ] Compare recommendations before/after high fatigue, pain, and load changes.
- [ ] Confirm revised “Injury Support” and recovery-guidance wording appears.
- [ ] Add/edit injury status and pain information.
- [ ] Add/edit/delete one-off and recurring calendar events.
- [ ] Confirm recurrence behaviour is unchanged.
- [ ] RSVP and verify the saved state after reload.
- [ ] Review Player analytics for 7, 14, and 30 days.
- [ ] Send one feedback message to the authorized Lodario test/support inbox.

## Coach stable core

- [ ] Create a team.
- [ ] Copy/use its team code with a disposable Player.
- [ ] Confirm the connected Player appears only on the correct team.
- [ ] Confirm a Coach cannot view an unrelated Player.
- [ ] View the connected Player’s allowed profile, wellness, training, readiness, load, pain/injury, calendar, RSVP, and attendance data.
- [ ] Create/update/delete Coach-managed Player calendar events.
- [ ] Record and edit attendance.
- [ ] Review dashboard, team overview, Player detail, and analytics.
- [ ] Switch between two test teams and confirm isolation.
- [ ] Update Coach password.
- [ ] Open legal/support links from Coach settings.

## Migration and RLS scenarios

After restoring representative data to an isolated database and applying the pending migration:

- [ ] Existing Guardian and consent rows remain present.
- [ ] Every Guardian feature flag is disabled.
- [ ] `public_beta_18_plus_enabled` is enabled.
- [ ] Existing valid Guardian age identities backfill profile DOB/age correctly.
- [ ] Profiles without authoritative Guardian DOB are not given an invented DOB.
- [ ] Adult owner CRUD works on all core tables.
- [ ] Under-18 owner CRUD fails on all ten protected tables.
- [ ] Adult Coach managed-team reads/writes work.
- [ ] Cross-team and unrelated-user access fails.
- [ ] Direct `anon` reads of private tables fail.
- [ ] Direct `authenticated` Guardian table access fails.
- [ ] Guardian and country/minor RPC execution fails for normal beta users.
- [ ] Team-join and attendance RPCs reject an under-18 caller.
- [ ] Service-role-only administration remains available only in a trusted server/database context.
- [ ] Re-running the migration in a fresh isolated restore reaches the same intended end state.

## Sign-off evidence

Record:

- Tester name and date
- Browser/OS/device
- Test environment URL
- Isolated Supabase project or local database identifier
- Migration version tested
- Passed/failed checklist items
- Screenshots without personal or secret data
- Defects and retest results
