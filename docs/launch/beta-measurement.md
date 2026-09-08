# Privacy-friendly beta measurement

Lodario uses existing records and a minimal first-party operational table. It adds no advertising profile, fingerprinting, PostHog or third-party behavioural analytics.

## Metrics

| Metric | Definition/source |
| --- | --- |
| Registration completion | Count of `auth.users` accounts |
| Player vs Coach onboarding | Profile role and `onboarding_completed`; Coach workspace entry is approximated by a Coach profile because no separate Coach wizard exists |
| Team creation | Count of `teams` |
| Coach-Player connection | Active Player `team_memberships` |
| First wellness/training | Distinct owners in respective log table |
| Calendar usage | Distinct owners in `calendar_events` |
| RSVP/attendance | Distinct Players with non-null states in `calendar_event_attendance` |
| Returning active users | Distinct owners with a log/event changed in the last seven days |
| Export/deletion/feedback | Allowlisted `beta_operational_events` counts |
| Application errors | Vercel error logs and `/api/health`; not a public analytics event |

Run `supabase/beta_metrics_report.sql` only as the operator in Supabase SQL Editor or another trusted administrative connection. It returns aggregates, never emails, DOB, wellness answers, injury details or notes.

## Data minimisation and access

`beta_operational_events` stores event type, request UUID, optional account role, user reference and time. Deletion sets the user reference to null. No event property or free-text column exists. Browser roles cannot select the table; the aggregate report is not exposed publicly.

Do not export per-user event rows for product analysis. Suppress or combine small cohorts before sharing a report. Restrict reports to the operator.

User-linked operational rows follow the account-data rule and remain until account deletion. Error/security logs used for application-error measurement are retained for 30 days.

## Review and removal

Review monthly whether each metric supports a launch decision. Remove unused events with a new migration and update the Privacy Policy. A future analytics provider, advertising measurement, fingerprinting or health-data event requires explicit approval and a new DPIA review.
