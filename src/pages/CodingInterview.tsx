import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Play, Send, RotateCcw, CheckCircle, XCircle, Loader2, Code2, ChevronRight, Clock, Zap, AlertTriangle } from "lucide-react";
import Editor from "@monaco-editor/react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const languages = [
  { id: "javascript", label: "JavaScript", default: "function twoSum(nums, target) {\n  // Write your solution here\n  \n}" },
  { id: "python", label: "Python", default: "def two_sum(nums, target):\n    # Write your solution here\n    pass" },
  { id: "java", label: "Java", default: "class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Write your solution here\n        return new int[]{};\n    }\n}" },
  { id: "cpp", label: "C++", default: "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        // Write your solution here\n        return {};\n    }\n};" },
];

interface CodingProblem {
  title: string; difficulty: "Easy" | "Medium" | "Hard"; description: string;
  constraints: string[]; examples: { input: string; output: string; explanation?: string }[];
  testCases: { input: string; expected: string }[];
}

const problems: CodingProblem[] = [
  { title: "Two Sum", difficulty: "Easy", description: "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.", constraints: ["2 ≤ nums.length ≤ 10⁴", "-10⁹ ≤ nums[i] ≤ 10⁹", "Only one valid answer exists."], examples: [{ input: "nums = [2,7,11,15], target = 9", output: "[0,1]", explanation: "nums[0] + nums[1] == 9" }, { input: "nums = [3,2,4], target = 6", output: "[1,2]" }], testCases: [{ input: "nums = [2,7,11,15], target = 9", expected: "[0,1]" }, { input: "nums = [3,2,4], target = 6", expected: "[1,2]" }, { input: "nums = [3,3], target = 6", expected: "[0,1]" }] },
  { title: "Valid Parentheses", difficulty: "Easy", description: "Given a string `s` containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.", constraints: ["1 ≤ s.length ≤ 10⁴"], examples: [{ input: 's = "()"', output: "true" }, { input: 's = "(]"', output: "false" }], testCases: [{ input: 's = "()"', expected: "true" }, { input: 's = "()[]{}"', expected: "true" }, { input: 's = "(]"', expected: "false" }, { input: 's = "{[]}"', expected: "true" }] },
  { title: "Merge Two Sorted Lists", difficulty: "Easy", description: "Merge two sorted linked lists into one sorted list.", constraints: ["0 ≤ list length ≤ 50"], examples: [{ input: "list1 = [1,2,4], list2 = [1,3,4]", output: "[1,1,2,3,4,4]" }], testCases: [{ input: "list1 = [1,2,4], list2 = [1,3,4]", expected: "[1,1,2,3,4,4]" }, { input: "list1 = [], list2 = []", expected: "[]" }] },
  { title: "Longest Substring Without Repeating Characters", difficulty: "Medium", description: "Find the length of the longest substring without repeating characters.", constraints: ["0 ≤ s.length ≤ 5 × 10⁴"], examples: [{ input: 's = "abcabcbb"', output: "3" }, { input: 's = "bbbbb"', output: "1" }], testCases: [{ input: 's = "abcabcbb"', expected: "3" }, { input: 's = "bbbbb"', expected: "1" }, { input: 's = "pwwkew"', expected: "3" }] },
  { title: "LRU Cache", difficulty: "Hard", description: "Design a data structure that follows the constraints of a Least Recently Used (LRU) cache with O(1) operations.", constraints: ["1 ≤ capacity ≤ 3000"], examples: [{ input: "LRUCache(2), put(1,1), put(2,2), get(1), put(3,3), get(2)", output: "1, -1" }], testCases: [{ input: "LRUCache(2), put(1,1), put(2,2), get(1)", expected: "1" }, { input: "LRUCache(2), put(1,1), put(2,2), put(3,3), get(2)", expected: "-1" }] },
];

interface TestResult { input: string; expected: string; actual: string; passed: boolean; }
interface AIEvaluation { timeComplexity: string; spaceComplexity: string; correctness: number; codeQuality: number; feedback: string; optimizations: string[]; suggestedAnswer: string; }

export default function CodingInterview() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<"select" | "coding" | "results">("select");
  const [selectedProblem, setSelectedProblem] = useState<CodingProblem | null>(null);
  const [selectedLang, setSelectedLang] = useState(languages[0]);
  const [code, setCode] = useState(languages[0].default);
  const [isRunning, setIsRunning] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [aiEvaluation, setAIEvaluation] = useState<AIEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [timerRef, setTimerRef] = useState<ReturnType<typeof setInterval> | null>(null);

  const startCoding = (problem: CodingProblem) => {
    setSelectedProblem(problem); setCode(selectedLang.default); setTestResults([]); setAIEvaluation(null); setError(null); setPhase("coding");
    const ref = setInterval(() => setElapsedTime(t => t + 1), 1000); setTimerRef(ref); setElapsedTime(0);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  const changeLang = (lang: typeof languages[0]) => { setSelectedLang(lang); setCode(lang.default); };

  const runCode = useCallback(async () => {
    if (!selectedProblem || isRunning) return;
    setIsRunning(true); setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("evaluate-code", { body: { code, language: selectedLang.id, problem: { title: selectedProblem.title, description: selectedProblem.description, testCases: selectedProblem.testCases }, action: "run" } });
      if (fnError) throw fnError; if (data?.error) throw new Error(data.error);
      setTestResults(data.testResults || []);
    } catch (e: any) { setError(e.message || "Failed to run code."); toast.error("Code execution failed."); } finally { setIsRunning(false); }
  }, [code, selectedLang, selectedProblem, isRunning]);

  const submitSolution = useCallback(async () => {
    if (!selectedProblem || isEvaluating) return;
    setIsEvaluating(true); setError(null);
    try {
      if (testResults.length === 0) await runCode();
      const { data, error: fnError } = await supabase.functions.invoke("evaluate-code", { body: { code, language: selectedLang.id, problem: { title: selectedProblem.title, description: selectedProblem.description, testCases: selectedProblem.testCases, constraints: selectedProblem.constraints }, action: "evaluate" } });
      if (fnError) throw fnError; if (data?.error) throw new Error(data.error);
      setAIEvaluation(data.evaluation); if (data.testResults) setTestResults(data.testResults);
      if (timerRef) clearInterval(timerRef); setPhase("results");
    } catch (e: any) { setError(e.message || "AI evaluation failed."); toast.error("Evaluation failed."); } finally { setIsEvaluating(false); }
  }, [code, selectedLang, selectedProblem, isEvaluating, testResults, timerRef, runCode]);

  const difficultyColor = (d: string) => d === "Easy" ? "text-primary" : d === "Medium" ? "text-warning" : "text-destructive";
  const difficultyTag = (d: string) => d === "Easy" ? "tag-primary" : d === "Medium" ? "tag-warning" : "tag-destructive";

  if (phase === "select") {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Coding Lab</h1>
          <p className="text-sm text-muted-foreground mt-2">Select a problem and solve it with AI evaluation</p>
        </div>
        <div className="flex flex-wrap gap-2 mb-1">
          <span className="text-xs text-muted-foreground py-2 font-medium">Language:</span>
          {languages.map(lang => (
            <button key={lang.id} onClick={() => changeLang(lang)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedLang.id === lang.id ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>{lang.label}</button>
          ))}
        </div>
        <div className="space-y-2">
          {problems.map((problem, i) => (
            <motion.button key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => startCoding(problem)} className="card-interactive p-5 w-full text-left group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-secondary flex items-center justify-center">
                    <Code2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-foreground">{problem.title}</span>
                    <span className={`ml-2 ${difficultyTag(problem.difficulty)} text-[10px]`}>{problem.difficulty}</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  if (phase === "results" && aiEvaluation) {
    const passedCount = testResults.filter(t => t.passed).length;
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-3">
          <CheckCircle className="h-12 w-12 text-primary mx-auto" />
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Solution Evaluated</h1>
          <p className="text-sm text-muted-foreground">{formatTime(elapsedTime)} · {selectedProblem?.title}</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[{ l: "Correctness", v: `${aiEvaluation.correctness}%` }, { l: "Quality", v: `${aiEvaluation.codeQuality}%` }, { l: "Tests", v: `${passedCount}/${testResults.length}` }, { l: "Time", v: formatTime(elapsedTime) }].map(({ l, v }) => (
            <div key={l} className="card-base p-4 text-center">
              <p className="text-[11px] text-muted-foreground mb-1 font-medium">{l}</p>
              <p className="text-xl font-bold text-foreground tabular-nums">{v}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="card-base p-4"><p className="text-[11px] text-muted-foreground mb-1 font-medium">Time Complexity</p><p className="text-sm font-bold text-foreground font-mono">{aiEvaluation.timeComplexity}</p></div>
          <div className="card-base p-4"><p className="text-[11px] text-muted-foreground mb-1 font-medium">Space Complexity</p><p className="text-sm font-bold text-foreground font-mono">{aiEvaluation.spaceComplexity}</p></div>
        </div>
        <div className="card-glow p-5 space-y-3">
          <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /><span className="text-sm font-bold text-primary">AI Feedback</span></div>
          <p className="text-sm text-foreground leading-relaxed">{aiEvaluation.feedback}</p>
        </div>
        {aiEvaluation.optimizations.length > 0 && (
          <div className="card-base p-5 space-y-3">
            <p className="text-sm font-bold text-foreground">Suggested Optimizations</p>
            {aiEvaluation.optimizations.map((opt, i) => <p key={i} className="text-sm text-muted-foreground flex items-start gap-2"><span className="text-primary">→</span> {opt}</p>)}
          </div>
        )}
        {aiEvaluation.suggestedAnswer && (
          <div className="card-base p-5 space-y-3">
            <p className="text-sm font-bold text-foreground">Optimal Solution</p>
            <pre className="text-xs text-muted-foreground bg-secondary rounded-xl p-4 overflow-x-auto font-mono whitespace-pre-wrap">{aiEvaluation.suggestedAnswer}</pre>
          </div>
        )}
        <div className="card-base p-5 space-y-2">
          <p className="text-sm font-bold text-foreground mb-3">Test Cases</p>
          {testResults.map((result, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
              {result.passed ? <CheckCircle className="h-4 w-4 text-primary" /> : <XCircle className="h-4 w-4 text-destructive" />}
              <span className="text-sm text-foreground flex-1">Test {i + 1}</span>
              <span className={`text-xs font-bold ${result.passed ? "text-primary" : "text-destructive"}`}>{result.passed ? "Passed" : "Failed"}</span>
            </div>
          ))}
        </div>
        <button onClick={() => { setPhase("select"); setTestResults([]); setAIEvaluation(null); setCode(selectedLang.default); }}
          className="w-full btn-secondary py-3 flex items-center justify-center gap-2 font-semibold"><RotateCcw className="h-4 w-4" /> Try Another Problem</button>
      </div>
    );
  }

  // Coding phase
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <button onClick={() => { setPhase("select"); if (timerRef) clearInterval(timerRef); }} className="text-sm text-muted-foreground hover:text-foreground font-medium">← Back</button>
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">{selectedProblem?.title}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs font-bold ${difficultyColor(selectedProblem?.difficulty || "Easy")}`}>{selectedProblem?.difficulty}</span>
              <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
              <span className="text-xs text-muted-foreground">{selectedLang.label}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /><span className="tabular-nums font-medium">{formatTime(elapsedTime)}</span>
        </div>
      </div>

      {error && <div className="card-base p-4 border-destructive/20 flex items-center gap-4"><AlertTriangle className="h-5 w-5 text-destructive shrink-0" /><p className="text-sm text-destructive flex-1">{error}</p></div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-base p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          <div><p className="text-xs font-bold text-foreground mb-2 uppercase tracking-wider">Description</p><p className="text-sm text-muted-foreground leading-relaxed">{selectedProblem?.description}</p></div>
          <div><p className="text-xs font-bold text-foreground mb-2 uppercase tracking-wider">Constraints</p><ul className="space-y-1">{selectedProblem?.constraints.map((c, i) => <li key={i} className="text-xs text-muted-foreground font-mono">• {c}</li>)}</ul></div>
          <div><p className="text-xs font-bold text-foreground mb-2 uppercase tracking-wider">Examples</p>{selectedProblem?.examples.map((ex, i) => <div key={i} className="bg-secondary rounded-xl p-3 mb-2 space-y-1"><p className="text-xs font-mono text-foreground"><span className="text-muted-foreground">Input:</span> {ex.input}</p><p className="text-xs font-mono text-foreground"><span className="text-muted-foreground">Output:</span> {ex.output}</p>{ex.explanation && <p className="text-[11px] text-muted-foreground">{ex.explanation}</p>}</div>)}</div>
          {testResults.length > 0 && <div><p className="text-xs font-bold text-foreground mb-2 uppercase tracking-wider">Results</p>{testResults.map((r, i) => <div key={i} className="flex items-center gap-2 py-1.5">{r.passed ? <CheckCircle className="h-4 w-4 text-primary" /> : <XCircle className="h-4 w-4 text-destructive" />}<span className="text-sm">Test {i + 1}</span><span className={`text-xs font-bold ml-auto ${r.passed ? "text-primary" : "text-destructive"}`}>{r.passed ? "Passed" : "Failed"}</span></div>)}</div>}
        </div>

        <div className="card-base overflow-hidden flex flex-col">
          <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border bg-secondary/30">
            {languages.map(lang => <button key={lang.id} onClick={() => changeLang(lang)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedLang.id === lang.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{lang.label}</button>)}
          </div>
          <div className="flex-1 min-h-[400px]">
            <Editor height="100%" language={selectedLang.id === "cpp" ? "cpp" : selectedLang.id} value={code} onChange={val => setCode(val || "")} theme="vs-dark"
              options={{ fontSize: 13, minimap: { enabled: false }, padding: { top: 16 }, lineNumbers: "on", scrollBeyondLastLine: false, wordWrap: "on", tabSize: 2, automaticLayout: true }} />
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-secondary/30">
            <button onClick={runCode} disabled={isRunning || isEvaluating} className="btn-secondary px-4 py-2 text-sm inline-flex items-center gap-2 disabled:opacity-40 font-semibold">
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Run
            </button>
            <button onClick={submitSolution} disabled={isEvaluating || isRunning} className="btn-primary px-4 py-2 text-sm inline-flex items-center gap-2 disabled:opacity-40 font-semibold">
              {isEvaluating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
