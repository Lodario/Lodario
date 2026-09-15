-- Stop Coach reads/writes as soon as the subject Player loses eligibility or consent.
BEGIN;
CREATE OR REPLACE FUNCTION public.public_beta_can_process_subject(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT auth.uid() IS NOT NULL
    AND (auth.uid()=p_user_id OR EXISTS (
      SELECT 1 FROM public.team_memberships membership WHERE membership.user_id=p_user_id
        AND membership.role='player' AND membership.status='active'
        AND public.can_manage_team(membership.team_id,auth.uid())))
    AND public.public_beta_user_age_eligible(p_user_id)
    AND public.public_beta_has_required_consents(p_user_id);
$$;
REVOKE ALL ON FUNCTION public.public_beta_can_process_subject(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.public_beta_can_process_subject(UUID) TO authenticated, service_role;
CREATE POLICY "Subject consent required for shared profiles" ON public.profiles
  AS RESTRICTIVE FOR SELECT TO authenticated USING(auth.uid()=id OR public.public_beta_can_process_subject(id));
CREATE POLICY "Subject eligibility and consent required" ON public.wellness_logs AS RESTRICTIVE FOR ALL TO authenticated USING(public.public_beta_can_process_subject(user_id)) WITH CHECK(public.public_beta_can_process_subject(user_id));
CREATE POLICY "Subject eligibility and consent required" ON public.training_logs AS RESTRICTIVE FOR ALL TO authenticated USING(public.public_beta_can_process_subject(user_id)) WITH CHECK(public.public_beta_can_process_subject(user_id));
CREATE POLICY "Subject eligibility and consent required" ON public.calendar_events AS RESTRICTIVE FOR ALL TO authenticated USING(public.public_beta_can_process_subject(user_id)) WITH CHECK(public.public_beta_can_process_subject(user_id));
CREATE POLICY "Subject eligibility and consent required" ON public.custom_event_types AS RESTRICTIVE FOR ALL TO authenticated USING(public.public_beta_can_process_subject(user_id)) WITH CHECK(public.public_beta_can_process_subject(user_id));
CREATE POLICY "Subject eligibility and consent required" ON public.injuries AS RESTRICTIVE FOR ALL TO authenticated USING(public.public_beta_can_process_subject(user_id)) WITH CHECK(public.public_beta_can_process_subject(user_id));
CREATE POLICY "Subject eligibility and consent required" ON public.player_calendar_event_color_overrides AS RESTRICTIVE FOR ALL TO authenticated USING(public.public_beta_can_process_subject(user_id)) WITH CHECK(public.public_beta_can_process_subject(user_id));
CREATE POLICY "Subject eligibility and consent required" ON public.calendar_event_attendance AS RESTRICTIVE FOR ALL TO authenticated USING(public.public_beta_can_process_subject(player_id)) WITH CHECK(public.public_beta_can_process_subject(player_id));
CREATE POLICY "Subject eligibility and consent required" ON public.event_attendance AS RESTRICTIVE FOR ALL TO authenticated USING(public.public_beta_can_process_subject(player_id)) WITH CHECK(public.public_beta_can_process_subject(player_id));

CREATE OR REPLACE FUNCTION public.is_active_team_player(p_team_id uuid, p_player_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.public_beta_current_user_can_access()
    AND public.public_beta_user_age_eligible(p_player_id)
    AND public.public_beta_has_required_consents(p_player_id)
    AND EXISTS (
      SELECT 1 FROM public.team_memberships membership
      WHERE membership.team_id = p_team_id
        AND membership.user_id = p_player_id
        AND membership.role = 'player'
        AND membership.status = 'active'
    );
$function$
;

CREATE OR REPLACE FUNCTION public.get_team_players(p_team_id uuid)
 RETURNS TABLE(user_id uuid, display_name text, email text, age integer, height_cm numeric, weight_kg numeric, positions text[], joined_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_manage_team(p_team_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to view this team.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    tm.user_id::UUID AS user_id,
    coalesce(
      nullif(trim(p.display_name), ''),
      nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(u.email::TEXT, ''::TEXT), '@'::TEXT, 1), ''),
      concat('Player '::TEXT, left(tm.user_id::TEXT, 8))
    )::TEXT AS display_name,
    u.email::TEXT AS email,
    p.age::INTEGER AS age,
    p.height_cm::NUMERIC AS height_cm,
    p.weight_kg::NUMERIC AS weight_kg,
    coalesce(p.positions, '{}'::TEXT[])::TEXT[] AS positions,
    tm.joined_at::TIMESTAMPTZ AS joined_at
  FROM public.team_memberships tm
  LEFT JOIN public.profiles p
    ON p.id = tm.user_id
  LEFT JOIN auth.users u
    ON u.id = tm.user_id
  WHERE tm.team_id = p_team_id
    AND tm.role = 'player'
    AND tm.status = 'active'
    AND public.public_beta_user_age_eligible(tm.user_id)
    AND public.public_beta_has_required_consents(tm.user_id)
  ORDER BY tm.joined_at ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_calendar_event_attendance_roster(p_team_id uuid, p_event_group_id text, p_occurrence_date date)
 RETURNS TABLE(player_id uuid, display_name text, email text, rsvp_status text, rsvp_updated_at timestamp with time zone, attendance_status text, attendance_updated_at timestamp with time zone, attendance_recorded_by uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  active_user_id UUID;
  event_scope RECORD;
BEGIN
  active_user_id := auth.uid();

  IF active_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_manage_team(p_team_id, active_user_id) THEN
    RAISE EXCEPTION 'Not authorized to view attendance for this team.' USING ERRCODE = '42501';
  END IF;

  SELECT scope.assignment_scope, scope.assigned_player_id
  INTO event_scope
  FROM public.get_coach_calendar_event_scope(p_team_id, p_event_group_id, p_occurrence_date) AS scope
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attendance is not available for this event.' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    tm.user_id::UUID AS player_id,
    coalesce(
      nullif(trim(p.display_name), ''),
      nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(u.email::TEXT, ''::TEXT), '@'::TEXT, 1), ''),
      concat('Player '::TEXT, left(tm.user_id::TEXT, 8))
    )::TEXT AS display_name,
    u.email::TEXT AS email,
    cea.rsvp_status::TEXT AS rsvp_status,
    cea.rsvp_updated_at::TIMESTAMPTZ AS rsvp_updated_at,
    cea.attendance_status::TEXT AS attendance_status,
    cea.attendance_updated_at::TIMESTAMPTZ AS attendance_updated_at,
    cea.attendance_recorded_by::UUID AS attendance_recorded_by
  FROM public.team_memberships tm
  LEFT JOIN public.profiles p
    ON p.id = tm.user_id
  LEFT JOIN auth.users u
    ON u.id = tm.user_id
  LEFT JOIN public.calendar_event_attendance cea
    ON cea.team_id = p_team_id
   AND cea.event_group_id = p_event_group_id
   AND cea.occurrence_date = p_occurrence_date
   AND cea.player_id = tm.user_id
  WHERE tm.team_id = p_team_id
    AND tm.role = 'player'
    AND tm.status = 'active'
    AND public.public_beta_user_age_eligible(tm.user_id)
    AND public.public_beta_has_required_consents(tm.user_id)
    AND (
      event_scope.assignment_scope = 'team'
      OR tm.user_id = event_scope.assigned_player_id
    )
  ORDER BY display_name ASC;
END;
$function$
;
NOTIFY pgrst, 'reload schema';
COMMIT;
