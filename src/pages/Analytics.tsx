import { useCallback, useEffect, useState, useMemo } from "react";
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
  Award,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SkillRadarChart from "@/components/SkillRadarChart";
import { Metric } from "@/components/ui/metric";
import { EmptyState } from "@/components/ui/empty-state";
import { type UserAnalytics } from "@/lib/utils";
import { pickStrongestAndWeakest } from "@/lib/skills";

interface SessionTrend {
  label: string;
  score: number;
}
interface SkillData {
  area: string;
  score: number;
}

const SKILL_LABELS: Record<string, string> = {
  communication_score: "Communication",
  technical_score: "Technical",
  system_design_score: "System Design",
  problem_solving_score: "Problem Solving",
  confidence_score: "Confidence",
};

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border-strong))",
  borderRadius: 8,
  color: "hsl(var(--foreground))",
  fontSize: 12,
  padding: "6px 10px",
  boxShadow: "0 12px 32px -16px hsl(var(--shadow-color) / 0.9)",
};

export default function Analytics() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [trendData, setTrendData] = useState<SessionTrend[]>([]);
  const [weaknessData, setWeaknessData] = useState<SkillData[]>([]);
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
        const skills: SkillData[] = Object.entries(SKILL_LABELS).map(([key, label]) => ({
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

  const { avgScore, weakest, strongest, insights } = useMemo(() => {
    const avg =
      trendData.length > 0
        ? Math.round(trendData.reduce((a, t) => a + t.score, 0) / trendData.length)
        : 0;
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
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="card-base max-w-sm space-y-4 p-8 text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-destructive" />
          <p className="text-[13px] font-medium text-foreground">{error}</p>
          <button onClick={fetchData} className="btn-primary btn-sm mx-auto gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const hasData = (analytics?.interviews_completed ?? 0) > 0;
  const maxSkill = Math.max(...weaknessData.map((skill) => skill.score), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-primary" aria-hidden="true" />
            <span className="section-label">Performance</span>
          </div>
          <h1 className="text-display-lg text-foreground">Analytics</h1>
          <p className="mt-2.5 text-[13.5px] leading-6 text-muted-foreground">
            {hasData
              ? `Trends across ${analytics?.interviews_completed ?? 0} completed ${
                  (analytics?.interviews_completed ?? 0) === 1 ? "interview" : "interviews"
                }, scored on five dimensions.`
              : "Complete interviews to unlock score trends and skill gap analysis."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="btn-secondary btn-sm gap-1.5"
          >
            <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            Refresh
          </button>
          <Link to="/interview" className="btn-primary btn-sm gap-1.5">
            New session
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {loading ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="card-base p-5">
                <div className="skeleton mb-4 h-2.5 w-16" />
                <div className="skeleton mb-4 h-6 w-14" />
                <div className="skeleton h-2.5 w-24" />
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="card-base p-5">
                <div className="skeleton mb-2 h-3.5 w-28" />
                <div className="skeleton h-[280px] rounded-md" />
              </div>
            ))}
          </div>
        </>
      ) : !hasData ? (
        <EmptyState
          icon={<Target className="h-5 w-5" strokeWidth={1.7} />}
          title="No analytics yet"
          description="Complete your first interview and we'll start tracking score trends, skill balance and the gaps worth your time."
          action={
            <Link to="/interview" className="btn-primary btn-sm gap-1.5">
              Start an interview
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric
              label="Interviews"
              value={analytics?.interviews_completed ?? 0}
              hint="Completed sessions"
              icon={Target}
            />
            <Metric
              label="Average score"
              value={avgScore ? `${avgScore}%` : "—"}
              hint="Across scored sessions"
              spark={trendData.length > 1 ? trendData.map((point) => point.score) : undefined}
              icon={TrendingUp}
            />
            <Metric
              label="Strongest"
              value={strongest?.area || "—"}
              hint={strongest ? `${strongest.score}/100` : "No data"}
              icon={Award}
            />
            <Metric
              label="Focus area"
              value={weakest?.area || "—"}
              hint={weakest ? `${weakest.score}/100` : "No data"}
              icon={AlertTriangle}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="card-base overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
                <div>
                  <h2 className="text-headline text-foreground">Score trend</h2>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/60">
                    Chronological, last {trendData.length}{" "}
                    {trendData.length === 1 ? "session" : "sessions"}
                  </p>
                </div>
                {trendData.length > 1 && (
                  <span className="tag-muted tabular">
                    {trendData[trendData.length - 1].score >= trendData[0].score ? "+" : ""}
                    {trendData[trendData.length - 1].score - trendData[0].score} pts
                  </span>
                )}
              </div>
              <div className="p-4 pl-2">
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={268}>
                    <AreaChart data={trendData} margin={{ top: 10, right: 14, bottom: 0, left: -18 }}>
                      <defs>
                        <linearGradient id="score-fill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.22} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        stroke="hsl(var(--border))"
                        strokeOpacity={0.7}
                        strokeDasharray="3 4"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        stroke="hsl(var(--muted-foreground))"
                        tickLine={false}
                        axisLine={false}
                        fontSize={10.5}
                        tick={{ fill: "hsl(var(--muted-foreground))" }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        ticks={[0, 25, 50, 75, 100]}
                        stroke="hsl(var(--muted-foreground))"
                        tickLine={false}
                        axisLine={false}
                        fontSize={10.5}
                        tick={{ fill: "hsl(var(--muted-foreground))" }}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={{ color: "hsl(var(--muted-foreground))", fontSize: 10.5 }}
                        formatter={(value: number) => [`${value}%`, "Score"]}
                        cursor={{ stroke: "hsl(var(--border-strong))", strokeDasharray: "3 3" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke="hsl(var(--primary))"
                        strokeWidth={1.8}
                        fill="url(#score-fill)"
                        dot={{ fill: "hsl(var(--primary))", r: 2.6, strokeWidth: 0 }}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[268px] items-center justify-center">
                    <p className="text-[12px] text-muted-foreground/50">
                      Complete another session to plot a trend.
                    </p>
                  </div>
                )}
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
              className="card-base flex flex-col overflow-hidden"
            >
              <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <h2 className="text-headline text-foreground">Signals</h2>
              </div>
              <ul className="flex-1 divide-y divide-border/60">
                {insights.map((insight, index) => (
                  <li key={index} className="flex gap-3 px-5 py-3.5">
                    <span className="mt-px font-mono text-[9.5px] text-primary/50">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <p className="text-[12px] leading-5 text-secondary-foreground">{insight}</p>
                  </li>
                ))}
              </ul>
              <div className="border-t border-border/60 p-3">
                <Link to="/roadmap" className="btn-secondary btn-sm w-full gap-1.5">
                  Turn signals into a plan
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <SkillRadarChart analytics={analytics} />
            </motion.div>

            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
              className="card-base overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
                <div>
                  <h2 className="text-headline text-foreground">Skill breakdown</h2>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/60">
                    Weakest to strongest
                  </p>
                </div>
                <span className="text-[11px] text-muted-foreground/45">0–100</span>
              </div>
              {weaknessData.length > 0 ? (
                <div className="space-y-3 p-5">
                  {weaknessData.map((skill, index) => (
                    <div key={skill.area}>
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-[12px] text-secondary-foreground">
                          <span className="font-mono text-[9px] text-muted-foreground/30">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          {skill.area}
                        </span>
                        <span className="tabular text-[11.5px] font-medium text-foreground">
                          {skill.score}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                        <div
                          className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out-expo"
                          style={{
                            width: `${(skill.score / maxSkill) * 100}%`,
                            opacity: 1 - index * 0.12,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  <p className="pt-2 text-[10.5px] leading-4 text-muted-foreground/45">
                    Scores decay toward your baseline when a dimension is rarely exercised.
                  </p>
                </div>
              ) : (
                <div className="flex h-[240px] items-center justify-center">
                  <p className="text-[12px] text-muted-foreground/50">No skill scores yet.</p>
                </div>
              )}
            </motion.section>
          </div>
        </>
      )}
    </div>
  );
}
