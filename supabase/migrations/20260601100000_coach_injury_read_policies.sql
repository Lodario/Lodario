-- Migration: Coach read access to managed team player injuries
-- Date: 2026-06-01
--
-- Allows coaches to read injury rows for players on teams they manage.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'injuries'
      AND policyname = 'Coaches can view managed team player injuries'
  ) THEN
    CREATE POLICY "Coaches can view managed team player injuries"
      ON public.injuries
      FOR SELECT
      TO authenticated
      USING (
        auth.uid() = user_id
        OR EXISTS (
          SELECT 1
          FROM public.team_memberships tm
          WHERE tm.user_id = injuries.user_id
            AND tm.role = 'player'
            AND tm.status = 'active'
            AND public.can_manage_team(tm.team_id, auth.uid())
        )
      );
  END IF;
END;
$$;
