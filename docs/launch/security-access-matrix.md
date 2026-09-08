# Lodario beta security-access matrix

**Basis:** ordered local migrations and current browser/server code, reviewed 23 July 2026. Remote migration versions align through `20260723180000`, but a remote schema dump and isolated database tests remain required.

Legend: **Own** = row belongs to signed-in user; **Managed** = active Player/Coach relationship on a team the Coach legitimately controls; **RPC** = direct table mutation is denied and a narrow function validates the action; **None** = no browser access.

## Application tables

| Resource | Anonymous | Player SELECT / INSERT / UPDATE / DELETE | Coach SELECT / INSERT / UPDATE / DELETE | Notes |
| --- | --- | --- | --- | --- |
| `profiles` | None | Own / Own / Own protected fields / None | Own+Managed / Own / Own protected fields / None | Role and DOB mutation protected by triggers |
| `user_account_roles` | None | Own / None / None / None | Own / None / None / None | Cannot self-promote through table |
| `wellness_logs` | None | Own / Own / Own / Own | Managed / None / None / None | Pending adult restrictive policy/trigger |
| `training_logs` | None | Own / Own / Own / Own | Managed / None / None / None | Pending adult restrictive policy/trigger |
| `injuries` | None | Own / Own / Own / Own | Managed / None / None / None | Pending adult restrictive policy/trigger |
| `calendar_events` | None | Own / Own / Own / Own | Managed / Managed / Managed / Managed | Existing product permits Coach-managed Player events |
| `custom_event_types` | None | Own / Own / Own / Own | Managed read plus own controls / Own / Own / Own | Pending adult restriction |
| `player_calendar_event_color_overrides` | None | Own / Own / Own / Own | Own only / Own / Own / Own | No cross-user access |
| `teams` | None | Related / None / None / None | Related / Own create / Managed / Creator | Invite code does not bypass membership |
| `team_memberships` | None | Own/related / RPC join only / None / Own leave where supported | Managed / Managed / Managed / Managed | Helper functions fail closed for under-18 callers |
| `event_attendance` | None | Own read / RPC RSVP / None / None | Managed / Managed / Managed / Managed | Legacy, adult-gated |
| `calendar_event_attendance` | None | Own read / RPC RSVP / None / None | Managed read / RPC / RPC / RPC | Current attendance model |
| `beta_waitlist` | Validated insert only | Insert only / no read | Insert only / no read | Submitted emails cannot be selected in browser |
| `beta_required_documents` | None | RPC status only | RPC status only | Operator-controlled current versions |
| `user_consent_acceptances` | None | Own / RPC / None / None | Own / RPC / None / None | Server timestamp; update trigger rejects mutation |
| `beta_operational_events` | None | None | None | Security-definer functions insert allowlisted minimal events |
| Guardian/minor tables | None | None after pending gate | None after pending gate | Guardian code retained but beta access revoked |

All listed tables have RLS enabled. `beta_required_documents` and `beta_operational_events` deliberately have no browser policies. No service-role key is used by browser or server routes.

## Endpoints and RPCs

| Resource | Authentication and scope | Mutation/abuse protection |
| --- | --- | --- |
| `/api/feedback` | Adult authenticated owner | Same origin, bounded fields, allowlisted category, email/header validation, honeypot, rate limit, duplicate digest |
| `/api/account/export` | Authenticated owner only; no target ID | Same origin, API and database rate limits, owner-scoped RPC |
| `/api/account/delete` | Authenticated owner only; no target ID | Exact phrase, recent JWT issue time, rate limit, transaction, Coach ownership block |
| `/api/guardian/*` | Disabled | Middleware/API returns unavailable/404 |
| `/api/health` | Public status only | No private data, no configuration details, three-second dependency timeout |
| `join_team_by_invite_code(text)` | Authenticated adult through pending write gate | Exact code required; invalid code returns no team/player data |
| `get_team_players(uuid)` | Managing Coach | `can_manage_team`; active Players only |
| Consent status/accept RPCs | Signed-in account | Exact current versions; server time; no target user |
| Export/delete RPCs | Signed-in account | `auth.uid()` only; no caller-supplied account ID |
| Attendance RPCs | Eligible Player or managing Coach | Team/event/Player eligibility checked |

## Confirmed fixes in Phases 1.8–1.20

- Added immutable current-version acceptance records and removed direct insert/update/delete access.
- Added owner-only export with no `user_id` parameter.
- Added owner-only transactional deletion with recent authentication and safe Coach-team blocking.
- Removed the unused debug script that printed returned data.
- Removed database error objects, user/team IDs and health-query context from client logs.
- Added same-origin and duplicate-request protections to privacy and feedback endpoints.
- Added explicit feedback category/header/email validation.

## Remaining risks

- Clean local migration, full age/team/privacy beta flows and a representative restored-production-data migration passed through Docker. Only the disposable-hosted anonymous-denial probe remains.
- The production dump found seven excluded AI/rewarded-ad tables, a legacy `test` table and `teams.picture_url` that fresh repository migrations do not reproduce. The pending age migration conditionally revokes normal-user access to the excluded tables, their sequence and all three discovered AI RPCs while preserving service-role access and data. Reconcile the schema drift later with a new migration; version alignment is not a checksum.
- In-memory API rate limits are per runtime instance. Database export limits and owner-scoped functions provide the stronger backstop, but platform-level rate limiting is still recommended.
- Public Coach registration is an intentional product role choice, not an administrator privilege. No browser path grants Guardian, service-role or administrator access.
- The legacy and current attendance tables coexist; both are restricted, but consolidation should be a separate migration.
