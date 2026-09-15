-- Restore the existing country/Guardian policy while retaining beta privacy controls.
-- Apply after the two July beta migrations; never rewrite applied migration history.
BEGIN;

UPDATE public.guardian_feature_flags SET enabled = FALSE, updated_at = now()
WHERE flag_key IN ('public_beta_18_plus_enabled', 'guardian_billing_enabled');
UPDATE public.guardian_feature_flags SET enabled = TRUE, updated_at = now()
WHERE flag_key IN ('guardian_platform_enabled', 'guardian_onboarding_enabled',
  'date_of_birth_collection_enabled', 'existing_user_age_checkpoint_enabled',
  'under_13_activation_lock_enabled', 'guardian_overview_requirement_enabled',
  'guardian_email_delivery_enabled', 'age_18_transition_enabled', 'jurisdiction_policy_evaluation_enabled');

-- Adult checks remain meaningful for Coach responsibilities; the blanket beta flag is gone.
CREATE OR REPLACE FUNCTION public.public_beta_current_user_is_adult()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.public_beta_valid_date_of_birth(public.public_beta_stored_date_of_birth(auth.uid()), current_date)
    AND public.calculate_player_age(public.public_beta_stored_date_of_birth(auth.uid()), current_date) >= 18;
$$;

CREATE OR REPLACE FUNCTION public.public_beta_user_age_eligible(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE identity public.player_age_identities%ROWTYPE; account_role TEXT; evaluation JSONB;
BEGIN
  IF p_user_id IS NULL THEN RETURN FALSE; END IF;
  SELECT role INTO account_role FROM public.profiles WHERE id = p_user_id;
  IF account_role = 'coach' THEN
    RETURN coalesce(public.public_beta_valid_date_of_birth(public.public_beta_stored_date_of_birth(p_user_id), current_date)
      AND public.calculate_player_age(public.public_beta_stored_date_of_birth(p_user_id), current_date) >= 18, FALSE);
  END IF;
  IF account_role IS DISTINCT FROM 'player' THEN RETURN FALSE; END IF;
  SELECT * INTO identity FROM public.player_age_identities WHERE player_user_id = p_user_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  evaluation := public.evaluate_player_age_policy(identity.date_of_birth, identity.country_code, current_date);
  IF (evaluation->>'guardianApprovalRequired')::BOOLEAN THEN
    RETURN NOT public.player_is_guardian_restricted(p_user_id) AND EXISTS (
      SELECT 1 FROM public.guardian_player_relationships relationship
      WHERE relationship.player_user_id = p_user_id AND relationship.status = 'active'
        AND relationship.verification_status = 'verified' AND relationship.consent_status = 'granted'
    );
  END IF;
  IF (evaluation->>'guardianConnectionRequired')::BOOLEAN THEN
    RETURN EXISTS (SELECT 1 FROM public.guardian_invitations WHERE player_user_id = p_user_id)
      OR EXISTS (SELECT 1 FROM public.guardian_player_relationships WHERE player_user_id = p_user_id);
  END IF;
  RETURN TRUE;
END;
$$;

-- Separate immutable records identify the Guardian who accepted each child's documents.
CREATE TABLE public.guardian_document_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guardian_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relationship_id UUID NOT NULL REFERENCES public.guardian_player_relationships(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL REFERENCES public.beta_required_documents(document_type),
  document_version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (relationship_id, document_type, document_version)
);
ALTER TABLE public.guardian_document_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can read Guardian document acceptances" ON public.guardian_document_acceptances
  FOR SELECT TO authenticated USING (auth.uid() IN (player_user_id, guardian_user_id));
REVOKE ALL ON public.guardian_document_acceptances FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.guardian_document_acceptances TO authenticated;
GRANT ALL ON public.guardian_document_acceptances TO service_role;
CREATE TRIGGER prevent_guardian_document_acceptance_update BEFORE UPDATE ON public.guardian_document_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.prevent_consent_acceptance_mutation();

CREATE OR REPLACE FUNCTION public.public_beta_document_accepted_at(p_user_id UUID, p_type TEXT, p_version TEXT)
RETURNS TIMESTAMPTZ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE identity public.player_age_identities%ROWTYPE; requires_guardian BOOLEAN := FALSE; accepted TIMESTAMPTZ;
BEGIN
  SELECT * INTO identity FROM public.player_age_identities WHERE player_user_id = p_user_id;
  IF FOUND THEN
    requires_guardian := (public.evaluate_player_age_policy(identity.date_of_birth, identity.country_code, current_date)->>'guardianApprovalRequired')::BOOLEAN;
  END IF;
  IF requires_guardian THEN
    SELECT max(acceptance.accepted_at) INTO accepted FROM public.guardian_document_acceptances acceptance
    JOIN public.guardian_player_relationships relationship ON relationship.id = acceptance.relationship_id
    WHERE acceptance.player_user_id = p_user_id AND acceptance.document_type = p_type AND acceptance.document_version = p_version
      AND relationship.guardian_user_id = acceptance.guardian_user_id AND relationship.player_user_id = p_user_id
      AND relationship.status = 'active' AND relationship.verification_status = 'verified' AND relationship.consent_status = 'granted';
  ELSE
    SELECT max(accepted_at) INTO accepted FROM public.user_consent_acceptances
    WHERE user_id = p_user_id AND document_type = p_type AND document_version = p_version;
  END IF;
  RETURN accepted;
END;
$$;

CREATE OR REPLACE FUNCTION public.public_beta_has_required_consents(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.beta_required_documents WHERE required)
    AND NOT EXISTS (SELECT 1 FROM public.beta_required_documents document WHERE required
      AND public.public_beta_document_accepted_at(p_user_id, document_type, document_version) IS NULL);
$$;

CREATE OR REPLACE FUNCTION public.public_beta_current_user_can_access()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.public_beta_user_age_eligible(auth.uid()) AND public.public_beta_has_required_consents(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.public_beta_get_my_consent_status()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE actor UUID := auth.uid(); identity public.player_age_identities%ROWTYPE; guardian_required BOOLEAN := FALSE;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO identity FROM public.player_age_identities WHERE player_user_id = actor;
  IF FOUND THEN guardian_required := (public.evaluate_player_age_policy(identity.date_of_birth, identity.country_code, current_date)->>'guardianApprovalRequired')::BOOLEAN; END IF;
  RETURN jsonb_build_object('complete', public.public_beta_has_required_consents(actor), 'guardianAcceptanceRequired', guardian_required,
    'documents', (SELECT coalesce(jsonb_agg(jsonb_build_object('documentType', document_type, 'documentVersion', document_version,
      'documentUrl', document_url, 'label', label, 'required', required,
      'accepted', public.public_beta_document_accepted_at(actor, document_type, document_version) IS NOT NULL,
      'acceptedAt', public.public_beta_document_accepted_at(actor, document_type, document_version)) ORDER BY document_type), '[]'::JSONB)
      FROM public.beta_required_documents WHERE required));
END;
$$;

CREATE OR REPLACE FUNCTION public.public_beta_assert_can_accept_documents()
RETURNS VOID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE identity public.player_age_identities%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO identity FROM public.player_age_identities WHERE player_user_id = auth.uid();
  IF FOUND AND (public.evaluate_player_age_policy(identity.date_of_birth, identity.country_code, current_date)->>'guardianApprovalRequired')::BOOLEAN THEN
    RAISE EXCEPTION 'A verified Guardian must accept the current documents for this Player.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.public_beta_user_age_eligible(auth.uid()) AND NOT public.has_account_role(auth.uid(), 'guardian') THEN
    RAISE EXCEPTION 'Complete account age and country setup first.' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.guardian_get_player_consent_status(p_player_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE relationship UUID; guardian_required BOOLEAN;
BEGIN
  SELECT id INTO relationship FROM public.guardian_player_relationships
  WHERE player_user_id = p_player_id AND guardian_user_id = auth.uid()
    AND status IN ('pending','active','adult_authorised') AND verification_status = 'verified'
  ORDER BY created_at DESC LIMIT 1;
  IF relationship IS NULL THEN RAISE EXCEPTION 'Verified Guardian relationship required.' USING ERRCODE = '42501'; END IF;
  SELECT (public.evaluate_player_age_policy(date_of_birth, country_code, current_date)->>'guardianApprovalRequired')::BOOLEAN
    INTO guardian_required FROM public.player_age_identities WHERE player_user_id = p_player_id;
  RETURN jsonb_build_object('complete', NOT coalesce(guardian_required, FALSE) OR NOT EXISTS (
      SELECT 1 FROM public.beta_required_documents document WHERE required AND NOT EXISTS (
        SELECT 1 FROM public.guardian_document_acceptances acceptance WHERE acceptance.relationship_id = relationship
          AND acceptance.document_type = document.document_type AND acceptance.document_version = document.document_version)),
    'documents', (SELECT jsonb_agg(jsonb_build_object('documentType', document_type, 'documentVersion', document_version,
      'documentUrl', document_url, 'label', label, 'required', required, 'accepted', FALSE, 'acceptedAt', NULL) ORDER BY document_type)
      FROM public.beta_required_documents WHERE required));
END;
$$;

CREATE OR REPLACE FUNCTION public.guardian_accept_player_documents(p_player_id UUID, p_acceptances JSONB)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE relationship UUID; required_count INTEGER;
BEGIN
  PERFORM public.guardian_get_player_consent_status(p_player_id);
  SELECT id INTO relationship FROM public.guardian_player_relationships
  WHERE player_user_id = p_player_id AND guardian_user_id = auth.uid()
    AND status IN ('pending','active') AND verification_status = 'verified'
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  SELECT count(*) INTO required_count FROM public.beta_required_documents WHERE required;
  IF p_acceptances IS NULL OR jsonb_typeof(p_acceptances) <> 'object' THEN
    RAISE EXCEPTION 'Every current document must be accepted.' USING ERRCODE = '22023';
  END IF;
  IF required_count = 0 OR (SELECT count(*) FROM jsonb_object_keys(p_acceptances)) <> required_count
    OR EXISTS (SELECT 1 FROM public.beta_required_documents WHERE required
      AND p_acceptances->>document_type IS DISTINCT FROM document_version) THEN
    RAISE EXCEPTION 'Every current document must be accepted exactly as published.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.guardian_document_acceptances(player_user_id, guardian_user_id, relationship_id, document_type, document_version)
  SELECT p_player_id, auth.uid(), relationship, document_type, document_version FROM public.beta_required_documents WHERE required
  ON CONFLICT (relationship_id, document_type, document_version) DO NOTHING;
  RETURN public.guardian_get_player_consent_status(p_player_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.public_beta_get_my_access_status()
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE actor UUID := auth.uid(); account_role TEXT;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.player_age_identities WHERE player_user_id = actor) THEN PERFORM public.process_my_age_transition(); END IF;
  SELECT role INTO account_role FROM public.profiles WHERE id = actor;
  RETURN jsonb_build_object('role', account_role, 'eligible', public.public_beta_current_user_can_access()
    OR (account_role = 'guardian' AND public.has_account_role(actor, 'guardian') AND public.public_beta_has_required_consents(actor)));
END;
$$;

-- Replace the blanket restrictive rule and preserve every existing owner/team policy.
DO $$ DECLARE table_name TEXT; BEGIN
  FOREACH table_name IN ARRAY ARRAY['wellness_logs','training_logs','calendar_events','custom_event_types','injuries',
    'teams','team_memberships','event_attendance','calendar_event_attendance','player_calendar_event_color_overrides'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "18+ public beta access required" ON public.%I', table_name);
    EXECUTE format('CREATE POLICY "Country policy and consent required" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.public_beta_current_user_can_access()) WITH CHECK (public.public_beta_current_user_can_access())', table_name);
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.enforce_public_beta_adult_write()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' AND auth.uid() IS NOT NULL
    AND current_setting('lodario.public_beta_self_delete_user_id', TRUE) = auth.uid()::TEXT THEN RETURN OLD; END IF;
  IF auth.uid() IS NOT NULL AND coalesce(auth.jwt()->>'role','') <> 'service_role'
    AND NOT public.public_beta_current_user_can_access() THEN
    RAISE EXCEPTION 'Complete the country, Guardian and consent requirements before accessing sporting data.' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- New document versions reflect the restored country/Guardian feature scope.
UPDATE public.beta_required_documents SET document_version = CASE document_type
  WHEN 'terms_of_use' THEN 'terms-2026-09-14-v1.1'
  WHEN 'privacy_policy' THEN 'privacy-2026-09-14-v1.1'
  WHEN 'health_data_processing' THEN 'health-data-2026-09-14-v1.1'
  WHEN 'coach_player_data_sharing' THEN 'coach-sharing-2026-09-14-v1.1' END, updated_at = now();

-- Continued below with explicit RPC grants and corrected existing function definitions.
-- Generated corrected functions, copied from their latest historical definitions.

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
  SELECT public.public_beta_current_user_can_access()
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
  SELECT public.public_beta_current_user_can_access()
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
  SELECT public.public_beta_current_user_can_access()
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
  SELECT public.public_beta_current_user_can_access()
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
  SELECT public.public_beta_current_user_can_access()
    AND EXISTS (
      SELECT 1 FROM public.team_memberships membership
      WHERE membership.team_id = p_team_id
        AND membership.user_id = p_player_id
        AND membership.role = 'player'
        AND membership.status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.public_beta_accept_required_consents(p_acceptances JSONB)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_user UUID := auth.uid();
  required_count INTEGER;
BEGIN
  IF active_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  PERFORM public.public_beta_assert_can_accept_documents();

  IF p_acceptances IS NULL OR jsonb_typeof(p_acceptances) <> 'object' THEN
    RAISE EXCEPTION 'Every required document must be accepted.' USING ERRCODE = '22023';
  END IF;

  SELECT count(*)
  INTO required_count
  FROM public.beta_required_documents
  WHERE required;

  IF (SELECT count(*) FROM jsonb_object_keys(p_acceptances)) <> required_count
     OR EXISTS (
       SELECT 1
       FROM public.beta_required_documents required_document
       WHERE required_document.required
         AND p_acceptances ->> required_document.document_type IS DISTINCT FROM required_document.document_version
     ) THEN
    RAISE EXCEPTION 'Every current required document must be accepted exactly as published.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_consent_acceptances (
    user_id,
    document_type,
    document_version,
    accepted_at,
    acceptance_source
  )
  SELECT
    active_user,
    required_document.document_type,
    required_document.document_version,
    now(),
    'web'
  FROM public.beta_required_documents required_document
  WHERE required_document.required
  ON CONFLICT (user_id, document_type, document_version) DO NOTHING;

  RETURN public.public_beta_get_my_consent_status();
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
    'eligible', active_role = 'coach'
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

  -- Player DOB must be recorded with country through player_set_initial_age.

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

  IF active_role IS DISTINCT FROM 'coach' THEN
    RAISE EXCEPTION 'Players must provide a date of birth and country of residence.'
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

CREATE OR REPLACE FUNCTION public.player_set_initial_age(p_date_of_birth DATE,p_country_code TEXT DEFAULT 'ZZ')
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $$
DECLARE active_user UUID:=auth.uid();
DECLARE evaluation JSONB;
DECLARE state TEXT;
DECLARE profile_role TEXT;
DECLARE decision_id UUID;
BEGIN
  IF active_user IS NULL THEN RAISE EXCEPTION 'Authentication required.' USING ERRCODE='42501'; END IF;
  SELECT role INTO profile_role FROM public.profiles WHERE id=active_user;
  IF NOT (public.has_account_role(active_user,'player') OR profile_role IS NULL OR profile_role='player') THEN
    RAISE EXCEPTION 'Player account required.' USING ERRCODE='42501';
  END IF;
  IF EXISTS(SELECT 1 FROM public.player_age_identities WHERE player_user_id=active_user) THEN
    RAISE EXCEPTION 'Age information is already recorded. Use the correction request process.' USING ERRCODE='23505';
  END IF;
  IF upper(btrim(coalesce(p_country_code,'')))='ZZ' THEN
    RAISE EXCEPTION 'Select a valid country of residence.' USING ERRCODE='22023';
  END IF;
  IF public.public_beta_valid_date_of_birth(public.public_beta_stored_date_of_birth(active_user), current_date) AND public.public_beta_stored_date_of_birth(active_user) IS DISTINCT FROM p_date_of_birth THEN
    RAISE EXCEPTION 'Date of birth is already recorded. Contact support for correction.' USING ERRCODE='23505';
  END IF;
  evaluation:=public.evaluate_player_age_policy(p_date_of_birth,p_country_code,current_date);
  state:=CASE WHEN (evaluation->>'guardianApprovalRequired')::BOOLEAN THEN 'guardian_required' ELSE 'active' END;

  INSERT INTO public.profiles(id,age,positions,priorities,role,onboarding_completed)
  VALUES(active_user,(evaluation->>'age')::INTEGER,'{}','{}','player',FALSE)
  ON CONFLICT(id) DO UPDATE SET age=EXCLUDED.age;
  INSERT INTO public.user_account_roles(user_id,role) VALUES(active_user,'player')
  ON CONFLICT(user_id,role) DO UPDATE SET status='active';
  INSERT INTO public.player_age_identities(
    player_user_id,date_of_birth,country_code,age_band,age_policy_version,next_transition_at,
    guardian_approval_required,guardian_overview_required,guardian_connection_required,
    account_state,jurisdiction_policy_id,fallback_used,policy_status,decision_reason,last_policy_decision
  ) VALUES(
    active_user,p_date_of_birth,evaluation->>'countryCode',evaluation->>'ageBand',evaluation->>'policyVersion',
    (evaluation->>'nextAgeTransitionAt')::TIMESTAMPTZ,
    (evaluation->>'guardianApprovalRequired')::BOOLEAN,(evaluation->>'guardianConnectionRequired')::BOOLEAN,
    (evaluation->>'guardianConnectionRequired')::BOOLEAN,state,
    (evaluation->>'jurisdictionPolicyId')::UUID,(evaluation->>'fallbackUsed')::BOOLEAN,
    evaluation->>'policyStatus',evaluation->>'decisionReason',evaluation
  );
  UPDATE public.profiles SET date_of_birth=p_date_of_birth WHERE id=active_user;
  decision_id:=public.record_guardian_policy_decision(active_user,evaluation,NULL,evaluation->>'decisionReason','initial_onboarding',
    CASE WHEN state='guardian_required' THEN 'applied' ELSE 'not_required' END,NULL);
  PERFORM public.guardian_write_audit('jurisdiction_policy_evaluated',active_user,NULL,NULL,'success',
    jsonb_build_object('policyId',evaluation->>'jurisdictionPolicyId','fallbackUsed',evaluation->>'fallbackUsed','decisionReason',evaluation->>'decisionReason'));
  PERFORM public.guardian_track_product_event('age_step_completed',jsonb_build_object('ageBand',evaluation->>'ageBand','fallbackUsed',evaluation->>'fallbackUsed'));
  RETURN evaluation||jsonb_build_object('accountState',state,'restricted',state='guardian_required','policyDecisionId',decision_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.player_get_my_guardian_state()
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $$
DECLARE active_user UUID:=auth.uid();
DECLARE identity public.player_age_identities%ROWTYPE;
DECLARE created_at_value TIMESTAMPTZ;
BEGIN
  IF active_user IS NULL THEN RAISE EXCEPTION 'Authentication required.' USING ERRCODE='42501'; END IF;
  SELECT * INTO identity FROM public.player_age_identities WHERE player_user_id=active_user;
  SELECT created_at INTO created_at_value FROM auth.users WHERE id=active_user;
  IF identity.player_user_id IS NULL THEN
    RETURN jsonb_build_object('ageKnown',FALSE,'ageCheckpointRequired',
      public.guardian_flag_enabled('date_of_birth_collection_enabled') AND
      (public.guardian_flag_enabled('existing_user_age_checkpoint_enabled') OR created_at_value>='2026-07-22 00:00:00+00'::TIMESTAMPTZ),
      'restricted',FALSE,'featureFlags',(SELECT coalesce(jsonb_object_agg(flag_key,enabled),'{}'::JSONB) FROM public.guardian_feature_flags));
  END IF;
  PERFORM public.process_my_age_transition();
  SELECT * INTO identity FROM public.player_age_identities WHERE player_user_id=active_user;
  RETURN jsonb_build_object(
    'ageKnown',TRUE,'dateOfBirth',identity.date_of_birth,'ageBand',identity.age_band,'countryCode',identity.country_code,
    'jurisdictionPolicyId',identity.jurisdiction_policy_id,'policyVersion',identity.age_policy_version,
    'policyStatus',identity.policy_status,'fallbackUsed',identity.fallback_used,'decisionReason',identity.decision_reason,
    'accountState',identity.account_state,'guardianRequired',identity.guardian_connection_required,
    'guardianApprovalRequired',identity.guardian_approval_required,
    'guardianConnectionRequired',identity.guardian_connection_required,
    'guardianOverviewRequired',identity.guardian_overview_required,'nextTransitionAt',identity.next_transition_at,
    'restricted',public.player_is_guardian_restricted(active_user),
    'hasGuardianConnection',EXISTS(SELECT 1 FROM public.guardian_invitations WHERE player_user_id=active_user) OR EXISTS(SELECT 1 FROM public.guardian_player_relationships WHERE player_user_id=active_user),
    'invitations',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id',i.id,'guardianEmailMasked',regexp_replace(i.guardian_email,'(^.).*(@.*$)','\1***\2'),
      'guardianName',i.guardian_name,'relationshipType',i.relationship_type,
      'status',CASE WHEN i.expires_at<=now() AND i.status IN ('pending','sent','delivered','opened') THEN 'expired' ELSE i.status END,
      'invitationType',i.invitation_type,'expiresAt',i.expires_at,'lastSentAt',i.last_sent_at,'resendAttempts',i.resend_attempts
    ) ORDER BY i.created_at DESC) FROM public.guardian_invitations i WHERE i.player_user_id=active_user),'[]'::JSONB),
    'relationships',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id',r.id,'guardianName',coalesce(gp.display_name,'Guardian'),'relationshipType',r.relationship_type,
      'status',r.status,'linkedAt',r.linked_at,'isPrimary',r.is_primary,'permissionTemplate',r.permission_template_key
    ) ORDER BY r.created_at DESC) FROM public.guardian_player_relationships r
      LEFT JOIN public.guardian_profiles gp ON gp.user_id=r.guardian_user_id WHERE r.player_user_id=active_user),'[]'::JSONB),
    'correctionRequest',(SELECT jsonb_build_object('id',c.id,'status',c.status,'createdAt',c.created_at,'categoryChange',c.category_change)
      FROM public.player_date_of_birth_corrections c WHERE c.player_user_id=active_user ORDER BY c.created_at DESC LIMIT 1),
    'policyNotifications',coalesce((SELECT jsonb_agg(jsonb_build_object('id',n.id,'type',n.notification_type,'title',n.title,'message',n.message,'createdAt',n.created_at)
      ORDER BY n.created_at DESC) FROM public.player_policy_notifications n WHERE n.player_user_id=active_user AND NOT n.is_read),'[]'::JSONB),
    'featureFlags',(SELECT coalesce(jsonb_object_agg(flag_key,enabled),'{}'::JSONB) FROM public.guardian_feature_flags)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.player_request_dob_correction(p_requested_date_of_birth DATE,p_reason TEXT)
RETURNS UUID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $$
DECLARE actor UUID:=auth.uid(); DECLARE identity public.player_age_identities%ROWTYPE; DECLARE old_policy JSONB; DECLARE new_policy JSONB; DECLARE request_id UUID;
BEGIN
  SELECT * INTO identity FROM public.player_age_identities WHERE player_user_id=actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'Age information is unavailable.' USING ERRCODE='22023'; END IF;
  IF NOT public.public_beta_valid_date_of_birth(p_requested_date_of_birth,current_date) OR char_length(btrim(coalesce(p_reason,'')))<10 THEN RAISE EXCEPTION 'Provide a valid date and a short explanation.' USING ERRCODE='22023'; END IF;
  old_policy:=public.evaluate_player_age_policy(identity.date_of_birth,identity.country_code,current_date);
  new_policy:=public.evaluate_player_age_policy(p_requested_date_of_birth,identity.country_code,current_date);
  INSERT INTO public.player_date_of_birth_corrections(player_user_id,original_date_of_birth,requested_date_of_birth,reason,status,category_change)
  VALUES(actor,identity.date_of_birth,p_requested_date_of_birth,btrim(p_reason),
    CASE WHEN old_policy->>'ageBand'<>new_policy->>'ageBand' THEN 'guardian_confirmation_required' ELSE 'under_review' END,
    old_policy->>'ageBand'<>new_policy->>'ageBand') RETURNING id INTO request_id;
  PERFORM public.guardian_write_audit('dob_correction_requested',actor,NULL,NULL,'pending',jsonb_build_object('categoryChange',old_policy->>'ageBand'<>new_policy->>'ageBand'));
  RETURN request_id;
END; $$;

CREATE OR REPLACE FUNCTION public.review_player_dob_correction(
  p_request_id UUID,
  p_approve BOOLEAN,
  p_resolution_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $$
DECLARE correction public.player_date_of_birth_corrections%ROWTYPE;
DECLARE identity public.player_age_identities%ROWTYPE;
DECLARE evaluated JSONB;
DECLARE newly_approval_required BOOLEAN;
DECLARE newly_connection_required BOOLEAN;
DECLARE decision_uuid UUID;
DECLARE next_state TEXT;
BEGIN
  -- This function deliberately has no anon/authenticated grant. Use a trusted
  -- service/admin database session after completing the correction review.
  SELECT * INTO correction
  FROM public.player_date_of_birth_corrections
  WHERE id=p_request_id
  FOR UPDATE;
  IF NOT FOUND OR correction.status NOT IN ('submitted','guardian_confirmation_required','under_review') THEN
    RAISE EXCEPTION 'Open date-of-birth correction not found.' USING ERRCODE='22023';
  END IF;
  IF char_length(btrim(coalesce(p_resolution_note,'')))<3 THEN
    RAISE EXCEPTION 'A resolution note is required.' USING ERRCODE='22023';
  END IF;

  IF NOT p_approve THEN
    UPDATE public.player_date_of_birth_corrections
    SET status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),resolution_note=btrim(p_resolution_note)
    WHERE id=correction.id;
    PERFORM public.guardian_write_audit('dob_correction_rejected',correction.player_user_id,NULL,NULL,'success',
      jsonb_build_object('correctionId',correction.id));
    RETURN jsonb_build_object('approved',FALSE,'correctionId',correction.id);
  END IF;

  SELECT * INTO identity
  FROM public.player_age_identities
  WHERE player_user_id=correction.player_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Player age identity not found.' USING ERRCODE='22023'; END IF;

  evaluated:=public.evaluate_player_age_policy(correction.requested_date_of_birth,identity.country_code,current_date);
  newly_approval_required:=NOT identity.guardian_approval_required
    AND (evaluated->>'guardianApprovalRequired')::BOOLEAN;
  newly_connection_required:=NOT identity.guardian_connection_required
    AND (evaluated->>'guardianConnectionRequired')::BOOLEAN;
  next_state:=CASE
    WHEN (evaluated->>'guardianApprovalRequired')::BOOLEAN THEN 'guardian_required'
    WHEN identity.account_state IN ('guardian_required','invitation_pending','approval_pending','rejected','review_required','relationship_revoked')
      THEN 'active'
    ELSE identity.account_state
  END;

  UPDATE public.player_age_identities SET
    date_of_birth=correction.requested_date_of_birth,
    age_band=evaluated->>'ageBand',
    age_policy_version=evaluated->>'policyVersion',
    policy_evaluated_at=now(),
    next_transition_at=(evaluated->>'nextAgeTransitionAt')::TIMESTAMPTZ,
    guardian_approval_required=(evaluated->>'guardianApprovalRequired')::BOOLEAN,
    guardian_overview_required=(evaluated->>'guardianConnectionRequired')::BOOLEAN,
    guardian_connection_required=(evaluated->>'guardianConnectionRequired')::BOOLEAN,
    account_state=next_state,
    jurisdiction_policy_id=(evaluated->>'jurisdictionPolicyId')::UUID,
    fallback_used=(evaluated->>'fallbackUsed')::BOOLEAN,
    policy_status=evaluated->>'policyStatus',
    decision_reason=evaluated->>'decisionReason',
    last_policy_decision=evaluated
  WHERE player_user_id=identity.player_user_id;
  UPDATE public.profiles SET age=(evaluated->>'age')::INTEGER WHERE id=identity.player_user_id;
  UPDATE public.player_date_of_birth_corrections
  SET status='approved',reviewed_by=auth.uid(),reviewed_at=now(),resolution_note=btrim(p_resolution_note)
  WHERE id=correction.id;

  UPDATE public.profiles SET date_of_birth=correction.requested_date_of_birth, age=(evaluated->>'age')::INTEGER WHERE id=correction.player_user_id;
  decision_uuid:=public.record_guardian_policy_decision(
    identity.player_user_id,evaluated,identity.jurisdiction_policy_id,
    'approved_date_of_birth_correction','dob_correction',
    CASE WHEN (evaluated->>'guardianApprovalRequired')::BOOLEAN THEN 'applied' ELSE 'not_required' END,NULL
  );
  IF newly_connection_required THEN
    INSERT INTO public.player_policy_notifications(player_user_id,notification_type,title,message,policy_decision_id)
    VALUES(identity.player_user_id,'guardian_now_required','Guardian required after account review',
      CASE WHEN newly_approval_required
        THEN 'Your approved date-of-birth correction requires a parent or Guardian to approve this account before full access can continue.'
        ELSE 'Your approved date-of-birth correction requires a parent or Guardian connection. You can continue using Lodario while the invitation is pending.'
      END,decision_uuid);
  END IF;
  PERFORM public.guardian_write_audit('dob_correction_approved',identity.player_user_id,NULL,NULL,'success',
    jsonb_build_object('correctionId',correction.id,'policyDecisionId',decision_uuid,'newlyGuardianRequired',newly_connection_required));
  RETURN evaluated||jsonb_build_object(
    'approved',TRUE,'correctionId',correction.id,'policyDecisionId',decision_uuid,
    'accountState',next_state,'restricted',next_state='guardian_required'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.guardian_has_permission(p_player_id UUID,p_permission_key TEXT,p_guardian_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.is_guardian(p_guardian_id) AND public.public_beta_has_required_consents(p_player_id) AND EXISTS(
    SELECT 1 FROM public.guardian_player_relationships r
    JOIN public.guardian_permission_definitions d ON d.permission_key=p_permission_key
    LEFT JOIN public.guardian_relationship_permissions rp ON rp.relationship_id=r.id AND rp.permission_key=d.permission_key
    WHERE r.guardian_user_id=p_guardian_id AND r.player_user_id=p_player_id
      AND r.status IN ('active','adult_authorised') AND coalesce(rp.state,d.default_state) IN ('allowed','required'));
$$;

CREATE OR REPLACE FUNCTION public.guardian_preview_invitation(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE invitation public.guardian_invitations%ROWTYPE;
DECLARE player_name TEXT;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('valid', FALSE, 'reason', 'invalid');
  END IF;
  SELECT * INTO invitation FROM public.guardian_invitations
  WHERE token_hash = extensions.digest(p_token, 'sha256') LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('valid', FALSE, 'reason', 'invalid'); END IF;
  IF invitation.expires_at <= now() AND invitation.status IN ('pending','sent','delivered','opened') THEN
    UPDATE public.guardian_invitations SET status = 'expired' WHERE id = invitation.id;
    PERFORM public.guardian_write_audit('invitation_expired', invitation.player_user_id, NULL, invitation.id, 'failed', '{}'::JSONB);
    RETURN jsonb_build_object('valid', FALSE, 'reason', 'expired');
  END IF;
  IF invitation.status NOT IN ('pending','sent','delivered','opened','accepted','review_required') THEN
    RETURN jsonb_build_object('valid', FALSE, 'reason', invitation.status);
  END IF;
  UPDATE public.guardian_invitations SET status = CASE WHEN status IN ('pending','sent','delivered') THEN 'opened' ELSE status END
  WHERE id = invitation.id;
  SELECT coalesce(nullif(display_name,''),'Player') INTO player_name FROM public.profiles WHERE id = invitation.player_user_id;
  RETURN jsonb_build_object(
    'valid', TRUE, 'invitationId', invitation.id, 'status', invitation.status, 'invitationType', invitation.invitation_type,
    'playerId', CASE WHEN invitation.intended_guardian_user_id=auth.uid() THEN invitation.player_user_id ELSE NULL END, 'playerName', coalesce(player_name,'Player'), 'guardianName', invitation.guardian_name,
    'guardianEmail', invitation.guardian_email, 'relationshipType', invitation.relationship_type,
    'isPrimary', invitation.is_primary, 'consentRequired', invitation.consent_required,
    'expiresAt', invitation.expires_at, 'policyVersion', invitation.policy_version
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.guardian_accept_invitation(
  p_token TEXT,
  p_display_name TEXT,
  p_authority_declared BOOLEAN,
  p_preferred_language TEXT DEFAULT 'en'
)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE actor UUID := auth.uid();
DECLARE actor_email TEXT;
DECLARE email_verified BOOLEAN;
DECLARE invitation public.guardian_invitations%ROWTYPE;
DECLARE identity public.player_age_identities%ROWTYPE;
DECLARE relationship_id UUID;
DECLARE relationship_status TEXT;
DECLARE verification_status TEXT;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Sign in with the invited email address to continue.' USING ERRCODE = '42501'; END IF;
  IF public.public_beta_valid_date_of_birth(public.public_beta_stored_date_of_birth(actor),current_date) AND public.calculate_player_age(public.public_beta_stored_date_of_birth(actor),current_date)<18 THEN RAISE EXCEPTION 'Guardians must be adults.' USING ERRCODE='42501'; END IF;
  IF NOT p_authority_declared THEN RAISE EXCEPTION 'You must confirm that you are authorised to act as this Player''s Guardian.' USING ERRCODE = '22023'; END IF;
  SELECT lower(email), email_confirmed_at IS NOT NULL INTO actor_email, email_verified FROM auth.users WHERE id = actor;
  IF NOT email_verified THEN RAISE EXCEPTION 'Verify your email address before accepting this invitation.' USING ERRCODE = '42501'; END IF;
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'This invitation link is invalid.' USING ERRCODE = '22023'; END IF;

  SELECT * INTO invitation FROM public.guardian_invitations
  WHERE token_hash = extensions.digest(p_token, 'sha256') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This invitation link is invalid.' USING ERRCODE = '22023'; END IF;
  IF invitation.guardian_email <> actor_email THEN
    PERFORM public.guardian_write_audit('invitation_wrong_email', invitation.player_user_id, NULL, invitation.id, 'denied', '{}'::JSONB);
    RAISE EXCEPTION 'This invitation was sent to a different email address.' USING ERRCODE = '42501';
  END IF;
  IF invitation.expires_at <= now() THEN
    UPDATE public.guardian_invitations SET status = 'expired' WHERE id = invitation.id;
    RAISE EXCEPTION 'This invitation has expired. Ask the Player or Coach to send a new one.' USING ERRCODE = '22023';
  END IF;
  IF invitation.status NOT IN ('pending','sent','delivered','opened') THEN
    RAISE EXCEPTION 'This invitation has already been used or is no longer available.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO identity FROM public.player_age_identities WHERE player_user_id = invitation.player_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'The Player age policy is incomplete.' USING ERRCODE = '55000'; END IF;

  INSERT INTO public.user_account_roles(user_id, role, status, granted_by, metadata)
  VALUES(actor, 'guardian', 'active', actor, jsonb_build_object('source','secure_invitation'))
  ON CONFLICT (user_id, role) DO UPDATE SET status = 'active';
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = actor) THEN
    INSERT INTO public.profiles(id, age, positions, priorities, role, display_name, onboarding_completed)
    VALUES(actor, 18, '{}', '{}', 'guardian', nullif(btrim(p_display_name),''), TRUE);
  END IF;
  INSERT INTO public.guardian_profiles(user_id, display_name, preferred_language)
  VALUES(actor, nullif(btrim(p_display_name),''), coalesce(nullif(btrim(p_preferred_language),''),'en'))
  ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, preferred_language = EXCLUDED.preferred_language;

  verification_status := CASE WHEN public.guardian_flag_enabled('enhanced_guardian_verification_enabled')
    AND identity.guardian_approval_required THEN 'review_required' ELSE 'verified' END;
  INSERT INTO public.guardian_verification_records(guardian_user_id, invitation_id, method, status, policy_version, verified_at)
  VALUES(actor, invitation.id, 'secure_invitation', verification_status, invitation.policy_version,
    CASE WHEN verification_status = 'verified' THEN now() ELSE NULL END);
  relationship_status := CASE WHEN identity.guardian_approval_required THEN 'pending' ELSE 'active' END;
  INSERT INTO public.guardian_player_relationships(
    guardian_user_id, player_user_id, relationship_type, is_primary, status, access_level,
    relationship_start_date, linked_at, created_by, consent_status, consent_version,
    consent_legal_text_version, verification_status, permission_template_key, metadata
  ) VALUES (
    actor, invitation.player_user_id, invitation.relationship_type, invitation.is_primary, relationship_status,
    (SELECT access_level FROM public.guardian_permission_templates WHERE template_key = invitation.permission_template_key),
    current_date, CASE WHEN relationship_status = 'active' THEN now() ELSE NULL END, invitation.created_by,
    CASE WHEN invitation.consent_required THEN 'pending' ELSE 'not_required' END,
    invitation.policy_version, 'guardian-authority-2026-01',
    CASE WHEN verification_status = 'verified' THEN 'verified' ELSE 'pending' END,
    invitation.permission_template_key, jsonb_build_object('invitationId', invitation.id)
  ) RETURNING id INTO relationship_id;
  PERFORM public.apply_guardian_permission_template(relationship_id, invitation.permission_template_key);
  INSERT INTO public.guardian_consent_history(
    guardian_user_id, player_user_id, relationship_id, invitation_id, decision, consent_category,
    text_version, policy_version, verification_method, metadata
  ) VALUES(actor, invitation.player_user_id, relationship_id, invitation.id, 'granted', 'guardian_relationship',
    'guardian-authority-2026-01', invitation.policy_version, 'verified_email_secure_invitation', jsonb_build_object('authorityDeclared',TRUE));
  UPDATE public.guardian_invitations SET status = CASE WHEN identity.guardian_approval_required THEN 'accepted' ELSE 'approved' END,
    accepted_at = now(), approved_at = CASE WHEN identity.guardian_approval_required THEN NULL ELSE now() END,
    intended_guardian_user_id = actor WHERE id = invitation.id;
  IF identity.guardian_approval_required THEN
    UPDATE public.player_age_identities SET account_state = CASE WHEN verification_status = 'review_required' THEN 'review_required' ELSE 'approval_pending' END
    WHERE player_user_id = invitation.player_user_id;
  ELSE
    INSERT INTO public.guardian_updates(guardian_user_id, update_type, title, message, related_player_id, importance, created_by)
    VALUES(actor, 'relationship_activated', 'Player linked', 'Your read-only Guardian overview is now available.', invitation.player_user_id, 'information', actor);
  END IF;
  PERFORM public.guardian_write_audit('invitation_accepted', invitation.player_user_id, relationship_id, invitation.id, 'success', '{}'::JSONB);
  PERFORM public.guardian_track_product_event('guardian_invitation_accepted', jsonb_build_object('invitationType',invitation.invitation_type));
  RETURN jsonb_build_object('accepted',TRUE,'invitationId',invitation.id,'relationshipId',relationship_id,'requiresApproval',identity.guardian_approval_required,
    'requiresReview',verification_status = 'review_required','playerId',invitation.player_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.public_beta_export_my_data(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_user UUID := auth.uid();
  active_role TEXT;
  export_payload JSONB;
BEGIN
  IF active_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request ID is required.' USING ERRCODE = '22023';
  END IF;

  IF (
    SELECT count(*)
    FROM public.beta_operational_events event
    WHERE event.user_id = active_user
      AND event.event_type = 'export_completed'
      AND event.occurred_at >= now() - INTERVAL '10 minutes'
  ) >= 3 THEN
    RAISE EXCEPTION 'Too many export requests. Please wait and try again.' USING ERRCODE = '54000';
  END IF;

  SELECT profile.role
  INTO active_role
  FROM public.profiles profile
  WHERE profile.id = active_user;

  SELECT jsonb_build_object(
    'schemaVersion', 'lodario-export-2026-07-23-v1',
    'generatedAt', clock_timestamp(),
    'account', jsonb_build_object(
      'userId', active_user,
      'role', active_role
    ),
    'profile', coalesce((
      SELECT to_jsonb(profile)
      FROM public.profiles profile
      WHERE profile.id = active_user
    ), 'null'::JSONB),
    'accountRoles', coalesce((
      SELECT jsonb_agg(to_jsonb(role_row) ORDER BY role_row.granted_at)
      FROM (
        SELECT role, status, granted_at
        FROM public.user_account_roles
        WHERE user_id = active_user
      ) role_row
    ), '[]'::JSONB),
    'wellnessLogs', CASE WHEN active_role = 'player' THEN coalesce((
      SELECT jsonb_agg(to_jsonb(log_row) ORDER BY log_row.date, log_row.created_at)
      FROM public.wellness_logs log_row
      WHERE log_row.user_id = active_user
    ), '[]'::JSONB) ELSE '[]'::JSONB END,
    'trainingLogs', CASE WHEN active_role = 'player' THEN coalesce((
      SELECT jsonb_agg(to_jsonb(log_row) ORDER BY log_row.date, log_row.created_at)
      FROM public.training_logs log_row
      WHERE log_row.user_id = active_user
    ), '[]'::JSONB) ELSE '[]'::JSONB END,
    'injuries', CASE WHEN active_role = 'player' THEN coalesce((
      SELECT jsonb_agg(to_jsonb(injury_row) ORDER BY injury_row.created_at)
      FROM public.injuries injury_row
      WHERE injury_row.user_id = active_user
    ), '[]'::JSONB) ELSE '[]'::JSONB END,
    'calendarEvents', CASE WHEN active_role = 'player' THEN coalesce((
      SELECT jsonb_agg(to_jsonb(event_row) ORDER BY event_row.created_at)
      FROM public.calendar_events event_row
      WHERE event_row.user_id = active_user
    ), '[]'::JSONB) ELSE '[]'::JSONB END,
    'customEventTypes', CASE WHEN active_role = 'player' THEN coalesce((
      SELECT jsonb_agg(to_jsonb(event_type_row) ORDER BY event_type_row.created_at)
      FROM public.custom_event_types event_type_row
      WHERE event_type_row.user_id = active_user
    ), '[]'::JSONB) ELSE '[]'::JSONB END,
    'calendarColorOverrides', CASE WHEN active_role = 'player' THEN coalesce((
      SELECT jsonb_agg(to_jsonb(override_row) ORDER BY override_row.created_at)
      FROM public.player_calendar_event_color_overrides override_row
      WHERE override_row.user_id = active_user
    ), '[]'::JSONB) ELSE '[]'::JSONB END,
    'rsvpAndAttendance', CASE WHEN active_role = 'player' THEN jsonb_build_object(
      'current', coalesce((
        SELECT jsonb_agg(to_jsonb(attendance_row) ORDER BY attendance_row.occurrence_date)
        FROM (
          SELECT
            id,
            team_id,
            event_group_id,
            occurrence_date,
            rsvp_status,
            rsvp_updated_at,
            attendance_status,
            attendance_updated_at,
            created_at,
            updated_at
          FROM public.calendar_event_attendance
          WHERE player_id = active_user
        ) attendance_row
      ), '[]'::JSONB),
      'legacy', coalesce((
        SELECT jsonb_agg(to_jsonb(attendance_row) ORDER BY attendance_row.event_date)
        FROM (
          SELECT
            id,
            team_id,
            event_group_id,
            event_date,
            rsvp_status,
            attendance_status,
            rsvp_updated_at,
            attendance_updated_at,
            created_at,
            updated_at
          FROM public.event_attendance
          WHERE player_id = active_user
        ) attendance_row
      ), '[]'::JSONB)
    ) ELSE jsonb_build_object('current', '[]'::JSONB, 'legacy', '[]'::JSONB) END,
    'teamMemberships', coalesce((
      SELECT jsonb_agg(to_jsonb(membership_row) ORDER BY membership_row.joined_at)
      FROM (
        SELECT team_id, role, status, joined_at, created_at, updated_at
        FROM public.team_memberships
        WHERE user_id = active_user
      ) membership_row
    ), '[]'::JSONB),
    'coachOwnedTeams', CASE WHEN active_role = 'coach' THEN coalesce((
      SELECT jsonb_agg(to_jsonb(team_row) ORDER BY team_row.created_at)
      FROM (
        SELECT
          team.id,
          team.name,
          team.invite_code,
          team.created_at,
          team.updated_at,
          (
            SELECT count(*)
            FROM public.team_memberships membership
            WHERE membership.team_id = team.id
              AND membership.status = 'active'
          ) AS active_member_count
        FROM public.teams team
        WHERE team.created_by = active_user
      ) team_row
    ), '[]'::JSONB) ELSE '[]'::JSONB END,
    'consentHistory', coalesce((
      SELECT jsonb_agg(to_jsonb(consent_row) ORDER BY consent_row.accepted_at)
      FROM (
        SELECT document_type, document_version, accepted_at, acceptance_source
        FROM public.user_consent_acceptances
        WHERE user_id = active_user
      ) consent_row
    ), '[]'::JSONB),
    'guardianRelationships', coalesce((
      SELECT jsonb_agg(to_jsonb(relationship_row) ORDER BY relationship_row.created_at)
      FROM (
        SELECT
          relationship.id,
          CASE
            WHEN relationship.player_user_id = active_user THEN 'player'
            ELSE 'guardian'
          END AS account_side,
          relationship.relationship_type,
          relationship.status,
          relationship.created_at,
          relationship.updated_at
        FROM public.guardian_player_relationships relationship
        WHERE relationship.player_user_id = active_user
           OR relationship.guardian_user_id = active_user
      ) relationship_row
    ), '[]'::JSONB),
    'guardianDocumentAcceptances', coalesce((SELECT jsonb_agg(to_jsonb(record)) FROM (SELECT document_type, document_version, accepted_at, CASE WHEN player_user_id=active_user THEN 'player' ELSE 'guardian' END AS account_side FROM public.guardian_document_acceptances WHERE player_user_id=active_user OR guardian_user_id=active_user) record), '[]'::JSONB),
    'recommendations', jsonb_build_object(
      'stored', FALSE,
      'description', 'Recommendations are calculated from exported source records and are not persisted as independent database records.'
    )
  )
  INTO export_payload;

  INSERT INTO public.beta_operational_events(user_id, account_role, event_type, request_id)
  VALUES (
    active_user,
    CASE WHEN active_role IN ('player', 'coach') THEN active_role ELSE NULL END,
    'export_completed',
    p_request_id
  )
  ON CONFLICT (user_id, event_type, request_id) DO NOTHING;

  RETURN export_payload;
END;
$$;

-- Explicit Data API privileges replace the deprecated auto-exposure setting.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles, public.wellness_logs, public.training_logs, public.calendar_events, public.custom_event_types, public.injuries, public.teams, public.team_memberships, public.event_attendance, public.calendar_event_attendance, public.player_calendar_event_color_overrides TO authenticated;
GRANT INSERT ON public.beta_waitlist TO anon, authenticated;
GRANT SELECT ON public.beta_waitlist TO anon; -- RLS returns no rows; used only for the health HEAD probe.
GRANT SELECT ON public.user_account_roles, public.guardian_updates, public.guardian_permission_definitions, public.guardian_player_relationships, public.guardian_relationship_permissions, public.guardian_acknowledgements, public.guardian_feature_flags, public.age_policy_configurations, public.player_age_identities, public.guardian_permission_templates, public.guardian_permission_template_items, public.guardian_verification_records, public.guardian_consent_history, public.player_date_of_birth_corrections, public.guardian_age_transitions, public.guardian_privacy_requests, public.guardian_policy_decisions, public.player_policy_notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.guardian_profiles, public.guardian_notification_preferences TO authenticated;
DO $$ DECLARE item RECORD; BEGIN FOR item IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname = ANY(ARRAY['guardian_flag_enabled','is_guardian','guardian_has_permission','guardian_get_linked_players','guardian_get_player_overview','guardian_get_events','guardian_get_permissions','guardian_get_player_profile_summary','guardian_mark_update_read','guardian_acknowledge_update','guardian_accept_invitation','guardian_decide_player_account','guardian_resend_invitation','guardian_cancel_invitation','guardian_create_invitation','guardian_mark_invitation_delivery','coach_get_guardian_status','player_get_my_guardian_state','player_set_initial_age','process_my_age_transition','player_decide_adult_guardian_access','player_request_dob_correction','revoke_guardian_relationship','create_guardian_privacy_request','player_is_guardian_restricted','guardian_get_player_consent_status','guardian_accept_player_documents','public_beta_get_my_access_status','public_beta_current_user_can_access']) LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', item.signature); EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', item.signature); END LOOP; END; $$;
REVOKE ALL ON FUNCTION public.guardian_preview_invitation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guardian_preview_invitation(TEXT) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.public_beta_user_age_eligible(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_beta_user_age_eligible(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.public_beta_document_accepted_at(UUID,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_beta_document_accepted_at(UUID,TEXT,TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.public_beta_has_required_consents(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_beta_has_required_consents(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.public_beta_assert_can_accept_documents() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_beta_assert_can_accept_documents() TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
