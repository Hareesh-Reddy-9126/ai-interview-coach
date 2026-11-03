-- AI response cache: semantic caching for NVIDIA NIM responses to cut
-- repeated model calls and reduce cost on duplicate/similar prompts.
-- Enabled via pg_cron cleanup of expired rows.

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

-- Allow the app (anon) to read/write cache entries.
-- Cache entries are not user-specific, so no RLS row filter needed.
ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read cache" ON public.ai_response_cache;
CREATE POLICY "Anyone can read cache"
  ON public.ai_response_cache FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can insert cache" ON public.ai_response_cache;
CREATE POLICY "Anyone can insert cache"
  ON public.ai_response_cache FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can upsert cache" ON public.ai_response_cache;
CREATE POLICY "Anyone can upsert cache"
  ON public.ai_response_cache FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

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
