-- Phase 3: Enterprise readiness
-- Organization model, RBAC, MFA, white-label branding

-- ── Organizations ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'starter',
  primary_color text DEFAULT '#154630',
  logo_url text,
  custom_domain text,
  settings jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view their org" ON public.organizations;
CREATE POLICY "Org members can view their org"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organizations.id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Org admins can update their org" ON public.organizations;
CREATE POLICY "Org admins can update their org"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organizations.id
        AND om.user_id = auth.uid()
        AND om.role = 'admin'
        AND om.status = 'active'
    )
  );

-- ── Organization members ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member', -- admin, member, interviewer
  status text NOT NULL DEFAULT 'active', -- active, invited, suspended
  invited_by uuid,
  invited_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view org membership" ON public.organization_members;
CREATE POLICY "Members can view org membership"
  ON public.organization_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
        AND om.role = 'admin'
        AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Org admins can manage members" ON public.organization_members;
CREATE POLICY "Org admins can manage members"
  ON public.organization_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
        AND om.role = 'admin'
        AND om.status = 'active'
    )
  );

-- ── MFA (TOTP) on profiles ─────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mfa_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mfa_secret text,
  ADD COLUMN IF NOT EXISTS mfa_recovery_codes jsonb DEFAULT '[]';

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

DROP POLICY IF EXISTS "Org members can view org analytics" ON public.org_analytics;
CREATE POLICY "Org members can view org analytics"
  ON public.org_analytics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = org_analytics.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

-- ── SSO provider configs ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sso_provider_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL, -- 'oidc', 'saml'
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

DROP POLICY IF EXISTS "Org admins can manage SSO config" ON public.sso_provider_configs;
CREATE POLICY "Org admins can manage SSO config"
  ON public.sso_provider_configs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = sso_provider_configs.organization_id
        AND om.user_id = auth.uid()
        AND om.role = 'admin'
        AND om.status = 'active'
    )
  );

-- ── Feedback / RLHF preference pairs ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.interview_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
  turn_index integer NOT NULL,
  user_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  helpful boolean,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.interview_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create feedback for their sessions" ON public.interview_feedback;
CREATE POLICY "Users can create feedback for their sessions"
  ON public.interview_feedback FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Org admins can view feedback" ON public.interview_feedback;
CREATE POLICY "Org admins can view feedback"
  ON public.interview_feedback FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.interview_sessions s
      JOIN public.organization_members om ON om.organization_id = s.organization_id
      WHERE s.id = interview_feedback.session_id
        AND om.user_id = auth.uid()
        AND om.role = 'admin'
        AND om.status = 'active'
    )
  );

CREATE INDEX IF NOT EXISTS idx_interview_feedback_session
  ON public.interview_feedback (session_id);

-- ── refresh_org_analytics helper ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.refresh_org_analytics()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  org_rec record;
BEGIN
  FOR org_rec IN
    SELECT id FROM public.organizations
  LOOP
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
      COUNT(*) FILTER (WHERE s.status = 'completed'),
      AVG(s.overall_score)::double precision,
      COUNT(DISTINCT s.user_id),
      0 -- ai_cost_usd populated by edge function billing events
    FROM public.interview_sessions s
    WHERE s.organization_id = org_rec.id
      AND s.created_at >= CURRENT_DATE
      AND s.created_at < CURRENT_DATE + interval '1 day'
    GROUP BY org_rec.id
    ON CONFLICT (organization_id, date) DO UPDATE
    SET
      interviews_completed = EXCLUDED.interviews_completed,
      avg_score = EXCLUDED.avg_score,
      unique_users = EXCLUDED.unique_users;
  END LOOP;
END;
$$;

-- ── Indexes for org analytics queries ──────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_org_analytics_org_date
  ON public.org_analytics (organization_id, date);

CREATE INDEX IF NOT EXISTS idx_interview_feedback_session
  ON public.interview_feedback (session_id);

-- ── org_analytics refresh helper (call via pg_cron or edge function) ───────

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
