import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BookOpen,
  CheckSquare,
  Loader2,
  Map,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/edge-functions";
import { getErrorMessage } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface WeekData {
  week: number;
  title: string;
  focus_skill: string;
  description: string;
  tasks: string[];
  resources: string[];
}
interface RoadmapData {
  weeks: WeekData[];
  summary: string;
  priority_skill: string;
}

function GeneratingState() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="card-base flex items-center gap-4 p-4">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <div>
          <p className="text-[12.5px] font-medium text-foreground">Building your four-week plan</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground/60">
            Reading your analytics, choosing a priority skill, then sequencing the work.
          </p>
        </div>
      </div>
      {[1, 2, 3, 4].map((week) => (
        <div key={week} className="card-base p-5">
          <div className="flex items-center gap-3">
            <div className="skeleton h-5 w-14 rounded" />
            <div className="skeleton h-3 w-24" />
          </div>
          <div className="skeleton mt-4 h-3.5 w-2/3" />
          <div className="mt-3 space-y-2">
            <div className="skeleton h-2.5 w-full" />
            <div className="skeleton h-2.5 w-5/6" />
            <div className="skeleton h-2.5 w-4/6" />
          </div>
        </div>
      ))}
    </div>
  );
}

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
      const { data, error: err } = await supabase
        .from("learning_roadmaps")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (err) throw err;
      if (data) {
        setRoadmap(data.roadmap_json as unknown as RoadmapData);
        setCreatedAt(data.created_at);
      }
    } catch (e) {
      console.error("Failed to load roadmap:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRoadmap();
  }, [fetchRoadmap]);

  const generateRoadmap = async () => {
    setGenerating(true);
    setError(null);
    try {
      const data = await invokeFunction<RoadmapData>("generate-roadmap", {
        fallbackMessage: "Roadmap generation failed.",
      });
      setRoadmap(data);
      setCreatedAt(new Date().toISOString());
      toast.success("Roadmap generated.");
    } catch (e) {
      const msg = getErrorMessage(e, "Roadmap generation failed.");
      setError(msg);
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  const generateButton = (label: string, variant: "primary" | "secondary") => (
    <button
      type="button"
      onClick={generateRoadmap}
      disabled={generating}
      className={`btn-${variant} btn-sm gap-1.5`}
    >
      {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
      {generating ? "Generating…" : label}
    </button>
  );

  return (
    <div className="mx-auto max-w-[1040px]">
      <div className="mb-6 flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-primary" aria-hidden="true" />
            <span className="section-label">Learning plan</span>
          </div>
          <h1 className="text-display-lg text-foreground">Your four-week plan.</h1>
          <p className="mt-2.5 max-w-xl text-[13.5px] leading-6 text-muted-foreground">
            {roadmap
              ? "Sequenced around your weakest dimension, with tasks and reading you can finish in a week."
              : "Generate a plan sequenced around your weakest dimension — not a generic syllabus."}
          </p>
        </div>
        {roadmap && !generating && (
          <div className="flex shrink-0 items-center gap-2">
            {generateButton("Regenerate", "secondary")}
          </div>
        )}
      </div>

      {error && !generating && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/25 bg-destructive/[0.06] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="flex-1 text-[12.5px] leading-5 text-destructive">{error}</p>
          <button
            type="button"
            onClick={generateRoadmap}
            className="shrink-0 text-[12px] font-medium text-destructive underline underline-offset-4 hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {generating && <GeneratingState />}

      {!roadmap && !generating && !error && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <section className="card-base flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="relative mb-5">
              <div className="absolute inset-0 rounded-xl bg-primary/15 blur-xl" aria-hidden="true" />
              <div className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface-2 text-muted-foreground shadow-inset-top">
                <Map className="h-4 w-4" strokeWidth={1.8} />
              </div>
            </div>
            <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-foreground">
              No roadmap yet
            </h2>
            <p className="mt-1.5 max-w-sm text-[12px] leading-5 text-muted-foreground">
              We use your interview analytics to pick one priority skill, then lay out four weeks
              of focused practice around it.
            </p>
            <button
              type="button"
              onClick={generateRoadmap}
              className="btn-primary btn-sm mt-5 gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Generate my roadmap
            </button>
            <p className="mt-4 text-[10.5px] text-muted-foreground/40">
              Takes about 20–30 seconds · replaces any previous plan
            </p>
          </section>

          <aside className="card-base overflow-hidden">
            <div className="border-b border-border/60 px-4 py-3">
              <h2 className="text-headline text-foreground">How it's built</h2>
            </div>
            <ol className="divide-y divide-border/60">
              {[
                {
                  title: "Read the analytics",
                  description: "Five scored dimensions, weighted by recency and volume.",
                },
                {
                  title: "Choose one priority",
                  description: "The lowest-leverage gap becomes the theme for four weeks.",
                },
                {
                  title: "Sequence the work",
                  description: "Each week pairs a concept with concrete practice and resources.",
                },
              ].map((step, index) => (
                <li key={step.title} className="flex gap-3 px-4 py-3.5">
                  <span className="mt-0.5 font-mono text-[9.5px] text-primary/60">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="text-[12px] font-medium text-foreground">{step.title}</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground/65">
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="flex items-start gap-2 border-t border-border/60 bg-surface-2/35 px-4 py-3">
              <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/60" />
              <p className="text-[10.5px] leading-4 text-muted-foreground/60">
                Regenerating replaces the previous plan for your account.
              </p>
            </div>
          </aside>
        </div>
      )}

      {roadmap && !generating && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_248px]">
          <div className="min-w-0 space-y-4">
            <div className="card-base p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/55">
                    Strategy
                  </p>
                </div>
                <span className="tag-primary">{roadmap.priority_skill}</span>
              </div>
              <p className="mt-3 text-[13px] leading-6 text-secondary-foreground">{roadmap.summary}</p>
              <p className="mt-3 text-[10.5px] text-muted-foreground/45">
                {roadmap.weeks.length} weeks
                {createdAt &&
                  ` · Generated ${new Date(createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}`}
              </p>
            </div>

            <ol className="relative space-y-3 before:absolute before:bottom-6 before:left-[15px] before:top-6 before:w-px before:bg-border/70">
              {roadmap.weeks.map((week, index) => (
                <motion.li
                  key={week.week}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="relative pl-10"
                >
                  <span className="absolute left-0 top-4 flex h-[31px] w-[31px] items-center justify-center rounded-full border border-border bg-card font-mono text-[9.5px] font-medium text-muted-foreground">
                    {String(week.week).padStart(2, "0")}
                  </span>
                  <article className="card-base overflow-hidden">
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 px-5 py-3.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/50">
                            Week {week.week}
                          </span>
                          <span className="h-[3px] w-[3px] rounded-full bg-border-strong" />
                          <span className="text-[10.5px] text-primary">{week.focus_skill}</span>
                        </div>
                        <h2 className="mt-1 font-display text-[15px] font-semibold tracking-[-0.02em] text-foreground">
                          {week.title}
                        </h2>
                      </div>
                    </div>
                    <div className="space-y-4 p-5">
                      <p className="text-[12.5px] leading-5 text-muted-foreground">{week.description}</p>
                      <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                          <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/45">
                            Tasks
                          </p>
                          <ul className="space-y-2">
                            {week.tasks.map((task, taskIndex) => (
                              <li key={taskIndex} className="flex items-start gap-2">
                                <CheckSquare
                                  className="mt-0.5 h-3 w-3 shrink-0 text-primary/45"
                                  strokeWidth={1.8}
                                />
                                <span className="text-[11.5px] leading-4 text-secondary-foreground">
                                  {task}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        {week.resources?.length > 0 && (
                          <div>
                            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/45">
                              Resources
                            </p>
                            <ul className="space-y-2">
                              {week.resources.map((resource, resourceIndex) => (
                                <li key={resourceIndex} className="flex items-start gap-2">
                                  <BookOpen
                                    className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/35"
                                    strokeWidth={1.8}
                                  />
                                  <span className="text-[11.5px] leading-4 text-muted-foreground">
                                    {resource}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                </motion.li>
              ))}
            </ol>

            <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-surface-2/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-muted-foreground/60">
                Plans refresh from your latest analytics when regenerated.
              </p>
              {generateButton("Regenerate plan", "secondary")}
            </div>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-[78px] space-y-3">
              <div className="card-base p-4">
                <p className="section-label">Plan at a glance</p>
                <p className="mt-3 font-display text-[19px] font-semibold leading-tight tracking-[-0.025em] text-foreground">
                  {roadmap.priority_skill}
                </p>
                <p className="mt-1 text-[10.5px] text-muted-foreground/50">Priority skill</p>
                <div className="mt-4 space-y-2 border-t border-border/60 pt-3">
                  <div className="flex items-center justify-between text-[10.5px]">
                    <span className="text-muted-foreground/50">Duration</span>
                    <span className="text-secondary-foreground">{roadmap.weeks.length} weeks</span>
                  </div>
                  <div className="flex items-center justify-between text-[10.5px]">
                    <span className="text-muted-foreground/50">Tasks</span>
                    <span className="text-secondary-foreground">
                      {roadmap.weeks.reduce((sum, week) => sum + week.tasks.length, 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10.5px]">
                    <span className="text-muted-foreground/50">Resources</span>
                    <span className="text-secondary-foreground">
                      {roadmap.weeks.reduce((sum, week) => sum + (week.resources?.length || 0), 0)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="card-base p-4">
                <p className="section-label">Weekly focus</p>
                <ol className="mt-3 space-y-2.5">
                  {roadmap.weeks.map((week) => (
                    <li key={week.week} className="flex items-start gap-2.5">
                      <span className="mt-px font-mono text-[9px] text-muted-foreground/30">
                        {String(week.week).padStart(2, "0")}
                      </span>
                      <span className="text-[10.5px] leading-4 text-muted-foreground">
                        {week.focus_skill}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
