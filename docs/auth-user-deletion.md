# Supabase Auth user deletion

Migration: `20260916190000_auth_user_deletion.sql`.

Applied to the linked hosted database on 16 September 2026. Hosted schema lint
reported no errors. TypeScript, 72 repository tests, and 23 native database test
groups passed. No existing hosted Auth user was deleted during this work.

The hosted catalog audit covered all 86 public foreign keys (55 directly referencing
`auth.users`), the 10 provider-managed foreign keys referencing `auth.users`, and
all 46 existing public triggers. There were no custom triggers on `auth.users`.
The audit reads schema metadata only; `scripts/database/audit-auth-dependencies.mjs`
can repeat it against the linked database, or use `--local` for the disposable test database.

## Root cause and foreign-key changes

Deleting a synthetic Guardian with consent history reproduced PostgreSQL error
`23503` on `guardian_consent_history_guardian_user_id_fkey`. Both participant FKs
used RESTRICT. The old app-specific account-deletion RPC manually removed these
rows, but a normal Supabase Auth deletion did not execute that RPC.

| Reference | Before | After | Reason |
| --- | --- | --- | --- |
| `guardian_consent_history.guardian_user_id` | RESTRICT | CASCADE | Remove history involving the deleted Guardian. |
| `guardian_consent_history.player_user_id` | RESTRICT | CASCADE | Remove history involving the deleted Player. |
| `teams.created_by` | NOT NULL, CASCADE | Nullable, SET NULL | Preserve the team, other memberships and attendance. |
| `guardian_invitations.created_by` | NOT NULL, CASCADE | Nullable, SET NULL | Preserve another Player/Guardian's invitation when its author is deleted. |
| `guardian_invitations.intended_guardian_user_id` | SET NULL | CASCADE | Remove invitations bound to the deleted recipient account. |

Existing CASCADE behavior remains for profiles, sporting logs, calendar records
owned by the user, memberships, attendance belonging to the Player, AI records,
billing summaries, age/policy records, Guardian profiles, relationships, permissions,
verification, document acceptances and recipient-owned notifications. Existing
nullable attribution links keep SET NULL. Shared policy/document definitions and
other users' records are not deleted. No provider-owned Auth or Storage tables are altered.

## Trigger and function changes

- `cleanup_auth_user_email_records`: BEFORE DELETE on `auth.users`, removes
  invitations addressed to the deleted account's current email (including invites
  created before signup) and its matching waitlist entry. An invitation tied to the
  account's ID but an older email is handled by its CASCADE FK.
- `handle_deleted_guardian_relationship`: AFTER DELETE on active Guardian
  relationships, marks a surviving dependent Player `relationship_revoked` only
  when no other active, verified, consenting Guardian remains. Existing permission
  and consent checks remove access; the Player's account and sporting records survive.
- `enforce_public_beta_adult_write` and `enforce_restricted_player_write`: permit
  the actual nested FK cascade after the relevant `auth.users` row has disappeared.
  Ordinary writes remain gated. The old client-settable self-delete flag is no
  longer trusted to bypass those checks. No triggers or RLS policies are disabled.
- `public_beta_delete_my_account`: retains explicit confirmation, recent login and
  the safeguard against self-deleting a team owner while other members remain.
  It now delegates dependent-record handling to the same FKs/triggers used by Auth,
  rather than deleting shared announcements or other users' privacy requests.
- `guardian_resend_invitation`, `guardian_cancel_invitation`, and
  `coach_get_guardian_sheet`: treat a missing invitation author as false in permission
  checks. A NULL author cannot accidentally authorize an unrelated user.
- `Team`, `TeamRow`, and `CoachTeam` TypeScript types allow a deleted creator's ID
  to be null. Existing active coach memberships continue to authorize management.

The two new trigger functions have no direct anon/authenticated execution grant.
Consent-acceptance immutability triggers remain unchanged (they block UPDATE, not
the intended account-deletion cascade).

## Shared-data and retention boundaries

A team with surviving coaches remains manageable through their existing
memberships. If no coach survives, the team is retained for administrator
reassignment; the migration does not grant ownership to a Player or arbitrary user.
Self-service still asks an owner to transfer/close shared teams before deletion;
an administrative dashboard deletion can proceed without destroying those teams.

Other users' scheduled events and messages, audit/product/operational history, and
historical JSON attribution remain where their existing retention model permits it.
Their FK references are detached. This is a referential-integrity fix, not a blanket
redaction of names or identifiers embedded in shared text, metadata, backups or external systems.

## Verification

`npm run test:native-database` applies every migration from scratch and runs the
existing country/Guardian and coach-sheet suites, followed by
`tests/native-auth-user-deletion.mjs`. The deletion suite uses a fixed loopback-only
PostgreSQL database, synthetic accounts, a limited Auth-style database role with
SELECT/DELETE on `auth.users` and no public-table grants, and full transaction rollback.

The seven deletion groups check all direct app/Auth FK actions and nullability;
Player deletion with populated personal, AI and Guardian records; Guardian deletion
and dependent access; preservation of teams, schedules, attendance and invitations;
null-author authorization; restricted self-deletion and retained safeguards; optional
attribution; multi-account deletion; and accounts with no profile. Every public FK
is queried after each applicable deletion to confirm no reference to the deleted
user remains. Sibling/teammate/other-Guardian records are checked separately.

This tests the actual database DELETE/cascade boundary without deleting existing
hosted users or invoking the live Auth admin deletion endpoint. Supabase-managed
session/identity cascade definitions were audited, not reimplemented in the native fixture.

The hosted audit found zero Storage objects. Supabase separately prevents deletion
of accounts owning Storage objects. Any future
file-storage integration must remove objects through the Storage API or reassign
them before deleting the account; deleting only SQL metadata would not remove files.
See [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data#deleting-users).
