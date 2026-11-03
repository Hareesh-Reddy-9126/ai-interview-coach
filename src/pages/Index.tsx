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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { type UserAnalytics } from "@/lib/utils";
import { pickStrongestAndWeakest, SKILLS } from "@/lib/skills";
import { ScoreRing, Sparkline } from "@/components/ui/metric";
import { EmptyState } from "@/components/ui/empty-state";
import SkillRadarChart from "@/components/SkillRadarChart";

interface RecentInterview {
  id: string;
  role: string;
  company: string;
  difficulty: string;
  experience: string | null;
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
    <div className="space-y-9">
      {/* Header — editorial briefing */}
      <section className="ruled py-6 sm:py-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <span className="h-[1px] w-6 bg-accent" aria-hidden="true" />
              <time className="mono-label" dateTime={new Date().toISOString().split("T")[0]}>
                {new Date().toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            </div>
            <h1 className="text-display-lg text-foreground">
              {greeting()}, {firstName}.
            </h1>
            <p className="mt-3 max-w-2xl text-[13.5px] leading-[1.75] text-muted-foreground">
              {hasHistory
                ? `${derived.completed} ${derived.completed === 1 ? "session" : "sessions"} completed so far. ${
                    focusSkill ? `Your clearest next gain is ${focusSkill.label.toLowerCase()}.` : ""
                  }`
                : "Start with a baseline interview to calibrate your readiness and unlock a personal plan."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Link to="/analytics" className="btn-secondary btn-sm">
              View analytics
            </Link>
            <Link to="/interview" className="btn-primary btn-sm gap-2">
              New session
              <ArrowRight className="h-3 w-3" strokeWidth={1.6} />
            </Link>
          </div>
        </div>
      </section>

      {/* Readiness + focus — open ruled spreads */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="ruled-inset sm:px-6"
          aria-label="Interview readiness"
        >
          <div className="flex items-center justify-between border-b border-[hsl(var(--surface-border))] pb-4 px-6 sm:px-0">
            <div className="flex items-center gap-2">
              <h2 className="text-headline text-foreground">Interview readiness</h2>
              <span className="tag-muted">{scoreTone(readiness)}</span>
            </div>
            <span className="mono-label">
              {derived.trend.length > 1 ? "Rolling average" : "Baseline"}
            </span>
          </div>

          <div className="flex flex-col gap-6 px-6 sm:flex-row sm:items-center sm:gap-10 sm:px-0">
            <div className="flex shrink-0 flex-col items-center gap-4">
              <ScoreRing value={readiness} size={148} stroke={8} label="Overall" />
              <p className="mono-label text-center">
                {derived.trend.length
                  ? `Across ${derived.trend.length} scored ${derived.trend.length === 1 ? "session" : "sessions"}`
                  : "Complete a session to score"}
              </p>
            </div>

            <div className="min-w-0 flex-1 space-y-4">
              {derived.skills.map((skill) => (
                <div key={skill.label}>
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <span className="text-[12px] font-medium text-secondary-foreground">{skill.label}</span>
                    <span className="tabular text-[11px] text-muted-foreground">
                      {skill.score > 0 ? skill.score : "—"}
                    </span>
                  </div>
                  <div className="h-[1px] bg-[hsl(var(--surface-border))]">
                    <div
                      className="h-[1px] bg-primary/80 transition-[width] duration-900 ease-out-expo"
                      style={{ width: `${Math.max(skill.score, skill.score > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[hsl(var(--surface-border))] pt-4 px-6 sm:px-0">
            <p className="mono-label">
              {hasHistory
                ? `Strongest area: ${derived.strongest?.label ?? "—"}`
                : "Interviews are scored on five dimensions."}
            </p>
            <Link
              to="/analytics"
              className="link-editorial"
            >
              Full breakdown
            </Link>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
          className="panel-ink flex flex-col sm:px-6"
          aria-label="Recommended next action"
        >
          <div className="flex items-center justify-between border-b border-[hsl(var(--sidebar-border))] pb-4 px-6">
            <h2 className="text-headline text-[hsl(var(--sidebar-accent-foreground))]">Focus next</h2>
            <span className="tag-accent">Recommended</span>
          </div>

          <div className="flex flex-1 flex-col px-6 pt-6 pb-8">
            <div className="flex h-10 w-10 items-center justify-center border border-[hsl(36_32%_42%/0.3)] text-[hsl(var(--accent))]">
              <Target className="h-4 w-4" strokeWidth={1.8} />
            </div>
            <h3 className="mt-5 font-display text-[22px] font-normal leading-[1.15] text-[hsl(var(--sidebar-accent-foreground))]">
              {focusSkill ? `Strengthen ${focusSkill.label}` : "Establish a baseline"}
            </h3>
            <p className="mt-2 text-[12.5px] leading-[1.65] text-[hsl(42_12%_68%)]">
              {focusSkill
                ? `Your ${focusSkill.label.toLowerCase()} score is ${focusSkill.score}/100 — the lowest of the five dimensions.`
                : "Run one full mock interview. We'll score five dimensions and build your first improvement plan."}
            </p>

            <div className="mt-auto pt-6">
              <Link
                to={
                  focusSkill
                    ? `/interview?focus=${encodeURIComponent(focusSkill.label)}&difficulty=Medium`
                    : "/interview"
                }
                className="btn-invert btn-sm w-full gap-2"
              >
                {focusSkill ? `Practice ${focusSkill.label}` : "Start baseline"}
                <ArrowRight className="h-3 w-3" strokeWidth={1.6} />
              </Link>
              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[hsl(var(--sidebar-border))] pt-4">
                <div>
                  <p className="font-display text-[26px] leading-none tabular text-[hsl(var(--sidebar-accent-foreground))]">
                    {analytics?.current_streak || 0}
                    <span className="font-body text-[9px] text-[hsl(42_12%_68%)]">
                      {(analytics?.current_streak || 0) === 1 ? " day" : " days"}
                    </span>
                  </p>
                  <p className="mt-1.5 flex items-center gap-1 mono-label text-[hsl(42_12%_68%)]">
                    <Flame className="h-2.5 w-2.5" strokeWidth={1.5} /> Current streak
                  </p>
                </div>
                <div>
                  <p className="font-display text-[26px] leading-none tabular text-[hsl(var(--sidebar-accent-foreground))]">
                    {derived.completed}
                  </p>
                  <p className="mt-1.5 flex items-center gap-1 mono-label text-[hsl(42_12%_68%)]">
                    <Award className="h-2.5 w-2.5" strokeWidth={1.5} /> Sessions
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.section>
      </div>

      {/* Metrics — ruled strip */}
      <section className="ruled pt-6 pb-8 sm:px-6">
        <div className="grid grid-cols-2 gap-[1px] border-y border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-border))] lg:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="bg-[hsl(var(--surface))] px-5 py-5 sm:px-6">
                <div className="skeleton mb-5 h-2.5 w-20" />
                <div className="skeleton mb-5 h-7 w-16" />
                <div className="skeleton h-2.5 w-28" />
              </div>
            ))
          ) : (
            <>
              <div className="bg-[hsl(var(--surface))] px-5 py-5 sm:px-6">
                <p className="mono-label">Interviews</p>
                <p className="mt-2 font-display text-[24px] font-normal leading-none tabular text-foreground">
                  {derived.completed}
                </p>
                <p className="mt-1 text-[10px] mono-label text-muted-foreground">Completed sessions</p>
              </div>
              <div className="bg-[hsl(var(--surface))] border-l border-[hsl(var(--surface-border))] px-5 py-5 sm:px-6">
                <p className="mono-label">Average score</p>
                <p className="mt-2 font-display text-[24px] font-normal leading-none tabular text-foreground">
                  {derived.average ? `${derived.average}%` : "—"}
                </p>
                <p className="mt-1 text-[10px] mono-label text-muted-foreground">Last 8 sessions</p>
              </div>
              <div className="bg-[hsl(var(--surface))] border-l border-[hsl(var(--surface-border))] px-5 py-5 sm:px-6">
                <p className="mono-label">Focus area</p>
                <p className="mt-2 font-display text-[20px] font-normal leading-none tabular text-foreground">
                  {focusSkill ? focusSkill.label : "—"}
                </p>
                <p className="mt-1 text-[10px] mono-label text-muted-foreground">
                  {focusSkill ? `${focusSkill.score}/100 currently` : "No scored session yet"}
                </p>
              </div>
              <div className="bg-[hsl(var(--surface))] border-l border-[hsl(var(--surface-border))] px-5 py-5 sm:px-6">
                <p className="mono-label">Streak</p>
                <p className="mt-2 font-display text-[20px] font-normal leading-none tabular text-foreground">
                  {`${analytics?.current_streak || 0}d`}
                </p>
                <p className="mt-1 text-[10px] mono-label text-muted-foreground">Consecutive days</p>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Radar + recent — ruled ledgers */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          {loading ? (
            <div className="h-[360px] border border-[hsl(var(--surface-border))] px-6 sm:px-0">
              <div className="skeleton mb-3 h-3 w-28" />
              <div className="skeleton h-[290px] w-full" />
            </div>
          ) : (
            <div className="border border-[hsl(var(--surface-border))] px-4 pb-2 pt-4 sm:px-0">
              <SkillRadarChart analytics={analytics} variant="plain" />
            </div>
          )}
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col border border-[hsl(var(--surface-border))] sm:px-0"
          aria-label="Recent sessions"
        >
          <div className="flex items-center justify-between border-b border-[hsl(var(--surface-border))] pb-3 px-6 sm:px-0">
            <h2 className="text-headline text-foreground">Recent sessions</h2>
            <Link
              to="/history"
              className="link-editorial"
            >
              All sessions
            </Link>
          </div>

          <div className="flex-1 border-t border-[hsl(var(--surface-border))]">
            {loading ? (
              <div className="divide-y divide-[hsl(var(--surface-border))]">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-3 px-4 py-4 sm:px-0">
                    <div className="skeleton h-9 w-9" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-3 w-32" />
                      <div className="skeleton h-2 w-20" />
                    </div>
                    <div className="skeleton h-6 w-10" />
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
                  <Link to="/interview" className="btn-primary btn-sm gap-2">
                    Start interview
                    <ArrowRight className="h-3 w-3" strokeWidth={1.6} />
                  </Link>
                }
                className="border-0 bg-transparent"
              />
            ) : (
              <ul className="divide-y divide-[hsl(var(--surface-border))]">
                {recentInterviews.slice(0, 5).map((session) => (
                  <li key={session.id}>
                    <Link
                      to="/history"
                      className="group flex items-center gap-3 px-4 py-4 transition-colors hover:bg-[hsl(var(--surface-hover))] sm:px-0"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-[hsl(var(--surface-border-strong))] text-muted-foreground/50 transition-colors group-hover:border-[hsl(var(--primary))] group-hover:text-[hsl(var(--primary))]">
                        <Mic className="h-3.5 w-3.5" strokeWidth={1.6} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium text-foreground">
                          {session.role}
                        </span>
                        <span className="mt-0.5 block truncate mono-label text-muted-foreground/45">
                          {session.company} · {session.difficulty} · {formatDate(session.created_at)}
                        </span>
                      </span>
                      {session.overall_score ? (
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="hidden h-[1px] w-16 overflow-hidden bg-[hsl(var(--surface-border))] sm:block">
                            <span
                              className="block h-[1px] bg-primary/70"
                              style={{ width: `${session.overall_score}%` }}
                            />
                          </span>
                          <span className="tabular w-8 text-right font-display text-[15px] font-medium text-foreground">
                            {session.overall_score}
                          </span>
                        </span>
                      ) : (
                        <span className="tag-muted shrink-0 capitalize">{session.status}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.section>
      </div>

      {/* Practice paths — ruled index */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
        aria-label="Practice paths"
        className="border-t border-[hsl(var(--surface-border))] pt-6 sm:px-0"
      >
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[hsl(var(--surface-border))] pb-3 sm:flex-row sm:items-end sm:justify-between sm:px-0">
          <div className="flex items-baseline gap-3">
            <span className="mono-accent">Index</span>
            <h2 className="text-headline text-foreground">Practice paths</h2>
          </div>
          <Link to="/practice" className="link-editorial">
            Explore all
            <ArrowRight className="h-3 w-3" strokeWidth={1.6} />
          </Link>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-[1px] border-y border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-border))] sm:grid-cols-2 lg:grid-cols-4">
          {PRACTICE_PATHS.map((path, index) => (
            <div
              key={path.to}
              className="bg-[hsl(var(--surface))] border-l border-[hsl(var(--surface-border))] px-5 py-5 sm:px-6 last:border-l-0 sm:last:border-l-0 lg:last:border-l-0"
            >
              <span className="flex items-center justify-between">
                <span className="font-mono text-[7.5px] tracking-[0.12em] text-accent">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <path.icon
                  className="h-3.5 w-3.5 text-muted-foreground/30 transition-colors group-hover:text-[hsl(var(--primary))]"
                  strokeWidth={1.6}
                />
              </span>
              <span className="mt-4 font-display text-[19px] leading-none tracking-[-0.02em] text-foreground">
                {path.label}
              </span>
              <span className="mt-2 flex-1 text-[11px] leading-[1.6] text-muted-foreground">
                {path.description}
              </span>
              <span className="mt-5 inline-flex items-center gap-1 font-mono text-[7px] uppercase tracking-[0.14em] text-muted-foreground/40">
                Begin
                <ArrowRight className="h-2 w-2 transition-transform group-hover:translate-x-0.5" strokeWidth={1.6} />
              </span>
            </div>
          ))}
        </div>
      </motion.section>

      {derived.trend.length > 1 && (
        <section className="ruled py-6 sm:px-6">
          <div className="flex items-center justify-between gap-4 border-b border-[hsl(var(--surface-border))] pb-3">
            <p className="mono-label">Score trend, last {derived.trend.length} sessions</p>
            <Sparkline data={derived.trend} width={160} height={20} />
          </div>
        </section>
      )}
    </div>
  );
}
