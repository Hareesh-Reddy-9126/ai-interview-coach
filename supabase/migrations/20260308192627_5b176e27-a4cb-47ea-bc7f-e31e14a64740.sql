
-- Add indexes for frequently queried foreign key columns
CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_id ON public.interview_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_status ON public.interview_sessions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_created ON public.interview_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interview_turns_session_id ON public.interview_turns (session_id);
CREATE INDEX IF NOT EXISTS idx_interview_turns_session_turn ON public.interview_turns (session_id, turn_number);
CREATE INDEX IF NOT EXISTS idx_user_analytics_user_id ON public.user_analytics (user_id);
CREATE INDEX IF NOT EXISTS idx_learning_roadmaps_user_id ON public.learning_roadmaps (user_id);
CREATE INDEX IF NOT EXISTS idx_learning_roadmaps_user_created ON public.learning_roadmaps (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_resumes_user_id ON public.user_resumes (user_id);
CREATE INDEX IF NOT EXISTS idx_user_resumes_user_created ON public.user_resumes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);
