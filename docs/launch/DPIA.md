# Lodario country-policy public beta DPIA

**Technical scope updated 15 September 2026; legal review remains required.** See [current release evidence](country-beta-status.md). Historical 18+ assumptions below are superseded where identified.

**Status:** internal launch assessment, not professional legal certification

**Prepared:** 23 July 2026

**Review owner:** the legal operator configured through `LEGAL_OPERATOR_NAME`

**Review cadence:** before launch, after a material incident, every three months during beta, and before any scope change listed below

## Purpose and scope

Lodario provides Player, Coach and Guardian accounts, onboarding, profiles, teams, Coach-Player connections, wellness and training logs, readiness/load calculations, informational recommendations, pain and injury status, calendars, RSVP, attendance, analytics, feedback and support. Players follow configured country age/Guardian rules; Coaches remain 18+.

Guardian/minor flows are active, with verified email-bound invitations, relationship-scoped access, and Guardian acceptance of current documents where required. AI, payments, advertising, behavioural tracking, PostHog and health-device integrations are excluded.

## People and roles

- **Players:** enter profile, wellness, training, pain/injury, calendar and team information.
- **Coaches:** create/manage teams and view connected Players only through active managed-team relationships.
- **Guardians:** receive only the permitted overview through verified, active relationships; younger Players need their approval and document acceptance.
- **Operator/support:** may access only what is necessary through trusted Supabase, Vercel and support-email administration.

## Data inventory, source, purpose and access

| Category | Source | Purpose | Permitted access |
| --- | --- | --- | --- |
| Authentication identifiers and email | User/Supabase Auth | Account access, verification, reset, security | Account owner; trusted Auth administration |
| Name, role and Player profile | User | Personalisation, onboarding, team display | Owner; legitimate managed-team Coach for permitted Player fields |
| DOB, country and eligibility | User; authoritative age identity | Apply country policy and Guardian requirements | Owner through narrow RPCs; verified Guardian where approval requires it; trusted administration |
| Teams, invite codes and memberships | Coach/Player actions | Team connection and management | Related member; managing Coach |
| Wellness, sleep, fatigue, stress and notes | Player | Readiness and trends | Player; legitimate managing Coach |
| Training sessions, load and notes | Player | Load, analytics and recommendations | Player; legitimate managing Coach |
| Pain and injury information | Player/system threshold | Informational support and safety context | Player; legitimate managing Coach |
| Calendar, RSVP and attendance | Player/Coach | Scheduling and participation | Player; legitimate managing Coach |
| Required consent history | Server after user action | Prove exact accepted document version/time | Owner read; trusted administration |
| Feedback and support content | User/app context | Investigate and answer requests | Operator/support and Gmail delivery |
| Minimal operational events | Application | Count export/deletion/feedback success/failure | Operator aggregates only |
| Guardian records and document acceptance | Invitation and approval flows | Relationship authorization and consent evidence | Verified participants through RLS/RPCs; trusted administration |

Readiness, load and recommendation results are derived from source records. Recommendations are not stored as independent database records.

## Providers and transfers

- **Supabase:** authentication and PostgreSQL application data.
- **Vercel:** application hosting, request execution and platform logs.
- **Google/Gmail SMTP:** feedback and support delivery.

Provider region, contractual transfer mechanism, subprocessors and retention must be confirmed in the operator’s live accounts before launch. No claim is made here that a particular legal transfer mechanism applies.

## Retention, export and deletion

- Account data remains until the user deletes the account.
- Error and security logs are retained for 30 days.
- Feedback and support emails are retained for 12 months.
- Manual backups are retained for 30 days and then securely deleted.
- Required acceptance history remains with the account and is removed on account deletion; records cannot be edited.
- Self-service export returns the owner’s data. Coach export contains owned-team metadata but no unrelated Player health records.
- Self-service deletion requires recent authentication and an exact confirmation phrase.
- Coach deletion is blocked while an owned team contains another user.
- Deleting a Coach does not delete Player-owned health records. Deleting a Player does not delete unrelated Coach/team accounts.
- Minimal completed-deletion operational events lose the user reference through `ON DELETE SET NULL`.
- Provider-managed automatic backups may retain deleted information temporarily according to the verified Supabase plan and recovery configuration; this is separate from the 30-day manual-backup rule.

## Security measures

- Supabase RLS on all browser tables.
- Owner predicates on private records and managed-team checks for Coach access.
- Country eligibility and current-consent restrictive policies/triggers on core tables.
- Guardian reads require verified relationships, appropriate permissions and current Player consent; direct core health tables remain inaccessible to Guardians.
- No service-role credential in browser or application environment.
- Owner-scoped export/deletion functions accept no target user ID.
- Recent JWT issue-time check, explicit phrase and team-ownership block for deletion.
- Immutable consent records with server timestamps.
- Same-origin checks, authentication, bounded input, honeypot, rate limiting and duplicate detection on sensitive APIs.
- Safe correlation-ID logging without health content, DOB, email, token or request body.
- Backup-before-migration and isolated restore testing.

## Risk assessment

| Risk | Likelihood | Severity | Mitigation | Remaining risk |
| --- | --- | --- | --- | --- |
| Wrong Coach views a Player | Possible | High | Active managed-team checks, RLS, relationship tests | Compromised Coach account |
| Cross-team access | Possible | High | `can_manage_team`, owner policies, negative tests | Policy regression until database tests run |
| Account takeover | Possible | High | Supabase Auth, reset flow, recent-auth deletion | Email-account compromise |
| Guardian/age-gate bypass | Unlikely after migration | High | Route/API blocks, adult RLS/triggers, privilege revocation | Pending migration is not applied/tested locally |
| Sensitive information in logs | Possible | High | Fixed safe log labels and correlation IDs | Provider/platform metadata requires manual review |
| Accidental or hostile deletion | Unlikely | High | No target ID, exact phrase, recent auth, transaction, Coach ownership block | User may misunderstand permanent effect |
| Deletion partially fails | Unlikely | High | Single database transaction, safe retry/support path | Must verify against isolated representative data |
| Failed or unusable backup | Possible | High | Dashboard checkpoint, three logical dumps, isolated restore drill | Native PostgreSQL restore verified public/Auth/Storage metadata; backups currently depend on the local PC |
| Excessive retention | Possible | Medium/High | Account deletion, 30-day logs, 12-month feedback email, 30-day manual backups, quarterly review | Provider-managed automatic-backup retention must be verified manually |
| Future AI accesses health data | Not in beta | High | AI UI/API flags off; existing key is server-only and inactive | Requires new DPIA and explicit approval |
| Future payment processing | Not in beta | High | Payment/subscription flags off | Requires provider/security/legal review |
| Minor processing | In beta | Very high | Country rules, verified Guardian relationships, exact document acceptance and restricted sporting-data access | Legal review of thresholds, consent and health processing remains required |
| Availability/failed requests | Possible | Medium | Health endpoint, error boundaries, Vercel/Supabase monitoring | No paid multi-region monitoring |

## Incident response

1. Stop the affected rollout or disable the affected feature.
2. Preserve safe correlation IDs and platform timestamps; do not copy health records into tickets.
3. Determine affected users, resources, time window and access path.
4. Rotate credentials only under a separately approved incident procedure.
5. Restore service with a reviewed code rollback or forward database fix.
6. Assess notification/legal obligations with qualified advice.
7. Document cause, containment, remediation and follow-up tests.

## Changes requiring a new DPIA review

- AI or automated-model access to Player information.
- Payments, subscriptions, advertising or third-party analytics.
- Minor registration or Guardian activation.
- Wearables, Health Connect or other health integrations.
- New sensitive categories, automated medical claims or materially changed formulas.
- New providers, storage regions, public dashboards or broader Coach access.
- Material retention, export, deletion, authentication or RLS changes.

## Open concerns

- All five pending migrations passed against an isolated restored database, including the Player-subject consent protection.
- The country and schema-reconciliation migrations fix the DOB evaluator argument and ambiguous AI credit reference; see the current release record for hosted lint results.
- Hosted plan, region and backup availability have been checked. Current recovery depends on the local maintenance task; independent offsite recovery and always-on alerting are suggested improvements. Provider logs expire within the documented 30-day maximum.
- Professional legal review is intentionally scheduled later.
