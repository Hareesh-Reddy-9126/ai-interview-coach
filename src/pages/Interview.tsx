import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  AudioLines,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Gauge,
  Keyboard,
  Loader2,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  Target,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import SkillRadarChart from "@/components/SkillRadarChart";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { invokeFunction } from "@/lib/edge-functions";
import { cn, getErrorMessage, type ResumeContext, type UserAnalytics } from "@/lib/utils";
import { pickStrongestAndWeakest } from "@/lib/skills";

function deriveSkillScoresFromTurns(turns: Turn[], avgScore: number): Record<string, number> {
  const skills: Record<string, number[]> = {
    communication_score: [],
    technical_score: [],
    system_design_score: [],
    problem_solving_score: [],
    confidence_score: [],
  };

  for (const turn of turns) {
    const text = [turn.feedback || "", ...(turn.strengths || []), ...(turn.improvements || [])].join(" ").toLowerCase();
    const score = turn.score || avgScore;

    const strengthText = (turn.strengths || []).join(" ").toLowerCase();
    const improvementText = (turn.improvements || []).join(" ").toLowerCase();

    const check = (keywords: string[], skillKey: string) => {
      const inStrengths = keywords.some((k) => strengthText.includes(k));
      const inImprovements = keywords.some((k) => improvementText.includes(k));
      const mentioned = keywords.some((k) => text.includes(k));
      if (mentioned) {
        let s = score;
        if (inStrengths && !inImprovements) s = Math.min(100, score + 10);
        else if (inImprovements && !inStrengths) s = Math.max(0, score - 10);
        skills[skillKey].push(s);
      }
    };

    check(["communicat", "clarity", "articulate", "explain", "clear", "concise", "structured"], "communication_score");
    check(["technical", "code", "algorithm", "data structure", "implementation", "logic", "complexity"], "technical_score");
    check(["system design", "architecture", "scalab", "distributed", "database", "trade-off"], "system_design_score");
    check(["problem solving", "approach", "solution", "analytical", "debug", "optimize", "edge case"], "problem_solving_score");
    check(["confidence", "composure", "assertive", "decisive", "prepared"], "confidence_score");
  }

  const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : avgScore);

  return {
    communication_score: avg(skills.communication_score),
    technical_score: avg(skills.technical_score),
    system_design_score: avg(skills.system_design_score),
    problem_solving_score: avg(skills.problem_solving_score),
    confidence_score: avg(skills.confidence_score),
  };
}

const companies = ["Google", "Amazon", "Meta", "Microsoft", "Netflix", "Apple", "Startup"];
const roles = ["Frontend Engineer", "Backend Engineer", "Full Stack Engineer", "ML Engineer", "DevOps Engineer"];
const difficulties = ["Easy", "Medium", "Hard"];
const experiences = ["Junior (0-2 yrs)", "Mid (2-5 yrs)", "Senior (5+ yrs)"];
const interviewFocuses = ["Behavioral", "System Design", "Leadership", "Coding"];

interface Turn {
  question: string;
  answer?: string;
  score?: number | null;
  feedback?: string | null;
  strengths?: string[];
  improvements?: string[];
}

interface InterviewAiResponse {
  score: number | null;
  feedback: string | null;
  strengths: string[];
  improvements: string[];
  nextQuestion: string;
}

function ScoreValue({ score, className }: { score?: number | null; className?: string }) {
  const value = score ?? 0;
  return (
    <span
      className={cn(
        "tabular text-[12px] font-semibold",
        value >= 80 ? "text-primary" : value >= 60 ? "text-warning" : "text-destructive",
        className,
      )}
    >
      {score != null ? `${score}%` : "—"}
    </span>
  );
}

function OptionGroup({
  index,
  label,
  hint,
  items,
  value,
  onChange,
}: {
  index: string;
  label: string;
  hint?: string;
  items: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="grid gap-4 py-6 sm:grid-cols-[148px_minmax(0,1fr)] sm:gap-8">
      <div>
        <legend className="flex items-baseline gap-2.5">
          <span className="font-mono text-[8.5px] tracking-[0.12em] text-accent">{index}</span>
          <span className="font-display text-[19px] leading-none tracking-[-0.02em] text-foreground">
            {label}
          </span>
        </legend>
        {hint && (
          <p className="mt-2 pl-[26px] text-[10.5px] leading-4 text-muted-foreground/50">{hint}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-3 self-start sm:pt-0.5">
        {items.map((item) => {
          const selected = value === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => onChange(item)}
              aria-pressed={selected}
              className={cn(
                "group relative inline-flex items-center gap-2 pb-1.5 text-[13.5px] transition-colors",
                selected
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "h-1 w-1 shrink-0 transition-colors",
                  selected ? "bg-accent" : "bg-transparent",
                )}
                aria-hidden="true"
              />
              {item}
              <span
                className={cn(
                  "absolute inset-x-0 bottom-0 h-px transition-colors",
                  selected ? "bg-accent" : "bg-transparent group-hover:bg-border-strong",
                )}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function Interview() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isResumeMode = searchParams.get("mode") === "resume";
  const focusParam = searchParams.get("focus") ?? "";
  const companyParam = searchParams.get("company") ?? "";
  const difficultyParam = searchParams.get("difficulty") ?? "";
  const focus = interviewFocuses.includes(focusParam) ? focusParam : null;
  const [phase, setPhase] = useState<"setup" | "interview" | "report">("setup");
  const [config, setConfig] = useState({
    company: companies.includes(companyParam) ? companyParam : "",
    role: "",
    difficulty: difficulties.includes(difficultyParam) ? difficultyParam : "",
    experience: "",
  });
  const [turns, setTurns] = useState<Turn[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [resumeContext, setResumeContext] = useState<ResumeContext | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [inputMode, setInputMode] = useState<"typing" | "voice">("typing");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const speech = useSpeechRecognition();

  useEffect(() => {
    if (isResumeMode) {
      try {
        const ctx = sessionStorage.getItem("resume_context");
        if (ctx) setResumeContext(JSON.parse(ctx) as ResumeContext);
      } catch {
        // Corrupt or missing resume context — start without personalization.
      }
    }
  }, [isResumeMode]);

  useEffect(() => {
    if (inputMode === "voice" && (speech.transcript || speech.interimTranscript)) {
      setCurrentAnswer(speech.transcript + (speech.interimTranscript ? " " + speech.interimTranscript : ""));
    }
  }, [speech.transcript, speech.interimTranscript, inputMode]);

  useEffect(() => {
    if (phase === "interview") {
      if (startedAtRef.current === null) startedAtRef.current = Date.now();
      const tick = () => {
        const started = startedAtRef.current;
        if (started !== null) setElapsedTime(Math.floor((Date.now() - started) / 1000));
      };
      tick();
      timerRef.current = setInterval(tick, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
    // Keep the final duration visible on the report screen; only reset when
    // starting a brand-new interview.
    if (phase === "setup") {
      startedAtRef.current = null;
      setElapsedTime(0);
    }
    if (timerRef.current) clearInterval(timerRef.current);
  }, [phase]);

  useEffect(() => {
    if (phase !== "interview") return;
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, isEvaluating, phase]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const callAI = useCallback(
    async (conversation: Turn[]): Promise<InterviewAiResponse> =>
      invokeFunction<InterviewAiResponse>("interview-ai", {
        body: {
          role: config.role,
          company: config.company,
          experience: config.experience,
          difficulty: config.difficulty,
          ...(focus ? { focus } : {}),
          conversation,
          resume_context: resumeContext,
        },
        fallbackMessage: "Failed to reach the AI interviewer. Please try again.",
      }),
    [config, focus, resumeContext],
  );

  const startInterview = async () => {
    setIsEvaluating(true);
    setAiError(null);
    try {
      const { data: session, error: sessionError } = await supabase
        .from("interview_sessions")
        .insert({
          user_id: user!.id,
          role: config.role,
          company: config.company,
          difficulty: config.difficulty,
          experience: config.experience,
        })
        .select()
        .single();
      if (sessionError) throw sessionError;
      setSessionId(session.id);
      const aiResponse = await callAI([]);
      const firstQuestion = aiResponse.nextQuestion || "Tell me about yourself and your experience.";
      await supabase
        .from("interview_turns")
        .insert({ session_id: session.id, turn_number: 1, question: firstQuestion });
      setTurns([{ question: firstQuestion }]);
      setPhase("interview");
    } catch (e) {
      const message = getErrorMessage(e, "Failed to start interview");
      setAiError(message);
      toast.error(message);
    } finally {
      setIsEvaluating(false);
    }
  };

  const submitAnswer = useCallback(async () => {
    if (!currentAnswer.trim() || !sessionId || isEvaluating) return;
    setIsEvaluating(true);
    setAiError(null);
    try {
      const currentTurnIndex = turns.length - 1;
      const conversationSoFar = turns.map((t, i) =>
        i === currentTurnIndex ? { ...t, answer: currentAnswer } : t,
      );
      const aiResponse = await callAI(conversationSoFar);
      const updatedTurns = [...turns];
      updatedTurns[currentTurnIndex] = {
        ...updatedTurns[currentTurnIndex],
        answer: currentAnswer,
        score: aiResponse.score ?? 75,
        feedback: aiResponse.feedback ?? "Good answer.",
        strengths: aiResponse.strengths || [],
        improvements: aiResponse.improvements || [],
      };
      await supabase
        .from("interview_turns")
        .update({
          answer: currentAnswer,
          score: aiResponse.score ?? 75,
          feedback: aiResponse.feedback,
          strengths: aiResponse.strengths || [],
          improvements: aiResponse.improvements || [],
        })
        .eq("session_id", sessionId)
        .eq("turn_number", currentTurnIndex + 1);
      if (updatedTurns.length < 5 && aiResponse.nextQuestion) {
        updatedTurns.push({ question: aiResponse.nextQuestion });
        await supabase
          .from("interview_turns")
          .insert({ session_id: sessionId, turn_number: updatedTurns.length, question: aiResponse.nextQuestion });
      }
      setTurns(updatedTurns);
      setCurrentAnswer("");
      const answeredTurns = updatedTurns.filter((t) => t.answer);
      if (answeredTurns.length >= 5) {
        const avgScore = Math.round(
          answeredTurns.reduce((a, t) => a + (t.score || 0), 0) / answeredTurns.length,
        );
        await supabase
          .from("interview_sessions")
          .update({ status: "completed", overall_score: avgScore })
          .eq("id", sessionId);
        void invokeFunction("compute-analytics", {
          body: { session_id: sessionId },
          fallbackMessage: "Analytics update failed.",
        }).catch((analyticsError) => console.error("[compute-analytics]", analyticsError));
        setPhase("report");
      }
    } catch (e) {
      const message = getErrorMessage(e, "AI evaluation temporarily unavailable.");
      setAiError(message);
      toast.error(message);
    } finally {
      setIsEvaluating(false);
    }
  }, [currentAnswer, sessionId, turns, isEvaluating, callAI]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submitAnswer();
    }
  };

  const currentTurn = turns[turns.length - 1];
  const answeredTurns = turns.filter((t) => t.score != null);
  const avgScore =
    answeredTurns.length > 0
      ? Math.round(answeredTurns.reduce((a, t) => a + (t.score || 0), 0) / answeredTurns.length)
      : 0;
  const [reportSkillScores, setReportSkillScores] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    if (phase !== "report" || !sessionId || !user) return;
    const answered = turns.filter((turn) => turn.score != null);
    const fallbackAvg =
      answered.length > 0
        ? Math.round(answered.reduce((sum, turn) => sum + (turn.score || 0), 0) / answered.length)
        : 0;
    let cancelled = false;
    let timer: number | undefined;
    let attempts = 0;

    const applyAnalytics = (data: UserAnalytics) => {
      setReportSkillScores({
        communication_score: Number(data.communication_score) || fallbackAvg,
        technical_score: Number(data.technical_score) || fallbackAvg,
        system_design_score: Number(data.system_design_score) || fallbackAvg,
        problem_solving_score: Number(data.problem_solving_score) || fallbackAvg,
        confidence_score: Number(data.confidence_score) || fallbackAvg,
      });
    };

    // Show scores derived from this session immediately, then replace them once
    // compute-analytics has written a fresh aggregate.
    setReportSkillScores(deriveSkillScoresFromTurns(answered, fallbackAvg));

    const loadAnalytics = async () => {
      const { data } = await supabase
        .from("user_analytics")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;

      const fresh = data && Date.now() - new Date(data.updated_at).getTime() < 120_000;
      if (fresh) {
        applyAnalytics(data);
        return;
      }
      if (attempts < 5) {
        attempts += 1;
        timer = window.setTimeout(loadAnalytics, 2000);
      }
    };

    void loadAnalytics();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [phase, sessionId, user, turns]);

  const setupComplete = Boolean(config.company && config.role && config.difficulty && config.experience);

  // ── Setup Phase ──
  if (phase === "setup") {
    return (
      <div className="mx-auto max-w-[1080px]">
        <div className="mb-8 flex flex-col gap-6 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <span className="h-px w-7 bg-accent" aria-hidden="true" />
              <span className="section-label">New session · Brief no. 05</span>
            </div>
            <h1 className="text-display-lg text-foreground">Design the interview.</h1>
            <p className="mt-4 max-w-xl text-[14px] leading-[1.7] text-muted-foreground">
              Choose the context you are preparing for. The interviewer adapts each question to
              your last answer, then scores the full session across five dimensions.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-5 pb-1">
            <span className="mono-label">5 questions</span>
            <span className="h-3 w-px bg-border-strong" aria-hidden="true" />
            <span className="mono-label">~20 minutes</span>
          </div>
        </div>

        {aiError && (
          <div className="mb-5 flex items-start gap-3 border border-destructive/30 bg-destructive/[0.05] px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="flex-1 text-[12.5px] leading-5 text-destructive">{aiError}</p>
            <button
              type="button"
              onClick={() => {
                setAiError(null);
                startInterview();
              }}
              className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-destructive underline underline-offset-4 hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
          <div>
            {(focus || (isResumeMode && resumeContext)) && (
              <div className="mb-2 space-y-2.5 border-b border-border pb-5">
                {focus && (
                  <p className="flex items-center gap-2.5 text-[11.5px] text-secondary-foreground">
                    <Target className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={1.7} />
                    <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-accent">
                      {focus} focus
                    </span>
                    Questions will target this interview type.
                  </p>
                )}
                {isResumeMode && resumeContext && (
                  <p className="flex items-center gap-2.5 text-[11.5px] text-secondary-foreground">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.7} />
                    <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-primary">
                      Resume-personalized
                    </span>
                    {(resumeContext.skills || []).length} skills detected and used for prompts.
                  </p>
                )}
              </div>
            )}

            <div className="divide-y divide-border border-b border-border">
              <OptionGroup
                index="01"
                label="Company"
                hint="Sets tone and expectations"
                items={companies}
                value={config.company}
                onChange={(value) => setConfig((prev) => ({ ...prev, company: value }))}
              />
              <OptionGroup
                index="02"
                label="Role"
                hint="Drives technical depth"
                items={roles}
                value={config.role}
                onChange={(value) => setConfig((prev) => ({ ...prev, role: value }))}
              />
              <OptionGroup
                index="03"
                label="Difficulty"
                hint="Calibrates question weight"
                items={difficulties}
                value={config.difficulty}
                onChange={(value) => setConfig((prev) => ({ ...prev, difficulty: value }))}
              />
              <OptionGroup
                index="04"
                label="Experience"
                hint="Sets the seniority bar"
                items={experiences}
                value={config.experience}
                onChange={(value) => setConfig((prev) => ({ ...prev, experience: value }))}
              />
            </div>

            <div className="flex items-start gap-2.5 pt-5">
              <Gauge className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/45" />
              <p className="max-w-md text-[11px] leading-5 text-muted-foreground/60">
                Scored across communication, technical, system design, problem solving and
                confidence. Each answer is assessed as you go, not at the end.
              </p>
            </div>
          </div>

          <aside className="lg:sticky lg:top-[88px] lg:h-fit">
            <div className="panel-ink overflow-hidden">
              <div className="flex items-center justify-between border-b border-sidebar-border px-6 py-4">
                <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-sidebar-primary">
                  Session ticket
                </span>
                <span className="border border-sidebar-primary/40 px-2 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.12em] text-sidebar-primary">
                  {setupComplete ? "Ready" : "Draft"}
                </span>
              </div>

              <div className="px-6 pb-6 pt-6">
                <p className="font-display text-[32px] font-light leading-none tracking-[-0.03em]">
                  Mock interview
                </p>
                <p className="mt-3 font-mono text-[8px] uppercase tracking-[0.16em] text-sidebar-foreground/50">
                  {config.difficulty || "Difficulty"} · {config.experience || "Experience"}
                </p>

                <dl className="mt-7 divide-y divide-sidebar-border border-y border-sidebar-border">
                  {[
                    { label: "Company", value: config.company },
                    { label: "Role", value: config.role },
                    { label: "Difficulty", value: config.difficulty },
                    { label: "Experience", value: config.experience },
                  ].map((row) => (
                    <div key={row.label} className="flex items-baseline justify-between gap-3 py-2.5">
                      <dt className="font-mono text-[7.5px] uppercase tracking-[0.16em] text-sidebar-foreground/45">
                        {row.label}
                      </dt>
                      <dd
                        className={cn(
                          "max-w-[190px] truncate text-right text-[11.5px]",
                          row.value
                            ? "text-[hsl(var(--sidebar-accent-foreground))]"
                            : "text-sidebar-foreground/30",
                        )}
                      >
                        {row.value || "Not set"}
                      </dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-6">
                  <p className="font-mono text-[7.5px] uppercase tracking-[0.16em] text-sidebar-foreground/40">
                    Scored dimensions
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                    {[
                      "Communication",
                      "Technical",
                      "System design",
                      "Problem solving",
                      "Confidence",
                    ].map((skill) => (
                      <span
                        key={skill}
                        className="flex items-center gap-1.5 text-[10.5px] text-sidebar-foreground/70"
                      >
                        <span className="h-1 w-1 bg-sidebar-primary/60" aria-hidden="true" />
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={startInterview}
                  disabled={!setupComplete || isEvaluating}
                  className="btn-invert btn-lg mt-7 w-full gap-2"
                >
                  {isEvaluating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Preparing session…
                    </>
                  ) : (
                    <>
                      Start interview
                      <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                    </>
                  )}
                </button>
                <p className="mt-3 text-center font-mono text-[7.5px] uppercase tracking-[0.14em] text-sidebar-foreground/35">
                  First question arrives in seconds
                </p>
              </div>

              <div className="border-t border-sidebar-border bg-sidebar-accent/30 px-6 py-3.5">
                <p className="text-[10.5px] leading-4 text-sidebar-foreground/45">
                  {setupComplete
                    ? "All fields set. Your interviewer is ready."
                    : "Complete all four fields to begin."}
                </p>
              </div>
            </div>

            <ul className="mt-5 space-y-2.5 px-1">
              {[
                "Answer in full sentences — clarity is scored.",
                "Use ⌘/Ctrl + Enter to submit an answer.",
                "Voice input works in Chrome and Edge.",
              ].map((tip) => (
                <li
                  key={tip}
                  className="flex items-start gap-2 text-[10.5px] leading-4 text-muted-foreground/55"
                >
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary/50" strokeWidth={2.4} />
                  {tip}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    );
  }

  // ── Report Phase ──
  if (phase === "report") {
    const answered = turns.filter((t) => t.answer);
    const skillRows = reportSkillScores
      ? [
          { label: "Communication", score: reportSkillScores.communication_score ?? 0 },
          { label: "Technical", score: reportSkillScores.technical_score ?? 0 },
          { label: "System Design", score: reportSkillScores.system_design_score ?? 0 },
          { label: "Problem Solving", score: reportSkillScores.problem_solving_score ?? 0 },
          { label: "Confidence", score: reportSkillScores.confidence_score ?? 0 },
        ].map((row) => ({ ...row, score: Math.min(100, Math.max(0, Math.round(row.score))) }))
      : [];
    const { strongest, weakest } = pickStrongestAndWeakest(skillRows, (row) => row.label);
    const verdict =
      avgScore >= 85
        ? "Interview-ready. Keep the reps sharp and work on consistency under pressure."
        : avgScore >= 70
          ? "Solid foundation. Tighten the weaker dimensions and add measurable outcomes."
          : "Early signal, not a verdict. One more session will make the pattern clear.";
    const resetInterview = () => {
      setPhase("setup");
      setTurns([]);
      setSessionId(null);
      setConfig({ company: "", role: "", difficulty: "", experience: "" });
      setAiError(null);
    };

    return (
      <div className="mx-auto max-w-[1080px]">
        <div className="border-b border-border pb-7">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-4 w-4 items-center justify-center border border-primary/30 bg-primary/[0.06]">
              <CheckCircle2 className="h-2.5 w-2.5 text-primary" />
            </span>
            <span className="section-label">Session complete · Dossier no. 05</span>
          </div>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-display-lg text-foreground">
                {config.company}
                <span className="text-muted-foreground/45"> / </span>
                {config.role}
              </h1>
              <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[8.5px] uppercase tracking-[0.13em] text-muted-foreground/55">
                <span>{config.difficulty}</span>
                <span className="h-[3px] w-[3px] bg-border-strong" aria-hidden="true" />
                <span>{config.experience}</span>
                <span className="h-[3px] w-[3px] bg-border-strong" aria-hidden="true" />
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3 w-3" /> {formatTime(elapsedTime)}
                </span>
                <span className="h-[3px] w-[3px] bg-border-strong" aria-hidden="true" />
                <span>{answered.length} answers</span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link to="/analytics" className="btn-secondary btn-sm">
                Full analytics
              </Link>
              <button type="button" onClick={resetInterview} className="btn-primary btn-sm gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" />
                New interview
              </button>
            </div>
          </div>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="grid gap-9 border-b border-border py-9 lg:grid-cols-[minmax(0,1fr)_330px] lg:gap-14"
          aria-label="Overall performance"
        >
          <div>
            <div className="flex items-end gap-6">
              <p className="font-display text-[clamp(6.5rem,11vw,9rem)] font-light leading-[0.68] tracking-[-0.075em] tabular text-foreground">
                {avgScore}
              </p>
              <div className="pb-2">
                <p className="mono-label">Overall index</p>
                <p className="mt-2 font-mono text-[8.5px] uppercase tracking-[0.16em] text-accent">
                  {avgScore >= 85 ? "Interview ready" : avgScore >= 70 ? "Developing well" : "Baseline set"}
                </p>
              </div>
            </div>

            <p className="mt-8 max-w-xl font-display text-[22px] font-light leading-[1.38] tracking-[-0.02em] text-secondary-foreground">
              {verdict}
            </p>

            <div className="mt-8 flex flex-wrap gap-x-10 gap-y-4 border-t border-border pt-5">
              {strongest && (
                <div>
                  <p className="mono-label">Strongest dimension</p>
                  <p className="mt-1.5 font-display text-[19px] leading-none text-foreground">
                    {strongest.label}{" "}
                    <span className="font-body text-[11px] tabular text-muted-foreground">
                      {strongest.score}
                    </span>
                  </p>
                </div>
              )}
              {weakest && (
                <div>
                  <p className="mono-label">Clearest next gain</p>
                  <p className="mt-1.5 font-display text-[19px] leading-none text-foreground">
                    {weakest.label}{" "}
                    <span className="font-body text-[11px] tabular text-muted-foreground">
                      {weakest.score}
                    </span>
                  </p>
                </div>
              )}
              <div>
                <p className="mono-label">Time in session</p>
                <p className="mt-1.5 font-display text-[19px] leading-none tabular text-foreground">
                  {formatTime(elapsedTime)}
                </p>
              </div>
            </div>
          </div>

          <div className="self-end">
            {reportSkillScores ? (
              <SkillRadarChart analytics={reportSkillScores} />
            ) : (
              <div className="flex min-h-[300px] items-center justify-center border border-border bg-card/40 p-6 text-center">
                <div>
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground/40" />
                  <p className="mt-3 font-mono text-[8px] uppercase tracking-[0.14em] text-muted-foreground/60">
                    Building your skill profile
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.section>

        <div className="grid gap-10 border-b border-border py-9 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16">
          <section aria-label="Skill scorecard">
            <div className="flex items-baseline justify-between border-b border-border pb-3">
              <h2 className="text-headline text-foreground">Scorecard</h2>
              <span className="mono-label">Five dimensions · 0–100</span>
            </div>
            <ul className="divide-y divide-border">
              {skillRows.map((row, index) => (
                <li key={row.label} className="py-4">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="flex items-baseline gap-3.5">
                      <span className="font-mono text-[8px] text-muted-foreground/35">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="font-display text-[19px] leading-none tracking-[-0.02em] text-foreground">
                        {row.label}
                      </span>
                    </span>
                    <span className="font-display text-[20px] leading-none tabular text-foreground">
                      {row.score}
                    </span>
                  </div>
                  <div className="ml-8 mt-3 h-px bg-border">
                    <div
                      className="h-px bg-foreground/65"
                      style={{ width: `${row.score}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[10.5px] leading-4 text-muted-foreground/50">
              Aggregated with your previous sessions. Scores decay slowly toward your baseline
              when a dimension is rarely exercised.
            </p>
          </section>

          <section aria-label="Coaching note">
            <div className="flex items-baseline justify-between border-b border-border pb-3">
              <h2 className="text-headline text-foreground">Coaching note</h2>
              <span className="mono-label">Session takeaway</span>
            </div>
            <div className="pt-6">
              <p className="font-display text-[26px] font-light leading-[1.3] tracking-[-0.025em] text-foreground">
                {weakest
                  ? `Your next session should make ${weakest.label.toLowerCase()} impossible to miss.`
                  : "Your next session should make your strongest story measurable."}
              </p>
              <p className="mt-5 max-w-md text-[13px] leading-[1.75] text-muted-foreground">
                {weakest
                  ? `At ${weakest.score}/100, ${weakest.label.toLowerCase()} is carrying the most headroom. Lead every answer with the outcome, then the decision, then the detail — the structure is what the examiner hears first.`
                  : "Lead every answer with the outcome, then the decision, then the detail. The structure is what the examiner hears first."}
              </p>
              <div className="mt-7 border-t border-border pt-4">
                <Link
                  to={
                    weakest
                      ? `/interview?focus=Behavioral&difficulty=Medium`
                      : "/interview?focus=System%20Design&difficulty=Hard"
                  }
                  className="link-editorial"
                >
                  Practice the weak dimension
                  <ArrowRight className="h-3 w-3" strokeWidth={1.8} />
                </Link>
              </div>
            </div>
          </section>
        </div>

        <section className="py-9" aria-label="Question review">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-headline text-foreground">Examination notes</h2>
            <span className="mono-label">
              {answered.length} answers · expand to read
            </span>
          </div>
          <div className="mt-4 border-t border-border">
            {answered.map((turn, index) => (
              <motion.details
                key={index}
                open={index === 0}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 + index * 0.04 }}
                className="group border-b border-border"
              >
                <summary className="grid cursor-pointer list-none grid-cols-[34px_minmax(0,1fr)_auto] items-start gap-4 py-5 transition-colors hover:bg-surface-2/25 [&::-webkit-details-marker]:hidden">
                  <span className="pt-0.5 font-mono text-[9px] tracking-[0.1em] text-accent">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-[18px] leading-[1.35] tracking-[-0.015em] text-foreground">
                      {turn.question}
                    </span>
                    <span className="mt-1.5 block font-mono text-[7.5px] uppercase tracking-[0.12em] text-muted-foreground/45">
                      {(turn.strengths || []).length} strengths · {(turn.improvements || []).length} improvements
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-4">
                    <ScoreValue score={turn.score} className="text-[13px]" />
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40 transition-transform group-open:rotate-180" />
                  </span>
                </summary>

                <div className="ml-[50px] space-y-5 border-l border-border pb-6 pl-5">
                  <div>
                    <p className="mono-label mb-2">Your answer</p>
                    <p className="whitespace-pre-wrap text-[13px] leading-[1.75] text-secondary-foreground">
                      {turn.answer}
                    </p>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="mono-label text-primary/80">Examiner feedback</p>
                      <ScoreValue score={turn.score} />
                    </div>
                    <p className="text-[13px] leading-[1.75] text-muted-foreground">{turn.feedback}</p>
                  </div>

                  {((turn.strengths || []).length > 0 || (turn.improvements || []).length > 0) && (
                    <div className="flex flex-wrap gap-1.5">
                      {(turn.strengths || []).map((strength, strengthIndex) => (
                        <span key={`s-${strengthIndex}`} className="tag-success">
                          {strength}
                        </span>
                      ))}
                      {(turn.improvements || []).map((improvement, improvementIndex) => (
                        <span key={`i-${improvementIndex}`} className="tag-warning">
                          {improvement}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.details>
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-muted-foreground/45">
            Analytics update within a few seconds of completion
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={resetInterview} className="btn-secondary btn-sm gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              Start over
            </button>
            <Link to="/roadmap" className="btn-primary btn-sm gap-1.5">
              Build my roadmap
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Interview Phase ──
  const answeredCount = turns.filter((t) => t.answer).length;
  const questionNumber = Math.min(answeredCount + 1, 5);

  return (
    <div className="mx-auto max-w-[1120px]">
      <div className="mb-6 flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2.5 flex items-center gap-2.5">
            <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping bg-primary/50" />
              <span className="relative inline-flex h-1.5 w-1.5 bg-primary" />
            </span>
            <span className="section-label">Interview in progress</span>
          </div>
          <h1 className="truncate font-display text-[clamp(1.7rem,2.6vw,2.3rem)] font-light leading-none tracking-[-0.035em] text-foreground">
            {config.company}
            <span className="text-muted-foreground/40"> / </span>
            {config.role}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-5">
          <span className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">
            <Clock className="h-3.5 w-3.5" strokeWidth={1.6} />
            <span className="tabular font-medium text-foreground">{formatTime(elapsedTime)}</span>
          </span>
          <span className="h-3 w-px bg-border-strong" aria-hidden="true" />
          <span className="mono-label">
            Question {questionNumber} / 5
          </span>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_226px] lg:gap-12">
        <div className="min-w-0">
          <div className="flex gap-1.5" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-[2px] flex-1 transition-all duration-500",
                  i < answeredCount
                    ? "bg-primary"
                    : i === answeredCount
                      ? "bg-accent"
                      : "bg-border",
                )}
              />
            ))}
          </div>

          {aiError && (
            <div className="mt-5 flex items-start gap-3 border border-destructive/30 bg-destructive/[0.05] px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="flex-1 text-[12.5px] leading-5 text-destructive">{aiError}</p>
              <button
                type="button"
                onClick={() => {
                  setAiError(null);
                  submitAnswer();
                }}
                className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-destructive underline underline-offset-4 hover:no-underline"
              >
                Retry
              </button>
            </div>
          )}

          <div className="mt-8 space-y-9">
            {turns.map((turn, index) => (
              <div key={index}>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="grid grid-cols-[30px_minmax(0,1fr)] gap-4"
                >
                  <span className="pt-1.5 font-mono text-[8.5px] tracking-[0.1em] text-accent">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <p className="mono-label mb-2.5">The interviewer</p>
                    <p className="font-display text-[clamp(1.25rem,2vw,1.55rem)] font-light leading-[1.4] tracking-[-0.018em] text-foreground">
                      {turn.question}
                    </p>
                  </div>
                </motion.div>

                {turn.answer && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="ml-[46px] mt-5 space-y-5"
                  >
                    <div className="border-l border-border pl-5">
                      <p className="mono-label mb-2">Your answer</p>
                      <p className="whitespace-pre-wrap text-[13.5px] leading-[1.8] text-secondary-foreground">
                        {turn.answer}
                      </p>
                    </div>

                    {turn.feedback && (
                      <div className="border-l-2 border-accent/45 pl-5">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="mono-label text-accent">Examiner note</p>
                          <ScoreValue score={turn.score} />
                        </div>
                        <p className="text-[12.5px] leading-[1.75] text-muted-foreground">
                          {turn.feedback}
                        </p>
                        {((turn.strengths || []).length > 0 || (turn.improvements || []).length > 0) && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {(turn.strengths || []).slice(0, 2).map((strength, strengthIndex) => (
                              <span key={`s-${strengthIndex}`} className="tag-success">
                                {strength}
                              </span>
                            ))}
                            {(turn.improvements || []).slice(0, 2).map((improvement, improvementIndex) => (
                              <span key={`i-${improvementIndex}`} className="tag-warning">
                                {improvement}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            ))}
          </div>

          {isEvaluating && (
            <div className="ml-[46px] mt-7 flex items-center gap-3">
              <span className="flex items-center gap-1" aria-hidden="true">
                <span className="h-1 w-1 bg-accent typing-dot" />
                <span className="h-1 w-1 bg-accent typing-dot" />
                <span className="h-1 w-1 bg-accent typing-dot" />
              </span>
              <span className="mono-label">The examiner is reading your answer</span>
            </div>
          )}

          {currentTurn && !currentTurn.answer && !isEvaluating && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="panel-ink mt-9 overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-2.5">
                <div className="flex items-center gap-0.5 border border-sidebar-border p-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode("typing");
                      speech.stopListening();
                    }}
                    aria-pressed={inputMode === "typing"}
                    className={cn(
                      "inline-flex h-6 items-center gap-1.5 px-2.5 font-mono text-[8px] uppercase tracking-[0.12em] transition-colors",
                      inputMode === "typing"
                        ? "bg-sidebar-accent text-[hsl(var(--sidebar-accent-foreground))]"
                        : "text-sidebar-foreground/55 hover:text-[hsl(var(--sidebar-accent-foreground))]",
                    )}
                  >
                    <Keyboard className="h-3 w-3" /> Type
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!speech.isSupported) {
                        toast.error("Voice input is not supported in this browser.");
                        return;
                      }
                      setInputMode("voice");
                      speech.resetTranscript();
                    }}
                    aria-pressed={inputMode === "voice"}
                    className={cn(
                      "inline-flex h-6 items-center gap-1.5 px-2.5 font-mono text-[8px] uppercase tracking-[0.12em] transition-colors",
                      inputMode === "voice"
                        ? "bg-sidebar-accent text-[hsl(var(--sidebar-accent-foreground))]"
                        : "text-sidebar-foreground/55 hover:text-[hsl(var(--sidebar-accent-foreground))]",
                    )}
                  >
                    <AudioLines className="h-3 w-3" /> Voice
                  </button>
                </div>
                <span className="font-mono text-[7.5px] uppercase tracking-[0.12em] text-sidebar-foreground/40">
                  {inputMode === "voice" ? "Speech to text" : "⌘/Ctrl + Enter to submit"}
                </span>
              </div>

              {inputMode === "voice" && (
                <div className="flex items-center gap-4 border-b border-sidebar-border bg-sidebar-accent/20 px-4 py-3.5">
                  <button
                    type="button"
                    onClick={() => (speech.isListening ? speech.stopListening() : speech.startListening())}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full transition-all",
                      speech.isListening
                        ? "animate-recording bg-destructive text-destructive-foreground"
                        : "bg-sidebar-primary text-sidebar-primary-foreground",
                    )}
                    aria-label={speech.isListening ? "Stop recording" : "Start recording"}
                  >
                    {speech.isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                  <div>
                    <p className="text-[12px] font-medium text-[hsl(var(--sidebar-accent-foreground))]">
                      {speech.isListening ? "Listening…" : "Voice capture ready"}
                    </p>
                    <p className="mt-0.5 font-mono text-[7.5px] uppercase tracking-[0.12em] text-sidebar-foreground/45">
                      {speech.isListening ? "Speak naturally, then stop" : "Tap the mic to begin"}
                    </p>
                  </div>
                </div>
              )}

              <textarea
                ref={textareaRef}
                value={currentAnswer}
                onChange={(e) => {
                  if (inputMode === "typing") setCurrentAnswer(e.target.value);
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  inputMode === "voice"
                    ? "Your spoken answer will appear here…"
                    : "Structure your answer — situation, action, result…"
                }
                rows={6}
                readOnly={inputMode === "voice"}
                className="w-full resize-none bg-transparent px-5 py-5 text-[13.5px] leading-[1.8] text-[hsl(var(--sidebar-accent-foreground))] caret-[hsl(var(--sidebar-primary))] outline-none placeholder:text-sidebar-foreground/25"
                autoFocus={inputMode === "typing"}
              />

              <div className="flex items-center justify-between border-t border-sidebar-border bg-sidebar-accent/20 px-4 py-2.5">
                <p className="font-mono text-[7.5px] uppercase tracking-[0.12em] text-sidebar-foreground/35">
                  {currentAnswer.trim().length} characters
                </p>
                <button
                  type="button"
                  onClick={() => {
                    speech.stopListening();
                    submitAnswer();
                  }}
                  disabled={!currentAnswer.trim()}
                  className="btn-invert btn-sm gap-2"
                >
                  Submit answer
                  <Send className="h-3 w-3" />
                </button>
              </div>
            </motion.div>
          )}

          <div ref={transcriptEndRef} />
        </div>

        {/* Session rail */}
        <aside className="hidden lg:block">
          <div className="sticky top-[88px] space-y-7">
            <div>
              <p className="mono-label">Elapsed time</p>
              <p className="mt-2 font-display text-[40px] font-light leading-none tracking-[-0.05em] tabular text-foreground">
                {formatTime(elapsedTime)}
              </p>
            </div>

            <dl className="divide-y divide-border border-y border-border">
              {[
                { label: "Company", value: config.company },
                { label: "Role", value: config.role },
                { label: "Difficulty", value: config.difficulty },
                { label: "Experience", value: config.experience },
              ].map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-2 py-2.5">
                  <dt className="font-mono text-[7.5px] uppercase tracking-[0.13em] text-muted-foreground/50">
                    {row.label}
                  </dt>
                  <dd className="max-w-[130px] truncate text-right text-[10.5px] font-medium text-secondary-foreground">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>

            <div>
              <div className="flex items-baseline justify-between">
                <p className="mono-label">Running score</p>
                <span className="font-display text-[20px] leading-none tabular text-foreground">
                  {answeredCount > 0 ? avgScore : "—"}
                </span>
              </div>
              <div className="mt-3 space-y-2.5">
                {Array.from({ length: 5 }).map((_, index) => {
                  const turn = turns[index];
                  const done = turn?.score != null;
                  return (
                    <div key={index} className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center border font-mono text-[8px]",
                          done
                            ? "border-primary/30 bg-primary/[0.06] text-primary"
                            : index === answeredCount
                              ? "border-accent/50 text-accent"
                              : "border-border text-muted-foreground/30",
                        )}
                      >
                        {done ? <Check className="h-2.5 w-2.5" strokeWidth={2.6} /> : index + 1}
                      </span>
                      <span
                        className={cn(
                          "flex-1 text-[10.5px]",
                          done ? "text-secondary-foreground" : "text-muted-foreground/40",
                        )}
                      >
                        Question {index + 1}
                      </span>
                      <ScoreValue score={done ? turn?.score : undefined} className="text-[10.5px]" />
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 border-t border-border pt-3">
                <div className="flex items-center justify-between">
                  <span className="mono-label">Progress</span>
                  <span className="font-mono text-[9px] tabular text-muted-foreground">
                    {answeredCount}/5
                  </span>
                </div>
                <div className="mt-2 h-px bg-border">
                  <div
                    className="h-px bg-primary transition-[width] duration-500"
                    style={{ width: `${(answeredCount / 5) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <p className="text-[10px] leading-[1.7] text-muted-foreground/40">
              Answers are scored on relevance, structure and depth. Feedback is generated per
              question, not at the end.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
