# Lodario backup and restore procedure

This supplements `supabase-backup-and-restore.md`. Never restore, reset or test migrations against production.

## Backup types

| Type | Purpose | Limitation |
| --- | --- | --- |
| Supabase automatic backup/PITR | Primary hosted recovery checkpoint | Availability and retention depend on the live project plan; verify in Dashboard |
| Manual schema/data/role dumps | Portable logical checkpoint | Excludes some managed schemas and actual Storage object bytes |
| Storage-object export | Copies file bytes | No repository-demonstrated Storage use currently exists |
| Git history | Source recovery | Does not back up database, Auth, environment or user data |
| Vercel deployment history | Code deployment rollback | Does not reverse database migrations or data changes |

## Pre-migration checklist

- [ ] Confirm project identity and current branch.
- [ ] Confirm Dashboard automatic backup/PITR status and retention.
- [ ] Create and verify schema, data and role dumps.
- [ ] Inventory Storage buckets in Dashboard even though the repository uses none.
- [ ] Record migration list and dry-run output.
- [ ] Restore into an isolated environment and verify it before production approval.

## Manual database backup

Run the timestamped Windows Command Prompt commands in `supabase-backup-and-restore.md`. Files are saved under ignored `backups\`. Verify three non-empty files and SHA-256 hashes without displaying their contents.

## Storage files

Repository code contains no active Storage bucket or object API. Before launch, verify the Dashboard has no undocumented bucket. If a bucket exists, inventory and download objects through an approved authenticated process; database dumps contain metadata, not object bytes. Never place exported files in Git.

## Schedule

- Before every migration: Dashboard checkpoint plus verified logical dumps.
- During beta: verify automatic backup status daily for the first week, then weekly.
- Monthly: isolated restore drill.
- Manual backups: retain for 30 days, then securely delete and record deletion.
- Quarterly: retention/access review and confirmation that no manual backup exceeded 30 days.
- After a material incident: create a new checkpoint only after containment and preserve required evidence separately.

## Isolated restore

1. Install/start Docker Desktop and PostgreSQL CLI tools.
2. Start local Supabase.
3. Create a new disposable local database.
4. Restore roles, schema and data with `ON_ERROR_STOP=1`.
5. Never use `supabase db reset --linked`.
6. Compare tables, RLS, policies, functions, triggers and safe row counts.
7. Apply pending migrations to the isolated database only.
8. Run consent/export/deletion and cross-user tests with disposable accounts.

Exact commands and catalog queries are in `supabase-backup-and-restore.md`.

## Restore verification

- [ ] Expected schemas/tables exist.
- [ ] All browser tables show `rowsecurity = true`.
- [ ] Policy and function inventories match the reviewed migrations.
- [ ] Safe row counts are plausible.
- [ ] Auth test accounts can sign in locally.
- [ ] Player A cannot access Player B.
- [ ] Coach access follows active managed-team relationships.
- [ ] Consent, export and deletion tests pass.
- [ ] Application builds and operates against the restored environment.

## Retention and secure deletion

Retain each manual backup for 30 days. Restrict access to the operator, record location, creation date and mandatory deletion date, and never store credentials beside dumps. At 30 days, delete local and remote manual copies using the storage provider’s secure deletion controls and record the date; do not print or inspect contents during disposal. Supabase automatic backup/PITR retention is provider-managed and must be verified separately in Dashboard.

## Current status

The repository cannot identify the project’s paid/free plan or guarantee automatic-backup capability. The operator must verify this in Supabase Dashboard. Docker-backed local migration reset now works, but host `psql`/`pg_dump` remain unavailable, so no isolated backup restore was completed.
