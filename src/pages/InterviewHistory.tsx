import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Clock, Mic, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

interface Session {
  id: string;
  role: string;
  company: string;
  difficulty: string;
  overall_score: number | null;
  status: string;
  created_at: string;
}

const FILTERS = [
  { id: "all", label: "All" },
  { id: "completed", label: "Completed" },
  { id: "in_progress", label: "In progress" },
] as const;

type Filter = (typeof FILTERS)[number]["id"];

const scoreText = (score: number) =>
  score >= 80 ? "text-primary" : score >= 60 ? "text-warning" : "text-destructive";

const scoreBar = (score: number) =>
  score >= 80 ? "bg-primary" : score >= 60 ? "bg-warning" : "bg-destructive";

const difficultyText = (difficulty: string) =>
  difficulty === "Hard"
    ? "text-destructive/80"
    : difficulty === "Medium"
      ? "text-warning/90"
      : "text-primary/90";

export default function InterviewHistory() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("interview_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        setSessions(data || []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const stats = useMemo(() => {
    const completed = sessions.filter((session) => session.status === "completed");
    const scored = sessions.filter(
      (session) => typeof session.overall_score === "number" && session.overall_score > 0,
    );
    const average = scored.length
      ? Math.round(scored.reduce((sum, session) => sum + (session.overall_score || 0), 0) / scored.length)
      : 0;
    const best = scored.length ? Math.max(...scored.map((session) => session.overall_score || 0)) : 0;
    return { total: sessions.length, completed: completed.length, average, best };
  }, [sessions]);

  const filtered = useMemo(
    () =>
      filter === "all"
        ? sessions
        : sessions.filter((session) => session.status === filter),
    [sessions, filter],
  );

  const grouped = useMemo(() => {
    const groups = new Map<string, Session[]>();
    for (const session of filtered) {
      const label = new Date(session.created_at).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
      const existing = groups.get(label) ?? [];
      existing.push(session);
      groups.set(label, existing);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  return (
    <div className="mx-auto max-w-[900px]">
      <div className="mb-6 flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-primary" aria-hidden="true" />
            <span className="section-label">Archive</span>
          </div>
          <h1 className="text-display-lg text-foreground">Session history</h1>
          <p className="mt-2.5 text-[13.5px] leading-6 text-muted-foreground">
            Every interview you've run, with the score it produced.
          </p>
        </div>
        <Link to="/interview" className="btn-primary btn-sm w-fit gap-1.5">
          New session
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="card-base flex items-center gap-4 p-4">
              <div className="skeleton h-8 w-8 rounded-md" />
              <div className="flex-1">
                <div className="skeleton mb-2 h-3.5 w-40" />
                <div className="skeleton h-2.5 w-24" />
              </div>
              <div className="skeleton h-6 w-12" />
            </div>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={<Mic className="h-5 w-5" strokeWidth={1.7} />}
          title="No interviews yet"
          description="Your first session will appear here with its score, difficulty and company context."
          action={
            <Link to="/interview" className="btn-primary btn-sm gap-1.5">
              Start your first interview
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
      ) : (
        <div className="space-y-5">
          {/* Summary strip */}
          <div className="card-base grid grid-cols-2 divide-border/60 sm:grid-cols-4 sm:divide-x">
            {[
              { label: "Sessions", value: stats.total },
              { label: "Completed", value: stats.completed },
              { label: "Average", value: stats.average ? `${stats.average}%` : "—" },
              { label: "Best score", value: stats.best ? `${stats.best}%` : "—" },
            ].map((stat) => (
              <div key={stat.label} className="px-4 py-3.5">
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/50">
                  {stat.label}
                </p>
                <p className="mt-1.5 font-display text-[20px] font-semibold leading-none tracking-[-0.03em] text-foreground tabular">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              {FILTERS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFilter(option.id)}
                  aria-pressed={filter === option.id}
                  className={cn(
                    "rounded-[6px] px-2.5 py-1.5 text-[11.5px] font-medium transition-colors",
                    filter === option.id
                      ? "bg-surface-3 text-foreground"
                      : "text-muted-foreground/60 hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-[10.5px] text-muted-foreground/45">
              {filtered.length} {filtered.length === 1 ? "session" : "sessions"}
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="card-base flex flex-col items-center justify-center px-6 py-12 text-center">
              <Target className="h-5 w-5 text-muted-foreground/35" />
              <p className="mt-3 text-[12.5px] font-medium text-foreground">
                No {filter === "completed" ? "completed" : "in-progress"} sessions
              </p>
              <p className="mt-1 text-[11.5px] text-muted-foreground/60">
                Try a different filter, or start a new interview.
              </p>
            </div>
          ) : (
            grouped.map(([month, monthSessions]) => (
              <section key={month} aria-label={month}>
                <div className="mb-2 flex items-center gap-3">
                  <h2 className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/55">
                    {month}
                  </h2>
                  <div className="h-px flex-1 bg-border/60" />
                  <span className="tabular text-[10.5px] text-muted-foreground/35">
                    {monthSessions.length}
                  </span>
                </div>
                <div className="card-base divide-y divide-border/60 overflow-hidden">
                  {monthSessions.map((session, index) => (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02, duration: 0.25 }}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40 sm:px-5"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-surface-2 text-muted-foreground/60">
                        <Mic className="h-3.5 w-3.5" strokeWidth={1.8} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-medium text-foreground">
                          {session.role}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-muted-foreground/55">
                          <span>{session.company}</span>
                          <span className="h-[3px] w-[3px] rounded-full bg-border-strong" />
                          <span className={difficultyText(session.difficulty)}>
                            {session.difficulty}
                          </span>
                          <span className="h-[3px] w-[3px] rounded-full bg-border-strong" />
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {new Date(session.created_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                      </div>
                      {session.status !== "completed" ? (
                        <span className="tag-warning shrink-0 capitalize">
                          {session.status.replace("_", " ")}
                        </span>
                      ) : session.overall_score != null ? (
                        <div className="flex shrink-0 items-center gap-2.5">
                          <div className="hidden h-1 w-16 overflow-hidden rounded-full bg-surface-3 sm:block">
                            <div
                              className={cn("h-full rounded-full", scoreBar(session.overall_score))}
                              style={{ width: `${session.overall_score}%` }}
                            />
                          </div>
                          <span
                            className={cn(
                              "tabular w-8 text-right text-[12px] font-semibold",
                              scoreText(session.overall_score),
                            )}
                          >
                            {session.overall_score}
                          </span>
                        </div>
                      ) : (
                        <span className="tag-muted shrink-0">Scored</span>
                      )}
                    </motion.div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      )}
    </div>
  );
}
