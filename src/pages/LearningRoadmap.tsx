import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Circle, BookOpen, RefreshCw, Loader2, Sparkles, Target, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface WeekData { week: number; title: string; focus_skill: string; description: string; tasks: string[]; resources: string[]; }
interface RoadmapData { weeks: WeekData[]; summary: string; priority_skill: string; }

export default function LearningRoadmap() {
  const { user } = useAuth();
  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchRoadmap = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error: err } = await supabase.from("learning_roadmaps").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (err) throw err;
      if (data) { setRoadmap(data.roadmap_json as unknown as RoadmapData); setCreatedAt(data.created_at); }
    } catch (e: any) { console.error("Failed:", e); } finally { setLoading(false); }
  }, [user]);

  useEffect(() => { fetchRoadmap(); }, [fetchRoadmap]);

  const generateRoadmap = async () => {
    setGenerating(true); setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-roadmap");
      if (error) throw error; if (data?.error) throw new Error(data.error);
      setRoadmap(data as RoadmapData); setCreatedAt(new Date().toISOString()); toast.success("Roadmap generated!");
    } catch (e: any) { const msg = e.message || "Failed."; setError(msg); toast.error(msg); } finally { setGenerating(false); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Learning Roadmap</h1>
          <p className="text-sm text-muted-foreground mt-2">{roadmap ? "Your personalized improvement plan" : "Generate a plan based on your performance"}</p>
        </div>
        <button onClick={generateRoadmap} disabled={generating} className="btn-primary px-5 py-2.5 inline-flex items-center gap-2 disabled:opacity-50 shrink-0 font-semibold">
          {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : roadmap ? <><RefreshCw className="h-4 w-4" /> Regenerate</> : <><Sparkles className="h-4 w-4" /> Generate</>}
        </button>
      </div>

      {error && !generating && (
        <div className="card-base p-4 border-destructive/20 flex items-center gap-4">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" /><p className="text-sm text-destructive flex-1">{error}</p>
          <button onClick={generateRoadmap} className="text-sm text-destructive font-semibold hover:underline">Retry</button>
        </div>
      )}

      {generating && (
        <div className="card-base p-10 text-center">
          <Loader2 className="h-8 w-8 text-primary mx-auto mb-4 animate-spin" />
          <p className="text-base font-semibold text-foreground">Generating personalized roadmap...</p>
          <p className="text-sm text-muted-foreground mt-1">This may take up to 30 seconds</p>
        </div>
      )}

      {!roadmap && !generating && !error && (
        <div className="card-base p-14 text-center space-y-4">
          <div className="h-14 w-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto">
            <Target className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <h3 className="text-xl font-bold text-foreground">No roadmap yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">Click "Generate" to create a personalized 4-week improvement plan based on your analytics.</p>
        </div>
      )}

      {roadmap && !generating && (
        <>
          <div className="card-glow p-5 flex items-start gap-4">
            <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-foreground leading-relaxed">{roadmap.summary}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Priority: <span className="text-primary font-bold">{roadmap.priority_skill}</span>
                {createdAt && <> · {new Date(createdAt).toLocaleDateString()}</>}
              </p>
            </div>
          </div>

          <div className="relative">
            <div className="absolute left-[22px] top-0 bottom-0 w-px bg-border" />
            <div className="space-y-5">
              {roadmap.weeks.map((week, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="relative pl-14">
                  <div className="absolute left-3 top-5">
                    <div className="h-5 w-5 rounded-full bg-primary/15 ring-2 ring-primary/20 flex items-center justify-center">
                      <span className="text-[9px] font-bold text-primary">{week.week}</span>
                    </div>
                  </div>
                  <div className="card-base p-5 space-y-4">
                    <div className="flex items-center gap-2.5">
                      <span className="tag-primary text-[10px] font-bold">Week {week.week}</span>
                      <span className="text-xs text-muted-foreground font-medium">{week.focus_skill}</span>
                    </div>
                    <h3 className="text-sm font-bold text-foreground">{week.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{week.description}</p>
                    <div>
                      <p className="text-[11px] font-bold text-foreground mb-2 uppercase tracking-[0.1em]">Tasks</p>
                      <ul className="space-y-1.5">{week.tasks.map((task, j) => <li key={j} className="flex items-start gap-2.5 text-sm text-muted-foreground"><Circle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/30" />{task}</li>)}</ul>
                    </div>
                    {week.resources?.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold text-foreground mb-2 uppercase tracking-[0.1em]">Resources</p>
                        <ul className="space-y-1.5">{week.resources.map((res, j) => <li key={j} className="flex items-start gap-2.5 text-sm text-muted-foreground"><BookOpen className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/50" />{res}</li>)}</ul>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="card-base p-5 text-center">
            <p className="text-sm text-muted-foreground mb-3">Complete more interviews for updated recommendations</p>
            <button onClick={generateRoadmap} disabled={generating} className="btn-secondary px-5 py-2.5 text-sm inline-flex items-center gap-2 font-semibold"><RefreshCw className="h-4 w-4" /> Regenerate</button>
          </div>
        </>
      )}
    </div>
  );
}
