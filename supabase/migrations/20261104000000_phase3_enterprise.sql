-- Phase 3: Enterprise readiness
-- Organizations, RBAC, invitations, org analytics, SSO configuration, RLHF feedback.
--
-- Design notes:
--   • Authorization checks live in SECURITY DEFINER helpers so RLS policies never
--     recurse through organization_members.
--   • Organizations are created through an RPC; there is no client INSERT policy,
--     which prevents orphan organizations with no admin.
--   • Invitations are email-addressed and claimed on signup or first sign-in.
--   • The AI cache is server-only. Edge functions use the service role; browser
--     clients must never read or poison shared model output.

-- ── Organizations ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'starter',
  primary_color text DEFAULT '#154630',
  logo_url text,
  custom_domain text,
  settings jsonb NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Organization members ───────────────────────────────────────────────────
-- user_id is nullable while an invitation is pending. invited_email always
-- records the address the invitation was sent to.

CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email text,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'interviewer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS invited_email text;

ALTER TABLE public.organization_members
  ALTER COLUMN user_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_members_pending_email
  ON public.organization_members (organization_id, lower(invited_email))
  WHERE status = 'invited' AND invited_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_org_members_user
  ON public.organization_members (user_id, status);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- ── Org-scoped sessions ────────────────────────────────────────────────────

ALTER TABLE public.interview_sessions
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_interview_sessions_org_id
  ON public.interview_sessions (organization_id);

-- ── Org analytics ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  date date NOT NULL,
  interviews_completed integer NOT NULL DEFAULT 0,
  avg_score double precision NOT NULL DEFAULT 0,
  unique_users integer NOT NULL DEFAULT 0,
  ai_cost_usd double precision NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, date)
);

ALTER TABLE public.org_analytics ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_org_analytics_org_date
  ON public.org_analytics (organization_id, date);

-- ── SSO provider configs ───────────────────────────────────────────────────
-- Secrets in this table are never exposed to browsers; only org admins can
-- read the row, and the client never selects client_secret.

CREATE TABLE IF NOT EXISTS public.sso_provider_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('oidc', 'saml')),
  issuer_url text,
  client_id text,
  client_secret text,
  metadata_url text,
  acs_url text,
  entity_id text,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sso_provider_configs ENABLE ROW LEVEL SECURITY;

-- ── Feedback / RLHF preference pairs ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.interview_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
  turn_index integer NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  helpful boolean,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.interview_feedback ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_interview_feedback_session
  ON public.interview_feedback (session_id);

CREATE INDEX IF NOT EXISTS idx_interview_feedback_user
  ON public.interview_feedback (user_id, created_at DESC);

-- ── Authorization helpers ──────────────────────────────────────────────────
-- SECURITY DEFINER avoids RLS recursion. They are intentionally one-argument:
-- callers can only ask about their own access, never probe another user.

CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = p_org_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = p_org_id
      AND user_id = auth.uid()
      AND role = 'admin'
      AND status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_org_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated;

-- ── RLS policies ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Org members can view their org" ON public.organizations;
DROP POLICY IF EXISTS "Org admins can update their org" ON public.organizations;
DROP POLICY IF EXISTS organizations_select ON public.organizations;
DROP POLICY IF EXISTS organizations_update ON public.organizations;

CREATE POLICY organizations_select
  ON public.organizations FOR SELECT
  TO authenticated
  USING (public.is_org_member(id));

CREATE POLICY organizations_update
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (public.is_org_admin(id))
  WITH CHECK (public.is_org_admin(id));

DROP POLICY IF EXISTS "Members can view org membership" ON public.organization_members;
DROP POLICY IF EXISTS "Org admins can manage members" ON public.organization_members;
DROP POLICY IF EXISTS organization_members_select ON public.organization_members;
DROP POLICY IF EXISTS organization_members_insert ON public.organization_members;
DROP POLICY IF EXISTS organization_members_update ON public.organization_members;
DROP POLICY IF EXISTS organization_members_delete ON public.organization_members;

CREATE POLICY organization_members_select
  ON public.organization_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_org_admin(organization_id));

CREATE POLICY organization_members_insert
  ON public.organization_members FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_admin(organization_id));

CREATE POLICY organization_members_update
  ON public.organization_members FOR UPDATE
  TO authenticated
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

CREATE POLICY organization_members_delete
  ON public.organization_members FOR DELETE
  TO authenticated
  USING (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "Org members can view org analytics" ON public.org_analytics;
DROP POLICY IF EXISTS org_analytics_select ON public.org_analytics;

CREATE POLICY org_analytics_select
  ON public.org_analytics FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Org admins can manage SSO config" ON public.sso_provider_configs;
DROP POLICY IF EXISTS sso_configs_admin ON public.sso_provider_configs;

CREATE POLICY sso_configs_admin
  ON public.sso_provider_configs FOR ALL
  TO authenticated
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "Users can create feedback for their sessions" ON public.interview_feedback;
DROP POLICY IF EXISTS "Org admins can view feedback" ON public.interview_feedback;
DROP POLICY IF EXISTS interview_feedback_insert ON public.interview_feedback;
DROP POLICY IF EXISTS interview_feedback_select ON public.interview_feedback;

CREATE POLICY interview_feedback_insert
  ON public.interview_feedback FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.interview_sessions s
      WHERE s.id = interview_feedback.session_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY interview_feedback_select
  ON public.interview_feedback FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.interview_sessions s
      WHERE s.id = interview_feedback.session_id
        AND s.organization_id IS NOT NULL
        AND public.is_org_admin(s.organization_id)
    )
  );

-- ── Organization RPCs ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_organization(p_name text, p_slug text DEFAULT NULL)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_base text;
  v_slug text;
  v_suffix integer := 1;
  v_org public.organizations;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF length(v_name) < 2 THEN
    RAISE EXCEPTION 'Organization name is too short';
  END IF;

  v_base := lower(regexp_replace(coalesce(nullif(trim(p_slug), ''), v_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_base := trim(both '-' from v_base);
  IF v_base = '' THEN
    v_base := 'workspace';
  END IF;
  v_base := left(v_base, 40);

  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = v_slug) LOOP
    v_suffix := v_suffix + 1;
    v_slug := v_base || '-' || v_suffix::text;
  END LOOP;

  INSERT INTO public.organizations (name, slug, created_by)
  VALUES (v_name, v_slug, v_uid)
  RETURNING * INTO v_org;

  INSERT INTO public.organization_members
    (organization_id, user_id, role, status, joined_at)
  VALUES
    (v_org.id, v_uid, 'admin', 'active', now());

  RETURN v_org;
END;
$$;

REVOKE ALL ON FUNCTION public.create_organization(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_organization(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.invite_org_member(
  p_org_id uuid,
  p_email text,
  p_role text DEFAULT 'member'
)
RETURNS public.organization_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email, '')));
  v_role text := coalesce(nullif(trim(p_role), ''), 'member');
  v_uid uuid;
  v_member public.organization_members;
  v_existing public.organization_members;
BEGIN
  IF NOT public.is_org_admin(p_org_id) THEN
    RAISE EXCEPTION 'Only organization admins can invite members';
  END IF;

  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'Enter a valid email address';
  END IF;

  IF v_role NOT IN ('admin', 'member', 'interviewer') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  SELECT id INTO v_uid
  FROM auth.users
  WHERE lower(email) = v_email
  LIMIT 1;

  -- Re-send an existing pending invitation.
  SELECT * INTO v_member
  FROM public.organization_members
  WHERE organization_id = p_org_id
    AND status = 'invited'
    AND lower(invited_email) = v_email
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.organization_members
    SET role = v_role,
        invited_by = auth.uid(),
        invited_at = now(),
        user_id = coalesce(v_uid, user_id)
    WHERE id = v_member.id
    RETURNING * INTO v_member;
    RETURN v_member;
  END IF;

  IF v_uid IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.organization_members
    WHERE organization_id = p_org_id
      AND user_id = v_uid
    LIMIT 1;

    IF FOUND THEN
      IF v_existing.status = 'suspended' THEN
        UPDATE public.organization_members
        SET status = 'active',
            role = v_role,
            invited_by = auth.uid(),
            joined_at = coalesce(joined_at, now())
        WHERE id = v_existing.id
        RETURNING * INTO v_existing;
        RETURN v_existing;
      END IF;
      RAISE EXCEPTION 'That person is already a member';
    END IF;
  END IF;

  INSERT INTO public.organization_members
    (organization_id, user_id, invited_email, role, status, invited_by, invited_at, joined_at)
  VALUES
    (p_org_id, v_uid, v_email, v_role,
     CASE WHEN v_uid IS NULL THEN 'invited' ELSE 'active' END,
     auth.uid(), now(),
     CASE WHEN v_uid IS NULL THEN NULL ELSE now() END)
  RETURNING * INTO v_member;

  RETURN v_member;
END;
$$;

REVOKE ALL ON FUNCTION public.invite_org_member(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invite_org_member(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_org_invitations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 0;
  END IF;

  SELECT lower(email) INTO v_email
  FROM auth.users
  WHERE id = v_uid;

  IF v_email IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.organization_members om
  SET user_id = v_uid,
      status = 'active',
      joined_at = coalesce(om.joined_at, now())
  WHERE om.user_id IS NULL
    AND om.status = 'invited'
    AND lower(om.invited_email) = v_email
    AND NOT EXISTS (
      SELECT 1 FROM public.organization_members m2
      WHERE m2.organization_id = om.organization_id
        AND m2.user_id = v_uid
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_org_invitations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_org_invitations() TO authenticated;

CREATE OR REPLACE FUNCTION public.list_org_members(p_org_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  role text,
  status text,
  invited_email text,
  name text,
  email text,
  mfa_enabled boolean,
  created_at timestamptz,
  joined_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  RETURN QUERY
  SELECT
    om.id,
    om.user_id,
    om.role,
    om.status,
    om.invited_email,
    coalesce(p.name, split_part(coalesce(u.email, om.invited_email, ''), '@', 1), 'Invited member')::text AS name,
    coalesce(u.email, om.invited_email)::text AS email,
    CASE
      WHEN om.user_id IS NULL THEN false
      ELSE EXISTS (
        SELECT 1 FROM auth.mfa_factors f
        WHERE f.user_id = om.user_id
          AND f.status = 'verified'
      )
    END AS mfa_enabled,
    om.created_at,
    om.joined_at
  FROM public.organization_members om
  LEFT JOIN auth.users u ON u.id = om.user_id
  LEFT JOIN public.profiles p ON p.user_id = om.user_id
  WHERE om.organization_id = p_org_id
  ORDER BY om.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_org_members(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_org_members(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_org_overview(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  SELECT jsonb_build_object(
    'members', (
      SELECT count(*) FROM public.organization_members
      WHERE organization_id = p_org_id
    ),
    'active_members', (
      SELECT count(*) FROM public.organization_members
      WHERE organization_id = p_org_id AND status = 'active'
    ),
    'pending_invites', (
      SELECT count(*) FROM public.organization_members
      WHERE organization_id = p_org_id AND status = 'invited'
    ),
    'interviews_completed', (
      SELECT count(*) FROM public.interview_sessions
      WHERE organization_id = p_org_id AND status = 'completed'
    ),
    'avg_score', coalesce((
      SELECT round(avg(s.overall_score))
      FROM public.interview_sessions s
      WHERE s.organization_id = p_org_id
        AND s.status = 'completed'
        AND s.overall_score IS NOT NULL
    ), 0),
    'sessions_last_30d', (
      SELECT count(*) FROM public.interview_sessions
      WHERE organization_id = p_org_id
        AND created_at >= now() - interval '30 days'
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_org_overview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_overview(uuid) TO authenticated;

-- ── Keep at least one active admin per organization ────────────────────────

CREATE OR REPLACE FUNCTION public.protect_last_org_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.role <> 'admin' OR OLD.status <> 'active' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  -- Allow the cascade when the organization itself is being deleted.
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = OLD.organization_id) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'DELETE' OR NEW.role <> 'admin' OR NEW.status <> 'active' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = OLD.organization_id
        AND id <> OLD.id
        AND role = 'admin'
        AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'An organization must keep at least one active admin';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_last_org_admin ON public.organization_members;
CREATE TRIGGER protect_last_org_admin
  BEFORE UPDATE OR DELETE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.protect_last_org_admin();

-- ── Claim invitations when a new auth user is created ──────────────────────

CREATE OR REPLACE FUNCTION public.link_pending_org_invites()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.organization_members om
  SET user_id = NEW.id,
      status = 'active',
      joined_at = coalesce(om.joined_at, now())
  WHERE om.user_id IS NULL
    AND om.status = 'invited'
    AND lower(om.invited_email) = lower(NEW.email)
    AND NOT EXISTS (
      SELECT 1 FROM public.organization_members m2
      WHERE m2.organization_id = om.organization_id
        AND m2.user_id = NEW.id
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_link_org_invites ON auth.users;
CREATE TRIGGER on_auth_user_created_link_org_invites
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.link_pending_org_invites();

-- ── Daily org analytics rollup ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.refresh_org_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  org_rec record;
BEGIN
  FOR org_rec IN SELECT id FROM public.organizations LOOP
    INSERT INTO public.org_analytics (
      organization_id,
      date,
      interviews_completed,
      avg_score,
      unique_users,
      ai_cost_usd
    )
    SELECT
      org_rec.id,
      CURRENT_DATE,
      count(*) FILTER (WHERE s.status = 'completed')::integer,
      coalesce(avg(s.overall_score) FILTER (WHERE s.status = 'completed'), 0)::double precision,
      count(DISTINCT s.user_id)::integer,
      0
    FROM public.interview_sessions s
    WHERE s.organization_id = org_rec.id
      AND s.created_at >= CURRENT_DATE
      AND s.created_at < CURRENT_DATE + interval '1 day'
    HAVING count(*) > 0
    ON CONFLICT (organization_id, date) DO UPDATE
    SET
      interviews_completed = EXCLUDED.interviews_completed,
      avg_score = EXCLUDED.avg_score,
      unique_users = EXCLUDED.unique_users;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_org_analytics() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'refresh-org-analytics',
      '0 1 * * *',
      $cron$SELECT public.refresh_org_analytics()$cron$
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipping pg_cron schedule for org_analytics: %', SQLERRM;
END $$;
