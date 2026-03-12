import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Building2, Mic, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";

interface Session { id: string; role: string; company: string; difficulty: string; overall_score: number | null; status: string; created_at: string; }

export default function InterviewHistory() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("interview_sessions").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => { setSessions(data || []); setLoading(false); });
  }, [user]);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Interview History</h1>
        <p className="text-sm text-muted-foreground mt-2">Review past sessions and track your progress</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card-base p-5 flex items-center gap-4">
              <div className="skeleton h-10 w-10 rounded-xl" />
              <div className="flex-1"><div className="skeleton h-4 w-32 mb-2" /><div className="skeleton h-3 w-20" /></div>
              <div className="skeleton h-6 w-12" />
            </div>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="card-base p-14 text-center space-y-4">
          <div className="h-14 w-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto">
            <Sparkles className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-bold text-foreground">No interviews yet</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">Start practicing to build your interview history and track improvement.</p>
          <Link to="/interview" className="btn-primary px-6 py-3 text-sm inline-flex items-center gap-2 font-semibold"><Mic className="h-4 w-4" /> Start Interview</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((item, i) => (
            <motion.div key={item.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="card-interactive p-5 flex items-center justify-between group">
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{item.role}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
                    <span>{item.company}</span>
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                    <span className={item.difficulty === "Hard" ? "text-destructive" : item.difficulty === "Medium" ? "text-warning" : "text-primary"}>{item.difficulty}</span>
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                    <span className={`${item.status === "completed" ? "tag-primary" : "tag-warning"} text-[10px]`}>{item.status}</span>
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(item.created_at).toLocaleDateString()}</span>
                  </p>
                </div>
              </div>
              {item.overall_score != null && (
                <span className={`text-xl font-bold tabular-nums shrink-0 ml-4 ${item.overall_score >= 80 ? "text-primary" : item.overall_score >= 60 ? "text-warning" : "text-destructive"}`}>
                  {item.overall_score}%
                </span>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
