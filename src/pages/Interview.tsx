import { useState, useEffect, useCallback, useRef, useMemo } from "react";

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
      const inStrengths = keywords.some(k => strengthText.includes(k));
      const inImprovements = keywords.some(k => improvementText.includes(k));
      const mentioned = keywords.some(k => text.includes(k));
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

  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : avgScore;

  return {
    communication_score: avg(skills.communication_score),
    technical_score: avg(skills.technical_score),
    system_design_score: avg(skills.system_design_score),
    problem_solving_score: avg(skills.problem_solving_score),
    confidence_score: avg(skills.confidence_score),
  };
}
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Send, ArrowRight, RotateCcw, CheckCircle, Loader2, FileText, AlertTriangle, Clock, Zap, Keyboard, AudioLines } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import SkillRadarChart from "@/components/SkillRadarChart";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

const companies = ["Google", "Amazon", "Meta", "Microsoft", "Netflix", "Apple", "Startup"];
const roles = ["Frontend Engineer", "Backend Engineer", "Full Stack Engineer", "ML Engineer", "DevOps Engineer"];
const difficulties = ["Easy", "Medium", "Hard"];
const experiences = ["Junior (0-2 yrs)", "Mid (2-5 yrs)", "Senior (5+ yrs)"];

interface Turn {
  question: string;
  answer?: string;
  score?: number | null;
  feedback?: string | null;
  strengths?: string[];
  improvements?: string[];
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 px-5 py-4">
      <div className="h-2 w-2 rounded-full bg-primary/50 typing-dot" />
      <div className="h-2 w-2 rounded-full bg-primary/50 typing-dot" />
      <div className="h-2 w-2 rounded-full bg-primary/50 typing-dot" />
      <span className="text-xs text-muted-foreground ml-2">AI is thinking...</span>
    </div>
  );
}

export default function Interview() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isResumeMode = searchParams.get("mode") === "resume";
  const [phase, setPhase] = useState<"setup" | "interview" | "report">("setup");
  const [config, setConfig] = useState({ company: "", role: "", difficulty: "", experience: "" });
  const [turns, setTurns] = useState<Turn[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [resumeContext, setResumeContext] = useState<any>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [inputMode, setInputMode] = useState<"typing" | "voice">("typing");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const speech = useSpeechRecognition();

  useEffect(() => {
    if (isResumeMode) {
      try {
        const ctx = sessionStorage.getItem("resume_context");
        if (ctx) setResumeContext(JSON.parse(ctx));
      } catch {}
    }
  }, [isResumeMode]);

  useEffect(() => {
    if (inputMode === "voice" && (speech.transcript || speech.interimTranscript)) {
      setCurrentAnswer(speech.transcript + (speech.interimTranscript ? " " + speech.interimTranscript : ""));
    }
  }, [speech.transcript, speech.interimTranscript, inputMode]);

  useEffect(() => {
    if (phase === "interview") {
      timerRef.current = setInterval(() => setElapsedTime(t => t + 1), 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    } else {
      setElapsedTime(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [phase]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const callAI = async (conversation: Turn[]) => {
    const { data, error } = await supabase.functions.invoke("interview-ai", {
      body: { role: config.role, company: config.company, experience: config.experience, difficulty: config.difficulty, conversation, resume_context: resumeContext },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const startInterview = async () => {
    setIsEvaluating(true);
    setAiError(null);
    try {
      const { data: session, error: sessionError } = await supabase
        .from("interview_sessions")
        .insert({ user_id: user!.id, role: config.role, company: config.company, difficulty: config.difficulty, experience: config.experience })
        .select().single();
      if (sessionError) throw sessionError;
      setSessionId(session.id);
      const aiResponse = await callAI([]);
      const firstQuestion = aiResponse.nextQuestion || "Tell me about yourself and your experience.";
      await supabase.from("interview_turns").insert({ session_id: session.id, turn_number: 1, question: firstQuestion });
      setTurns([{ question: firstQuestion }]);
      setPhase("interview");
    } catch (e: any) {
      setAiError(e.message || "Failed to start interview");
      toast.error(e.message || "Failed to start interview");
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
      const conversationSoFar = turns.map((t, i) => i === currentTurnIndex ? { ...t, answer: currentAnswer } : t);
      const aiResponse = await callAI(conversationSoFar);
      const updatedTurns = [...turns];
      updatedTurns[currentTurnIndex] = {
        ...updatedTurns[currentTurnIndex], answer: currentAnswer,
        score: aiResponse.score ?? 75, feedback: aiResponse.feedback ?? "Good answer.",
        strengths: aiResponse.strengths || [], improvements: aiResponse.improvements || [],
      };
      await supabase.from("interview_turns").update({
        answer: currentAnswer, score: aiResponse.score ?? 75, feedback: aiResponse.feedback,
        strengths: aiResponse.strengths || [], improvements: aiResponse.improvements || [],
      }).eq("session_id", sessionId).eq("turn_number", currentTurnIndex + 1);
      if (updatedTurns.length < 5 && aiResponse.nextQuestion) {
        updatedTurns.push({ question: aiResponse.nextQuestion });
        await supabase.from("interview_turns").insert({ session_id: sessionId, turn_number: updatedTurns.length, question: aiResponse.nextQuestion });
      }
      setTurns(updatedTurns);
      setCurrentAnswer("");
      const answeredTurns = updatedTurns.filter(t => t.answer);
      if (answeredTurns.length >= 5) {
        const avgScore = Math.round(answeredTurns.reduce((a, t) => a + (t.score || 0), 0) / answeredTurns.length);
        await supabase.from("interview_sessions").update({ status: "completed", overall_score: avgScore }).eq("id", sessionId);
        supabase.functions.invoke("compute-analytics", { body: { session_id: sessionId } }).catch(console.error);
        setPhase("report");
      }
    } catch (e: any) {
      setAiError(e.message || "AI evaluation temporarily unavailable.");
      toast.error(e.message || "AI evaluation failed.");
    } finally {
      setIsEvaluating(false);
    }
  }, [currentAnswer, sessionId, turns, isEvaluating, config, resumeContext]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitAnswer(); }
  };

  const currentTurn = turns[turns.length - 1];
  const answeredTurns = turns.filter(t => t.score != null);
  const avgScore = answeredTurns.length > 0 ? Math.round(answeredTurns.reduce((a, t) => a + (t.score || 0), 0) / answeredTurns.length) : 0;
  const [reportSkillScores, setReportSkillScores] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    if (phase === "report" && sessionId && user) {
      // Fetch real AI-computed analytics after interview completes
      supabase.from("user_analytics").select("*").eq("user_id", user.id).maybeSingle()
        .then(({ data }) => {
          if (data) {
            setReportSkillScores({
              communication_score: Number(data.communication_score) || avgScore,
              technical_score: Number(data.technical_score) || avgScore,
              system_design_score: Number(data.system_design_score) || avgScore,
              problem_solving_score: Number(data.problem_solving_score) || avgScore,
              confidence_score: Number(data.confidence_score) || avgScore,
            });
          } else {
            // Derive from per-turn AI feedback if analytics not yet computed
            const scores = deriveSkillScoresFromTurns(answeredTurns, avgScore);
            setReportSkillScores(scores);
          }
        });
    }
  }, [phase, sessionId]);

  // ── Setup Phase ──
  if (phase === "setup") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Interview Simulator</h1>
          <p className="text-sm text-muted-foreground mt-2">Configure your AI-powered mock interview</p>
        </div>

        {isResumeMode && resumeContext && (
          <div className="card-base p-4 border-primary/20 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-primary/10"><FileText className="h-4 w-4 text-primary" /></div>
            <div>
              <p className="text-sm font-semibold text-primary">Resume-Based Interview</p>
              <p className="text-xs text-muted-foreground">Personalized from your resume ({(resumeContext.skills || []).length} skills detected)</p>
            </div>
          </div>
        )}

        {aiError && (
          <div className="card-base p-4 border-destructive/20 flex items-center gap-4">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive flex-1">{aiError}</p>
            <button onClick={() => { setAiError(null); startInterview(); }} className="text-sm text-destructive font-semibold hover:underline">Retry</button>
          </div>
        )}

        <div className="card-base p-6 space-y-5">
          {[
            { label: "Company", items: companies, key: "company" as const },
            { label: "Role", items: roles, key: "role" as const },
            { label: "Difficulty", items: difficulties, key: "difficulty" as const },
            { label: "Experience Level", items: experiences, key: "experience" as const },
          ].map(({ label, items, key }) => (
            <div key={key}>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-[0.1em] mb-2.5 block">{label}</label>
              <div className="flex flex-wrap gap-2">
                {items.map(item => (
                  <button key={item} onClick={() => setConfig(p => ({ ...p, [key]: item }))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      config[key] === item ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}>{item}</button>
                ))}
              </div>
            </div>
          ))}

          <button onClick={startInterview}
            disabled={!config.company || !config.role || !config.difficulty || !config.experience || isEvaluating}
            className="w-full btn-primary py-3 disabled:opacity-40 flex items-center justify-center gap-2 font-semibold">
            {isEvaluating ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing...</> : <>Start Interview <ArrowRight className="h-4 w-4" /></>}
          </button>
        </div>
      </div>
    );
  }

  // ── Report Phase ──
  if (phase === "report") {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-3">
          <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <CheckCircle className="h-14 w-14 text-primary mx-auto" />
          </motion.div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Interview Complete</h1>
          <p className="text-sm text-muted-foreground">{formatTime(elapsedTime)} elapsed</p>
        </div>

        <div className="card-glow p-8 text-center">
          <motion.p initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="text-5xl font-bold text-primary tabular-nums tracking-tighter">{avgScore}%</motion.p>
          <p className="text-sm text-muted-foreground mt-2">Overall Score</p>
        </div>

        {reportSkillScores && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SkillRadarChart analytics={reportSkillScores} />
            <div className="card-base p-6 space-y-4">
              <h3 className="text-sm font-bold text-foreground">Skill Breakdown</h3>
              {Object.entries({
                "Communication": reportSkillScores.communication_score,
                "Technical": reportSkillScores.technical_score,
                "System Design": reportSkillScores.system_design_score,
                "Problem Solving": reportSkillScores.problem_solving_score,
                "Confidence": reportSkillScores.confidence_score,
              }).map(([name, score]) => (
                <div key={name}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground font-medium">{name}</span>
                    <span className="text-foreground font-bold tabular-nums">{Math.min(100, Math.max(0, score))}%</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                      transition={{ duration: 0.8, delay: 0.2 }} className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {turns.filter(t => t.answer).map((turn, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="card-base p-5 space-y-3">
              <div className="flex justify-between items-start gap-4">
                <p className="text-sm font-semibold text-foreground">Q{i + 1}: {turn.question}</p>
                <span className={`text-sm font-bold shrink-0 tabular-nums ${(turn.score || 0) >= 80 ? "text-primary" : (turn.score || 0) >= 60 ? "text-warning" : "text-destructive"}`}>{turn.score}%</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{turn.feedback}</p>
              <div className="flex flex-wrap gap-1.5">
                {(turn.strengths || []).map((s, j) => <span key={j} className="tag-primary text-[10px]">{s}</span>)}
                {(turn.improvements || []).map((s, j) => <span key={j} className="tag-warning text-[10px]">{s}</span>)}
              </div>
            </motion.div>
          ))}
        </div>

        <button onClick={() => { setPhase("setup"); setTurns([]); setSessionId(null); setConfig({ company: "", role: "", difficulty: "", experience: "" }); setAiError(null); }}
          className="w-full btn-secondary py-3 flex items-center justify-center gap-2 font-semibold">
          <RotateCcw className="h-4 w-4" /> Start New Interview
        </button>
      </div>
    );
  }

  // ── Interview Phase ──
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground tracking-tight">{config.company} · {config.role}</h1>
          <p className="text-xs text-muted-foreground">Interview in Progress</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span className="tabular-nums font-medium">{formatTime(elapsedTime)}</span>
          </div>
          <span className="tag-primary text-xs font-bold">Turn {Math.min(turns.filter(t => t.answer).length + 1, 5)}/5</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${
            i < turns.filter(t => t.answer).length ? "bg-primary" : i === turns.filter(t => t.answer).length ? "bg-primary/30" : "bg-secondary"
          }`} />
        ))}
      </div>

      {aiError && (
        <div className="card-base p-4 border-destructive/20 flex items-center gap-4">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm text-destructive flex-1">{aiError}</p>
          <button onClick={() => { setAiError(null); submitAnswer(); }} className="text-sm text-destructive font-semibold hover:underline">Retry</button>
        </div>
      )}

      <div className="space-y-3">
        {turns.map((turn, i) => (
          <div key={i} className="space-y-3">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-base p-5">
              <div className="flex items-start gap-4">
                <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Mic className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1 font-medium">Question {i + 1}</p>
                  <p className="text-sm text-foreground leading-relaxed">{turn.question}</p>
                </div>
              </div>
            </motion.div>
            {turn.answer && (
              <>
                <div className="card-base p-5 ml-6 border-border/50">
                  <p className="text-[11px] text-muted-foreground mb-1 font-medium">Your Answer</p>
                  <p className="text-sm text-foreground leading-relaxed">{turn.answer}</p>
                </div>
                {turn.feedback && (
                  <div className="card-glow p-5 ml-6">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Zap className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-bold text-primary">AI Feedback</span>
                      </div>
                      <span className={`text-sm font-bold tabular-nums ${(turn.score || 0) >= 80 ? "text-primary" : (turn.score || 0) >= 60 ? "text-warning" : "text-destructive"}`}>{turn.score}%</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{turn.feedback}</p>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {isEvaluating && <TypingIndicator />}

      {currentTurn && !currentTurn.answer && !isEvaluating && (
        <div className="card-base p-5 space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => { setInputMode("typing"); speech.stopListening(); }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${inputMode === "typing" ? "bg-primary text-primary-foreground" : "btn-secondary"}`}>
              <Keyboard className="h-3.5 w-3.5 inline mr-1.5" />Typing
            </button>
            <button onClick={() => { if (!speech.isSupported) { toast.error("Voice not supported."); return; } setInputMode("voice"); speech.resetTranscript(); }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${inputMode === "voice" ? "bg-primary text-primary-foreground" : "btn-secondary"}`}>
              <AudioLines className="h-3.5 w-3.5 inline mr-1.5" />Voice
            </button>
          </div>

          {inputMode === "voice" && (
            <div className="flex items-center gap-4">
              <button
                onClick={() => speech.isListening ? speech.stopListening() : speech.startListening()}
                className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all ${
                  speech.isListening ? "bg-destructive text-destructive-foreground animate-pulse shadow-lg shadow-destructive/30" : "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                }`}>
                {speech.isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              <p className="text-sm text-muted-foreground">{speech.isListening ? "Listening..." : "Click to start recording"}</p>
            </div>
          )}

          <textarea ref={textareaRef} value={currentAnswer}
            onChange={e => { if (inputMode === "typing") setCurrentAnswer(e.target.value); }}
            onKeyDown={handleKeyDown}
            placeholder={inputMode === "voice" ? "Speech appears here..." : "Type your answer here..."}
            rows={4} readOnly={inputMode === "voice"}
            className="w-full bg-transparent text-foreground placeholder:text-muted-foreground/30 resize-none focus:outline-none text-sm leading-relaxed"
            autoFocus={inputMode === "typing"} />

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground">{inputMode === "voice" ? "Speak your answer, then submit" : "⌘+Enter to submit"}</p>
            <button onClick={() => { speech.stopListening(); submitAnswer(); }} disabled={!currentAnswer.trim()}
              className="btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2 disabled:opacity-40 font-semibold">
              Submit <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
