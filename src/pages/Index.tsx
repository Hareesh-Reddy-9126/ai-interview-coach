import { useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Award, Flame, Target, TrendingUp, ArrowRight, Mic, FileText, Map, Code2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import StatCard from "@/components/StatCard";
import SkillRadarChart from "@/components/SkillRadarChart";
import { type UserAnalytics } from "@/lib/utils";
import { StaggerContainer, StaggerItem } from "@/components/layout/page-layout";

interface RecentInterview {
  id: string;
  role: string;
  company: string;
  overall_score: number | null;
  created_at: string;
  status: string;
}

function StatSkeleton() {
  return (
    <div className="card-base p-5">
      <div className="skeleton h-3 w-16 mb-4" />
      <div className="skeleton h-7 w-14" />
    </div>
  );
}

function InterviewSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3">
      <div className="skeleton h-9 w-9 rounded-lg" />
      <div className="flex-1">
        <div className="skeleton h-3.5 w-28 mb-2" />
        <div className="skeleton h-2.5 w-16" />
      </div>
      <div className="skeleton h-5 w-10" />
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
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
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
          <div>
            <h1 className="text-display-lg font-bold text-foreground tracking-tight">
              Welcome back, <span className="gradient-primary">{firstName}</span>
            </h1>
            <p className="text-body text-muted-foreground mt-1.5">Here's your interview preparation overview</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="tag-primary animate-float">Premium</span>
            <span className="tag-accent hidden sm:inline-flex">AI-Powered</span>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <StaggerContainer delay={0.08} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <StaggerItem key={i} delay={i * 50}><StatSkeleton /></StaggerItem>
          ))
        ) : (
          <>
            <StaggerItem delay={0}>
              <StatCard icon={Target} label="Interviews" value={interviewsCompleted} color="primary" />
            </StaggerItem>
            <StaggerItem delay={1}>
              <StatCard icon={TrendingUp} label="Avg Score" value={avgScore ? `${avgScore}%` : "—"} color="info" />
            </StaggerItem>
            <StaggerItem delay={2}>
              <StatCard icon={Award} label="Focus Area" value={weakestSkill?.name || "N/A"} subtitle={weakestSkill ? `${weakestSkill.score}/100` : undefined} color="warning" />
            </StaggerItem>
            <StaggerItem delay={3}>
              <StatCard icon={Flame} label="Streak" value={`${analytics?.current_streak || 0}d`} color="accent" />
            </StaggerItem>
          </>
        )}
      </StaggerContainer>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-display-sm font-semibold text-foreground">Quick Actions</h2>
          <Link to="/practice" className="btn-ghost text-xs">
            View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Link>
        </div>
        <StaggerContainer delay={0.06} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { to: "/interview", icon: Mic, label: "Mock Interview", desc: "AI-powered practice", gradient: "from-primary/15 to-primary/5", iconColor: "text-primary" },
            { to: "/coding", icon: Code2, label: "Coding Lab", desc: "Algorithms & systems", gradient: "from-accent/15 to-accent/5", iconColor: "text-accent" },
            { to: "/resume", icon: FileText, label: "Resume Analysis", desc: "AI feedback & questions", gradient: "from-info/15 to-info/5", iconColor: "text-info" },
            { to: "/roadmap", icon: Map, label: "Learning Plan", desc: "Personalized 4-week plan", gradient: "from-warning/15 to-warning/5", iconColor: "text-warning" },
          ].map((action, i) => (
            <StaggerItem key={action.to} delay={i}>
              <motion.div whileHover={{ y: -2, scale: 1.01 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}>
                <Link to={action.to} className="card-interactive p-5 flex flex-col gap-4 group block">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${action.gradient} w-fit`}>
                    <action.icon className={`h-5 w-5 ${action.iconColor}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{action.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{action.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </Link>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </motion.div>

      {/* Charts + Recent */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-5"
      >
        <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.3 }}>
          {loading ? (
            <div className="card-base p-6 h-[380px]">
              <div className="skeleton h-4 w-20 mb-5" />
              <div className="skeleton h-[280px] w-full rounded-lg" />
            </div>
          ) : (
            <SkillRadarChart analytics={analytics} />
          )}
        </motion.div>

        <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.3 }}>
          <div className="card-base p-6 h-[380px] flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-display-sm font-semibold text-foreground">Recent Interviews</h3>
              <Link to="/history" className="btn-ghost text-xs">
                View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <InterviewSkeleton key={i} />)
              ) : recentInterviews.length === 0 ? (
                <div className="text-center py-12 space-y-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                    className="h-16 w-16 rounded-2xl bg-secondary/50 flex items-center justify-center mx-auto"
                  >
                    <Mic className="h-7 w-7 text-muted-foreground/50" />
                  </motion.div>
                  <div>
                    <p className="text-body text-muted-foreground">No interviews yet</p>
                    <p className="text-caption text-muted-foreground/70 mt-1">Start your first session to see progress</p>
                  </div>
                  <Link to="/interview" className="btn-primary inline-flex items-center gap-2 shrink-0 text-sm font-semibold mt-2">
                    Start Interview <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ) : (
                recentInterviews.map((interview, i) => (
                  <motion.div
                    key={interview.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.3 }}
                    className="group flex items-center justify-between p-3.5 rounded-xl hover:bg-secondary/40 transition-colors"
                    whileHover={{ x: 4 }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-xl bg-secondary/50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <Mic className="h-4.5 w-4.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{interview.role}</p>
                        <p className="text-[11px] text-muted-foreground/70">{interview.company} · {new Date(interview.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                      </div>
                    </div>
                    {interview.overall_score ? (
                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        <span className={cn(
                          "text-sm font-bold tabular-nums shrink-0",
                          interview.overall_score >= 80 ? "text-primary" :
                          interview.overall_score >= 65 ? "text-warning" : "text-destructive"
                        )}>
                          {interview.overall_score}%
                        </span>
                        <motion.div
                          layoutId={`score-bar-${interview.id}`}
                          className="h-2 w-16 bg-secondary/50 rounded-full overflow-hidden"
                        >
                          <motion.div
                            animate={{ width: `${interview.overall_score}%` }}
                            transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                            className="h-full rounded-full"
                            style={{ background: interview.overall_score >= 80 ? 'hsl(var(--primary))' :
                              interview.overall_score >= 65 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))' }}
                          />
                        </motion.div>
                      </div>
                    ) : (
                      <span className="tag-warning text-xs shrink-0 ml-4">{interview.status}</span>
                    )}
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        whileHover={{ scale: 1.005 }}
        className="card-glow p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-5"
      >
        <div className="flex items-center gap-4 flex-1">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="p-4 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/20"
          >
            <Sparkles className="h-7 w-7 text-primary" />
          </motion.div>
          <div>
            <h3 className="text-display-sm font-bold text-foreground">Ready for your next practice?</h3>
            <p className="text-body text-muted-foreground mt-1">Start an AI-powered mock interview and sharpen your skills</p>
          </div>
        </div>
        <Link to="/interview" className="btn-primary px-7 py-3 inline-flex items-center gap-2 shrink-0 text-sm font-semibold group">
          Start Interview
          <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </motion.div>
    </div>
  );
}