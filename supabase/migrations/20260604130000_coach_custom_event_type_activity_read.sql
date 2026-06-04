-- Allow coaches to classify player-created calendar events as activity-related
-- without exposing those events in team-wide coach calendars.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'custom_event_types'
      AND policyname = 'Coaches can view managed team player event types'
  ) THEN
    CREATE POLICY "Coaches can view managed team player event types"
      ON public.custom_event_types
      FOR SELECT
      TO authenticated
      USING (
        auth.uid() = user_id
        OR EXISTS (
          SELECT 1
          FROM public.team_memberships tm
          WHERE tm.user_id = custom_event_types.user_id
            AND tm.role = 'player'
            AND tm.status = 'active'
            AND public.can_manage_team(tm.team_id, auth.uid())
        )
      );
  END IF;
END;
$$;
