> Historical 18+ release record. The [country-policy release record](country-beta-status.md) supersedes this scope, checklist and deployment status.

# Lodario 18+ beta functional test plan

**Automated result:** 72/72 passing on 8 September 2026

**Database integration result:** pass for clean migration apply plus restored-production-data migration, age/RLS and full beta-flow suites on 8 September 2026

**Real-browser result:** local adult and under-18 age-gate paths passed on 24 July 2026; broader browser/physical-device matrix remains manual

**Typecheck/lint/build result:** pass on 8 September 2026; zero lint warnings and successful 40-route production build

**Local production HTTP smoke:** public pages 200; disabled Guardian pages 307 to safe routes; Guardian API 404; unauthenticated export/deletion 401. `/api/health` correctly failed closed with 503 because Supabase was unreachable from the validation environment.

## Automated coverage

| Area | Result |
| --- | --- |
| Player/Coach registration, existing-account role bootstrap and password reset contracts | Pass |
| 18+ boundaries, today/tomorrow, older/younger, missing/invalid/future/leap-day DOB | Pass |
| Required exact-version consent, repeated acceptance and outdated-version behavior | Pass |
| Unselected checkboxes, decline path and processing gate | Pass |
| Player onboarding and existing Coach workspace entry | Pass |
| Team creation/code join/Coach-Player connection contracts | Pass |
| Wellness, training, readiness, load, recommendation, injury/pain contracts | Pass |
| Calendar, RSVP, attendance and analytics data paths | Pass |
| Guardian/API denial and protected route ordering | Pass |
| Owner-scoped export and no cross-owner target parameter | Pass |
| Transactional recent-auth deletion and Coach ownership block | Pass |
| Feedback validation, mock delivery, abuse controls and safe errors | Pass |
| RLS/privilege/security-definer migration contracts | Pass |
| Error boundaries, health endpoint and safe logging contracts | Pass |

Automated source tests are security contracts. They are designed to fail if required RLS declarations, owner checks, revocations, consent immutability, age restrictions or disabled Guardian controls are removed. The separate `npm run test:local-supabase` integration runner uses disposable confirmed users against local Auth/PostgREST and refuses any non-local Supabase hostname.

The local database runner verified missing, future and malformed DOB handling; an authenticated adult pass; an authenticated under-18 block; one-time DOB immutability; adult-owned wellness writes; cross-user wellness denial; and under-18 write denial. Browser automation verified that an adult moved from “Confirm your age” to the required-document screen and that an under-18 user reached the blocking screen, without a schema-cache error.

Local PostgreSQL image `17.6.1.111` has a Supabase-platform defect: invoking any function whose EXECUTE permission is revoked from `anon` terminates the backend process instead of returning `42501`. A disposable one-line probe reproduced it independently of Lodario. Lodario retains the correct authenticated-only RPC grant; do not weaken it. Recheck anonymous denial against the hosted database after the approved migration, and escalate the image defect to Supabase if hosted behavior matches.

## Hosted anonymous RPC-denial procedure

Run this only on a new disposable hosted Supabase test project containing no production data. Never link the main Lodario checkout to that project and never run this negative probe on production.

1. Create an isolated test project and record its project ref in the test evidence only.
2. From a disposable repository copy, link to that test project and apply the complete migration history through `20260723230000` after confirming the project ref in the CLI prompt.
3. Put the disposable project's URL and anonymous key in process-only variables. Do not write them into repository files or command logs.
4. Send `POST /rest/v1/rpc/public_beta_get_my_age_status` with the anonymous key as both `apikey` and bearer token and an empty JSON object body.
5. PASS only if the request fails closed with no age data and no `2xx` response. Depending on hosted PostgREST schema visibility, an authorization denial or function-not-visible response is acceptable.
6. Immediately call the disposable project's health endpoint or a harmless public endpoint. PASS only if the database remains healthy; a backend restart/crash is a failure to escalate to Supabase.
7. Authenticate a disposable adult account and confirm the same no-argument RPC succeeds for `authenticated`, proving the anonymous failure was permission-related rather than a missing migration or stale schema cache.
8. Save only status codes, error codes and timestamps. Do not save bearer tokens, keys, DOBs, emails or response bodies containing account data.
9. Remove the disposable test data/project using the provider's normal controls after evidence review.

## Isolated database test identities

Create only in local or staging:

- Anonymous
- Player A and Player B
- Coach A and Coach B
- Future Guardian A
- Unrelated authenticated account

Verify:

- Player A cannot select/mutate Player B profile, logs, injuries, calendar, attendance or consent.
- Coach A cannot access Coach B teams or Players.
- Unrelated Coach cannot access Player wellness/injury data.
- Player cannot replace protected IDs, role or stored DOB.
- Invalid team code reveals no team/member details.
- Revoked membership loses access immediately.
- Guardian routes/RPCs/tables remain inaccessible.
- Consent cannot be inserted/updated for another user.
- Export/deletion cannot name or target another user.
- Anonymous access to private tables/endpoints fails.

## Manual functional matrix

Run at mobile 375×812, tablet 768×1024 and desktop 1440×900:

- [ ] Player registration, email verification, login and reset.
- [ ] Coach registration, email verification, login and reset.
- [ ] Existing account with and without DOB.
- [ ] Turns 18 today accepted; turns 18 tomorrow blocked.
- [ ] Required documents open before acceptance; checkboxes start empty.
- [ ] Decline keeps core processing paused while support/export/deletion work.
- [ ] Acceptance survives refresh and does not repeat for current versions.
- [ ] Test migration-only version bump requests renewed acceptance.
- [ ] Player display name/profile/onboarding.
- [ ] Coach workspace/profile entry; confirm no separate Coach wizard is expected.
- [ ] Team creation, valid/invalid code connection, leaving/removing a team.
- [ ] Daily wellness and training logging.
- [ ] Pain 4 versus pain 5 behavior remains unchanged.
- [ ] Injury status and guidance wording.
- [ ] Readiness/load/recommendation display against known fixtures.
- [ ] Team/individual calendars, recurrence, exceptions and Player-specific edit/delete.
- [ ] RSVP and past/future attendance.
- [ ] Analytics and notes.
- [ ] Player export includes own required categories and regenerated current recommendation.
- [ ] Coach export contains owned team metadata and no Player health records.
- [ ] Export cannot be rapidly duplicated.
- [ ] Player deletion success and session invalidation.
- [ ] Coach deletion blocked with another team member; empty-team Coach deletion succeeds.
- [ ] Cancellation remains possible before final deletion.
- [ ] Feedback categories, duplicate handling, SMTP failure and authorised delivery.
- [ ] Empty/error/loading states and slow/failed network behavior.
- [ ] Refresh/return to open views and protected direct URLs.
- [ ] Keyboard, visible focus, labels, errors, contrast and 200% zoom.

## Time behavior

Test in `Europe/Lisbon`, UTC and one negative-offset zone:

- [ ] Midnight date rollover.
- [ ] Rolling 24-hour API/rate-limit behavior.
- [ ] DST spring-forward and fall-back calendar occurrences.
- [ ] Recurring event exceptions on transition dates.
- [ ] Export generation timestamp and filename.
- [ ] Recent-auth deletion boundary before and after 15 minutes.

## Stop-ship failures

Any cross-user access, consent forgery, wrong-account export/deletion, under-18 bypass, Guardian access, destructive Coach cascade, health data in logs, migration failure, failed build or unusable restore makes the beta not ready.
