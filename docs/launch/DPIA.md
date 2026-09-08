# Lodario 18+ public beta DPIA

**Status:** internal launch assessment, not professional legal certification

**Prepared:** 23 July 2026

**Review owner:** the legal operator configured through `LEGAL_OPERATOR_NAME`

**Review cadence:** before launch, after a material incident, every three months during beta, and before any scope change listed below

## Purpose and scope

Lodario provides Player and Coach authentication, onboarding, profiles, teams, Coach-Player connections, wellness and training logs, readiness/load calculations, informational recommendations, pain and injury status, calendars, RSVP, attendance, analytics, feedback and support. The public beta is limited to adults aged 18 or older.

Guardian/minor infrastructure remains in historical migrations but is disabled by application flags, route controls, API denial, privilege revocation and the pending 18+ migration. AI, payments, advertising, behavioural tracking, PostHog and health-device integrations are excluded.

## People and roles

- **Players:** enter profile, wellness, training, pain/injury, calendar and team information.
- **Coaches:** create/manage teams and view connected Players only through active managed-team relationships.
- **Future Guardians:** schema exists for later phases but public registration and access are disabled.
- **Operator/support:** may access only what is necessary through trusted Supabase, Vercel and support-email administration.

## Data inventory, source, purpose and access

| Category | Source | Purpose | Permitted access |
| --- | --- | --- | --- |
| Authentication identifiers and email | User/Supabase Auth | Account access, verification, reset, security | Account owner; trusted Auth administration |
| Name, role and Player profile | User | Personalisation, onboarding, team display | Owner; legitimate managed-team Coach for permitted Player fields |
| DOB and adult eligibility | User; legacy authoritative age identity | Enforce 18+ beta | Owner through narrow status RPC; trusted administration |
| Teams, invite codes and memberships | Coach/Player actions | Team connection and management | Related member; managing Coach |
| Wellness, sleep, fatigue, stress and notes | Player | Readiness and trends | Player; legitimate managing Coach |
| Training sessions, load and notes | Player | Load, analytics and recommendations | Player; legitimate managing Coach |
| Pain and injury information | Player/system threshold | Informational support and safety context | Player; legitimate managing Coach |
| Calendar, RSVP and attendance | Player/Coach | Scheduling and participation | Player; legitimate managing Coach |
| Required consent history | Server after user action | Prove exact accepted document version/time | Owner read; trusted administration |
| Feedback and support content | User/app context | Investigate and answer requests | Operator/support and Gmail delivery |
| Minimal operational events | Application | Count export/deletion/feedback success/failure | Operator aggregates only |
| Guardian records | Historical/future flows | Future Guardian lifecycle | Inactive for beta; trusted administration only after pending gate |

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
- Adult restrictive policies/triggers on core tables in the pending 18+ gate.
- Guardian routes disabled; Guardian tables/RPCs revoked by the pending gate.
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
| Failed or unusable backup | Possible | High | Dashboard checkpoint, three logical dumps, isolated restore drill | Current restore drill is blocked by Docker/`psql` |
| Excessive retention | Possible | Medium/High | Account deletion, 30-day logs, 12-month feedback email, 30-day manual backups, quarterly review | Provider-managed automatic-backup retention must be verified manually |
| Future AI accesses health data | Not in beta | High | AI flag off; no AI environment key | Requires new DPIA and explicit approval |
| Future payment processing | Not in beta | High | Payment/subscription flags off | Requires provider/security/legal review |
| Future minor processing | Not in beta | Very high | 18+ gate and Guardian shutdown | Requires new DPIA, consent/legal review |
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

- Pending migrations have not run against an isolated restored database.
- Linked database lint has two historical errors in disabled AI/Guardian functions.
- Provider plan, region, automatic-backup retention and alert settings require operator confirmation. Vercel/Supabase error and security log retention must be configured to 30 days where supported.
- Professional legal review is intentionally scheduled later.
