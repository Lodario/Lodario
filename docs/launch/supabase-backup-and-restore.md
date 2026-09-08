# Supabase backup and isolated restore guide

This guide prepares a recoverable checkpoint before the Lodario 18+ migration. It does not authorize a production restore, reset, or migration.

**Current local status:** On 8 September 2026, PostgreSQL 17.6 Docker clients created password-free roles plus public schema/data backups under `.local-backups/pre-18-plus/`. The files are non-empty, SHA-256 hashed, Git-ignored and scheduled for deletion on 8 October 2026. Thirty-nine repository-backed production tables were restored to the disposable local Supabase stack without restoring production Auth users or overwriting internal schemas; both pending migrations and all automated suites passed afterward. The production dump also revealed the schema drift documented in `18-plus-beta-scope.md`.

## Prefer the Supabase Dashboard backup

For a production project, first verify a recent backup under **Supabase Dashboard → Database → Backups**. A Dashboard-managed backup or Point-in-Time Recovery checkpoint is the safer primary rollback option because it is managed by Supabase and avoids depending only on a workstation.

Keep the CLI exports below as an additional logical backup. Supabase documents that CLI schema dumps exclude Supabase-managed schemas such as `auth`, `storage`, and extension-owned schemas. Database backups contain Storage metadata, not the actual files stored through the Storage API. Lodario currently has no repository-demonstrated Storage bucket usage, but this limitation still matters if files exist in the project outside the application code.

Official references:

- [Supabase CLI `db dump`](https://supabase.com/docs/reference/cli/supabase-start#supabase-db-dump)
- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
- [Restore a downloaded backup locally](https://supabase.com/docs/guides/local-development/restoring-downloaded-backup)

## Create timestamped logical backups

Run these commands interactively in **Windows Command Prompt**, not PowerShell, from the repository root:

```cmd
cd /d "C:\Users\socce\Desktop\Anti Gravity Apps\My Own Prolaesio"
if not exist .local-backups\pre-18-plus mkdir .local-backups\pre-18-plus
for /f %i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "LODARIO_BACKUP_STAMP=%i"
npx supabase db dump --linked --role-only --file ".local-backups\pre-18-plus\lodario-%LODARIO_BACKUP_STAMP%-roles.sql"
npx supabase db dump --linked --file ".local-backups\pre-18-plus\lodario-%LODARIO_BACKUP_STAMP%-schema.sql"
npx supabase db dump --linked --data-only --use-copy --file ".local-backups\pre-18-plus\lodario-%LODARIO_BACKUP_STAMP%-data.sql"
```

Files are saved under:

```text
C:\Users\socce\Desktop\Anti Gravity Apps\My Own Prolaesio\.local-backups\pre-18-plus\
```

The directory is ignored by Git. Do not move production dumps into a tracked directory or cloud-sync them without an approved secure-storage policy.

Each manual dump set has a 30-day retention period. Record its creation date and mandatory deletion date when it is created.

If these commands are placed in a `.cmd` file, change `%i` to `%%i`.

## Verify the backup files

Still in the same Command Prompt session:

```cmd
dir ".local-backups\pre-18-plus\lodario-%LODARIO_BACKUP_STAMP%-roles.sql"
dir ".local-backups\pre-18-plus\lodario-%LODARIO_BACKUP_STAMP%-schema.sql"
dir ".local-backups\pre-18-plus\lodario-%LODARIO_BACKUP_STAMP%-data.sql"
powershell -NoProfile -Command "$files=Get-ChildItem -LiteralPath '.local-backups\pre-18-plus' -Filter ('lodario-%LODARIO_BACKUP_STAMP%-*.sql'); if($files.Count -ne 3){throw 'Expected exactly three backup files.'}; $empty=$files | Where-Object Length -le 0; if($empty){throw ('Empty backup file(s): ' + (($empty.Name) -join ', '))}; $files | Select-Object Name,Length,LastWriteTime"
```

Success means all three files exist and have non-zero sizes. Do not print or copy their contents into tickets, chat, or Git.

For stronger integrity verification, create SHA-256 hashes:

```cmd
certutil -hashfile ".local-backups\pre-18-plus\lodario-%LODARIO_BACKUP_STAMP%-roles.sql" SHA256
certutil -hashfile ".local-backups\pre-18-plus\lodario-%LODARIO_BACKUP_STAMP%-schema.sql" SHA256
certutil -hashfile ".local-backups\pre-18-plus\lodario-%LODARIO_BACKUP_STAMP%-data.sql" SHA256
```

Record hashes separately from the backup files.

## Manual backup expiry

- Retain each manual role/schema/data dump set for 30 days.
- At 30 days, delete every local and remote copy using the storage provider’s secure deletion controls.
- Record the filename/hash reference, creation date and deletion date without recording database contents.
- Do not extend manual-backup retention silently. Supabase automatic backups/PITR follow the separately verified provider plan and are not reclassified as manual dumps.

## What the logical backup does not include

- Actual Supabase Storage objects/files. Database exports can contain metadata but not the object bytes.
- Supabase-managed `auth`, `storage`, extension, and other platform schemas excluded by the CLI’s filtered dump process.
- Dashboard configuration such as Auth Site URL, redirect allow-list, email templates, SMTP configuration, project API settings, DNS, or Vercel variables.
- Edge Function source or secrets. This repository currently demonstrates no Edge Functions.
- Custom role passwords. Managed backups and role exports do not provide recoverable plaintext passwords.
- A guaranteed byte-for-byte physical snapshot of the hosted cluster.
- Git working-tree changes or environment files.

If Storage objects exist in the Dashboard despite no current code usage, inventory and export them separately before migration.

## Restore only to a local or isolated database

Never test restoration against the linked production project.

### Option A: isolated local PostgreSQL/Supabase

After Docker Desktop and `psql` are installed, start a local Supabase stack:

```cmd
cd /d "C:\Users\socce\Desktop\Anti Gravity Apps\My Own Prolaesio"
npx supabase start
```

Restore into a new disposable local database rather than the normal migration-test database:

```cmd
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" --variable ON_ERROR_STOP=1 --command "DROP DATABASE IF EXISTS lodario_restore_test"
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" --variable ON_ERROR_STOP=1 --command "CREATE DATABASE lodario_restore_test"
psql "postgresql://postgres:postgres@127.0.0.1:54322/lodario_restore_test" --single-transaction --variable ON_ERROR_STOP=1 --file ".local-backups\pre-18-plus\lodario-%LODARIO_BACKUP_STAMP%-roles.sql" --file ".local-backups\pre-18-plus\lodario-%LODARIO_BACKUP_STAMP%-schema.sql" --command "SET session_replication_role = replica" --file ".local-backups\pre-18-plus\lodario-%LODARIO_BACKUP_STAMP%-data.sql"
```

Some role statements may require an isolated instance where the restoring user can create roles. If role restoration fails, stop and inspect the error; do not remove statements blindly and do not retry against production.

### Option B: Supabase Dashboard downloadable backup

If the Dashboard supplies a physical backup file, follow Supabase’s version-specific local restore guide:

```cmd
npx supabase db start --from-backup "C:\absolute\path\to\db_cluster.backup"
```

Use the exact Postgres image version shown with the downloaded backup. Do not guess it.

## Verify the isolated restore

Run these read-only checks against `lodario_restore_test`:

```cmd
psql "postgresql://postgres:postgres@127.0.0.1:54322/lodario_restore_test" --variable ON_ERROR_STOP=1 --command "SELECT current_database(), current_user, version();"
psql "postgresql://postgres:postgres@127.0.0.1:54322/lodario_restore_test" --variable ON_ERROR_STOP=1 --command "SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname='public' ORDER BY tablename;"
psql "postgresql://postgres:postgres@127.0.0.1:54322/lodario_restore_test" --variable ON_ERROR_STOP=1 --command "SELECT schemaname, tablename, policyname, roles, cmd, permissive FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname;"
psql "postgresql://postgres:postgres@127.0.0.1:54322/lodario_restore_test" --variable ON_ERROR_STOP=1 --command "SELECT routine_schema, routine_name FROM information_schema.routines WHERE routine_schema='public' ORDER BY routine_name;"
psql "postgresql://postgres:postgres@127.0.0.1:54322/lodario_restore_test" --variable ON_ERROR_STOP=1 --command "SELECT trigger_schema, event_object_table, trigger_name FROM information_schema.triggers WHERE trigger_schema='public' ORDER BY event_object_table, trigger_name;"
```

Compare row counts for important tables without exporting their contents:

```cmd
psql "postgresql://postgres:postgres@127.0.0.1:54322/lodario_restore_test" --variable ON_ERROR_STOP=1 --command "SELECT 'profiles' AS table_name, count(*) FROM public.profiles UNION ALL SELECT 'wellness_logs', count(*) FROM public.wellness_logs UNION ALL SELECT 'training_logs', count(*) FROM public.training_logs UNION ALL SELECT 'calendar_events', count(*) FROM public.calendar_events UNION ALL SELECT 'teams', count(*) FROM public.teams UNION ALL SELECT 'team_memberships', count(*) FROM public.team_memberships;"
```

The restore is verified only after commands finish without errors, expected tables/functions/triggers/policies exist, and row counts are plausible compared with approved source counts.

## Migration test after restore

Do not use `db push --linked`. Point `psql` at the isolated database and apply only the two reviewed pending files, in order:

```cmd
psql "postgresql://postgres:postgres@127.0.0.1:54322/lodario_restore_test" --single-transaction --variable ON_ERROR_STOP=1 --file "supabase\migrations\20260723210000_public_beta_18_plus_gate.sql"
psql "postgresql://postgres:postgres@127.0.0.1:54322/lodario_restore_test" --single-transaction --variable ON_ERROR_STOP=1 --file "supabase\migrations\20260723230000_beta_privacy_operations.sql"
```

Then repeat the catalog and row-count verification. Test adult, under-18, missing-DOB, existing Guardian-identity, current/outdated/rejected consent, Player/Coach export, Player deletion, empty-team/occupied-team Coach deletion, team, log, calendar, RSVP, attendance, and direct Guardian-access scenarios with disposable test users.

## Rollback plan

1. Before migration, confirm a usable Dashboard backup or PITR point and verify the three logical export files.
2. Keep the pre-migration application build available for rollback.
3. If the migration fails inside its transaction, do not mark it applied or repair migration history. Capture the error and leave production unchanged.
4. If a post-deployment problem appears:
   - stop rollout and revert the application to the pre-migration build;
   - prefer Supabase Dashboard PITR/backup restoration when data integrity is affected;
   - otherwise prepare a new reviewed forward corrective migration.
5. A corrective migration would need to:
   - restore the five prior team-helper definitions;
   - drop the ten restrictive `18+ public beta access required` policies;
   - drop the eleven beta triggers;
   - restore only the reviewed Guardian grants if Guardian access is intentionally re-enabled;
   - disable/remove the public-beta feature-flag row and handle new functions/grants explicitly.
6. The profile DOB/age backfill cannot be reliably reversed from the migration alone because prior values are not retained. Use the verified backup if those values must be restored.

Do not improvise permission restoration from memory; derive it from the historical migrations and an isolated restore.

## Production safety warning

> Never run `supabase db reset --linked`, `npx supabase db reset --linked`, or any equivalent reset command against production.

`supabase db reset` is for a local stack. A linked production database must never be used as a reset target.
