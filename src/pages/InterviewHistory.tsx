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
    <div className="mx-auto max-w-[980px]">
      <div className="mb-8 flex flex-col gap-6 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="h-px w-7 bg-accent" aria-hidden="true" />
            <span className="section-label">Archive · Every session</span>
          </div>
          <h1 className="text-display-lg text-foreground">Session history</h1>
          <p className="mt-4 max-w-xl text-[14px] leading-[1.7] text-muted-foreground">
            Every interview you have run, with the score it produced and the context around it.
          </p>
        </div>
        <Link to="/interview" className="btn-primary btn-sm w-fit gap-2">
          New session
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 border-b border-border py-4">
              <div className="skeleton h-8 w-8" />
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
        <div className="space-y-9">
          <div className="grid grid-cols-2 gap-px border-y border-border bg-border sm:grid-cols-4">
            {[
              { label: "Sessions", value: stats.total },
              { label: "Completed", value: stats.completed },
              { label: "Average", value: stats.average ? `${stats.average}%` : "—" },
              { label: "Best score", value: stats.best ? `${stats.best}%` : "—" },
            ].map((stat) => (
              <div key={stat.label} className="bg-background px-4 py-4 sm:px-5">
                <p className="mono-label">{stat.label}</p>
                <p className="mt-2 font-display text-[30px] font-light leading-none tracking-[-0.04em] tabular text-foreground">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-6 border-b-0">
              {FILTERS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFilter(option.id)}
                  aria-pressed={filter === option.id}
                  className={cn(
                    "relative pb-1.5 font-mono text-[8.5px] uppercase tracking-[0.14em] transition-colors",
                    filter === option.id
                      ? "text-foreground"
                      : "text-muted-foreground/50 hover:text-foreground",
                  )}
                >
                  {option.label}
                  <span
                    className={cn(
                      "absolute inset-x-0 bottom-0 h-px transition-colors",
                      filter === option.id ? "bg-accent" : "bg-transparent",
                    )}
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
            <p className="mono-label text-muted-foreground/45">
              {filtered.length} {filtered.length === 1 ? "session" : "sessions"}
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center border border-border px-6 py-12 text-center">
              <Target className="h-5 w-5 text-muted-foreground/35" />
              <p className="mt-3 font-display text-[19px] text-foreground">
                No {filter === "completed" ? "completed" : "in-progress"} sessions
              </p>
              <p className="mt-1 text-[11.5px] text-muted-foreground/60">
                Try a different filter, or start a new interview.
              </p>
            </div>
          ) : (
            grouped.map(([month, monthSessions], groupIndex) => (
              <motion.section
                key={month}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: groupIndex * 0.05, duration: 0.3 }}
                aria-label={month}
              >
                <div className="mb-3 flex items-baseline gap-4">
                  <h2 className="font-display text-[24px] font-light leading-none tracking-[-0.03em] text-foreground">
                    {month}
                  </h2>
                  <div className="h-px flex-1 bg-border" />
                  <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-muted-foreground/40">
                    {monthSessions.length} {monthSessions.length === 1 ? "entry" : "entries"}
                  </span>
                </div>

                <div className="border-t border-border">
                  {monthSessions.map((session, index) => (
                    <div
                      key={session.id}
                      className="grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-4 border-b border-border py-4 transition-colors hover:bg-surface-2/30 sm:grid-cols-[40px_minmax(0,1fr)_auto]"
                    >
                      <span className="font-mono text-[8px] tracking-[0.1em] text-muted-foreground/35">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-display text-[19px] leading-none tracking-[-0.02em] text-foreground">
                          {session.role}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                          <span className="text-[10.5px] font-medium text-secondary-foreground">
                            {session.company}
                          </span>
                          <span className="h-[3px] w-[3px] bg-border-strong" aria-hidden="true" />
                          <span className={cn("text-[10.5px]", difficultyText(session.difficulty))}>
                            {session.difficulty}
                          </span>
                          <span className="h-[3px] w-[3px] bg-border-strong" aria-hidden="true" />
                          <span className="inline-flex items-center gap-1 font-mono text-[7.5px] uppercase tracking-[0.1em] text-muted-foreground/45">
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
                        <span
                          className={cn(
                            "shrink-0 font-display text-[26px] font-light leading-none tabular",
                            scoreText(session.overall_score),
                          )}
                        >
                          {session.overall_score}
                        </span>
                      ) : (
                        <span className="tag-muted shrink-0">Scored</span>
                      )}
                    </div>
                  ))}
                </div>
              </motion.section>
            ))
          )}
        </div>
      )}
    </div>
  );
}
