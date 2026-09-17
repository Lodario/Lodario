-- Dashboard/Auth API deletion must work without calling a Lodario cleanup RPC first.
-- Ownership cascades; optional attribution is detached. No existing users are deleted.
BEGIN;

ALTER TABLE public.guardian_consent_history
  DROP CONSTRAINT guardian_consent_history_guardian_user_id_fkey,
  DROP CONSTRAINT guardian_consent_history_player_user_id_fkey,
  ADD CONSTRAINT guardian_consent_history_guardian_user_id_fkey
    FOREIGN KEY (guardian_user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT guardian_consent_history_player_user_id_fkey
    FOREIGN KEY (player_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- A team belongs to its surviving members too. Existing active coaches retain
-- management via their memberships; teams without one await administrator reassignment.
ALTER TABLE public.teams
  ALTER COLUMN created_by DROP NOT NULL,
  DROP CONSTRAINT teams_created_by_fkey,
  ADD CONSTRAINT teams_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Deleting an invitation's author must not destroy another Player's invitation.
-- Deleting its intended Guardian, however, must invalidate that account's invitation.
ALTER TABLE public.guardian_invitations
  ALTER COLUMN created_by DROP NOT NULL,
  DROP CONSTRAINT guardian_invitations_created_by_fkey,
  DROP CONSTRAINT guardian_invitations_intended_guardian_user_id_fkey,
  ADD CONSTRAINT guardian_invitations_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT guardian_invitations_intended_guardian_user_id_fkey
    FOREIGN KEY (intended_guardian_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Legacy/pre-signup invitations and waitlist entries are email-bound, not FK-bound.
-- This trigger runs for dashboard, Auth API and self-service account deletion alike.
CREATE OR REPLACE FUNCTION public.cleanup_auth_user_email_records()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.email IS NOT NULL THEN
    DELETE FROM public.guardian_invitations
    WHERE guardian_email = lower(btrim(OLD.email));
    DELETE FROM public.beta_waitlist WHERE lower(btrim(email)) = lower(btrim(OLD.email));
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.cleanup_auth_user_email_records() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER cleanup_lodario_auth_user_email_records
  BEFORE DELETE ON auth.users FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_auth_user_email_records();

-- Keep surviving children's operational account state aligned with actual access.
-- Removing one Guardian must not restrict a child who still has another active one.
CREATE OR REPLACE FUNCTION public.handle_deleted_guardian_relationship()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.player_age_identities identity SET account_state = 'relationship_revoked'
  WHERE identity.player_user_id = OLD.player_user_id AND identity.guardian_approval_required
    AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = OLD.player_user_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.guardian_player_relationships r
      WHERE r.player_user_id = OLD.player_user_id AND r.status = 'active'
        AND r.verification_status = 'verified' AND r.consent_status = 'granted'
    );
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_deleted_guardian_relationship() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER handle_deleted_guardian_relationship
  AFTER DELETE ON public.guardian_player_relationships FOR EACH ROW
  WHEN (OLD.status = 'active') EXECUTE FUNCTION public.handle_deleted_guardian_relationship();

-- The deleted caller's age/profile/consent rows may already be gone when RI actions
-- cascade. Permit only nested UPDATE/DELETE triggers after auth.users is actually
-- absent, not a client-set flag or a general bypass of ordinary write restrictions.
CREATE OR REPLACE FUNCTION public.enforce_public_beta_adult_write()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('DELETE', 'UPDATE') AND pg_trigger_depth() > 1
    AND auth.uid() IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid()) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF auth.uid() IS NOT NULL AND coalesce(auth.jwt()->>'role', '') <> 'service_role'
    AND NOT public.public_beta_current_user_can_access() THEN
    RAISE EXCEPTION 'Complete the country, Guardian and consent requirements before accessing sporting data.' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_restricted_player_write()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE row_user UUID;
BEGIN
  IF auth.uid() IS NULL THEN RETURN coalesce(NEW, OLD); END IF;
  row_user := CASE TG_TABLE_NAME WHEN 'profiles' THEN coalesce(NEW.id, OLD.id)
    ELSE coalesce(NEW.user_id, OLD.user_id) END;
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1
    AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = row_user) THEN RETURN OLD; END IF;
  IF row_user = auth.uid() AND public.player_is_guardian_restricted(row_user) THEN
    PERFORM public.guardian_write_audit('restricted_write_blocked', row_user, NULL, NULL, 'denied', jsonb_build_object('table', TG_TABLE_NAME));
    RAISE EXCEPTION 'This Player account is waiting for Guardian approval.' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce(NEW, OLD);
END;
$$;

-- Self-service retains its confirmation, recent-authentication and shared-team
-- protection; it now uses the same dependency handling as a dashboard deletion.
CREATE OR REPLACE FUNCTION public.public_beta_delete_my_account(p_confirmation TEXT, p_request_id UUID)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE active_user UUID := auth.uid(); active_role TEXT; issued_at TIMESTAMPTZ;
BEGIN
  IF active_user IS NULL THEN RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501'; END IF;
  IF p_confirmation IS DISTINCT FROM 'DELETE MY LODARIO ACCOUNT' OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'Explicit account-deletion confirmation is required.' USING ERRCODE = '22023';
  END IF;
  BEGIN issued_at := to_timestamp((auth.jwt()->>'iat')::DOUBLE PRECISION);
  EXCEPTION WHEN OTHERS THEN issued_at := NULL; END;
  IF issued_at IS NULL OR issued_at < now() - INTERVAL '15 minutes' THEN
    RAISE EXCEPTION 'Recent authentication is required. Sign out, sign in again, and retry.' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(active_user::TEXT, 0));
  IF EXISTS (
    SELECT 1 FROM public.teams t WHERE t.created_by = active_user AND EXISTS (
      SELECT 1 FROM public.team_memberships m WHERE m.team_id = t.id AND m.user_id <> active_user AND m.status <> 'removed'
    )
  ) THEN
    RAISE EXCEPTION 'Transfer or close teams containing other members before deleting this account.' USING ERRCODE = '23503';
  END IF;
  SELECT role INTO active_role FROM public.profiles WHERE id = active_user;
  INSERT INTO public.beta_operational_events(user_id, account_role, event_type, request_id)
  VALUES (active_user, CASE WHEN active_role IN ('player', 'coach') THEN active_role ELSE NULL END, 'deletion_completed', p_request_id)
  ON CONFLICT (user_id, event_type, request_id) DO NOTHING;
  DELETE FROM auth.users WHERE id = active_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account deletion could not be completed.' USING ERRCODE = 'P0001'; END IF;
  RETURN jsonb_build_object('deleted', TRUE);
END;
$$;

-- Nullable author IDs must fail closed in invitation authorization and action flags.
CREATE OR REPLACE FUNCTION public.guardian_resend_invitation(p_invitation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE actor UUID := auth.uid();
DECLARE invitation public.guardian_invitations%ROWTYPE;
DECLARE token_value TEXT;
DECLARE expires_value TIMESTAMPTZ := now() + INTERVAL '7 days';
BEGIN
  SELECT * INTO invitation FROM public.guardian_invitations WHERE id=p_invitation_id FOR UPDATE;
  IF NOT FOUND OR actor IS NULL OR NOT (coalesce(invitation.created_by=actor,FALSE) OR invitation.player_user_id=actor OR
    (invitation.related_team_id IS NOT NULL AND public.can_manage_team(invitation.related_team_id,actor))) THEN
    RAISE EXCEPTION 'Invitation is unavailable.' USING ERRCODE='42501';
  END IF;
  IF invitation.status NOT IN ('pending','sent','delivered','opened','expired') THEN RAISE EXCEPTION 'This invitation cannot be resent.' USING ERRCODE='22023'; END IF;
  IF invitation.last_sent_at > now() - INTERVAL '60 seconds' THEN RAISE EXCEPTION 'Please wait before resending this invitation.' USING ERRCODE='54000'; END IF;
  IF invitation.resend_attempts >= 5 THEN RAISE EXCEPTION 'The resend limit has been reached.' USING ERRCODE='54000'; END IF;
  token_value := encode(extensions.gen_random_bytes(32),'hex');
  UPDATE public.guardian_invitations SET token_hash=extensions.digest(token_value,'sha256'), token_hint=right(token_value,6),
    status='sent', expires_at=expires_value, last_sent_at=now(), resend_attempts=resend_attempts+1, failure_code=NULL
  WHERE id=invitation.id;
  PERFORM public.guardian_write_audit('invitation_resent',invitation.player_user_id,NULL,invitation.id,'success','{}'::JSONB);
  RETURN jsonb_build_object('invitationId',invitation.id,'token',token_value,'guardianEmail',invitation.guardian_email,
    'guardianName',invitation.guardian_name,'playerId',invitation.player_user_id,'invitationType',invitation.invitation_type,
    'expiresAt',expires_value,'policyVersion',invitation.policy_version);
END;
$$;

CREATE OR REPLACE FUNCTION public.guardian_cancel_invitation(p_invitation_id UUID)
RETURNS VOID LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $$
DECLARE actor UUID:=auth.uid(); DECLARE invitation public.guardian_invitations%ROWTYPE;
BEGIN
  SELECT * INTO invitation FROM public.guardian_invitations WHERE id=p_invitation_id FOR UPDATE;
  IF NOT FOUND OR actor IS NULL OR NOT (coalesce(invitation.created_by=actor,FALSE) OR invitation.player_user_id=actor OR
    (invitation.related_team_id IS NOT NULL AND public.can_manage_team(invitation.related_team_id,actor))) THEN
    RAISE EXCEPTION 'Invitation is unavailable.' USING ERRCODE='42501';
  END IF;
  IF invitation.status NOT IN ('pending','sent','delivered','opened','expired') THEN RAISE EXCEPTION 'This invitation cannot be cancelled.' USING ERRCODE='22023'; END IF;
  UPDATE public.guardian_invitations SET status='cancelled',cancelled_at=now() WHERE id=invitation.id;
  PERFORM public.guardian_write_audit('invitation_cancelled',invitation.player_user_id,NULL,invitation.id,'success','{}'::JSONB);
END; $$;


CREATE OR REPLACE FUNCTION public.coach_get_guardian_sheet(p_team_id UUID)
RETURNS TABLE (
  player_id UUID, player_name TEXT, age_policy_category TEXT, account_state TEXT,
  positions TEXT[], height_cm NUMERIC, weight_kg NUMERIC, contacts JSONB
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_team(p_team_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorised for this team.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT tm.user_id, coalesce(nullif(btrim(p.display_name), ''), sport.display_name, 'Player'),
    coalesce(ai.age_band, 'unknown'), coalesce(ai.account_state, 'age_unknown'),
    sport.positions, sport.height_cm, sport.weight_kg,
    coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'kind', c.kind, 'name', c.name, 'email', c.email,
        'relationship', c.relationship, 'isPrimary', c.is_primary, 'status', c.status,
        'canManage', c.can_manage, 'canResend', c.can_resend
      ) ORDER BY c.is_primary DESC, c.created_at, c.id)
      FROM (
        SELECT r.id, 'relationship'::TEXT AS kind,
          coalesce(nullif(gp.display_name, ''), 'Guardian') AS name,
          regexp_replace(u.email, '(^.).*(@.*$)', '\1***\2') AS email,
          r.relationship_type AS relationship, r.is_primary, r.status,
          FALSE AS can_manage, FALSE AS can_resend, r.created_at
        FROM public.guardian_player_relationships r
        LEFT JOIN public.guardian_profiles gp ON gp.user_id = r.guardian_user_id
        LEFT JOIN auth.users u ON u.id = r.guardian_user_id
        WHERE r.player_user_id = tm.user_id
        UNION ALL
        SELECT i.id, 'invitation', coalesce(nullif(i.guardian_name, ''), 'Invited guardian'),
          CASE WHEN coalesce(i.created_by = auth.uid(), FALSE) OR i.related_team_id = p_team_id THEN i.guardian_email
            ELSE regexp_replace(i.guardian_email, '(^.).*(@.*$)', '\1***\2') END,
          i.relationship_type, i.is_primary,
          CASE WHEN i.status IN ('pending','sent','delivered','opened') AND i.expires_at <= now()
            THEN 'expired' ELSE i.status END,
          (coalesce(i.created_by = auth.uid(), FALSE) OR coalesce(public.can_manage_team(i.related_team_id, auth.uid()), FALSE))
            AND i.status IN ('pending','sent','delivered','opened','expired'),
          (coalesce(i.created_by = auth.uid(), FALSE) OR coalesce(public.can_manage_team(i.related_team_id, auth.uid()), FALSE))
            AND i.status IN ('pending','sent','delivered','opened','expired')
            AND i.resend_attempts < 5 AND (i.last_sent_at IS NULL OR i.last_sent_at <= now() - INTERVAL '60 seconds'),
          i.created_at
        FROM public.guardian_invitations i
        WHERE i.player_user_id = tm.user_id AND NOT EXISTS (
          SELECT 1 FROM public.guardian_player_relationships linked
          WHERE linked.player_user_id = tm.user_id AND linked.metadata->>'invitationId' = i.id::TEXT
        )
      ) c
    ), '[]'::JSONB)
  FROM public.team_memberships tm
  JOIN public.profiles p ON p.id = tm.user_id
  LEFT JOIN public.player_age_identities ai ON ai.player_user_id = tm.user_id
  -- Reuse the existing sporting-data access gate, including subject consent checks.
  LEFT JOIN public.get_team_players(p_team_id) sport ON sport.user_id = tm.user_id
  WHERE tm.team_id = p_team_id AND tm.role = 'player' AND tm.status = 'active'
  ORDER BY p.display_name, tm.user_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
