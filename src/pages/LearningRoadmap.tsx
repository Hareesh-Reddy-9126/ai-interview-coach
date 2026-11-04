import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BookOpen,
  Check,
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
    <div aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-3 border-y border-border py-4">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
        <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-muted-foreground">
          Building your four-week plan
        </p>
      </div>
      <div className="divide-y divide-border border-b border-border">
        {[1, 2, 3, 4].map((week) => (
          <div key={week} className="grid grid-cols-[52px_minmax(0,1fr)] gap-5 py-6 sm:grid-cols-[84px_minmax(0,1fr)] sm:gap-8">
            <div className="skeleton h-8 w-8" />
            <div>
              <div className="skeleton mb-3 h-2.5 w-24" />
              <div className="skeleton h-4 w-2/3" />
              <div className="mt-4 space-y-2">
                <div className="skeleton h-2.5 w-full" />
                <div className="skeleton h-2.5 w-5/6" />
                <div className="skeleton h-2.5 w-4/6" />
              </div>
            </div>
          </div>
        ))}
      </div>
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
      {generating ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RefreshCw className="h-3.5 w-3.5" />
      )}
      {generating ? "Generating…" : label}
    </button>
  );

  return (
    <div className="mx-auto max-w-[1040px]">
      <div className="mb-9 flex flex-col gap-6 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="h-px w-7 bg-accent" aria-hidden="true" />
            <span className="section-label">Learning plan · Four weeks</span>
          </div>
          <h1 className="text-display-lg text-foreground">Your four-week plan.</h1>
          <p className="mt-4 max-w-xl text-[14px] leading-[1.7] text-muted-foreground">
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
        <div className="mb-5 flex items-start gap-3 border border-destructive/30 bg-destructive/[0.05] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="flex-1 text-[12.5px] leading-5 text-destructive">{error}</p>
          <button
            type="button"
            onClick={generateRoadmap}
            className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-destructive underline underline-offset-4 hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {generating && <GeneratingState />}

      {!roadmap && !generating && !error && (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-14">
          <section className="relative flex min-h-[340px] flex-col justify-between border border-dashed border-border-strong bg-card/40 p-8 sm:p-10">
            <span
              className="pointer-events-none absolute inset-4 border border-border/40"
              aria-hidden="true"
            />
            <div className="relative flex items-start justify-between">
              <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-accent">
                No plan on file
              </span>
              <span className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-muted-foreground/40">
                Four weeks
              </span>
            </div>

            <div className="relative py-10">
              <span className="flex h-12 w-12 items-center justify-center border border-border-strong bg-background text-muted-foreground">
                <Map className="h-4 w-4" strokeWidth={1.7} />
              </span>
              <h2 className="mt-6 font-display text-[28px] font-light leading-[1.05] tracking-[-0.035em] text-foreground">
                A plan built from
                <br />
                your own answers.
              </h2>
              <p className="mt-3 max-w-sm text-[12.5px] leading-[1.7] text-muted-foreground">
                We use your interview analytics to pick one priority skill, then lay out four weeks
                of focused practice around it.
              </p>
              <button
                type="button"
                onClick={generateRoadmap}
                className="btn-primary btn-sm mt-6 gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Generate my roadmap
              </button>
              <p className="mt-4 font-mono text-[7.5px] uppercase tracking-[0.14em] text-muted-foreground/40">
                Takes about 20–30 seconds · replaces any previous plan
              </p>
            </div>

            <p className="relative border-t border-border pt-4 font-mono text-[7.5px] uppercase leading-[1.9] tracking-[0.12em] text-muted-foreground/40">
              Priority skill selected from five scored dimensions
            </p>
          </section>

          <aside>
            <div className="flex items-baseline justify-between border-b border-border pb-3">
              <h2 className="text-headline text-foreground">How it&apos;s built</h2>
              <span className="mono-label">Three steps</span>
            </div>
            <ol className="divide-y divide-border border-b border-border">
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
                <li key={step.title} className="flex gap-4 py-5">
                  <span className="font-display text-[22px] font-light leading-none tracking-[-0.03em] tabular text-muted-foreground/30">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="font-display text-[17px] leading-none tracking-[-0.02em] text-foreground">
                      {step.title}
                    </p>
                    <p className="mt-2 text-[11.5px] leading-[1.7] text-muted-foreground/75">
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex items-start gap-2.5">
              <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/55" />
              <p className="text-[10.5px] leading-[1.7] text-muted-foreground/50">
                Regenerating replaces the previous plan for your account.
              </p>
            </div>
          </aside>
        </div>
      )}

      {roadmap && !generating && (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_248px] lg:gap-12">
          <div className="min-w-0">
            <div className="border-y border-border py-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-accent">
                    Strategy
                  </span>
                  <h2 className="font-display text-[22px] font-light leading-none tracking-[-0.025em] text-foreground">
                    {roadmap.priority_skill}
                  </h2>
                </div>
                <p className="font-mono text-[7.5px] uppercase tracking-[0.13em] text-muted-foreground/45">
                  {roadmap.weeks.length} weeks
                  {createdAt &&
                    ` · ${new Date(createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}`}
                </p>
              </div>
              <p className="mt-4 max-w-2xl text-[13.5px] leading-[1.8] text-secondary-foreground">
                {roadmap.summary}
              </p>
            </div>

            <ol className="divide-y divide-border border-b border-border">
              {roadmap.weeks.map((week, index) => (
                <motion.li
                  key={week.week}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="grid grid-cols-[52px_minmax(0,1fr)] gap-5 py-7 sm:grid-cols-[84px_minmax(0,1fr)] sm:gap-8"
                >
                  <div>
                    <span className="font-display text-[40px] font-light leading-[0.7] tracking-[-0.05em] tabular text-muted-foreground/30">
                      {String(week.week).padStart(2, "0")}
                    </span>
                    <span className="mt-2 block font-mono text-[7px] uppercase tracking-[0.14em] text-muted-foreground/35">
                      Week
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h2 className="font-display text-[24px] font-light leading-[1.1] tracking-[-0.03em] text-foreground">
                        {week.title}
                      </h2>
                      <span className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-accent">
                        {week.focus_skill}
                      </span>
                    </div>
                    <p className="mt-3 max-w-2xl text-[12.5px] leading-[1.75] text-muted-foreground">
                      {week.description}
                    </p>

                    <div className="mt-5 grid gap-6 sm:grid-cols-2">
                      <div>
                        <p className="mono-label mb-2.5">Tasks</p>
                        <ul className="space-y-2">
                          {week.tasks.map((task, taskIndex) => (
                            <li key={taskIndex} className="flex items-start gap-2.5">
                              <Check
                                className="mt-0.5 h-3 w-3 shrink-0 text-primary/55"
                                strokeWidth={2.2}
                              />
                              <span className="text-[11.5px] leading-[1.65] text-secondary-foreground">
                                {task}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {week.resources?.length > 0 && (
                        <div>
                          <p className="mono-label mb-2.5">Resources</p>
                          <ul className="space-y-2">
                            {week.resources.map((resource, resourceIndex) => (
                              <li key={resourceIndex} className="flex items-start gap-2.5">
                                <BookOpen
                                  className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/35"
                                  strokeWidth={1.8}
                                />
                                <span className="text-[11.5px] leading-[1.65] text-muted-foreground">
                                  {resource}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.li>
              ))}
            </ol>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-mono text-[7.5px] uppercase tracking-[0.13em] text-muted-foreground/40">
                Plans refresh from your latest analytics
              </p>
              {generateButton("Regenerate plan", "secondary")}
            </div>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-[88px]">
              <div className="border-t border-border pt-3">
                <div className="flex items-baseline justify-between">
                  <p className="mono-label">Plan at a glance</p>
                  <span className="font-mono text-[7.5px] uppercase tracking-[0.13em] text-muted-foreground/35">
                    Live
                  </span>
                </div>
                <p className="mt-4 font-display text-[28px] font-light leading-[1.05] tracking-[-0.035em] text-foreground">
                  {roadmap.priority_skill}
                </p>
                <p className="mt-1.5 text-[10.5px] text-muted-foreground/50">Priority skill</p>
              </div>

              <dl className="mt-5 divide-y divide-border border-y border-border">
                {[
                  { label: "Duration", value: `${roadmap.weeks.length} weeks` },
                  {
                    label: "Tasks",
                    value: roadmap.weeks.reduce((sum, week) => sum + week.tasks.length, 0),
                  },
                  {
                    label: "Resources",
                    value: roadmap.weeks.reduce(
                      (sum, week) => sum + (week.resources?.length || 0),
                      0,
                    ),
                  },
                ].map((row) => (
                  <div key={row.label} className="flex items-baseline justify-between gap-3 py-2.5">
                    <dt className="font-mono text-[7.5px] uppercase tracking-[0.13em] text-muted-foreground/45">
                      {row.label}
                    </dt>
                    <dd className="text-[11.5px] tabular text-secondary-foreground">{row.value}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-6">
                <p className="mono-label">Weekly focus</p>
                <ol className="mt-3 space-y-3">
                  {roadmap.weeks.map((week) => (
                    <li key={week.week} className="flex items-start gap-3">
                      <span className="mt-px font-mono text-[8px] tabular text-accent/85">
                        {String(week.week).padStart(2, "0")}
                      </span>
                      <span className="text-[10.5px] leading-[1.5] text-muted-foreground">
                        {week.focus_skill}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              <p className="mt-6 border-t border-border pt-4 text-[10px] leading-[1.75] text-muted-foreground/40">
                One priority skill, four weeks, no filler. Regenerate after your next scored
                session to keep the plan honest.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
