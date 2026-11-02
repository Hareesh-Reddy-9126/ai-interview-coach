import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Award,
  Code2,
  FileText,
  Flame,
  Map,
  Mic,
  Target,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { type UserAnalytics } from "@/lib/utils";
import { pickStrongestAndWeakest, SKILLS } from "@/lib/skills";
import { Metric, ScoreRing, Sparkline } from "@/components/ui/metric";
import { EmptyState } from "@/components/ui/empty-state";
import SkillRadarChart from "@/components/SkillRadarChart";

interface RecentInterview {
  id: string;
  role: string;
  company: string;
  difficulty: string;
  overall_score: number | null;
  created_at: string;
  status: string;
}

const PRACTICE_PATHS = [
  {
    to: "/interview",
    icon: Mic,
    label: "Mock interview",
    description: "Adaptive questions with scored feedback",
  },
  {
    to: "/coding",
    icon: Code2,
    label: "Coding lab",
    description: "Algorithms judged by AI review",
  },
  {
    to: "/resume",
    icon: FileText,
    label: "Resume analysis",
    description: "Extract strengths and tailored questions",
  },
  {
    to: "/roadmap",
    icon: Map,
    label: "Learning roadmap",
    description: "A four-week plan built around your gaps",
  },
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function scoreTone(score: number) {
  if (score >= 80) return "Strong";
  if (score >= 65) return "Developing";
  if (score > 0) return "Building";
  return "Not started";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function Dashboard() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [recentInterviews, setRecentInterviews] = useState<RecentInterview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    Promise.all([
      supabase.from("user_analytics").select("*").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("interview_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(8),
    ]).then(([analyticsRes, interviewsRes]) => {
      if (cancelled) return;
      setAnalytics(analyticsRes.data);
      setRecentInterviews(interviewsRes.data || []);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const derived = useMemo(() => {
    const completed = Number(analytics?.interviews_completed) || 0;
    const scored = recentInterviews.filter(
      (session) => typeof session.overall_score === "number" && session.overall_score > 0,
    );
    const average = scored.length
      ? Math.round(scored.reduce((sum, session) => sum + (session.overall_score || 0), 0) / scored.length)
      : 0;

    const skills = SKILLS.map((skill) => ({
      label: skill.label,
      score: Number(analytics?.[skill.key]) || 0,
    })).sort((a, b) => b.score - a.score);

    const { strongest, weakest } = pickStrongestAndWeakest(skills, (skill) => skill.label);
    const trend = [...scored].reverse().map((session) => session.overall_score as number);

    return { completed, average, skills, strongest: completed > 0 ? strongest : null, weakest: completed > 0 ? weakest : null, trend };
  }, [analytics, recentInterviews]);

  const firstName =
    user?.user_metadata?.name?.split(" ")[0] || user?.email?.split("@")[0] || "there";
  const focusSkill = derived.weakest;
  const readiness = derived.average;
  const hasHistory = derived.completed > 0 && derived.average > 0;

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col gap-5 border-b border-border/60 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-primary" aria-hidden="true" />
            <span className="section-label">
              {new Date().toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
          <h1 className="text-display-lg text-foreground">
            {greeting()}, {firstName}.
          </h1>
          <p className="mt-2.5 max-w-xl text-[13.5px] leading-6 text-muted-foreground">
            {hasHistory
              ? `${derived.completed} ${derived.completed === 1 ? "session" : "sessions"} completed so far. ${
                  focusSkill ? `Your clearest next gain is ${focusSkill.label.toLowerCase()}.` : ""
                }`
              : "Start with a baseline interview to calibrate your readiness and unlock a personal plan."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link to="/analytics" className="btn-secondary btn-sm">
            View analytics
          </Link>
          <Link to="/interview" className="btn-primary btn-sm gap-1.5">
            New session
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Readiness + focus */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="card-base relative overflow-hidden"
          aria-label="Interview readiness"
        >
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <h2 className="text-headline text-foreground">Interview readiness</h2>
              <span className="tag-muted">{scoreTone(readiness)}</span>
            </div>
            <span className="text-[11px] text-muted-foreground/60">
              {derived.trend.length > 1 ? "Rolling average" : "Baseline"}
            </span>
          </div>

          <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:gap-8">
            <div className="flex shrink-0 flex-col items-center gap-3">
              <ScoreRing value={readiness} size={132} stroke={7} label="Overall" />
              <p className="text-[11px] text-muted-foreground/60">
                {derived.trend.length
                  ? `Across ${derived.trend.length} scored ${derived.trend.length === 1 ? "session" : "sessions"}`
                  : "Complete a session to score"}
              </p>
            </div>

            <div className="min-w-0 flex-1 space-y-3">
              {derived.skills.map((skill) => (
                <div key={skill.label}>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="text-[12px] font-medium text-secondary-foreground">{skill.label}</span>
                    <span className="tabular text-[11.5px] text-muted-foreground">
                      {skill.score > 0 ? skill.score : "—"}
                    </span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full bg-primary/85 transition-[width] duration-700 ease-out-expo"
                      style={{ width: `${Math.max(skill.score, skill.score > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-surface-2/40 px-5 py-3">
            <p className="text-[11.5px] text-muted-foreground">
              {hasHistory
                ? `Strongest area: ${derived.strongest?.label ?? "—"}`
                : "Interviews are scored on five dimensions."}
            </p>
            <Link
              to="/analytics"
              className="group inline-flex items-center gap-1.5 text-[11.5px] font-medium text-primary transition-colors hover:text-primary-glow"
            >
              Full breakdown
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
          className="card-base flex flex-col"
          aria-label="Recommended next action"
        >
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
            <h2 className="text-headline text-foreground">Focus next</h2>
            <span className="tag-primary">Recommended</span>
          </div>

          <div className="flex flex-1 flex-col p-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-2 text-primary">
              <Target className="h-4 w-4" strokeWidth={1.8} />
            </div>
            <h3 className="mt-4 font-display text-[17px] font-semibold tracking-[-0.02em] text-foreground">
              {focusSkill ? `Strengthen ${focusSkill.label}` : "Establish a baseline"}
            </h3>
            <p className="mt-1.5 text-[12.5px] leading-5 text-muted-foreground">
              {focusSkill
                ? `Your ${focusSkill.label.toLowerCase()} score is ${focusSkill.score}/100 — the lowest of the five dimensions. A focused 20-minute session will move it fastest.`
                : "Run one full mock interview. We'll score five dimensions and build your first improvement plan from the results."}
            </p>

            <div className="mt-auto pt-5">
              <Link
                to={
                  focusSkill
                    ? `/interview?focus=${encodeURIComponent(focusSkill.label)}&difficulty=Medium`
                    : "/interview"
                }
                className="btn-primary btn-sm w-full gap-1.5"
              >
                {focusSkill ? `Practice ${focusSkill.label}` : "Start baseline"}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-4">
                <div>
                  <p className="font-display text-[18px] font-semibold leading-none text-foreground tabular">
                    {analytics?.current_streak || 0}
                    <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                      {(analytics?.current_streak || 0) === 1 ? "day" : "days"}
                    </span>
                  </p>
                  <p className="mt-1.5 flex items-center gap-1 text-[10.5px] text-muted-foreground/60">
                    <Flame className="h-3 w-3" /> Current streak
                  </p>
                </div>
                <div>
                  <p className="font-display text-[18px] font-semibold leading-none text-foreground tabular">
                    {derived.completed}
                    <span className="ml-1 text-[11px] font-normal text-muted-foreground">total</span>
                  </p>
                  <p className="mt-1.5 flex items-center gap-1 text-[10.5px] text-muted-foreground/60">
                    <Award className="h-3 w-3" /> Sessions
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.section>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="card-base p-5">
              <div className="skeleton mb-4 h-2.5 w-16" />
              <div className="skeleton mb-4 h-6 w-14" />
              <div className="skeleton h-2.5 w-24" />
            </div>
          ))
        ) : (
          <>
            <Metric
              label="Interviews"
              value={derived.completed}
              hint="Completed sessions"
              icon={Mic}
            />
            <Metric
              label="Average score"
              value={derived.average ? `${derived.average}%` : "—"}
              hint="Last 8 sessions"
              spark={derived.trend.length > 1 ? derived.trend : undefined}
              icon={TrendingUp}
            />
            <Metric
              label="Focus area"
              value={focusSkill ? focusSkill.label : "—"}
              hint={focusSkill ? `${focusSkill.score}/100 currently` : "No scored session yet"}
              icon={Target}
            />
            <Metric
              label="Streak"
              value={`${analytics?.current_streak || 0}d`}
              hint="Consecutive practice days"
              icon={Flame}
            />
          </>
        )}
      </div>

      {/* Radar + recent */}
      <div className="grid gap-4 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          {loading ? (
            <div className="card-base h-[336px] p-5">
              <div className="skeleton mb-2 h-3.5 w-24" />
              <div className="skeleton h-[270px] w-full" />
            </div>
          ) : (
            <SkillRadarChart analytics={analytics} />
          )}
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
          className="card-base flex flex-col"
          aria-label="Recent sessions"
        >
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
            <h2 className="text-headline text-foreground">Recent sessions</h2>
            <Link
              to="/history"
              className="group inline-flex items-center gap-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              All sessions
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <div className="flex-1">
            {loading ? (
              <div className="divide-y divide-border/60">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="skeleton h-8 w-8 rounded-md" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-3 w-32" />
                      <div className="skeleton h-2.5 w-20" />
                    </div>
                    <div className="skeleton h-5 w-10" />
                  </div>
                ))}
              </div>
            ) : recentInterviews.length === 0 ? (
              <EmptyState
                compact
                icon={<Mic className="h-5 w-5" strokeWidth={1.7} />}
                title="No sessions yet"
                description="Your first scored interview will appear here with a full breakdown."
                action={
                  <Link to="/interview" className="btn-primary btn-sm gap-1.5">
                    Start interview
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                }
                className="border-0 bg-transparent shadow-none"
              />
            ) : (
              <ul className="divide-y divide-border/60">
                {recentInterviews.slice(0, 5).map((session) => (
                  <li key={session.id}>
                    <Link
                      to="/history"
                      className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2/50"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-surface-2 text-muted-foreground/70 transition-colors group-hover:border-border-strong group-hover:text-foreground">
                        <Mic className="h-3.5 w-3.5" strokeWidth={1.8} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium text-foreground">
                          {session.role}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground/65">
                          {session.company} · {session.difficulty} · {formatDate(session.created_at)}
                        </span>
                      </span>
                      {session.overall_score ? (
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="hidden h-1 w-14 overflow-hidden rounded-full bg-surface-3 sm:block">
                            <span
                              className="block h-full rounded-full bg-primary/80"
                              style={{ width: `${session.overall_score}%` }}
                            />
                          </span>
                          <span className="tabular w-8 text-right text-[12px] font-medium text-foreground">
                            {session.overall_score}
                          </span>
                        </span>
                      ) : (
                        <span className="tag-warning shrink-0 capitalize">{session.status}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.section>
      </div>

      {/* Practice paths */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="card-base"
        aria-label="Practice paths"
      >
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
          <div>
            <h2 className="text-headline text-foreground">Practice paths</h2>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">
              Structured ways to close the gap between where you are and the offer.
            </p>
          </div>
          <Link to="/practice" className="btn-ghost btn-sm hidden sm:inline-flex">
            Explore all
          </Link>
        </div>
        <div className="grid divide-y divide-border/60 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
          {PRACTICE_PATHS.map((path) => (
            <Link
              key={path.to}
              to={path.to}
              className="group relative flex items-start gap-3 px-5 py-4 transition-colors hover:bg-surface-2/50 sm:border-l sm:border-border/60 sm:first:border-l-0 lg:py-5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-surface-2 text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary">
                <path.icon className="h-3.5 w-3.5" strokeWidth={1.8} />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 text-[12.5px] font-medium text-foreground">
                  {path.label}
                  <ArrowRight className="h-3 w-3 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-60" />
                </span>
                <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground/70">
                  {path.description}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </motion.section>

      {derived.trend.length > 1 && (
        <div className="hidden items-center justify-between rounded-lg border border-border/50 bg-surface-2/30 px-4 py-2.5 md:flex">
          <p className="text-[11px] text-muted-foreground/70">
            Score trend, last {derived.trend.length} sessions
          </p>
          <Sparkline data={derived.trend} width={140} height={22} />
        </div>
      )}
    </div>
  );
}
