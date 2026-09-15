# Country-policy beta: current release record

Updated 15 September 2026. This document supersedes the July 18+ scope, deployment manifest and test checklist. Those documents describe historical verification, not the current eligibility policy.

## Scope and access

- Players follow the existing country policy. Examples: Portugal self-consent at 13, France at 15, Germany at 16. Below the configured threshold, a verified Guardian must approve the account and accept the exact current required document versions before sporting-data access opens.
- Existing fallback policy remains: below 13 requires approval; ages 13–17 require a Guardian invitation/connection and may proceed while approval is pending. Coaches remain 18+. Guardian responsibilities require the existing adult declaration and email-bound secure invitation.
- Consent is enforced in database access checks and core write triggers as well as the UI. Required document changes and Guardian revocation remove dependent access. Current document version: `2026-09-14-v1.1`.
- Player age/country setup happens before the sporting-data provider. Guardian acceptance records identify the accepting relationship, document and version. Restricted accounts retain self-service export/deletion and support access.
- AI, ads, billing and health integrations remain off. Previously remote-only AI tables/functions and `teams.picture_url` are now represented by an additive migration; existing data is preserved and AI access remains service-only.

## Verification

- 72 repository tests passed after the country changes and dependency updates.
- 12 native PostgreSQL integration groups passed: country boundaries, Guardian identity/approval/documents, consent-version changes, revoked relationships, pending fallback invitations, team privacy, minor RSVP, Coach attendance, privileged DOB correction, owner export/deletion, service-only AI, anonymous denial, and removal of Coach access when the subject Player loses eligibility.
- All 32 migrations applied to an empty disposable PostgreSQL 17 database. All five pending migrations also applied to a restored production public-data copy.
- The final 15 September public backup restore matched all 47 tables and 2,442 rows. Full recovery archive restore matched all 78 public/Auth/Storage metadata tables. Restored databases were removed after each drill. No production Auth users were used for synthetic application tests.
- Docker was unavailable. Native PostgreSQL, real SQL/JWT-role integration checks, archive restore checks, TypeScript, lint and production builds provide the replacement evidence. This is not a claim that the complete Docker Auth/PostgREST suite was rerun.
- Next.js upgraded from 14.2.35 to patched 15.5.24, with matching lint configuration, asynchronous route parameters, and compatible dependency security updates. `npm audit` reported zero known vulnerabilities after updates.

## Hosted configuration

- Vercel project `lodario`, scope `lodario-project`; intended canonical address `https://lodario.vercel.app`.
- Production and Preview have the site URL and legal operator value configured. Existing Supabase and SMTP settings are present. AI switches are explicitly off.
- Supabase `atatbrnnmgnqbbkriosx` is healthy in `eu-west-1`. Auth site URL and reset redirects match the canonical address. Signup now requires email confirmation; custom Gmail SMTP is configured. TLS/authentication verification passed without sending email.
- Vercel is on Hobby: short provider runtime-log retention applies, and deployment retention is 30 days with ten retained deployments. Supabase reported no available hosted restore points and PITR disabled. No paid plan or add-on was purchased.
- All five migrations were applied successfully on 15 September. Hosted database lint reports **no schema errors**. The deployed release is `dpl_CfpqTxZYifCctpxoxzMkNkquSGX4`, aliased to [the live app](https://lodario.vercel.app), running Next.js 15.5.24. Vercel compilation, lint and type validation passed. No Git commit or push was made.

## Backup and maintenance

`scripts/database/backup.mjs` obtains the linked CLI's temporary database login in memory and verifies the Supabase TLS certificate and hostname. It exports a consistent public snapshot, password-free roles, and a custom recovery archive including Auth and Storage metadata. SHA-256 hashes and row counts are recorded in `.local-backups/country-beta/backup-*.json`. These files are excluded from Git and Vercel uploads. Auth archives contain sensitive authentication records and must remain private.

The final verified full archive is recorded in `backup-2026-09-15T11-06-18-931Z.json`, superseding the earlier 14 September snapshot. No Storage objects or buckets existed at the snapshot; archives do not include Storage object bytes. Future use of Storage requires object backup as well.

Windows task **Lodario daily backup and health check** runs at noon and on sign-in, skips a duplicate recent full backup, applies 30-day dump retention, applies 12-month support-mail retention, and checks the public health endpoint. The task uses the existing Windows/Supabase login and contains no credentials. It requires this PC, a signed-in user, network access, the checkout and installed dependencies. Results are in `.local-backups/country-beta/maintenance-status.json`; a failure returns nonzero. It is not an offsite or always-on backup service.

Mail retention uses verified Gmail IMAP. It selects only app-generated `Lodario Beta Feedback [` messages or mail labelled **Lodario Support**, checks age, moves expired messages to Trash and removes only their exact UIDs. Other mail is excluded. Label manually handled app support conversations **Lodario Support** during intake. The initial dry run and first application found zero expired messages. No message bodies or identifying headers are logged.

Commands:

```powershell
npm run db:backup
npm run db:restore-check -- backup-2026-09-15T11-06-18-931Z.json
npm run db:recovery-check -- backup-2026-09-15T11-06-18-931Z.json
npm run test:native-database
node scripts/database/retention.mjs
npm run ops:maintenance
```

Restore/test scripts are hard-wired to the isolated native PostgreSQL server at `127.0.0.1:55432`. Tests reset only `lodario_country_test`; recovery drills create and remove uniquely named databases. They cannot target production via an environment variable. A PostgreSQL 17 server and clients are required; configure `LODARIO_PG_BIN` for another installation and `LODARIO_DATABASE_CA` for the official Supabase CA. This checkout currently has tools under the ignored `.local-backups/country-beta` folder. Production recovery requires a separate reviewed procedure; never run local bootstrap or `DROP SCHEMA` commands against the hosted database.

Hosted daily jobs `lodario-operational-retention` and `lodario-cron-history-retention` are active at 03:15 and 03:30 UTC. They remove application operational events and cron execution history older than 30 days. These jobs run on Supabase independently of this PC; the backup/mail maintenance task remains local. The initial full maintenance check passed all four checks on 15 September.

Live smoke checks passed for eight public/sign-in routes, `/api/health`, and authentication denial on the export, deletion and feedback APIs. Browser verification confirmed the current public policy and corrected beta label. Run `node scripts/verify-public-release.mjs` to repeat these checks without sending mail or using an account.

## DOB correction support procedure

Verify the request through the existing account email and resolve discrepancies through the connected Guardian when required. Do not request passwords or government ID in feedback. The Player submits a request through `player_request_dob_correction(requested_date, reason)` while signed in; the authenticated account cannot approve its own correction.

After verification, an authorized operator uses the Supabase SQL editor or trusted database session:

```sql
-- Review only the requested correction ID; do not export the complete queue.
SELECT id, player_user_id, status, requested_date_of_birth
FROM public.player_date_of_birth_corrections WHERE id = '<request UUID>'::uuid;
-- Approve after ownership/Guardian verification, or pass FALSE to reject.
SELECT public.review_player_dob_correction(
  '<request UUID>'::uuid, TRUE, 'Ownership and required Guardian confirmation verified; support case reference');
```

The server updates private age identity and profile DOB together, reevaluates country requirements, and records the decision. No service key belongs in client code. If a request arrives only by email, ask the account holder to submit the in-app correction request; support must not impersonate a user.

## Owner work and suggestions

**Owner work:** legal review of country thresholds, Guardian consent, health-data processing and all public documents; live testing with real Players, Coaches and Guardians, including actual email delivery and password reset.

**Suggestion:** use provider-managed/offsite backups and independent uptime alerts before relying on the app at scale. The installed local maintenance task depends on this PC; a paid provider upgrade was not assumed or purchased.

Sources: [Supabase backups](https://supabase.com/docs/guides/platform/backups), [Supabase SSL](https://supabase.com/docs/guides/platform/ssl-enforcement), [Vercel log limits](https://vercel.com/docs/limits), [Next.js security fix](https://github.com/vercel/next.js/releases/tag/v15.5.24).
