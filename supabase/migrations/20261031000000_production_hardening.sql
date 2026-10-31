-- Production hardening: data integrity constraints, missing policies and
-- scheduled cleanup of rate-limit rows.

-- One analytics row per user (the app relies on maybeSingle()).
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_analytics_user_id_unique
  ON public.user_analytics (user_id);

-- A session can only have one turn per turn number.
CREATE UNIQUE INDEX IF NOT EXISTS idx_interview_turns_session_turn_unique
  ON public.interview_turns (session_id, turn_number);

-- Users may regenerate their roadmap, which replaces the previous row.
DROP POLICY IF EXISTS "Users can update own roadmaps" ON public.learning_roadmaps;
CREATE POLICY "Users can update own roadmaps"
  ON public.learning_roadmaps FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to remove their own interview sessions (history cleanup).
DROP POLICY IF EXISTS "Users can delete own sessions" ON public.interview_sessions;
CREATE POLICY "Users can delete own sessions"
  ON public.interview_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Keep the rate_limits table from growing without bound.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-rate-limits',
      '0 3 * * *',
      $cron$DELETE FROM public.rate_limits WHERE window_start < now() - interval '7 days'$cron$
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipping pg_cron schedule for rate_limits cleanup: %', SQLERRM;
END $$;
