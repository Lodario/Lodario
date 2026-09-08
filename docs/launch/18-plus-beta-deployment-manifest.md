# Lodario 18+ beta deployment manifest

**Prepared:** 8 September 2026

**Production domain:** `https://lodario.vercel.app`

**Current recommendation:** **NOT SAFE TO DEPLOY YET**

This manifest describes the current local repository and the linked Supabase project. It does not authorize a deployment. No migration, Vercel change, DNS change, Git publication, or production mutation was performed while preparing it.

## Evidence collected

- The 8 September `supabase migration list --linked` reports every migration through `20260723180000` on both sides, with only `20260723210000` and `20260723230000` local-only.
- The 8 September `supabase db push --linked --dry-run` reports exactly two files, in order: `20260723210000_public_beta_18_plus_gate.sql` and `20260723230000_beta_privacy_operations.sql`. Nothing was pushed.
- The linked database lint currently reports two pre-existing errors:
  - `public.reserve_player_ai_message`: ambiguous `rewarded_ad_credits` reference.
  - `public.player_request_dob_correction`: call to a non-existent `evaluate_player_age_policy(date, text, timestamptz)` signature.
- Docker-backed local Supabase recreation and explicit migration apply completed on 6 September 2026. Every migration through `20260723230000` applied in order after correcting the historical fresh-install dependency on `profiles.role`.
- The age-status catalog is exactly `public.public_beta_get_my_age_status()` with zero arguments, JSONB return, `STABLE`, `SECURITY DEFINER`, `search_path=public`, authenticated/service-role EXECUTE and no anon EXECUTE. PostgREST discovered and executed it after the migration’s schema-cache reload notification.
- Real local Auth/PostgREST tests passed for adult, under-18, missing/invalid DOB and representative RLS paths. Local browser tests passed the adult screen and blocked the under-18 screen.
- A password-free roles dump plus public schema/data dumps were created through PostgreSQL 17.6 Docker clients, verified non-empty, SHA-256 hashed and assigned a 30-day deletion date. The production connection URI existed only in the helper process memory.
- Thirty-nine repository-backed production public tables were restored into the disposable local stack without copying production Auth users or overwriting Supabase internal schemas. Adult/minor/missing-DOB, team/core and Guardian-history cases were present, both migrations reapplied in order, and all automated suites passed afterward.
- The remote schema also contains seven excluded AI/rewarded-ad tables, a legacy `test` table, and `teams.picture_url`, none of which fresh repository migrations reproduce. The pending age migration now conditionally revokes normal-user access to those tables, the test sequence and three AI RPCs while preserving data and service-role access.
- Local migration files and linked version numbers align, but the CLI migration list does not prove that historical file contents are byte-for-byte identical to the SQL originally applied remotely.

## Supabase migrations

| Deployment order | Version/timestamp | Filename | Present remotely | Classification | `--include-all` | History repair |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `20260723210000` / 2026-07-23 21:00:00 UTC | `20260723210000_public_beta_18_plus_gate.sql` | No | Data-transforming and access-restricting. It does not drop tables, columns, constraints, indexes, views, enums, functions, or stored rows. It does drop/recreate named policies and triggers, revokes beta-user privileges, disables Guardian flags, and backfills profile DOB/age from authoritative Guardian identity records. | Not required | Not required |
| 2 | `20260723230000` / 2026-07-23 23:00:00 UTC | `20260723230000_beta_privacy_operations.sql` | No | Additive privacy/security objects plus an authenticated self-deletion RPC. The migration itself deletes no accounts or user data. The RPC deliberately deletes only the caller's account and related Guardian rows after explicit confirmation, recent authentication and Coach ownership checks. | Not required | Not required |

The age migration must run after `20260723180000_guardian_under_consent_access.sql`; the privacy migration must run after the age migration. All historical Guardian migrations remain required because the pending migrations reference and restrict their schema. They must not be removed or replayed with `--include-all`.

### Exact remote dry run

```cmd
npx supabase db push --linked --dry-run
```

Expected result:

```text
Would push these migrations:
 • 20260723210000_public_beta_18_plus_gate.sql
 • 20260723230000_beta_privacy_operations.sql
```

### Exact production deployment command

> **DO NOT RUN YET**

```cmd
npx supabase db push --linked
```

Do not add `--include-all`, `--include-seed`, `--include-roles`, or migration-history repair commands. The linked history does not currently justify them.

## Pending migration object inventory

### New objects

#### Functions

- `public.public_beta_age_gate_enabled()`
- `public.public_beta_valid_date_of_birth(date, date)`
- `public.public_beta_stored_date_of_birth(uuid)`
- `public.public_beta_current_user_is_adult()`
- `public.public_beta_assert_current_user_adult()`
- `public.public_beta_get_my_age_status()`
- `public.public_beta_set_my_date_of_birth(date)`
- `public.enforce_public_beta_profile_date_of_birth()`
- `public.enforce_public_beta_adult_write()`

#### Triggers

- `public.profiles.enforce_public_beta_profile_date_of_birth`
- `enforce_public_beta_adult_write` on each existing table in this list:
  - `public.wellness_logs`
  - `public.training_logs`
  - `public.calendar_events`
  - `public.custom_event_types`
  - `public.injuries`
  - `public.teams`
  - `public.team_memberships`
  - `public.event_attendance`
  - `public.calendar_event_attendance`
  - `public.player_calendar_event_color_overrides`

The SQL uses `DROP TRIGGER IF EXISTS` before creating each trigger, making the intended end state deterministic.

#### RLS policies

A restrictive policy named `18+ public beta access required` is created on each of the ten core tables listed above. It applies to every operation by `authenticated` and requires `public.public_beta_current_user_is_adult()` in both `USING` and `WITH CHECK`.

The policy is restrictive, so an existing owner/Coach/team policy must pass as well as the adult check.

#### Data records

- Feature-flag row `public_beta_18_plus_enabled` is inserted or updated in `public.guardian_feature_flags`.

### Modified objects

#### Functions replaced to fail closed for under-18 callers

- `public.is_team_creator(uuid, uuid)`
- `public.is_active_team_member(uuid, uuid)`
- `public.is_active_team_coach(uuid, uuid)`
- `public.can_manage_team(uuid, uuid)`
- `public.is_active_team_player(uuid, uuid)`

Their team/membership semantics remain the same, with the additional `public_beta_current_user_is_adult()` requirement.

#### Tables with transformed or updated data

- `public.guardian_feature_flags`
  - Every existing Guardian flag is set to `enabled = false`.
  - The public-beta 18+ flag is inserted or updated to `true`.
- `public.profiles`
  - `date_of_birth` and `age` are backfilled only where a valid `public.player_age_identities` record exists.
  - The one-time age-confirmation RPC can insert a minimal profile or update the signed-in account’s `age` and `date_of_birth`.

The DOB/age backfill is data-transforming. It is not automatically reversible because the prior profile values are not retained in a separate rollback table.

#### Permissions and grants

Standalone execution is revoked from `PUBLIC`, `anon`, and `authenticated` for:

- `public.get_coach_calendar_event_scope(uuid, text, date)`
- `public.calendar_event_attendance_player_is_eligible(uuid, text, date, uuid)`

Normal-user execution is dynamically revoked for all currently existing `guardian_*` functions and the following named functions:

- `coach_get_guardian_status`
- `create_guardian_privacy_request`
- `evaluate_player_age_policy`
- `guardian_accept_invitation`
- `guardian_acknowledge_update`
- `guardian_cancel_invitation`
- `guardian_create_invitation`
- `guardian_decide_player_account`
- `guardian_flag_enabled`
- `guardian_get_billing_summary`
- `guardian_get_events`
- `guardian_get_linked_players`
- `guardian_get_permissions`
- `guardian_get_player_overview`
- `guardian_get_player_profile_summary`
- `guardian_has_permission`
- `guardian_mark_invitation_delivery`
- `guardian_mark_update_read`
- `guardian_preview_invitation`
- `guardian_resend_invitation`
- `guardian_track_product_event`
- `guardian_write_audit`
- `is_guardian`
- `player_decide_adult_guardian_access`
- `player_get_my_guardian_state`
- `player_is_guardian_restricted`
- `player_request_dob_correction`
- `player_set_initial_age`
- `process_my_age_transition`
- `revoke_guardian_relationship`

Direct table privileges are revoked from `anon` and `authenticated` for every existing table in this list:

- `guardian_profiles`
- `guardian_player_relationships`
- `guardian_permission_definitions`
- `guardian_relationship_permissions`
- `guardian_updates`
- `guardian_acknowledgements`
- `guardian_notification_preferences`
- `guardian_feature_flags`
- `age_policy_configurations`
- `player_age_identities`
- `guardian_permission_templates`
- `guardian_permission_template_items`
- `guardian_invitations`
- `guardian_verification_records`
- `guardian_consent_history`
- `player_date_of_birth_corrections`
- `guardian_age_transitions`
- `guardian_privacy_requests`
- `guardian_privacy_request_internal`
- `guardian_audit_events`
- `guardian_product_events`
- `iso_country_codes`
- `guardian_jurisdiction_policies`
- `guardian_policy_decisions`
- `player_policy_notifications`
- `player_billing_summaries`

Only these new public-beta functions are granted to `authenticated`:

- `public_beta_age_gate_enabled()`
- `public_beta_valid_date_of_birth(date, date)`
- `public_beta_current_user_is_adult()`
- `public_beta_assert_current_user_adult()`
- `public_beta_get_my_age_status()`
- `public_beta_set_my_date_of_birth(date)`

Internal DOB lookup and trigger functions remain non-executable by normal API roles.

### Removed objects

None. No table, column, constraint, index, view, function, enum, stored procedure, or row is removed.

### Columns, constraints, indexes, views, enums, and procedures

- New columns: none
- Modified column definitions: none
- Removed columns: none
- New/modified/removed constraints: none
- New/modified/removed indexes: none
- New/modified/removed views: none
- New/modified/removed enums: none
- PostgreSQL `CREATE PROCEDURE` objects: none

The migration creates or replaces functions used as PostgREST RPCs; PostgreSQL procedures are not used.

## Privacy migration object inventory

`20260723230000_beta_privacy_operations.sql` creates:

- Tables `public.beta_required_documents`, `public.user_consent_acceptances`, and `public.beta_operational_events`, all with RLS enabled.
- Indexes `user_consent_acceptances_user_idx` and `beta_operational_events_type_time_idx`.
- A SELECT-only owner policy on consent history; no browser policy on required-document configuration or operational events.
- The immutable-consent trigger function and `prevent_consent_acceptance_update` trigger.
- Narrow authenticated RPCs:
  - `public_beta_get_my_consent_status()`
  - `public_beta_accept_required_consents(jsonb)`
  - `public_beta_record_my_operational_event(text, uuid)`
  - `public_beta_export_my_data(uuid)`
  - `public_beta_delete_my_account(text, uuid)`

Direct table privileges are revoked from `anon` and `authenticated`, except owner-filtered consent-history SELECT. RPCs derive identity only from `auth.uid()`; export and deletion have no target-user parameter.

The migration upserts the four current required document-version rows. The migration does not call the deletion function. If an authenticated user later calls that function with the exact confirmation phrase and a JWT issued within 15 minutes, it removes Guardian records involving that caller and then deletes the caller from `auth.users`. The transaction rolls back on any failure. Coach deletion is blocked while any owned team contains another user.

## Browser-table RLS audit

This audit is derived from the ordered local migrations whose versions are present remotely. A successful remote version match is not a content checksum, so a post-backup remote schema comparison is still required before scope freeze.

| Table | RLS in local history | Current access model | Pending 18+ effect / risk |
| --- | --- | --- | --- |
| `profiles` | Enabled | Own select/insert/update; Coach select for managed active team Players | No restrictive adult policy because role selection and DOB bootstrap occur before the age gate. Under-18 accounts can still access their own profile row but cannot access another user through the owner policies. Managed-player access depends on the adult-gated `can_manage_team`. |
| `user_account_roles` | Enabled | Authenticated users can select only their own active-role records | No direct write policy. Used during role bootstrap. |
| `beta_waitlist` | Enabled | `anon` and `authenticated` may insert only validated Player/Coach interest rows; no browser select policy | Intentionally public interest form. It is not an account eligibility decision. |
| `wellness_logs` | Enabled | Own CRUD; managed Coach read | Adds restrictive adult policy and write trigger. |
| `training_logs` | Enabled | Own CRUD; managed Coach read | Adds restrictive adult policy and write trigger. |
| `calendar_events` | Enabled | Own CRUD; managed Coach read/write | Adds restrictive adult policy and write trigger. |
| `custom_event_types` | Enabled | Own CRUD; managed Coach read | Adds restrictive adult policy and write trigger. |
| `injuries` | Enabled | Own CRUD; managed Coach read | Adds restrictive adult policy and write trigger. |
| `teams` | Enabled | Authenticated Coach create; related-member select; managers update; creator delete | Adds restrictive adult policy and trigger; helpers also fail closed for under-18 callers. |
| `team_memberships` | Enabled | Own/managed-team select; manager create/update/delete | Adds restrictive adult policy and trigger; helpers also fail closed. |
| `event_attendance` | Enabled | Player-self/Coach select; Coach-managed writes | Legacy table, still gated by restrictive policy and trigger. Current client code does not use it. |
| `calendar_event_attendance` | Enabled | Player-self/Coach select; writes occur through RPCs | Adds restrictive policy and trigger. RPC helper functions are not standalone-callable. |
| `player_calendar_event_color_overrides` | Enabled | Own CRUD only | Adds restrictive adult policy and trigger. |

No browser service-role credential was found. The browser uses only the intentionally public Supabase URL and anonymous key. No active policy found in local history grants cross-user or cross-team access without an owner, active membership, or `can_manage_team` check.

### RLS limitations requiring verification

- Remote policy definitions were not queried directly because the available CLI does not provide arbitrary read-only catalog SQL. Local catalog, Auth, PostgREST and representative RLS checks passed; a remote dump comparison is still required before launch.
- `profiles` and `user_account_roles` intentionally retain narrow self-access before the DOB decision; this is needed by the existing account/bootstrap flow.
- Guardian UI/API routes are blocked in application middleware and feature flags, while the pending migration supplies the database-level execution/table revocations.
- The unused `lib/test.js` debug script and obsolete duplicate `lib/supabase.js` client were removed from the local source changes; neither was an application dependency.

## Environment-variable deployment matrix

| Variable | Local development | Vercel Preview | Vercel Production | Classification |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Required for app/API testing | Required | Required | Public browser configuration |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Required for app/API testing | Required | Required | Public browser configuration; authorization relies on RLS |
| `NEXT_PUBLIC_SITE_URL` | Optional fallback for basic localhost development; set to `https://lodario.vercel.app` for launch-equivalent builds | Required: `https://lodario.vercel.app` | Required: `https://lodario.vercel.app` | Public configuration |
| `LEGAL_OPERATOR_NAME` | Required for launch-equivalent legal-page review; use the operator’s full legal name | Required | Required | Public, server-read configuration; not secret |
| `GMAIL_SMTP_USER` | Required to test feedback delivery | Required for launch-equivalent Preview testing | Required | Server-only configuration |
| `GMAIL_SMTP_APP_PASSWORD` | Required to test feedback delivery | Required for launch-equivalent Preview testing | Required | Server-only secret |
| `FEEDBACK_EMAIL_TO` | Required to test feedback delivery | Required for launch-equivalent Preview testing | Required | Server-only configuration |
| `EMAIL_FROM` | Required to test feedback delivery | Required for launch-equivalent Preview testing | Required | Server-only configuration |

`VERCEL` and `VERCEL_ENV` are platform-managed indicators used only to fail Vercel builds when the site URL or operator name is missing. Users do not configure them manually.

AI and PostHog variables are not beta deployment requirements and must be omitted. `OPENAI_API_KEY` in `supabase/config.toml` applies only to optional local Studio AI functionality and is not required. Disabled Twilio and experimental S3 placeholders in `supabase/config.toml` are also not required.

No Supabase Edge Function secret or Supabase-hosted runtime environment variable is demonstrated by this repository.

## Other deployment items

| Item | Required? | Repository evidence / action |
| --- | --- | --- |
| Supabase Edge Functions | No | No `supabase/functions` directory or client invocation exists. |
| Storage buckets or Storage policies | No | No bucket declaration, Storage migration, or active Storage client call exists. |
| Cron jobs | No | No `pg_cron` schedule or application cron configuration exists. |
| Email/SMTP | Yes | Feedback uses server-side Gmail SMTP configuration. Verify sender identity and delivery in an authorized test account. |
| Supabase Auth templates | No custom repository deployment | No template files exist. Review the dashboard’s existing confirmation/reset templates and smoke-test their links. |
| Auth Site URL | Yes | Set to `https://lodario.vercel.app`. |
| Auth redirect URLs | Yes | Allow `https://lodario.vercel.app/reset-password`. Sign-up confirmation currently uses the configured Site URL because no explicit sign-up redirect is supplied. |
| Preview Auth redirects | Optional | Add only exact intentionally supported Preview URLs and their `/reset-password` path. Do not add a broad wildcard by default. |
| Vercel configuration | Yes | Add all eight variables in the matrix to both Production and Preview for launch-equivalent testing. No `vercel.json` is required by current code. |
| Retention settings | Yes | Configure error/security logs to 30 days, feedback/support email to 12 months, and manual backup deletion to 30 days. Verify provider-managed automatic-backup retention separately. |
| Domain/DNS | Yes | Connect and verify `lodario.app` in Vercel before production launch. DNS values come from Vercel and are not present in this repository. |
| Generated Supabase types | No current deployment item | The application uses handwritten types; no generated database-types artifact is imported. |
| Seed data | No | `supabase/seed.sql` is absent. `guardian_dev_seed.sql` is explicitly local-development-only and must never be run on production. |

## Deployment blockers

1. The linked database lint has the two errors listed above. Both currently relate to excluded/disabled features, but a production launch should not proceed with unexplained database lint errors.
2. The linked production schema drift listed above must be reviewed and formally accepted for beta; reconcile it later with a new corrective migration rather than rewriting applied history.
3. `NEXT_PUBLIC_SITE_URL=https://lodario.vercel.app` and a non-placeholder `LEGAL_OPERATOR_NAME` are confirmed locally without displaying secret/personal values, but Preview/Production and Supabase Auth URL settings still require manual verification.
4. Professional legal review is intentionally deferred.
5. Broader Player/Coach, email, accessibility and physical-device tests remain manual.
6. Supabase PostgreSQL local image `17.6.1.111` crashes on any function-permission denial for `anon`, reproduced with a disposable non-Lodario function. Confirm fail-closed behavior on a disposable hosted test project after the migrations; do not run this negative probe on production and do not grant anon access as a workaround.

The local `api.auto_expose_new_tables=true` setting preserves parity with Lodario's existing pre-change project during fresh resets, but Supabase marks it for removal on 30 October 2026. A separately reviewed explicit-grant migration/config update is required before that date.
