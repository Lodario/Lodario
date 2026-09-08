-- Temporary 18+ enforcement for the Lodario public beta.
-- This is additive/corrective: guardian/minor data is preserved for a later launch.

-- Reuse the existing database feature-flag store. All guardian/country-minor
-- flows stay off while the separate public-beta gate stays on.
UPDATE public.guardian_feature_flags
SET enabled = FALSE,
    updated_at = now()
WHERE enabled IS DISTINCT FROM FALSE;

INSERT INTO public.guardian_feature_flags(flag_key, enabled, description, metadata)
VALUES (
  'public_beta_18_plus_enabled',
  TRUE,
  'Requires a server-validated age of 18 or older for the temporary public beta.',
  '{"temporary":true,"minimumAge":18}'::JSONB
)
ON CONFLICT (flag_key) DO UPDATE
SET enabled = EXCLUDED.enabled,
    description = EXCLUDED.description,
    metadata = EXCLUDED.metadata,
    updated_at = now();

CREATE OR REPLACE FUNCTION public.public_beta_age_gate_enabled()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((
    SELECT enabled
    FROM public.guardian_feature_flags
    WHERE flag_key = 'public_beta_18_plus_enabled'
  ), FALSE);
$$;

CREATE OR REPLACE FUNCTION public.public_beta_valid_date_of_birth(
  p_date_of_birth DATE,
  p_as_of DATE DEFAULT current_date
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_date_of_birth IS NOT NULL
    AND p_as_of IS NOT NULL
    AND p_date_of_birth <= p_as_of
    AND public.calculate_player_age(p_date_of_birth, p_as_of) BETWEEN 0 AND 99;
$$;

CREATE OR REPLACE FUNCTION public.public_beta_stored_date_of_birth(p_user_id UUID)
RETURNS DATE
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT identity.date_of_birth
     FROM public.player_age_identities identity
     WHERE identity.player_user_id = p_user_id
       AND public.public_beta_valid_date_of_birth(identity.date_of_birth, current_date)),
    (SELECT profile.date_of_birth
     FROM public.profiles profile
     WHERE profile.id = p_user_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.public_beta_current_user_is_adult()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.public_beta_age_gate_enabled()
    AND auth.uid() IS NOT NULL
    AND public.public_beta_valid_date_of_birth(
      public.public_beta_stored_date_of_birth(auth.uid()),
      current_date
    )
    AND public.calculate_player_age(
      public.public_beta_stored_date_of_birth(auth.uid()),
      current_date
    ) >= 18;
$$;

CREATE OR REPLACE FUNCTION public.public_beta_assert_current_user_adult()
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.public_beta_current_user_is_adult() THEN
    RAISE EXCEPTION 'The Lodario public beta is only available to users aged 18 or older.'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.public_beta_get_my_age_status()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_user UUID := auth.uid();
  stored_date_of_birth DATE;
  completed_age INTEGER;
  active_role TEXT;
  valid_date_of_birth BOOLEAN;
BEGIN
  IF active_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(
    (SELECT profile.role FROM public.profiles profile WHERE profile.id = active_user),
    (SELECT account_role.role
     FROM public.user_account_roles account_role
     WHERE account_role.user_id = active_user
       AND account_role.status = 'active'
       AND account_role.role IN ('player', 'coach')
     ORDER BY CASE account_role.role WHEN 'player' THEN 1 ELSE 2 END
     LIMIT 1)
  ) INTO active_role;

  stored_date_of_birth := public.public_beta_stored_date_of_birth(active_user);
  valid_date_of_birth := public.public_beta_valid_date_of_birth(stored_date_of_birth, current_date);
  completed_age := CASE
    WHEN valid_date_of_birth THEN public.calculate_player_age(stored_date_of_birth, current_date)
    ELSE NULL
  END;

  RETURN jsonb_build_object(
    'hasDateOfBirth', valid_date_of_birth,
    'eligible', public.public_beta_age_gate_enabled()
      AND active_role IN ('player', 'coach')
      AND coalesce(completed_age >= 18, FALSE),
    'age', completed_age,
    'dateOfBirth', CASE WHEN valid_date_of_birth THEN stored_date_of_birth ELSE NULL END,
    'role', CASE WHEN active_role IN ('player', 'coach') THEN active_role ELSE NULL END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.public_beta_set_my_date_of_birth(p_date_of_birth DATE)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_user UUID := auth.uid();
  stored_date_of_birth DATE;
  completed_age INTEGER;
  active_role TEXT;
BEGIN
  IF active_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.public_beta_age_gate_enabled() THEN
    RAISE EXCEPTION 'Public-beta age verification is unavailable.' USING ERRCODE = '55000';
  END IF;

  IF NOT public.public_beta_valid_date_of_birth(p_date_of_birth, current_date) THEN
    RAISE EXCEPTION 'Enter a valid date of birth.' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(
    (SELECT profile.role FROM public.profiles profile WHERE profile.id = active_user),
    (SELECT account_role.role
     FROM public.user_account_roles account_role
     WHERE account_role.user_id = active_user
       AND account_role.status = 'active'
       AND account_role.role IN ('player', 'coach')
     ORDER BY CASE account_role.role WHEN 'player' THEN 1 ELSE 2 END
     LIMIT 1)
  ) INTO active_role;

  IF active_role NOT IN ('player', 'coach') THEN
    RAISE EXCEPTION 'Choose a Player or Coach role before confirming age.'
      USING ERRCODE = '42501';
  END IF;

  stored_date_of_birth := public.public_beta_stored_date_of_birth(active_user);
  IF public.public_beta_valid_date_of_birth(stored_date_of_birth, current_date)
     AND stored_date_of_birth IS DISTINCT FROM p_date_of_birth THEN
    RAISE EXCEPTION 'Date of birth is already recorded. Contact Lodario support to request a correction.'
      USING ERRCODE = '23505';
  END IF;

  completed_age := public.calculate_player_age(p_date_of_birth, current_date);
  INSERT INTO public.profiles(id, age, date_of_birth, positions, priorities, role)
  VALUES (active_user, completed_age, p_date_of_birth, '{}'::TEXT[], '{}'::TEXT[], active_role)
  ON CONFLICT (id) DO UPDATE
  SET age = EXCLUDED.age,
      date_of_birth = EXCLUDED.date_of_birth;

  RETURN public.public_beta_get_my_age_status();
END;
$$;

-- Preserve guardian age identities as the authoritative source where they
-- already exist, while making the existing profile DOB available to beta UI.
UPDATE public.profiles profile
SET date_of_birth = identity.date_of_birth,
    age = public.calculate_player_age(identity.date_of_birth, current_date)
FROM public.player_age_identities identity
WHERE identity.player_user_id = profile.id
  AND public.public_beta_valid_date_of_birth(identity.date_of_birth, current_date)
  AND (
    profile.date_of_birth IS DISTINCT FROM identity.date_of_birth
    OR profile.age IS DISTINCT FROM public.calculate_player_age(identity.date_of_birth, current_date)
  );

CREATE OR REPLACE FUNCTION public.enforce_public_beta_profile_date_of_birth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.date_of_birth IS NOT NULL
     AND NOT public.public_beta_valid_date_of_birth(NEW.date_of_birth, current_date) THEN
    RAISE EXCEPTION 'Enter a valid date of birth.' USING ERRCODE = '22023';
  END IF;

  IF TG_OP = 'UPDATE'
     AND public.public_beta_valid_date_of_birth(OLD.date_of_birth, current_date)
     AND NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth
     AND auth.uid() IS NOT NULL
     AND coalesce(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Date of birth is already recorded. Contact Lodario support to request a correction.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.date_of_birth IS NOT NULL THEN
    NEW.age := public.calculate_player_age(NEW.date_of_birth, current_date);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_public_beta_profile_date_of_birth ON public.profiles;
CREATE TRIGGER enforce_public_beta_profile_date_of_birth
  BEFORE INSERT OR UPDATE OF date_of_birth, age ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_public_beta_profile_date_of_birth();

-- Make the existing team permission helpers fail closed for an under-18
-- caller. Privileged team/attendance reads already route through these.
CREATE OR REPLACE FUNCTION public.is_team_creator(
  p_team_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.public_beta_current_user_is_adult()
    AND EXISTS (
      SELECT 1 FROM public.teams team
      WHERE team.id = p_team_id AND team.created_by = p_user_id
    );
$$;

CREATE OR REPLACE FUNCTION public.is_active_team_member(
  p_team_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.public_beta_current_user_is_adult()
    AND EXISTS (
      SELECT 1 FROM public.team_memberships membership
      WHERE membership.team_id = p_team_id
        AND membership.user_id = p_user_id
        AND membership.status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_active_team_coach(
  p_team_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.public_beta_current_user_is_adult()
    AND EXISTS (
      SELECT 1 FROM public.team_memberships membership
      WHERE membership.team_id = p_team_id
        AND membership.user_id = p_user_id
        AND membership.role = 'coach'
        AND membership.status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_team(
  p_team_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.public_beta_current_user_is_adult()
    AND (
      public.is_team_creator(p_team_id, p_user_id)
      OR public.is_active_team_coach(p_team_id, p_user_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.is_active_team_player(
  p_team_id UUID,
  p_player_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.public_beta_current_user_is_adult()
    AND EXISTS (
      SELECT 1 FROM public.team_memberships membership
      WHERE membership.team_id = p_team_id
        AND membership.user_id = p_player_id
        AND membership.role = 'player'
        AND membership.status = 'active'
    );
$$;

-- Restrictive policies cover direct table access. Existing permissive owner,
-- team, coach, and player policies remain unchanged and must also pass.
DO $$
DECLARE
  protected_table TEXT;
BEGIN
  FOREACH protected_table IN ARRAY ARRAY[
    'wellness_logs',
    'training_logs',
    'calendar_events',
    'custom_event_types',
    'injuries',
    'teams',
    'team_memberships',
    'event_attendance',
    'calendar_event_attendance',
    'player_calendar_event_color_overrides'
  ] LOOP
    IF to_regclass(format('public.%I', protected_table)) IS NOT NULL THEN
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON public.%I',
        '18+ public beta access required',
        protected_table
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.public_beta_current_user_is_adult()) WITH CHECK (public.public_beta_current_user_is_adult())',
        '18+ public beta access required',
        protected_table
      );
    END IF;
  END LOOP;
END;
$$;

-- Table triggers also cover writes made by SECURITY DEFINER RPCs, which bypass
-- RLS by design (team join and RSVP/attendance are the important cases).
CREATE OR REPLACE FUNCTION public.enforce_public_beta_adult_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND auth.uid() IS NOT NULL
     AND current_setting('lodario.public_beta_self_delete_user_id', TRUE) = auth.uid()::TEXT THEN
    RETURN OLD;
  END IF;

  IF auth.uid() IS NOT NULL
     AND coalesce(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    PERFORM public.public_beta_assert_current_user_adult();
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  protected_table TEXT;
BEGIN
  FOREACH protected_table IN ARRAY ARRAY[
    'wellness_logs',
    'training_logs',
    'calendar_events',
    'custom_event_types',
    'injuries',
    'teams',
    'team_memberships',
    'event_attendance',
    'calendar_event_attendance',
    'player_calendar_event_color_overrides'
  ] LOOP
    IF to_regclass(format('public.%I', protected_table)) IS NOT NULL THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS enforce_public_beta_adult_write ON public.%I',
        protected_table
      );
      EXECUTE format(
        'CREATE TRIGGER enforce_public_beta_adult_write BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_public_beta_adult_write()',
        protected_table
      );
    END IF;
  END LOOP;
END;
$$;

-- Helper functions needed only inside attendance RPCs should not be callable
-- as standalone data probes through PostgREST.
REVOKE ALL ON FUNCTION public.get_coach_calendar_event_scope(UUID, TEXT, DATE)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calendar_event_attendance_player_is_eligible(UUID, TEXT, DATE, UUID)
  FROM PUBLIC, anon, authenticated;

-- Guardian and country-minor RPCs remain in place but are not executable by
-- beta users. Service-role-only review/reconciliation grants are untouched.
DO $$
DECLARE
  guardian_function RECORD;
BEGIN
  FOR guardian_function IN
    SELECT proc.oid::regprocedure AS signature
    FROM pg_proc proc
    JOIN pg_namespace namespace ON namespace.oid = proc.pronamespace
    WHERE namespace.nspname = 'public'
      AND (
        proc.proname LIKE 'guardian_%'
        OR proc.proname IN (
          'is_guardian',
          'evaluate_player_age_policy',
          'player_set_initial_age',
          'player_get_my_guardian_state',
          'process_my_age_transition',
          'player_decide_adult_guardian_access',
          'player_request_dob_correction',
          'revoke_guardian_relationship',
          'create_guardian_privacy_request',
          'coach_get_guardian_status',
          'player_is_guardian_restricted'
        )
      )
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      guardian_function.signature
    );
  END LOOP;
END;
$$;

-- Remove direct normal-user access to Guardian/minor data while preserving all
-- rows, RLS policies, consent history, audit records, and service-role access.
DO $$
DECLARE
  guardian_table TEXT;
BEGIN
  FOREACH guardian_table IN ARRAY ARRAY[
    'guardian_profiles',
    'guardian_player_relationships',
    'guardian_permission_definitions',
    'guardian_relationship_permissions',
    'guardian_updates',
    'guardian_acknowledgements',
    'guardian_notification_preferences',
    'guardian_feature_flags',
    'age_policy_configurations',
    'player_age_identities',
    'guardian_permission_templates',
    'guardian_permission_template_items',
    'guardian_invitations',
    'guardian_verification_records',
    'guardian_consent_history',
    'player_date_of_birth_corrections',
    'guardian_age_transitions',
    'guardian_privacy_requests',
    'guardian_privacy_request_internal',
    'guardian_audit_events',
    'guardian_product_events',
    'iso_country_codes',
    'guardian_jurisdiction_policies',
    'guardian_policy_decisions',
    'player_policy_notifications',
    'player_billing_summaries'
  ] LOOP
    IF to_regclass(format('public.%I', guardian_table)) IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, authenticated',
        guardian_table
      );
    END IF;
  END LOOP;
END;
$$;

-- Some linked projects contain the deferred AI/rewarded-ad schema even when a
-- fresh checkout does not. Keep those later-phase tables and functions intact,
-- but remove every normal-user/direct-API privilege for the 18+ beta. The
-- legacy connectivity-test table is treated as unfinished surface and denied
-- in the same way. All statements are conditional so fresh local resets remain
-- compatible with repositories that do not yet contain these objects.
DO $$
DECLARE
  excluded_table TEXT;
  excluded_sequence TEXT;
BEGIN
  FOREACH excluded_table IN ARRAY ARRAY[
    'ai_conversations',
    'ai_entitlements',
    'ai_free_message_credits',
    'ai_messages',
    'ai_rewarded_ad_grants',
    'ai_usage',
    'ai_usage_reservations',
    'test'
  ] LOOP
    IF to_regclass(format('public.%I', excluded_table)) IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated',
        excluded_table
      );
      EXECUTE format(
        'GRANT ALL PRIVILEGES ON TABLE public.%I TO service_role',
        excluded_table
      );
    END IF;
  END LOOP;

  FOREACH excluded_sequence IN ARRAY ARRAY[
    'test_id_seq'
  ] LOOP
    IF to_regclass(format('public.%I', excluded_sequence)) IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON SEQUENCE public.%I FROM PUBLIC, anon, authenticated',
        excluded_sequence
      );
      EXECUTE format(
        'GRANT ALL PRIVILEGES ON SEQUENCE public.%I TO service_role',
        excluded_sequence
      );
    END IF;
  END LOOP;
END;
$$;

DO $$
DECLARE
  excluded_function RECORD;
BEGIN
  FOR excluded_function IN
    SELECT p.oid::regprocedure::TEXT AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'complete_player_ai_message_reservation',
        'consume_player_ai_free_message',
        'reserve_player_ai_message'
      )
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      excluded_function.signature
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %s TO service_role',
      excluded_function.signature
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.public_beta_age_gate_enabled() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.public_beta_valid_date_of_birth(DATE, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.public_beta_stored_date_of_birth(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.public_beta_current_user_is_adult() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.public_beta_assert_current_user_adult() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.public_beta_get_my_age_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.public_beta_set_my_date_of_birth(DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_public_beta_profile_date_of_birth() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_public_beta_adult_write() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.public_beta_age_gate_enabled() TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_beta_valid_date_of_birth(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_beta_current_user_is_adult() TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_beta_assert_current_user_adult() TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_beta_get_my_age_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_beta_set_my_date_of_birth(DATE) TO authenticated;

COMMENT ON FUNCTION public.public_beta_get_my_age_status() IS
  'Returns the signed-in Player or Coach public-beta age status from stored DOB only.';
COMMENT ON FUNCTION public.public_beta_set_my_date_of_birth(DATE) IS
  'One-time Player/Coach DOB confirmation for the temporary 18+ public beta; accepts no client-provided age or eligibility value.';

-- PostgREST caches function signatures. Explicitly reload the schema after
-- publishing the no-argument status RPC and one-argument DOB RPC.
NOTIFY pgrst, 'reload schema';
