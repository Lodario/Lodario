-- Operational coach view. Keep private DOB, verification, consent answers and tokens private.
BEGIN;
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
          CASE WHEN i.created_by = auth.uid() OR i.related_team_id = p_team_id THEN i.guardian_email
            ELSE regexp_replace(i.guardian_email, '(^.).*(@.*$)', '\1***\2') END,
          i.relationship_type, i.is_primary,
          CASE WHEN i.status IN ('pending','sent','delivered','opened') AND i.expires_at <= now()
            THEN 'expired' ELSE i.status END,
          (i.created_by = auth.uid() OR coalesce(public.can_manage_team(i.related_team_id, auth.uid()), FALSE))
            AND i.status IN ('pending','sent','delivered','opened','expired'),
          (i.created_by = auth.uid() OR coalesce(public.can_manage_team(i.related_team_id, auth.uid()), FALSE))
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
REVOKE ALL ON FUNCTION public.coach_get_guardian_sheet(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_get_guardian_sheet(UUID) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
