# Lodario beta monitoring and safe error handling

## Implemented locally

- `app/error.tsx` and `app/global-error.tsx` provide production-safe recovery screens.
- `/api/health` verifies public application configuration and Supabase reachability without selecting private data.
- Feedback, export and deletion responses include `X-Request-ID`.
- Server failures log only an allowlisted event label, correlation ID and HTTP status.
- Client data-layer logs use fixed operation labels and do not print returned records, Supabase error objects, user/team IDs, DOBs, email addresses or health context.
- Minimal `beta_operational_events` rows count export/deletion/feedback outcomes without message or health content.

## Vercel checks

Enable manually:

1. Deployment-failure notifications for Production and Preview.
2. Function error-rate and latency alerts for `/api/feedback`, `/api/account/export`, `/api/account/delete` and `/api/health`.
3. Availability monitoring of `https://lodario.vercel.app/api/health`.
4. Error and security log retention of 30 days.
5. Access restricted to the operator and explicitly authorised collaborators.

Immediate action:

- Repeated 5xx responses from deletion/export.
- `/api/health` degraded for more than five minutes.
- Authentication failure spike or unexplained 401/403 change.
- Deployment/build failure on Production.
- Evidence that request bodies, tokens, emails, DOB or health content entered logs.

## Supabase checks

Enable manually where the current plan supports them:

1. Database availability and connection saturation alerts.
2. Auth error-rate and suspicious sign-in notifications.
3. Backup/PITR failure notifications.
4. Database disk, CPU and memory warnings.
5. API 5xx and RLS-denial trend review.

Review daily during the first beta week, then weekly:

- Auth sign-ups and failures.
- Database/API error logs.
- `beta_operational_events` failure counts.
- Migration history.
- Backup status.
- Unexpected service-role or dashboard access.

## Safe triage

Search by request ID and timestamp. Do not paste whole request bodies, exports, database rows, email messages, tokens or screenshots containing health data into issue trackers. Record route, status, safe error label, affected release and whether the user confirmed impact.

Application errors are measured through Vercel error logs rather than a public analytics endpoint. If an error contains private information, restrict access, shorten retention, document the incident and remove the unsafe logging source.

## Approved retention

- Retain Vercel, Supabase and application error/security logs for 30 days.
- Configure provider retention to 30 days where the plan supports it.
- If a provider cannot enforce 30 days, document its actual minimum/maximum, restrict access, and treat the mismatch as a launch decision requiring owner approval.
- This rule does not extend the retention of request bodies or health data: those must not be logged at all.
