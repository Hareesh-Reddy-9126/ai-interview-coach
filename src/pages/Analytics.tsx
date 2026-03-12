import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { Target, TrendingUp, Award, RefreshCw, AlertTriangle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SkillRadarChart from "@/components/SkillRadarChart";
import StatCard from "@/components/StatCard";

interface SessionTrend { label: string; score: number; }
interface SkillData { area: string; score: number; }

const SKILL_LABELS: Record<string, string> = {
  communication_score: "Communication", technical_score: "Technical", system_design_score: "System Design",
  problem_solving_score: "Problem Solving", confidence_score: "Confidence",
};
const BAR_COLORS = ["hsl(0 68% 55%)", "hsl(32 95% 60%)", "hsl(45 90% 55%)", "hsl(142 60% 50%)", "hsl(142 72% 50%)"];

export default function Analytics() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<any>(null);
  const [trendData, setTrendData] = useState<SessionTrend[]>([]);
  const [weaknessData, setWeaknessData] = useState<SkillData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      const [analyticsRes, sessionsRes] = await Promise.all([
        supabase.from("user_analytics").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("interview_sessions").select("overall_score, created_at").eq("user_id", user.id).eq("status", "completed").not("overall_score", "is", null).order("created_at", { ascending: true }).limit(20),
      ]);
      if (analyticsRes.error) throw analyticsRes.error;
      if (sessionsRes.error) throw sessionsRes.error;
      setAnalytics(analyticsRes.data);
      if (analyticsRes.data) {
        const skills: SkillData[] = Object.entries(SKILL_LABELS).map(([key, label]) => ({ area: label, score: Number(analyticsRes.data[key]) || 0 }));
        skills.sort((a, b) => a.score - b.score);
        setWeaknessData(skills);
      }
      if (sessionsRes.data?.length) setTrendData(sessionsRes.data.map((s, i) => ({ label: `#${i + 1}`, score: s.overall_score! })));
    } catch { setError("Failed to load analytics."); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [user]);

  const { avgScore, weakest, strongest, insights } = useMemo(() => {
    const avg = trendData.length > 0 ? Math.round(trendData.reduce((a, t) => a + t.score, 0) / trendData.length) : 0;
    const w = weaknessData[0] || null;
    const s = weaknessData[weaknessData.length - 1] || null;
    const ins: string[] = [];
    if (w && w.score < 60) ins.push(`Focus on ${w.area} — it's your weakest at ${w.score}/100.`);
    if (s && s.score > 70) ins.push(`${s.area} is your strongest skill at ${s.score}/100.`);
    if (trendData.length >= 3) {
      const t = trendData[trendData.length - 1].score - trendData[trendData.length - 3].score;
      if (t > 0) ins.push(`Score improved by ${t}% over last 3 interviews.`);
      else if (t < 0) ins.push(`Score dropped by ${Math.abs(t)}% recently.`);
    }
    return { avgScore: avg, weakest: w, strongest: s, insights: ins };
  }, [trendData, weaknessData]);

  if (error) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="card-base p-8 text-center space-y-4 max-w-sm">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
        <p className="text-sm text-foreground font-medium">{error}</p>
        <button onClick={fetchData} className="btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2 font-semibold"><RefreshCw className="h-4 w-4" /> Retry</button>
      </div>
    </div>
  );

  const hasData = analytics?.interviews_completed > 0;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-2">{hasData ? `${analytics.interviews_completed} interview${analytics.interviews_completed > 1 ? "s" : ""} completed` : "Complete interviews to see analytics"}</p>
        </div>
        {!loading && <button onClick={fetchData} className="p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"><RefreshCw className="h-4 w-4" /></button>}
      </div>

      {loading ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="card-base p-5"><div className="skeleton h-3 w-14 mb-4" /><div className="skeleton h-6 w-12" /></div>)}</div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="card-base p-6"><div className="skeleton h-4 w-24 mb-5" /><div className="skeleton h-[280px] rounded-lg" /></div>)}</div>
        </>
      ) : !hasData ? (
        <div className="card-base p-14 text-center space-y-4">
          <h3 className="text-xl font-bold text-foreground">No analytics yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">Complete your first interview to start tracking your performance.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Target} label="Interviews" value={analytics.interviews_completed} color="primary" />
            <StatCard icon={TrendingUp} label="Avg Score" value={`${avgScore}%`} color="info" />
            <StatCard icon={Award} label="Weakest" value={weakest?.area || "N/A"} subtitle={weakest ? `${weakest.score}/100` : undefined} color="warning" />
            <StatCard icon={Award} label="Strongest" value={strongest?.area || "N/A"} subtitle={strongest ? `${strongest.score}/100` : undefined} color="primary" />
          </div>

          {insights.length > 0 && (
            <div className="space-y-2">
              {insights.map((insight, i) => (
                <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.1 }}
                  className="card-glow p-4 flex items-start gap-3">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">{insight}</p>
                </motion.div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <SkillRadarChart analytics={analytics} />
            <div className="card-base p-6">
              <h3 className="text-sm font-bold text-foreground mb-0.5">Score Trend</h3>
              <p className="text-xs text-muted-foreground mb-5">Performance across sessions</p>
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={trendData}>
                    <CartesianGrid stroke="hsl(225 12% 16%)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" stroke="hsl(215 10% 44%)" fontSize={11} />
                    <YAxis domain={[0, 100]} stroke="hsl(215 10% 44%)" fontSize={11} />
                    <Tooltip contentStyle={{ background: "hsl(225 14% 10%)", border: "1px solid hsl(225 12% 16%)", borderRadius: 12, color: "hsl(210 20% 95%)", fontSize: 12 }} formatter={(v: number) => [`${v}%`, "Score"]} />
                    <Line type="monotone" dataKey="score" stroke="hsl(142 72% 50%)" strokeWidth={2} dot={{ fill: "hsl(142 72% 50%)", r: 3, strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-muted-foreground text-center py-16">More data needed</p>}
            </div>
            <div className="card-base p-6 lg:col-span-2">
              <h3 className="text-sm font-bold text-foreground mb-0.5">Skill Breakdown</h3>
              <p className="text-xs text-muted-foreground mb-5">Weakest to strongest</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={weaknessData} layout="vertical">
                  <CartesianGrid stroke="hsl(225 12% 16%)" strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} stroke="hsl(215 10% 44%)" fontSize={11} />
                  <YAxis dataKey="area" type="category" stroke="hsl(215 10% 44%)" fontSize={11} width={110} />
                  <Tooltip contentStyle={{ background: "hsl(225 14% 10%)", border: "1px solid hsl(225 12% 16%)", borderRadius: 12, color: "hsl(210 20% 95%)", fontSize: 12 }} formatter={(v: number) => [`${v}/100`, "Score"]} />
                  <Bar dataKey="score" radius={[0, 6, 6, 0]}>{weaknessData.map((_, idx) => <Cell key={idx} fill={BAR_COLORS[idx] || BAR_COLORS[4]} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
