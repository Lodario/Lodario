# Lodario beta rollback plan

## Code rollback

Use Vercel deployment history to promote the last verified deployment when the database remains backward-compatible. Confirm the previous build does not depend on removed database objects and that rolling back will not re-enable excluded features.

## Database changes

An applied migration is historical state. Do not delete or edit its file and do not use migration-history repair to pretend it did not run. Prefer a new reviewed forward corrective migration.

The consent/privacy migration is additive but account deletion is irreversible after success. Its tables/functions can be disabled by revoking execute privileges or an application feature gate; already deleted accounts cannot be reconstructed without an authorised pre-deletion backup restore.

## Feature containment

- Keep `PUBLIC_BETA_FEATURES` exclusions false.
- Middleware can continue redirecting disabled Guardian pages and returning 404 for Guardian APIs.
- If consent/export/deletion is defective, block the affected UI/API with a small reviewed release while preserving support and public policy access.
- Never weaken RLS as an emergency workaround.

## Database restore threshold

Restore is a last resort for confirmed broad corruption, destructive migration effects or unrecoverable integrity failure. Before restore:

1. Stop writes or deployment rollout where practical.
2. Preserve the current database and incident evidence.
3. Identify the exact recovery point.
4. Determine how much valid new production data would be lost.
5. Test the restore in isolation.
6. Obtain explicit operator approval and Supabase support/legal input where appropriate.

Prefer selective forward repair when a full restore would overwrite valid post-backup data.

## Incident record

Record timeline, release SHA, migration versions, affected environment, safe correlation IDs, impact, containment, data-recovery decision, approvals, final fix and regression tests. Do not copy private rows, exports, emails or health details into the incident document.
