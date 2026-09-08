# Lodario 18+ public beta scope

## Status

The local application and two migrations are prepared for review. On 6 September 2026, all 29 repository migrations were applied to a freshly recreated Docker-backed local PostgreSQL 17.6 database. On 8 September 2026, a current production logical backup was created, hashed and restored locally without restoring Supabase internal schemas or production Auth users. The two pending migrations reapplied successfully to the restored representative data, and the complete age/RLS and beta-flow integration suites passed. TypeScript, ESLint, all 72 automated contract/unit tests, the production build and `git diff --check` also passed. This scope is **not frozen or deployable yet** because `20260723210000_public_beta_18_plus_gate.sql` and `20260723230000_beta_privacy_operations.sql` have intentionally not been applied to the linked remote database. Until both migrations exist in the target database, the deployed application fails closed at the protected age and consent RPCs.

Preparation and validation were performed without a commit, push, branch switch, deployment, linked database mutation, or remote migration application. The reviewed work was subsequently saved as a local commit on the existing branch at the owner's request; it has not been pushed or deployed. Only the disposable local Supabase database was recreated and changed. The generated `public/sw.js` build output was restored and is not part of the intended change set.

## Latest local verification

| Check | Result |
| --- | --- |
| TypeScript (`npm run typecheck`) | PASS |
| ESLint (`npm run lint`) | PASS, no warnings or errors |
| Automated contract/unit tests (`npm test`) | PASS, 72/72 |
| Fresh local database migration apply | PASS, all 29 repository migrations |
| Local age/RLS integration suite | PASS, 8/8 |
| Local beta-flow integration suite | PASS, 9/9 |
| Production build | PASS, 40 App Router routes generated/validated |
| `git diff --check` | PASS; line-ending conversion warnings only |
| Build-only service-worker cleanup | PASS; `public/sw.js` restored clean |
| Production roles/public-schema/public-data logical backup | PASS; non-empty, SHA-256 recorded, 30-day deletion date recorded |
| Linked `migration list` | PASS; historical versions aligned and only the two expected migrations pending |
| Linked `db push --dry-run` | PASS; exactly `20260723210000` then `20260723230000`; nothing pushed |
| Representative public-data restore | PASS; 39 repository-backed production tables restored locally; internal schemas/Auth users untouched |
| Pending migrations against restored data | PASS in the documented order; adult/minor/missing-DOB, team/core and Guardian-history cases present |
| Production-only excluded database surfaces | PASS; normal-user access revoked conditionally from seven AI/rewarded-ad tables, three AI RPCs and the legacy `test` table; service-role access preserved |

The Supabase CLI 2.109.1 combined `db reset --local` wrapper stalled while initializing its temporary Realtime service after recreating the database. The database was confirmed healthy, the stuck local-only CLI process was stopped, and the reset was completed transparently by applying every migration with `migration up --local --include-all`, restarting local Auth/REST so their internal schemas and schema cache were rebuilt, and running both real integration suites. This is a local CLI/runtime issue to retain in the audit trail, not an application or migration failure.

The local catalog confirms the exact function is `public.public_beta_get_my_age_status()` with no arguments and `SECURITY DEFINER`; `authenticated` and `service_role` have execute permission, `anon` does not, `public_beta_18_plus_enabled` is on, and zero excluded Guardian flags are enabled. The migration contains an explicit PostgREST schema-cache reload notification.

The retained backup set is `.local-backups/pre-18-plus/lodario-20260908-183342-*`: roles 5,643 bytes, public schema 271,750 bytes and public data 619,697 bytes. The result record contains SHA-256 hashes and a mandatory deletion date of 8 October 2026. `.local-backups/` is Git-ignored and no backup file is tracked.

After verification, the local Supabase stack was stopped with its disposable restored-data volume removed. No production-derived copy remains in the local database containers; only the retention-controlled logical backups remain under `.local-backups/pre-18-plus/`.

## Included stable core

### Player

- Email/password sign-up, sign-in, password recovery, and sign-out
- 18+ date-of-birth confirmation before onboarding or protected access
- Guided onboarding and profile
- Team joining and existing coach-player membership flows
- Daily wellness and training logging
- Existing readiness, training-load, and training-recommendation logic
- Injury status, injury records, and pain capture
- Player and coach-assigned calendars, including existing recurrence behaviour
- Player analytics
- RSVP and attendance
- Existing reminders and feedback/support

### Coach

- Email/password authentication and Coach role selection
- 18+ date-of-birth confirmation before Coach workspace access
- Coach profile and working account/password settings
- Team creation, selection, management, and Player connections
- Dashboard, overview, Player, individual, and team views
- Existing readiness, load, and analytics views
- Team and individual calendars
- RSVP and attendance management
- Existing feedback/support

## 18+ gate

The browser never decides that a user is an adult. `PublicBetaAgeGate` calls the authenticated `public_beta_get_my_age_status()` RPC and submits only a DOB to `public_beta_set_my_date_of_birth(date)`. The database reads the stored DOB, calculates completed years using the existing `calculate_player_age` function and `current_date`, and returns eligibility.

- A valid stored DOB becomes eligible at age 18.
- Missing DOB produces a one-time confirmation screen for existing and new accounts.
- Future, malformed, and impossible/out-of-range dates are rejected.
- A valid stored DOB cannot be changed by a normal authenticated client; support/service-role correction remains possible.
- Existing valid Guardian age identities take precedence and are copied into the existing profile DOB/age fields without deleting the identity or consent history.
- Under-18 users receive a simple 18+ beta message and no core data provider is mounted.
- Player onboarding and the Coach workspace are both below the same age gate.
- Password recovery remains reachable before the age gate.
- The authenticated feedback endpoint repeats the server-side age check and ignores client-supplied email/role identity fields.
- Restrictive RLS policies protect all core tables.
- write triggers cover team-join and RSVP/attendance `SECURITY DEFINER` RPCs that bypass RLS.
- existing team permission helpers fail closed for an under-18 caller, protecting privileged team and attendance reads.

## Disabled features and controls

The application source of truth is `lib/betaScope.mjs`; excluded application flags are immutable and have no environment override. Database enforcement is contained in `20260723210000_public_beta_18_plus_gate.sql`. Versioned consent, owner-scoped export, owner-scoped account deletion, and minimal operational events are contained in `20260723230000_beta_privacy_operations.sql`.

| Excluded feature | Application control | Route/API/database control |
| --- | --- | --- |
| AI assistant and conversations | `aiAssistant: false`; no AI UI, route, client call, or active integration was found | Seven production-only AI/rewarded-ad tables and the three discovered AI RPCs are conditionally revoked from `PUBLIC`, `anon` and `authenticated`; service-role access and stored data are preserved |
| Subscriptions, payments, and paid-plan enforcement | `subscriptionsAndPayments: false`; billing UI is not rendered | Guardian billing remains stored but normal-user table/RPC access is revoked by the beta migration |
| Advertising | `advertising: false`; no ad UI or client implementation was found | The production-only `ai_rewarded_ad_grants` table and AI reservation/credit RPCs are covered by the same conditional beta-user revocation |
| Health Connect, wearables, or new health integrations | `healthIntegrations: false`; no integration setting or flow was found | No health-integration endpoint exists |
| Guardian/minor registration and access | `guardianAndMinorAccounts: false`; Guardian role selection, navigation, onboarding, profile, Coach, and settings entry points are hidden/fail closed | Middleware blocks `/guardian`, `/profile/guardians`, `/coach/guardians`, and `/api/guardian`; the migration turns all Guardian flags off, revokes beta-user Guardian/minor table access, and revokes Guardian/country-age RPC execution |
| Users under 18 | server result controls `PublicBetaAgeGate`; no checkbox, local storage, or client `isAdult` value is used | database DOB validation, RLS, write triggers, team permission helpers, narrow RPC grants, and feedback API verification |
| Unfinished/experimental/placeholder UI | `unfinishedFeatures: false`; non-working Coach settings controls do not render | no enabled beta route uses `CoachPlaceholderPage`; the production-only legacy `test` table and identity sequence are conditionally revoked from beta users |

### Blocked route prefixes

| Prefix | Beta result |
| --- | --- |
| `/guardian` including invitations and all Guardian pages | Redirect to `/` |
| `/profile/guardians` | Redirect to `/profile` |
| `/coach/guardians` | Redirect to `/coach/dashboard` |
| `/api/guardian` | `404`, `Cache-Control: no-store` |

## Migration control and review

The pending migrations, in required order, are:

1. `20260723210000_public_beta_18_plus_gate.sql`
   - turns every existing Guardian feature flag off and adds `public_beta_18_plus_enabled = true`;
   - adds narrow age-status and one-time DOB-confirmation functions;
   - backfills profile DOB/age only from an existing valid Guardian age identity;
   - adds a DOB validation/lock trigger;
   - updates the existing team permission helpers to require an adult caller;
   - adds restrictive 18+ RLS policies and write triggers to core tables;
   - revokes standalone access to internal attendance helpers; and
   - revokes beta-user Guardian/country-minor RPC and table access while preserving service-role access and all data; and
   - conditionally revokes beta-user access to remote-only AI/rewarded-ad/test tables, their sequence and the three discovered AI RPCs without deleting later-phase data or code.
2. `20260723230000_beta_privacy_operations.sql`
   - publishes four exact required document versions;
   - stores immutable, server-timestamped, owner-readable consent history;
   - adds authenticated, owner-derived export and deletion RPCs with no target-user parameter;
   - blocks Coach deletion while an owned team contains another user;
   - adds aggregate-only operational completion/failure events and database export throttling; and
   - grants normal users only the narrow RPC/table access required by those flows.

Neither migration contains `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or destructive type conversion. The age migration intentionally contains permission revocations, policy/trigger replacement, Guardian-flag updates, and the narrowly scoped profile backfill described above. The privacy migration contains an intentional, user-triggered `DELETE FROM auth.users` inside the self-deletion RPC and deletes only Guardian rows involving that same account so restrictive historical foreign keys cannot leave personal data behind. It cannot name a target user and is never run by the migration itself.

## Repository surfaces inspected

- Every App Router page and API route
- Player, Coach, and Guardian desktop/mobile navigation
- Authentication, role selection/switching, password reset, onboarding, profile, settings, dashboards, and app shell
- Profile DOB, Guardian age identity, country-policy, consent, correction, and permission implementations
- Every local Supabase migration in chronological order and `supabase/config.toml`
- Direct Supabase table/RPC call sites
- Feedback and Guardian email routes
- Feature flags and deferred AI/payment/advertising/health-integration configuration names
- Placeholder, mock, Coming Soon, and unfinished UI references
- Browser metadata, canonical URL handling, Open Graph/Twitter metadata, structured data, manifest, favicon, PWA icons, auth/onboarding text, feedback sender text, package name, and public README
- tracked/untracked files, full diff/statistics, ignored build/environment files, large files, and high-confidence secret patterns

## Environment and public-document controls

- Public Supabase configuration is validated separately in `lib/env/public.ts`. The anonymous key remains intentionally browser-visible and relies on reviewed RLS for authorization.
- SMTP, feedback delivery, legal operator identity, and server-side configuration errors are handled in `lib/env/server.ts`, which is protected by `server-only`.
- Real environment files are ignored; `.env.example` is the only trackable, sanitised template.
- AI configuration can remain absent. Existing local AI and PostHog variables are not referenced by beta runtime code.
- Feedback and disabled Guardian email paths do not log recipients, message bodies, invitation links, tokens, passwords, or thrown environment objects.
- Public Privacy, Terms, Health and Injury Disclaimer, Cookie Information, and Support pages are available without authentication at `/privacy`, `/terms`, `/health-disclaimer`, `/cookies`, and `/support`.
- Legal and support links are present on the beta page, authentication screen, age gate, onboarding, Player profile, Coach settings, and feedback interface.
- Required versioned consent is implemented below the age gate and above all health-data providers. Current acceptance is stored server-side and checked again after a document version changes.
- Users who do not accept cannot continue into core processing, but retain access to the public legal/support pages plus self-service export and account deletion.
- Player and Coach Profile/Settings expose owner-scoped JSON export and account deletion.
- The owner-approved beta retention schedule is documented consistently: account data until account deletion; error/security logs for 30 days; feedback/support emails for 12 months; and manual backups for 30 days followed by secure deletion.

## Risks and unfinished work

### Beta blockers

1. **The two new migrations are not applied.** This is intentional. Protected application routes will fail closed because the age and consent RPCs are not yet present remotely.
2. **The linked database Guardian flags remain in their previously applied state until the corrective migration is approved.** Application and middleware routes are disabled locally, but remote direct-RPC shutdown depends on the pending migration.
3. **Hosted anonymous RPC denial is still pending.** The local PostgreSQL image has a platform-level crash when probing a function whose execute permission is revoked. Run the documented denial probe only against a disposable hosted test project after applying the two migrations there; never use the production project for this negative test.
4. **Production canonical/auth configuration is not yet fully applied.** `NEXT_PUBLIC_SITE_URL=https://lodario.vercel.app` is confirmed locally, but Vercel Preview/Production values, domain configuration and matching Supabase Auth URLs still require manual verification.
5. **DOB correction is support-operated during beta.** The profile tells users to contact support; an operational identity-check and service-role correction procedure must exist before launch.
6. **The legal operator value is locally present but still needs owner/legal confirmation.** Its value was not displayed or copied into the audit output. The operator must legally review all public-document wording before deployment.
7. **Linked database lint has two existing errors.** `reserve_player_ai_message` contains an ambiguous `rewarded_ad_credits` reference, and `player_request_dob_correction` calls an unavailable `evaluate_player_age_policy(date,text,timestamptz)` signature. These affect excluded AI/Guardian functionality, but must be understood and resolved or formally accepted before production migration approval.

### Launch risks that are not code blockers

- Both legacy `event_attendance` and current `calendar_event_attendance` tables/RPCs exist. Runtime code uses the current table; the beta migration gates both. Consolidation should be a separately reviewed later migration, not a launch-time deletion.
- Fourteen historical migration files have later Git modifications in repository history. The CLI confirms version alignment only, not SQL checksum/content parity. A dump/schema comparison is still required before declaring historical parity.
- The production public schema contains seven AI/rewarded-ad tables and a legacy RLS-enabled `test` table that fresh repository migrations do not create. It also contains `teams.picture_url`, which is absent from repository migrations and runtime use. The restore drill excluded the eight non-beta tables and added `picture_url` only to the disposable local database. The pending age migration now conditionally revokes `PUBLIC`, `anon` and `authenticated` access to those eight tables, their test sequence and the three discovered AI RPCs while preserving service-role access and all stored data. Reconcile this drift later with a new reviewed migration; do not rewrite applied history.
- `supabase/config.toml` uses deprecated `[inbucket]`; the CLI recommends `[local_smtp]`. This affects local tooling, not production data.
- Fresh local resets currently use the deprecated `api.auto_expose_new_tables=true` compatibility setting because Lodario's linked project predates the 2026 Data API grant change. Replace it with reviewed explicit grants before Supabase removes the setting on 30 October 2026.
- Supabase PostgreSQL local image `17.6.1.111` crashes when `anon` invokes any function with revoked EXECUTE permission. A disposable probe reproduced the platform-image issue independently of Lodario. Keep the authenticated-only grants and verify hosted anonymous denial after migration approval.
- Automated coverage is contract/unit based and now includes the stable core, age boundaries, direct-route denial, feedback delivery mocks, and accessibility contracts. Real-browser, real-session, and physical-device regression testing is still manual.
- Feedback requires working SMTP configuration and an environment smoke test.
- The public waitlist is an interest form, not an account-access decision. Its free-text age must never be used to bypass the stored-DOB gate.
- Previously risky injury and recommendation wording was softened to informational “support” and “guidance” language without changing calculations, thresholds, injury logic, or recommendation logic.
- A dedicated 1200×630 Lodario social-preview image is not present. Existing Lodario favicon/PWA artwork is valid, so metadata uses a standard summary card.
- The tracked `public/sw.js` is reproducible Serwist output and should not be included in a source commit; `.gitignore` already excludes generated service-worker outputs.

## Exact work required before scope freeze

1. Run the anonymous RPC-denial probe against a disposable hosted test project after applying both migrations there. Do not run it against production.
2. Review the full SQL in `20260723210000_public_beta_18_plus_gate.sql` and `20260723230000_beta_privacy_operations.sql`, in that order, plus the complete beta change set and the newly documented production-schema drift.
3. Complete the unchecked physical-device, assistive-technology, visual, Preview and email-delivery items in `18-plus-beta-manual-test-checklist.md`; automated database cases are recorded there as passed.
4. Define and test the manual DOB-correction support procedure.
5. Keep the confirmed local `NEXT_PUBLIC_SITE_URL=https://lodario.vercel.app` value and set/verify it in Vercel Preview and Production.
6. Configure the same Lodario URL/domain in Vercel, DNS and Supabase Auth site/redirect settings.
7. Confirm `LEGAL_OPERATOR_NAME`, complete legal review of all five public documents, and configure the approved 30-day/12-month retention controls in the live providers.
8. Verify Gmail/SMTP sender identity and deliverability for Lodario feedback; validate Supabase auth email templates and links.
9. Resolve or formally accept the two excluded-feature database-lint findings before production migration approval.
10. Reconcile the documented remote-only tables/column with a new future corrective migration; do not edit already-applied historical migrations.
11. Replace the temporary local `auto_expose_new_tables` compatibility setting with reviewed explicit stable-core Data API grants before 30 October 2026.
12. Optionally supply and validate a dedicated Lodario social-preview image.
13. After every item above passes, rerun the final checks and obtain explicit approval before any remote migration or deployment command.

The operational hand-off documents are:

- `docs/launch/beta-deployment.md`
- `docs/launch/18-plus-beta-deployment-manifest.md`
- `docs/launch/supabase-backup-and-restore.md`
- `docs/launch/18-plus-beta-manual-test-checklist.md`

The scope can be frozen only after all beta blockers above are closed and the final dry run still lists only the two reviewed migrations in the documented order.
