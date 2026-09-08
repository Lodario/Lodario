-- Lodario 18+ beta aggregate report.
-- Run only as the project operator in Supabase SQL Editor or an equivalent
-- trusted administrative connection. This file returns counts only.
-- It never selects emails, DOBs, wellness answers, injury details, or notes.

WITH account_summary AS (
  SELECT
    count(*) AS registered_accounts,
    count(*) FILTER (WHERE profile.role = 'player') AS players,
    count(*) FILTER (WHERE profile.role = 'coach') AS coaches,
    count(*) FILTER (WHERE profile.role = 'player' AND profile.onboarding_completed) AS player_onboarding_completed,
    count(*) FILTER (WHERE profile.role = 'coach') AS coach_workspace_entered
  FROM auth.users account
  LEFT JOIN public.profiles profile ON profile.id = account.id
),
product_summary AS (
  SELECT
    (SELECT count(*) FROM public.teams) AS teams_created,
    (SELECT count(*) FROM public.team_memberships WHERE role = 'player' AND status = 'active') AS active_coach_player_connections,
    (SELECT count(DISTINCT user_id) FROM public.wellness_logs) AS accounts_with_wellness,
    (SELECT count(DISTINCT user_id) FROM public.training_logs) AS accounts_with_training,
    (SELECT count(DISTINCT user_id) FROM public.calendar_events) AS accounts_with_calendar,
    (SELECT count(DISTINCT player_id) FROM public.calendar_event_attendance WHERE rsvp_status IS NOT NULL) AS accounts_with_rsvp,
    (SELECT count(DISTINCT player_id) FROM public.calendar_event_attendance WHERE attendance_status IS NOT NULL) AS accounts_with_attendance
),
active_accounts AS (
  SELECT count(DISTINCT activity.user_id) AS returning_active_users_7d
  FROM (
    SELECT user_id FROM public.wellness_logs WHERE created_at >= now() - INTERVAL '7 days'
    UNION ALL
    SELECT user_id FROM public.training_logs WHERE created_at >= now() - INTERVAL '7 days'
    UNION ALL
    SELECT user_id FROM public.calendar_events WHERE updated_at >= now() - INTERVAL '7 days'
  ) activity
),
operations AS (
  SELECT
    count(*) FILTER (WHERE event_type = 'export_completed') AS exports_completed,
    count(*) FILTER (WHERE event_type = 'export_failed') AS exports_failed,
    count(*) FILTER (WHERE event_type = 'deletion_completed') AS deletions_completed,
    count(*) FILTER (WHERE event_type = 'deletion_failed') AS deletions_failed,
    count(*) FILTER (WHERE event_type = 'feedback_submitted') AS feedback_submitted,
    count(*) FILTER (WHERE event_type = 'feedback_failed') AS feedback_failed
  FROM public.beta_operational_events
)
SELECT *
FROM account_summary
CROSS JOIN product_summary
CROSS JOIN active_accounts
CROSS JOIN operations;

-- Daily operational trend. Counts only.
SELECT
  occurred_at::DATE AS day,
  event_type,
  count(*) AS event_count
FROM public.beta_operational_events
GROUP BY occurred_at::DATE, event_type
ORDER BY day DESC, event_type;
