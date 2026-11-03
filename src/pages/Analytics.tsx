import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SkillRadarChart from "@/components/SkillRadarChart";
import { type UserAnalytics } from "@/lib/utils";
import { pickStrongestAndWeakest } from "@/lib/skills";

interface SessionTrend {
  label: string;
  score: number;
}

const SKILL_LABELS: Record<string, string> = {
  communication_score: "Communication",
  technical_score: "Technical",
  system_design_score: "System Design",
  problem_solving_score: "Problem Solving",
  confidence_score: "Confidence",
};

export default function Analytics() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [trendData, setTrendData] = useState<SessionTrend[]>([]);
  const [weaknessData, setWeaknessData] = useState<{ area: string; score: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = user?.id;

  const fetchData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [analyticsRes, sessionsRes] = await Promise.all([
        supabase.from("user_analytics").select("*").eq("user_id", userId).maybeSingle(),
        supabase
          .from("interview_sessions")
          .select("overall_score, created_at")
          .eq("user_id", userId)
          .eq("status", "completed")
          .not("overall_score", "is", null)
          .order("created_at", { ascending: true })
          .limit(20),
      ]);
      if (analyticsRes.error) throw analyticsRes.error;
      if (sessionsRes.error) throw sessionsRes.error;
      setAnalytics(analyticsRes.data);
      const data = analyticsRes.data;
      if (data) {
        const record = data as unknown as Record<string, number | null>;
        const skills = Object.entries(SKILL_LABELS).map(([key, label]) => ({
          area: label,
          score: Number(record[key]) || 0,
        }));
        skills.sort((a, b) => a.score - b.score);
        setWeaknessData(skills);
      }
      if (sessionsRes.data?.length) {
        setTrendData(
          sessionsRes.data.map((session) => ({
            label: new Date(session.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            }),
            score: session.overall_score!,
          })),
        );
      }
    } catch {
      setError("Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const { avgScore, weakest, strongest, insights } = useMemo<{
    avgScore: number;
    weakest: { area: string; score: number } | null;
    strongest: { area: string; score: number } | null;
    insights: string[];
  }>(() => {
    const avg = trendData.length > 0 ? Math.round(trendData.reduce((a, t) => a + t.score, 0) / trendData.length) : 0;
    const { strongest: s, weakest: w } = pickStrongestAndWeakest(weaknessData, (skill) => skill.area);
    const ins: string[] = [];
    if (w && w.score < 60) ins.push(`Focus on ${w.area} — it's your weakest at ${w.score}/100.`);
    if (s && s.score > 70) ins.push(`${s.area} is your strongest skill at ${s.score}/100.`);
    if (trendData.length >= 3) {
      const t = trendData[trendData.length - 1].score - trendData[trendData.length - 3].score;
      if (t > 0) ins.push(`Score improved by ${t}% over the last three interviews.`);
      else if (t < 0) ins.push(`Score dropped by ${Math.abs(t)}% recently.`);
    }
    if (!ins.length) ins.push("Complete more sessions to unlock reliable trend signals.");
    return { avgScore: avg, weakest: w, strongest: s, insights: ins };
  }, [trendData, weaknessData]);

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <section className="ruled max-w-sm text-center px-6">
          <AlertTriangle className="mx-auto h-5 w-5 text-destructive" />
          <h2 className="mt-3 font-display text-[20px] font-light leading-none tracking-[-0.02em] text-foreground">
            Couldn't load analytics
          </h2>
          <p className="mt-2 text-[12px] leading-[1.6] text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={fetchData}
            className="mt-4 btn-primary btn-sm gap-1.5"
          >
            <RefreshCw className="h-3 w-3" strokeWidth={1.6} />
            Retry
          </button>
        </section>
      </div>
    );
  }

  const hasData = (analytics?.interviews_completed ?? 0) > 0;
  const maxSkill = Math.max(...weaknessData.map((skill) => skill.score), 1);

  return (
    <div className="space-y-6">
      <section className="ruled py-6 sm:py-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <span className="h-[1px] w-6 bg-accent" aria-hidden="true" />
              <span className="section-label">Performance · Five dimensions</span>
            </div>
            <h1 className="text-display-lg text-foreground">Analytics</h1>
            <p className="mt-3 max-w-xl text-[13px] leading-[1.75] text-muted-foreground">
              {hasData
                ? `Trends across ${analytics?.interviews_completed ?? 0} completed ${(
                    analytics?.interviews_completed ?? 0
                  ) === 1 ? "interview" : "interviews"}, scored on five dimensions.`
                : "Complete interviews to unlock score trends, skill balance, and the gaps worth your time."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="btn-secondary btn-sm gap-1.5"
            >
              <RefreshCw className={loading ? "h-3 w-3 animate-spin" : "h-3 w-3"} strokeWidth={1.6} />
              Refresh
            </button>
            <Link to="/interview" className="btn-primary btn-sm gap-1.5">
              New session
              <ArrowRight className="h-3 w-3" strokeWidth={1.6} />
            </Link>
          </div>
        </div>
      </section>

      {loading ? (
        <>
          <section className="ruled pt-6 pb-8">
            <div className="grid grid-cols-2 gap-[1px] border-y border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-border))] lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="bg-[hsl(var(--surface))] px-5 py-5 sm:px-6">
                  <div className="skeleton mb-5 h-2 w-16" />
                  <div className="skeleton mb-5 h-6 w-14" />
                  <div className="skeleton h-2 w-24" />
                </div>
              ))}
            </div>
            <div className="grid gap-[1px] border-y border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-border))] lg:grid-cols-2 lg:divide-x lg:divide-border py-5">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="bg-[hsl(var(--surface))] px-5 py-5 sm:px-6">
                  <div className="skeleton mb-2 h-3 w-28" />
                  <div className="skeleton h-[280px] w-full" />
                </div>
              ))}
            </div>
          </section>
        </>
      ) : !hasData ? (
        <section className="ruled py-10 text-center">
          <Target className="mx-auto h-5 w-5 text-muted-foreground/40" strokeWidth={1.7} />
          <h2 className="mt-3 font-display text-[20px] font-light leading-none tracking-[-0.02em] text-foreground">
            No analytics yet
          </h2>
          <p className="mt-2 text-[12px] leading-[1.6] text-muted-foreground">
            Complete your first interview and we'll start tracking score trends, skill balance,
            and the gaps worth your time.
          </p>
          <div className="mt-5 flex items-center justify-center">
            <Link to="/interview" className="btn-primary btn-sm gap-1.5">
              Start an interview
              <ArrowRight className="h-3 w-3" strokeWidth={1.6} />
            </Link>
          </div>
        </section>
      ) : (
        <>
          {/* Ruled metric strip */}
          <section className="ruled pt-6 pb-8">
            <div className="grid grid-cols-2 gap-[1px] border-y border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-border))] lg:grid-cols-4">
              <div className="bg-[hsl(var(--surface))] px-5 py-5 sm:px-6">
                <p className="mono-label">Interviews</p>
                <p className="mt-2 font-display text-[24px] font-normal leading-none tabular text-foreground">
                  {analytics?.interviews_completed ?? 0}
                </p>
                <p className="mt-1 text-[10px] mono-label text-muted-foreground">
                  Completed sessions
                </p>
              </div>
              <div className="bg-[hsl(var(--surface))] border-l border-[hsl(var(--surface-border))] px-5 py-5 sm:px-6">
                <p className="mono-label">Average score</p>
                <p className="mt-2 font-display text-[24px] font-normal leading-none tabular text-foreground">
                  {avgScore ? `${avgScore}%` : "—"}
                </p>
                <p className="mt-1 text-[10px] mono-label text-muted-foreground">
                  Across scored sessions
                </p>
              </div>
              <div className="bg-[hsl(var(--surface))] border-l border-[hsl(var(--surface-border))] px-5 py-5 sm:px-6">
                <p className="mono-label">Strongest</p>
                <p className="mt-2 font-display text-[20px] font-normal leading-none tabular text-foreground">
                  {strongest?.area || "—"}
                </p>
                <p className="mt-1 text-[10px] mono-label text-muted-foreground">
                  {strongest ? `${strongest.score}/100` : "No data"}
                </p>
              </div>
              <div className="bg-[hsl(var(--surface))] border-l border-[hsl(var(--surface-border))] px-5 py-5 sm:px-6">
                <p className="mono-label">Focus area</p>
                <p className="mt-2 font-display text-[20px] font-normal leading-none tabular text-foreground">
                  {weakest?.area || "—"}
                </p>
                <p className="mt-1 text-[10px] mono-label text-muted-foreground">
                  {weakest ? `${weakest.score}/100` : "No data"}
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-[1px] border-y border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-border))] lg:grid-cols-2 lg:divide-x lg:divide-border">
            {/* Score trend */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="bg-[hsl(var(--surface))] py-5 sm:pr-8"
            >
              <div className="flex items-center justify-between pb-4 px-5 sm:px-0">
                <div>
                  <h2 className="text-headline text-foreground">Score trend</h2>
                  <p className="mt-1 mono-label">
                    Chronological, last {trendData.length}{" "}
                    {trendData.length === 1 ? "session" : "sessions"}
                  </p>
                </div>
                {trendData.length > 1 && (
                  <span className="font-mono text-[8px] uppercase tracking-[0.12em] tabular text-muted-foreground">
                    {trendData[trendData.length - 1].score >= trendData[0].score ? "+" : ""}
                    {trendData[trendData.length - 1].score - trendData[0].score} pts
                  </span>
                )}
              </div>
              <div className="px-5 sm:px-0">
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={trendData} margin={{ top: 10, right: 14, bottom: 0, left: -18 }}>
                      <CartesianGrid
                        stroke="hsl(var(--surface-border))"
                        strokeOpacity={0.7}
                        strokeDasharray="3 4"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        stroke="hsl(var(--muted-foreground))"
                        tickLine={false}
                        axisLine={false}
                        fontSize={10}
                        tick={{ fill: "hsl(var(--muted-foreground))" }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        ticks={[0, 25, 50, 75, 100]}
                        stroke="hsl(var(--muted-foreground))"
                        tickLine={false}
                        axisLine={false}
                        fontSize={10}
                        tick={{ fill: "hsl(var(--muted-foreground))" }}
                      />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--surface-border))", color: "hsl(var(--foreground))", fontSize: 11, padding: "5px 9px" }}
                        formatter={(value: number) => `${value}%`}
                      />
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke="hsl(var(--primary))"
                        strokeWidth={1.6}
                        fill="hsl(var(--primary))"
                        fillOpacity={0.12}
                        dot={{ fill: "hsl(var(--primary))", r: 2, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[240px] items-center justify-center">
                    <p className="text-[11px] text-muted-foreground/40">
                      Complete another session to plot a trend.
                    </p>
                  </div>
                )}
              </div>
            </motion.section>

            {/* Signals */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
              className="bg-[hsl(var(--surface))] py-5 sm:pl-8"
            >
              <div className="flex items-center gap-2 pb-4 px-5 sm:px-0">
                <Sparkles className="h-3 w-3 text-accent" strokeWidth={1.6} />
                <h2 className="text-headline text-foreground">Signals</h2>
              </div>
              <div className="flex-1 border-y border-[hsl(var(--surface-border))] border-t border-[hsl(var(--surface-border))]">
                <ul className="divide-y divide-[hsl(var(--surface-border))] px-5 sm:px-0">
                  {insights.map((insight: string, index: number) => (
                    <li key={index} className="flex gap-2 py-3">
                      <span className="mt-px font-mono text-[7.5px] tracking-[0.1em] text-accent/50">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <p className="text-[12px] leading-[1.6] text-secondary-foreground">
                        {insight}
                      </p>
                    </li>
                  ))}
                </ul>
                <div className="px-5 sm:px-0 pt-4">
                  <Link to="/roadmap" className="link-editorial">
                    Turn signals into a plan
                    <ArrowRight className="h-3 w-3" strokeWidth={1.6} />
                  </Link>
                </div>
              </div>
            </motion.section>

            {/* Plain radar */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="bg-[hsl(var(--surface))] py-5 sm:pr-8"
            >
              <SkillRadarChart analytics={analytics} variant="plain" />
            </motion.div>

            {/* Skill breakdown */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
              className="bg-[hsl(var(--surface))] py-5 sm:pl-8"
            >
              <div className="flex items-end justify-between pb-4 px-5 sm:px-0">
                <div>
                  <h2 className="text-headline text-foreground">Skill breakdown</h2>
                  <p className="mt-1 mono-label">Weakest to strongest</p>
                </div>
                <span className="font-mono text-[7px] uppercase tracking-[0.13em] text-muted-foreground/35">
                  0–100
                </span>
              </div>
              {weaknessData.length > 0 ? (
                <div className="border-t border-[hsl(var(--surface-border))] pt-4 px-5 sm:px-0">
                  {weaknessData.map((skill, index) => (
                    <div key={skill.area}>
                      <div className="mb-2 flex items-baseline justify-between gap-2">
                        <span className="flex items-baseline gap-2 text-[12px] text-secondary-foreground">
                          <span className="font-mono text-[7px] text-muted-foreground/25">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          {skill.area}
                        </span>
                        <span className="font-display text-[18px] leading-none tabular text-foreground">
                          {skill.score}
                        </span>
                      </div>
                      <div className="h-[1px] bg-[hsl(var(--surface-border))]">
                        <div
                          className="h-[1px] bg-primary transition-[width] duration-700 ease-out-expo"
                          style={{
                            width: `${(skill.score / maxSkill) * 100}%`,
                            opacity: 1 - index * 0.1,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  <p className="pt-2 text-[10px] leading-[1.6] text-muted-foreground/45">
                    Scores decay toward your baseline when a dimension is rarely exercised.
                  </p>
                </div>
              ) : (
                <div className="flex h-[240px] items-center justify-center px-5 sm:px-0">
                  <p className="text-[11px] text-muted-foreground/40">No skill scores yet.</p>
                </div>
              )}
            </motion.section>
          </div>
        </>
      )}
    </div>
  );
}
