# Lodario 18+ beta release checklist

## Source and scope

- [x] Inspect `git status --short`; identify all intentional and pre-existing changes.
- [ ] Confirm the approved branch and commit SHA.
- [x] Confirm AI, PostHog, payments, ads, minors, Guardian access and health integrations remain disabled.
- [x] Scan tracked files, Git history and client bundles for secret patterns.
- [x] Confirm `.env.local`, dumps and generated service-worker output are ignored.

## Database safety

- [x] `npx supabase migration list --linked`
- [ ] Verify Dashboard backup/PITR status and retention.
- [x] Run password-free roles plus public schema/data logical dumps.
- [x] Record a deletion date 30 days after each manual dump is created.
- [x] Complete an isolated restore drill.
- [x] Apply all migrations locally in historical order.
- [ ] Run database lint and resolve/review every error.
- [x] `npx supabase db push --linked --dry-run`
- [x] Confirm only the expected pending migrations and order.
- [ ] Obtain explicit production-migration approval.

## Code validation

- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm test`
- [x] Security/RLS contract tests pass.
- [x] Integration/database tests pass in isolation and against restored representative data.
- [x] `npm run build`
- [ ] Preview route, mobile, accessibility and authenticated smoke tests pass.
- [ ] Feedback sends only to the authorised test inbox.

## Preview

- [ ] Configure all required Preview variables.
- [ ] Use an isolated Supabase project unless explicitly approving production reads.
- [ ] Add only exact intentional Preview Auth redirect URLs.
- [ ] Test new/existing Player and Coach accounts, 18+ DOB, consent, export, deletion block/success, team isolation and error states.

## Production

- [ ] Configure domain, DNS, Auth Site URL/redirect, SMTP and environment variables.
- [ ] Configure error/security log retention to 30 days and feedback/support email retention to 12 months.
- [ ] Run final backup and dry run.
- [ ] Apply approved migrations.
- [ ] Deploy the reviewed commit.
- [ ] Smoke-test public pages, sign-in/reset, core Player/Coach paths, consent, export and feedback.
- [ ] Verify Guardian/API denial and excluded-feature absence.
- [ ] Check `/api/health`, Vercel errors, Supabase logs and operational failure counts.

## Rollback decision

Stop rollout for migration errors, cross-user exposure, deletion/export targeting failure, Guardian/under-18 bypass, widespread 5xx, secret exposure or health data in logs. Follow `rollback-plan.md`; never reset or restore production casually.
