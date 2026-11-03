-- AI response cache for NVIDIA NIM calls made by edge functions.
--
-- Security model: this table is server-only. The edge functions use the
-- service-role key, which bypasses RLS. Browser clients must never be able to
-- read cached model output or poison it with arbitrary rows, so RLS is enabled
-- with no policies and table privileges are revoked from anon/authenticated.

CREATE TABLE IF NOT EXISTS public.ai_response_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_hash text NOT NULL,
  prompt_text text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_response_cache_prompt_hash
  ON public.ai_response_cache (prompt_hash);

CREATE INDEX IF NOT EXISTS idx_ai_response_cache_expires
  ON public.ai_response_cache (expires_at);

ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read cache" ON public.ai_response_cache;
DROP POLICY IF EXISTS "Anyone can insert cache" ON public.ai_response_cache;
DROP POLICY IF EXISTS "Anyone can upsert cache" ON public.ai_response_cache;

REVOKE ALL ON TABLE public.ai_response_cache FROM anon, authenticated;

-- Cleanup expired cache entries daily at 04:00 UTC.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-ai-response-cache',
      '0 4 * * *',
      $cron$DELETE FROM public.ai_response_cache WHERE expires_at < now()$cron$
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipping pg_cron schedule for ai_response_cache cleanup: %', SQLERRM;
END $$;
