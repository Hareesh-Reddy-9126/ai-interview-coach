import { useEffect, useState, useMemo } from "react";
import { Award, Flame, Target, TrendingUp, ArrowRight, Mic, FileText, Map, Code2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import StatCard from "@/components/StatCard";
import SkillRadarChart from "@/components/SkillRadarChart";

interface RecentInterview {
  id: string;
  role: string;
  company: string;
  overall_score: number | null;
  created_at: string;
  status: string;
}

function StatSkeleton() {
  return <div className="card-base p-5"><div className="skeleton h-3 w-16 mb-4" /><div className="skeleton h-7 w-14" /></div>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<any>(null);
  const [recentInterviews, setRecentInterviews] = useState<RecentInterview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("user_analytics").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("interview_sessions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
    ]).then(([analyticsRes, interviewsRes]) => {
      setAnalytics(analyticsRes.data);
      setRecentInterviews(interviewsRes.data || []);
      setLoading(false);
    });
  }, [user]);

  const { interviewsCompleted, avgScore, weakestSkill } = useMemo(() => {
    const completed = analytics?.interviews_completed || 0;
    const scored = recentInterviews.filter(i => i.overall_score);
    const avg = scored.length > 0
      ? Math.round(scored.reduce((a, i) => a + (i.overall_score || 0), 0) / scored.length)
      : 0;
    const skills = [
      { name: "Communication", score: Number(analytics?.communication_score) || 0 },
      { name: "Technical", score: Number(analytics?.technical_score) || 0 },
      { name: "System Design", score: Number(analytics?.system_design_score) || 0 },
      { name: "Problem Solving", score: Number(analytics?.problem_solving_score) || 0 },
      { name: "Confidence", score: Number(analytics?.confidence_score) || 0 },
    ];
    const weakest = completed > 0 ? skills.sort((a, b) => a.score - b.score)[0] : null;
    return { interviewsCompleted: completed, avgScore: avg, weakestSkill: weakest };
  }, [analytics, recentInterviews]);

  const firstName = user?.user_metadata?.name?.split(' ')[0] || 'there';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <motion.h1 initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-bold text-foreground tracking-tight">
          Welcome back, <span className="gradient-text">{firstName}</span>
        </motion.h1>
        <p className="text-sm text-muted-foreground mt-2">Here's your interview preparation overview</p>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Target} label="Interviews" value={interviewsCompleted} color="primary" />
          <StatCard icon={TrendingUp} label="Avg Score" value={avgScore ? `${avgScore}%` : "—"} color="info" />
          <StatCard icon={Award} label="Weakest" value={weakestSkill?.name || "N/A"} subtitle={weakestSkill ? `${weakestSkill.score}/100` : undefined} color="warning" />
          <StatCard icon={Flame} label="Streak" value={`${analytics?.current_streak || 0}d`} color="accent" />
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.12em] mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { to: "/interview", icon: Mic, label: "Mock Interview", desc: "AI-powered practice", gradient: "from-primary/15 to-primary/5" },
            { to: "/coding", icon: Code2, label: "Coding Lab", desc: "Solve problems", gradient: "from-accent/15 to-accent/5" },
            { to: "/resume", icon: FileText, label: "Resume Analysis", desc: "Smart prep", gradient: "from-info/15 to-info/5" },
            { to: "/roadmap", icon: Map, label: "Learning Plan", desc: "Your study path", gradient: "from-warning/15 to-warning/5" },
          ].map((action, i) => (
            <motion.div key={action.to} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <Link to={action.to} className="card-interactive p-5 flex flex-col gap-4 group block">
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${action.gradient} w-fit`}>
                  <action.icon className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{action.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{action.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Charts + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {loading ? (
          <div className="card-base p-6"><div className="skeleton h-4 w-20 mb-5" /><div className="skeleton h-[280px] w-full rounded-lg" /></div>
        ) : (
          <SkillRadarChart analytics={analytics} />
        )}

        <div className="card-base p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-foreground">Recent Interviews</h3>
            <Link to="/history" className="text-xs text-primary hover:underline font-medium">View all →</Link>
          </div>
          <div className="space-y-1">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <div className="skeleton h-9 w-9 rounded-lg" />
                  <div className="flex-1"><div className="skeleton h-3.5 w-28 mb-2" /><div className="skeleton h-2.5 w-16" /></div>
                  <div className="skeleton h-5 w-10" />
                </div>
              ))
            ) : recentInterviews.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center mx-auto">
                  <Mic className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No interviews yet</p>
                <Link to="/interview" className="text-xs text-primary hover:underline font-medium">Start your first →</Link>
              </div>
            ) : (
              recentInterviews.map((interview, i) => (
                <motion.div key={interview.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-colors group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <Mic className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{interview.role}</p>
                      <p className="text-[11px] text-muted-foreground">{interview.company} · {new Date(interview.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  {interview.overall_score ? (
                    <span className={`text-sm font-bold tabular-nums shrink-0 ml-3 ${
                      interview.overall_score >= 80 ? "text-primary" : interview.overall_score >= 60 ? "text-warning" : "text-destructive"
                    }`}>{interview.overall_score}%</span>
                  ) : (
                    <span className="tag-warning text-[10px] shrink-0 ml-3">{interview.status}</span>
                  )}
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* CTA */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="card-glow p-8 flex flex-col sm:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/15 ring-1 ring-primary/20">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Ready for your next practice?</h3>
            <p className="text-sm text-muted-foreground">Start an AI-powered mock interview now</p>
          </div>
        </div>
        <Link to="/interview" className="btn-primary px-6 py-3 inline-flex items-center gap-2 shrink-0 text-sm font-semibold">
          Start Interview <ArrowRight className="h-4 w-4" />
        </Link>
      </motion.div>
    </div>
  );
}
