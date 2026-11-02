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
  Zap,
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
import { ScoreRing } from "@/components/ui/metric";

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

function TypingIndicator() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-surface-2/50 px-4 py-3">
      <span className="flex items-center gap-1" aria-hidden="true">
        <span className="h-1.5 w-1.5 rounded-full bg-primary/60 typing-dot" />
        <span className="h-1.5 w-1.5 rounded-full bg-primary/60 typing-dot" />
        <span className="h-1.5 w-1.5 rounded-full bg-primary/60 typing-dot" />
      </span>
      <span className="text-[11.5px] text-muted-foreground">Evaluating your answer…</span>
    </div>
  );
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
  label,
  hint,
  items,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  items: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <div className="mb-2.5 flex items-baseline justify-between">
        <legend className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/60">
          {label}
        </legend>
        {hint && <span className="text-[10.5px] text-muted-foreground/40">{hint}</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => {
          const selected = value === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => onChange(item)}
              aria-pressed={selected}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-[7px] border px-2.5 text-[12px] font-medium transition-all duration-150",
                selected
                  ? "border-primary/35 bg-primary/10 text-primary shadow-[inset_0_1px_0_hsl(var(--primary)/0.08)]"
                  : "border-border/80 bg-surface-2/40 text-secondary-foreground hover:border-border-strong hover:text-foreground",
              )}
            >
              {selected && <Check className="h-3 w-3" strokeWidth={2.4} />}
              {item}
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
      <div className="mx-auto max-w-[980px]">
        <div className="mb-6 border-b border-border/60 pb-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-primary" aria-hidden="true" />
            <span className="section-label">New session</span>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-display-lg text-foreground">Design your interview.</h1>
              <p className="mt-2.5 max-w-xl text-[13.5px] leading-6 text-muted-foreground">
                Pick the context you're preparing for. The interviewer adapts each question to
                your last answer, then scores the full session.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground/60">
              <span className="tag-muted">5 questions</span>
              <span className="tag-muted">~20 minutes</span>
            </div>
          </div>
        </div>

        {aiError && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/25 bg-destructive/[0.06] px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="flex-1 text-[12.5px] leading-5 text-destructive">{aiError}</p>
            <button
              type="button"
              onClick={() => {
                setAiError(null);
                startInterview();
              }}
              className="shrink-0 text-[12px] font-medium text-destructive underline underline-offset-4 hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <section className="card-base" aria-label="Interview configuration">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
              <h2 className="text-headline text-foreground">Session brief</h2>
              <span className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground/45">
                {setupComplete ? "Ready" : "4 fields required"}
              </span>
            </div>

            <div className="space-y-6 p-5 sm:p-6">
              {(focus || (isResumeMode && resumeContext)) && (
                <div className="space-y-2">
                  {focus && (
                    <div className="flex items-center gap-3 rounded-lg border border-accent/20 bg-accent/[0.05] px-3.5 py-2.5">
                      <Target className="h-3.5 w-3.5 shrink-0 text-accent" />
                      <p className="text-[11.5px] text-secondary-foreground">
                        <span className="font-medium text-accent">{focus}</span> focus — questions
                        will target this interview type.
                      </p>
                    </div>
                  )}
                  {isResumeMode && resumeContext && (
                    <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/[0.05] px-3.5 py-2.5">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <p className="text-[11.5px] text-secondary-foreground">
                        <span className="font-medium text-primary">Resume-personalized</span> —{" "}
                        {(resumeContext.skills || []).length} skills detected and used for prompts.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <OptionGroup
                label="Company"
                hint="Sets tone and expectations"
                items={companies}
                value={config.company}
                onChange={(value) => setConfig((prev) => ({ ...prev, company: value }))}
              />
              <OptionGroup
                label="Role"
                hint="Drives technical depth"
                items={roles}
                value={config.role}
                onChange={(value) => setConfig((prev) => ({ ...prev, role: value }))}
              />
              <div className="grid gap-6 sm:grid-cols-2">
                <OptionGroup
                  label="Difficulty"
                  items={difficulties}
                  value={config.difficulty}
                  onChange={(value) => setConfig((prev) => ({ ...prev, difficulty: value }))}
                />
                <OptionGroup
                  label="Experience"
                  items={experiences}
                  value={config.experience}
                  onChange={(value) => setConfig((prev) => ({ ...prev, experience: value }))}
                />
              </div>
            </div>

            <div className="flex items-center gap-2.5 border-t border-border/60 bg-surface-2/35 px-5 py-3">
              <Gauge className="h-3.5 w-3.5 text-muted-foreground/50" />
              <p className="text-[11px] text-muted-foreground/70">
                Scored across communication, technical, system design, problem solving and confidence.
              </p>
            </div>
          </section>

          <aside className="lg:sticky lg:top-[78px] lg:h-fit">
            <div className="card-base overflow-hidden">
              <div className="border-b border-border/60 px-5 py-3.5">
                <h2 className="text-headline text-foreground">Before you start</h2>
              </div>
              <div className="space-y-4 p-5">
                <dl className="space-y-2.5">
                  {[
                    { label: "Company", value: config.company },
                    { label: "Role", value: config.role },
                    { label: "Difficulty", value: config.difficulty },
                    { label: "Experience", value: config.experience },
                  ].map((row) => (
                    <div key={row.label} className="flex items-baseline justify-between gap-3">
                      <dt className="text-[11.5px] text-muted-foreground">{row.label}</dt>
                      <dd
                        className={cn(
                          "truncate text-right text-[11.5px] font-medium",
                          row.value ? "text-foreground" : "text-muted-foreground/35",
                        )}
                      >
                        {row.value || "Not set"}
                      </dd>
                    </div>
                  ))}
                </dl>

                <div className="hairline" />

                <ul className="space-y-2">
                  {[
                    "Answer in full sentences — clarity is scored.",
                    "Use ⌘/Ctrl + Enter to submit an answer.",
                    "Voice input works in Chrome and Edge.",
                  ].map((tip) => (
                    <li key={tip} className="flex items-start gap-2 text-[11px] leading-4 text-muted-foreground/70">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary/70" strokeWidth={2.4} />
                      {tip}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={startInterview}
                  disabled={!setupComplete || isEvaluating}
                  className="btn-primary btn-lg w-full gap-2"
                >
                  {isEvaluating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Preparing session…
                    </>
                  ) : (
                    <>
                      Start interview
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
                <p className="text-center text-[10.5px] text-muted-foreground/45">
                  Your first question arrives in a few seconds.
                </p>
              </div>
            </div>
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
      <div className="mx-auto max-w-[980px] space-y-4">
        <div className="border-b border-border/60 pb-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-4 w-4 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
              <CheckCircle2 className="h-3 w-3 text-primary" />
            </span>
            <span className="section-label">Session complete</span>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-display-lg text-foreground">
                {config.role} at {config.company}
              </h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
                <span>{config.difficulty}</span>
                <span className="h-[3px] w-[3px] rounded-full bg-border-strong" />
                <span>{config.experience}</span>
                <span className="h-[3px] w-[3px] rounded-full bg-border-strong" />
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {formatTime(elapsedTime)}
                </span>
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

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="card-base flex flex-col justify-between p-5 sm:p-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-headline text-foreground">Overall performance</h2>
              <span className="tag-muted">{answered.length} answers</span>
            </div>
            <div className="mt-6 flex items-center gap-6">
              <ScoreRing value={avgScore} size={132} stroke={7} label="Overall" />
              <div className="min-w-0">
                <p className="text-[13px] font-medium leading-5 text-foreground">{verdict}</p>
                <div className="mt-3 space-y-1.5">
                  {strongest && (
                    <p className="text-[11.5px] text-muted-foreground">
                      Strongest:{" "}
                      <span className="font-medium text-primary">{strongest.label}</span>{" "}
                      <span className="tabular text-muted-foreground/50">{strongest.score}</span>
                    </p>
                  )}
                  {weakest && (
                    <p className="text-[11.5px] text-muted-foreground">
                      Focus next:{" "}
                      <span className="font-medium text-foreground">{weakest.label}</span>{" "}
                      <span className="tabular text-muted-foreground/50">{weakest.score}</span>
                    </p>
                  )}
                  <p className="text-[11.5px] text-muted-foreground">
                    Time: <span className="tabular text-foreground">{formatTime(elapsedTime)}</span>
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-5 gap-px overflow-hidden rounded-md border border-border/70 bg-border/70">
              {skillRows.map((row) => (
                <div key={row.label} className="bg-card px-1 py-2 text-center">
                  <p className="tabular text-[12px] font-semibold text-foreground">{row.score}</p>
                  <p className="mt-0.5 truncate px-0.5 text-[8.5px] uppercase tracking-[0.06em] text-muted-foreground/50">
                    {row.label.split(" ")[0]}
                  </p>
                </div>
              ))}
            </div>
          </motion.section>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
          >
            {reportSkillScores ? (
              <SkillRadarChart analytics={reportSkillScores} />
            ) : (
              <div className="card-base flex h-full min-h-[300px] items-center justify-center p-6 text-center">
                <div>
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground/40" />
                  <p className="mt-3 text-[12px] text-muted-foreground">Building your skill profile…</p>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        <section className="card-base overflow-hidden" aria-label="Question review">
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
            <h2 className="text-headline text-foreground">Question review</h2>
            <span className="text-[11px] text-muted-foreground/50">Expand for feedback</span>
          </div>
          <div className="divide-y divide-border/60">
            {answered.map((turn, index) => (
              <motion.details
                key={index}
                open={index === 0}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 + index * 0.04 }}
                className="group"
              >
                <summary className="flex cursor-pointer list-none items-start gap-4 px-5 py-3.5 transition-colors hover:bg-surface-2/40 [&::-webkit-details-marker]:hidden">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border/70 bg-surface-2 text-[10px] font-semibold text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-medium leading-5 text-foreground">
                      {turn.question}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground/55">
                      {(turn.strengths || []).length} strengths · {(turn.improvements || []).length} improvements
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <ScoreValue score={turn.score} />
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40 transition-transform group-open:rotate-180" />
                  </span>
                </summary>
                <div className="space-y-3 px-5 pb-5 pl-[60px]">
                  <div className="rounded-lg border border-border/60 bg-surface-2/40 p-3.5">
                    <p className="mb-1 text-[9.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground/45">
                      Your answer
                    </p>
                    <p className="text-[12px] leading-5 text-secondary-foreground">{turn.answer}</p>
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <Zap className="h-3 w-3 text-primary" />
                      <p className="text-[9.5px] font-medium uppercase tracking-[0.12em] text-primary/80">
                        Feedback
                      </p>
                    </div>
                    <p className="text-[12px] leading-5 text-muted-foreground">{turn.feedback}</p>
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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-muted-foreground/50">
            Analytics update within a few seconds of completion.
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
    <div className="mx-auto max-w-[1080px]">
      <div className="mb-4 flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            <span className="section-label">Interview in progress</span>
          </div>
          <h1 className="truncate font-display text-[19px] font-semibold tracking-[-0.025em] text-foreground">
            {config.company} · {config.role}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span className="tabular font-medium text-foreground">{formatTime(elapsedTime)}</span>
          </span>
          <span className="tag-muted">
            Question {questionNumber} of 5
          </span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0 space-y-4">
          <div className="flex gap-1" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-[3px] flex-1 rounded-full transition-all duration-500",
                  i < answeredCount
                    ? "bg-primary"
                    : i === answeredCount
                      ? "bg-primary/35"
                      : "bg-surface-3",
                )}
              />
            ))}
          </div>

          {aiError && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/25 bg-destructive/[0.06] px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="flex-1 text-[12.5px] leading-5 text-destructive">{aiError}</p>
              <button
                type="button"
                onClick={() => {
                  setAiError(null);
                  submitAnswer();
                }}
                className="shrink-0 text-[12px] font-medium text-destructive underline underline-offset-4 hover:no-underline"
              >
                Retry
              </button>
            </div>
          )}

          <div className="space-y-4">
            {turns.map((turn, index) => (
              <div key={index} className="space-y-2.5">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-start gap-3"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/[0.08] text-primary">
                    <Mic className="h-3.5 w-3.5" strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/45">
                      Interviewer · Q{index + 1}
                    </p>
                    <p className="text-[14px] leading-6 text-foreground">{turn.question}</p>
                  </div>
                </motion.div>

                {turn.answer && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="ml-10 space-y-2.5"
                  >
                    <div className="rounded-lg border border-border/60 bg-surface-2/40 p-3.5">
                      <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/40">
                        You
                      </p>
                      <p className="whitespace-pre-wrap text-[13px] leading-6 text-secondary-foreground">
                        {turn.answer}
                      </p>
                    </div>

                    {turn.feedback && (
                      <div className="rounded-lg border border-primary/15 bg-primary/[0.035] p-3.5">
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1.5">
                            <Zap className="h-3 w-3 text-primary" />
                            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-primary/80">
                              Feedback
                            </span>
                          </div>
                          <ScoreValue score={turn.score} />
                        </div>
                        <p className="text-[12.5px] leading-5 text-muted-foreground">{turn.feedback}</p>
                        {((turn.strengths || []).length > 0 || (turn.improvements || []).length > 0) && (
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
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

          {isEvaluating && <TypingIndicator />}

          {currentTurn && !currentTurn.answer && !isEvaluating && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-base overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
                <div className="flex items-center gap-1 rounded-md border border-border/70 bg-surface-2/60 p-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode("typing");
                      speech.stopListening();
                    }}
                    aria-pressed={inputMode === "typing"}
                    className={cn(
                      "inline-flex h-6 items-center gap-1.5 rounded-[5px] px-2 text-[11px] font-medium transition-colors",
                      inputMode === "typing"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
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
                      "inline-flex h-6 items-center gap-1.5 rounded-[5px] px-2 text-[11px] font-medium transition-colors",
                      inputMode === "voice"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <AudioLines className="h-3 w-3" /> Voice
                  </button>
                </div>
                <span className="text-[10.5px] text-muted-foreground/45">
                  {inputMode === "voice" ? "Speech to text" : "⌘/Ctrl + Enter to submit"}
                </span>
              </div>

              {inputMode === "voice" && (
                <div className="flex items-center gap-4 border-b border-border/60 bg-surface-2/30 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => (speech.isListening ? speech.stopListening() : speech.startListening())}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full transition-all",
                      speech.isListening
                        ? "bg-destructive text-destructive-foreground animate-recording"
                        : "bg-primary text-primary-foreground shadow-[0_0_0_4px_hsl(var(--primary)/0.1)]",
                    )}
                    aria-label={speech.isListening ? "Stop recording" : "Start recording"}
                  >
                    {speech.isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                  <div>
                    <p className="text-[12px] font-medium text-foreground">
                      {speech.isListening ? "Listening…" : "Voice capture ready"}
                    </p>
                    <p className="text-[10.5px] text-muted-foreground/60">
                      {speech.isListening ? "Speak naturally, then stop." : "Tap the mic to begin."}
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
                rows={5}
                readOnly={inputMode === "voice"}
                className="w-full resize-none bg-transparent px-4 py-3.5 text-[13px] leading-6 text-foreground outline-none placeholder:text-muted-foreground/30"
                autoFocus={inputMode === "typing"}
              />

              <div className="flex items-center justify-between border-t border-border/60 bg-surface-2/35 px-4 py-2.5">
                <p className="text-[10.5px] text-muted-foreground/50">
                  {currentAnswer.trim().length} characters
                </p>
                <button
                  type="button"
                  onClick={() => {
                    speech.stopListening();
                    submitAnswer();
                  }}
                  disabled={!currentAnswer.trim()}
                  className="btn-primary btn-sm gap-1.5"
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
          <div className="sticky top-[78px] space-y-3">
            <div className="card-base p-4">
              <p className="section-label">This session</p>
              <p className="mt-2.5 font-display text-[26px] font-semibold leading-none tracking-[-0.035em] text-foreground tabular">
                {formatTime(elapsedTime)}
              </p>
              <p className="mt-1 text-[10.5px] text-muted-foreground/50">Elapsed time</p>

              <div className="mt-4 space-y-2">
                {[
                  { label: "Company", value: config.company },
                  { label: "Role", value: config.role },
                  { label: "Difficulty", value: config.difficulty },
                  { label: "Experience", value: config.experience },
                ].map((row) => (
                  <div key={row.label} className="flex items-baseline justify-between gap-2">
                    <span className="text-[10.5px] text-muted-foreground/50">{row.label}</span>
                    <span className="truncate text-right text-[10.5px] font-medium text-secondary-foreground">
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-base p-4">
              <div className="flex items-center justify-between">
                <p className="section-label">Scores</p>
                <span className="tabular text-[11px] font-medium text-foreground">
                  {answeredCount > 0 ? `${avgScore}%` : "—"}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {Array.from({ length: 5 }).map((_, index) => {
                  const turn = turns[index];
                  const done = turn?.score != null;
                  return (
                    <div key={index} className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border text-[8px] font-semibold",
                          done
                            ? "border-primary/25 bg-primary/10 text-primary"
                            : index === answeredCount
                              ? "border-border-strong text-muted-foreground"
                              : "border-border/60 text-muted-foreground/30",
                        )}
                      >
                        {done ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : index + 1}
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
              <div className="mt-3 border-t border-border/60 pt-3">
                <div className="flex items-center justify-between text-[10.5px]">
                  <span className="text-muted-foreground/50">Progress</span>
                  <span className="tabular text-muted-foreground">{answeredCount}/5</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${(answeredCount / 5) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <p className="px-1 text-[10px] leading-4 text-muted-foreground/40">
              Answers are scored on relevance, structure and depth. Feedback is generated per
              question, not at the end.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
