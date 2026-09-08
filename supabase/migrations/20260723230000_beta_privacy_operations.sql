-- Lodario 18+ beta: versioned consent, owner-scoped export, account deletion,
-- and minimal first-party operational measurement.
--
-- This migration is additive. It must run after
-- 20260723210000_public_beta_18_plus_gate.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS public.beta_required_documents (
  document_type TEXT PRIMARY KEY CHECK (document_type IN (
    'terms_of_use',
    'privacy_policy',
    'health_data_processing',
    'coach_player_data_sharing'
  )),
  document_version TEXT NOT NULL CHECK (char_length(btrim(document_version)) BETWEEN 1 AND 100),
  document_url TEXT NOT NULL CHECK (document_url LIKE '/%'),
  label TEXT NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 120),
  required BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.beta_required_documents (
  document_type,
  document_version,
  document_url,
  label,
  required
)
VALUES
  ('terms_of_use', 'terms-2026-07-23-v1.0', '/terms', 'Terms of Use', TRUE),
  ('privacy_policy', 'privacy-2026-07-23-v1.0', '/privacy', 'Privacy Policy', TRUE),
  ('health_data_processing', 'health-data-2026-07-23-v1.0', '/privacy#health-data', 'Health-data processing', TRUE),
  ('coach_player_data_sharing', 'coach-sharing-2026-07-23-v1.0', '/privacy#coach-sharing', 'Coach access and player-data sharing', TRUE)
ON CONFLICT (document_type) DO UPDATE SET
  document_version = EXCLUDED.document_version,
  document_url = EXCLUDED.document_url,
  label = EXCLUDED.label,
  required = EXCLUDED.required,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.user_consent_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL REFERENCES public.beta_required_documents(document_type) ON DELETE RESTRICT,
  document_version TEXT NOT NULL CHECK (char_length(btrim(document_version)) BETWEEN 1 AND 100),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acceptance_source TEXT NOT NULL DEFAULT 'web' CHECK (acceptance_source IN ('web')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, document_type, document_version)
);

CREATE INDEX IF NOT EXISTS user_consent_acceptances_user_idx
  ON public.user_consent_acceptances(user_id, accepted_at DESC);

CREATE TABLE IF NOT EXISTS public.beta_operational_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  account_role TEXT CHECK (account_role IS NULL OR account_role IN ('player', 'coach')),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'export_completed',
    'export_failed',
    'deletion_completed',
    'deletion_failed',
    'feedback_submitted',
    'feedback_failed'
  )),
  request_id UUID NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_type, request_id)
);

CREATE INDEX IF NOT EXISTS beta_operational_events_type_time_idx
  ON public.beta_operational_events(event_type, occurred_at DESC);

ALTER TABLE public.beta_required_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_consent_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_operational_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own consent history" ON public.user_consent_acceptances;
CREATE POLICY "Users can read own consent history"
  ON public.user_consent_acceptances
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON public.beta_required_documents FROM anon, authenticated;
REVOKE ALL ON public.user_consent_acceptances FROM anon, authenticated;
REVOKE ALL ON public.beta_operational_events FROM anon, authenticated;
GRANT SELECT ON public.user_consent_acceptances TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_consent_acceptance_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Consent acceptance records are immutable.' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_consent_acceptance_update ON public.user_consent_acceptances;
CREATE TRIGGER prevent_consent_acceptance_update
  BEFORE UPDATE ON public.user_consent_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.prevent_consent_acceptance_mutation();

CREATE OR REPLACE FUNCTION public.public_beta_get_my_consent_status()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_user UUID := auth.uid();
  result JSONB;
BEGIN
  IF active_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'complete',
    NOT EXISTS (
      SELECT 1
      FROM public.beta_required_documents required_document
      WHERE required_document.required
        AND NOT EXISTS (
          SELECT 1
          FROM public.user_consent_acceptances acceptance
          WHERE acceptance.user_id = active_user
            AND acceptance.document_type = required_document.document_type
            AND acceptance.document_version = required_document.document_version
        )
    ),
    'documents',
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'documentType', required_document.document_type,
          'documentVersion', required_document.document_version,
          'documentUrl', required_document.document_url,
          'label', required_document.label,
          'required', required_document.required,
          'accepted', latest_acceptance.accepted_at IS NOT NULL,
          'acceptedAt', latest_acceptance.accepted_at
        )
        ORDER BY required_document.document_type
      ),
      '[]'::JSONB
    )
  )
  INTO result
  FROM public.beta_required_documents required_document
  LEFT JOIN LATERAL (
    SELECT acceptance.accepted_at
    FROM public.user_consent_acceptances acceptance
    WHERE acceptance.user_id = active_user
      AND acceptance.document_type = required_document.document_type
      AND acceptance.document_version = required_document.document_version
    ORDER BY acceptance.accepted_at DESC
    LIMIT 1
  ) latest_acceptance ON TRUE
  WHERE required_document.required;

  RETURN coalesce(result, jsonb_build_object('complete', TRUE, 'documents', '[]'::JSONB));
END;
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

  PERFORM public.public_beta_assert_current_user_adult();

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

CREATE OR REPLACE FUNCTION public.public_beta_record_my_operational_event(
  p_event_type TEXT,
  p_request_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_user UUID := auth.uid();
  active_role TEXT;
BEGIN
  IF active_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF p_event_type NOT IN ('export_failed', 'deletion_failed', 'feedback_submitted', 'feedback_failed')
     OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'Unsupported operational event.' USING ERRCODE = '22023';
  END IF;

  IF (
    SELECT count(*)
    FROM public.beta_operational_events event
    WHERE event.user_id = active_user
      AND event.event_type = p_event_type
      AND event.occurred_at >= now() - INTERVAL '24 hours'
  ) >= 25 THEN
    RETURN FALSE;
  END IF;

  SELECT profile.role
  INTO active_role
  FROM public.profiles profile
  WHERE profile.id = active_user;

  INSERT INTO public.beta_operational_events(user_id, account_role, event_type, request_id)
  VALUES (
    active_user,
    CASE WHEN active_role IN ('player', 'coach') THEN active_role ELSE NULL END,
    p_event_type,
    p_request_id
  )
  ON CONFLICT (user_id, event_type, request_id) DO NOTHING;

  RETURN FOUND;
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

CREATE OR REPLACE FUNCTION public.public_beta_delete_my_account(
  p_confirmation TEXT,
  p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  active_user UUID := auth.uid();
  active_role TEXT;
  active_email TEXT;
  issued_at TIMESTAMPTZ;
  blocked_team_count INTEGER;
BEGIN
  IF active_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF p_confirmation IS DISTINCT FROM 'DELETE MY LODARIO ACCOUNT' OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'Explicit account-deletion confirmation is required.' USING ERRCODE = '22023';
  END IF;

  BEGIN
    issued_at := to_timestamp((auth.jwt() ->> 'iat')::DOUBLE PRECISION);
  EXCEPTION
    WHEN OTHERS THEN
      issued_at := NULL;
  END;

  IF issued_at IS NULL OR issued_at < now() - INTERVAL '15 minutes' THEN
    RAISE EXCEPTION 'Recent authentication is required. Sign out, sign in again, and retry.' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(active_user::TEXT, 0));

  SELECT profile.role
  INTO active_role
  FROM public.profiles profile
  WHERE profile.id = active_user;

  SELECT lower(user_record.email::TEXT)
  INTO active_email
  FROM auth.users user_record
  WHERE user_record.id = active_user;

  SELECT count(*)
  INTO blocked_team_count
  FROM public.teams team
  WHERE team.created_by = active_user
    AND EXISTS (
      SELECT 1
      FROM public.team_memberships membership
      WHERE membership.team_id = team.id
        AND membership.user_id <> active_user
        AND membership.status <> 'removed'
    );

  IF blocked_team_count > 0 THEN
    RAISE EXCEPTION 'Transfer or close teams containing other members before deleting this account.' USING ERRCODE = '23503';
  END IF;

  -- Historical Guardian rows use restrictive foreign keys. Remove only rows
  -- involving the deleting account so unrelated accounts remain intact.
  DELETE FROM public.guardian_consent_history
  WHERE guardian_user_id = active_user OR player_user_id = active_user;

  DELETE FROM public.guardian_privacy_requests
  WHERE requesting_user_id = active_user OR related_player_id = active_user;

  DELETE FROM public.guardian_updates
  WHERE guardian_user_id = active_user
     OR related_player_id = active_user
     OR created_by = active_user;

  DELETE FROM public.guardian_audit_events
  WHERE actor_user_id = active_user OR subject_player_id = active_user;

  DELETE FROM public.guardian_product_events
  WHERE actor_user_id = active_user;

  DELETE FROM public.guardian_invitations
  WHERE intended_guardian_user_id = active_user
     OR (active_email IS NOT NULL AND lower(guardian_email) = active_email);

  INSERT INTO public.beta_operational_events(user_id, account_role, event_type, request_id)
  VALUES (
    active_user,
    CASE WHEN active_role IN ('player', 'coach') THEN active_role ELSE NULL END,
    'deletion_completed',
    p_request_id
  )
  ON CONFLICT (user_id, event_type, request_id) DO NOTHING;

  -- auth.users deletion cascades after the profile DOB may already be gone.
  -- Allow only this transaction's own-user cascade through the beta write
  -- trigger; the setting is transaction-local and is never client-supplied.
  PERFORM set_config('lodario.public_beta_self_delete_user_id', active_user::TEXT, TRUE);

  DELETE FROM auth.users WHERE id = active_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account deletion could not be completed.' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object('deleted', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_consent_acceptance_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_beta_get_my_consent_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_beta_accept_required_consents(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_beta_record_my_operational_event(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_beta_export_my_data(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_beta_delete_my_account(TEXT, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.public_beta_get_my_consent_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_beta_accept_required_consents(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_beta_record_my_operational_event(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_beta_export_my_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_beta_delete_my_account(TEXT, UUID) TO authenticated;

COMMENT ON TABLE public.user_consent_acceptances IS
  'Immutable, server-timestamped acceptance history for current and superseded Lodario beta documents.';
COMMENT ON TABLE public.beta_operational_events IS
  'Minimal first-party operational events. Never store wellness answers, injury details, notes, email addresses, tokens, or request bodies here.';
COMMENT ON FUNCTION public.public_beta_export_my_data(UUID) IS
  'Returns only the signed-in account owner''s exportable data. Coaches receive owned team metadata, never unrelated Player health records.';
COMMENT ON FUNCTION public.public_beta_delete_my_account(TEXT, UUID) IS
  'Deletes only the signed-in account after recent authentication and blocks Coach deletion when owned teams contain another user.';

COMMIT;
