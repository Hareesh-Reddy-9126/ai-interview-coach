import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Code2,
  Loader2,
  Play,
  RotateCcw,
  Send,
  Terminal,
  XCircle,
  Zap,
} from "lucide-react";
import Editor from "@monaco-editor/react";
import { invokeFunction } from "@/lib/edge-functions";
import { cn, getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";

const languages = [
  {
    id: "javascript",
    label: "JavaScript",
    default: "function twoSum(nums, target) {\n  // Write your solution here\n  \n}",
  },
  {
    id: "python",
    label: "Python",
    default: "def two_sum(nums, target):\n    # Write your solution here\n    pass",
  },
  {
    id: "java",
    label: "Java",
    default:
      "class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Write your solution here\n        return new int[]{};\n    }\n}",
  },
  {
    id: "cpp",
    label: "C++",
    default:
      "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        // Write your solution here\n        return {};\n    }\n};",
  },
];

interface CodingProblem {
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  description: string;
  constraints: string[];
  examples: { input: string; output: string; explanation?: string }[];
  testCases: { input: string; expected: string }[];
}

const problems: CodingProblem[] = [
  {
    title: "Two Sum",
    difficulty: "Easy",
    description:
      "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.",
    constraints: ["2 ≤ nums.length ≤ 10⁴", "-10⁹ ≤ nums[i] ≤ 10⁹", "Only one valid answer exists."],
    examples: [
      { input: "nums = [2,7,11,15], target = 9", output: "[0,1]", explanation: "nums[0] + nums[1] == 9" },
      { input: "nums = [3,2,4], target = 6", output: "[1,2]" },
    ],
    testCases: [
      { input: "nums = [2,7,11,15], target = 9", expected: "[0,1]" },
      { input: "nums = [3,2,4], target = 6", expected: "[1,2]" },
      { input: "nums = [3,3], target = 6", expected: "[0,1]" },
    ],
  },
  {
    title: "Valid Parentheses",
    difficulty: "Easy",
    description:
      "Given a string `s` containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.",
    constraints: ["1 ≤ s.length ≤ 10⁴"],
    examples: [
      { input: 's = "()"', output: "true" },
      { input: 's = "(]"', output: "false" },
    ],
    testCases: [
      { input: 's = "()"', expected: "true" },
      { input: 's = "()[]{}"', expected: "true" },
      { input: 's = "(]"', expected: "false" },
      { input: 's = "{[]}"', expected: "true" },
    ],
  },
  {
    title: "Merge Two Sorted Lists",
    difficulty: "Easy",
    description: "Merge two sorted linked lists into one sorted list.",
    constraints: ["0 ≤ list length ≤ 50"],
    examples: [
      { input: "list1 = [1,2,4], list2 = [1,3,4]", output: "[1,1,2,3,4,4]" },
    ],
    testCases: [
      { input: "list1 = [1,2,4], list2 = [1,3,4]", expected: "[1,1,2,3,4,4]" },
      { input: "list1 = [], list2 = []", expected: "[]" },
    ],
  },
  {
    title: "Longest Substring Without Repeating Characters",
    difficulty: "Medium",
    description: "Find the length of the longest substring without repeating characters.",
    constraints: ["0 ≤ s.length ≤ 5 × 10⁴"],
    examples: [
      { input: 's = "abcabcbb"', output: "3" },
      { input: 's = "bbbbb"', output: "1" },
    ],
    testCases: [
      { input: 's = "abcabcbb"', expected: "3" },
      { input: 's = "bbbbb"', expected: "1" },
      { input: 's = "pwwkew"', expected: "3" },
    ],
  },
  {
    title: "LRU Cache",
    difficulty: "Hard",
    description:
      "Design a data structure that follows the constraints of a Least Recently Used (LRU) cache with O(1) operations.",
    constraints: ["1 ≤ capacity ≤ 3000"],
    examples: [
      {
        input: "LRUCache(2), put(1,1), put(2,2), get(1), put(3,3), get(2)",
        output: "1, -1",
      },
    ],
    testCases: [
      { input: "LRUCache(2), put(1,1), put(2,2), get(1)", expected: "1" },
      { input: "LRUCache(2), put(1,1), put(2,2), put(3,3), get(2)", expected: "-1" },
    ],
  },
];

interface TestResult {
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
}
interface AIEvaluation {
  timeComplexity: string;
  spaceComplexity: string;
  correctness: number;
  codeQuality: number;
  feedback: string;
  optimizations: string[];
  suggestedAnswer: string;
}

const difficultyTag = (difficulty: string) =>
  difficulty === "Easy" ? "tag-success" : difficulty === "Medium" ? "tag-warning" : "tag-destructive";

const barClass = (score: number) =>
  score >= 80 ? "bg-primary" : score >= 60 ? "bg-warning" : "bg-destructive";

export default function CodingInterview() {
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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => () => stopTimer(), []);

  const startCoding = (problem: CodingProblem) => {
    stopTimer();
    setSelectedProblem(problem);
    setCode(selectedLang.default);
    setTestResults([]);
    setAIEvaluation(null);
    setError(null);
    setPhase("coding");
    setElapsedTime(0);
    timerRef.current = setInterval(() => setElapsedTime((t) => t + 1), 1000);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  const changeLang = (lang: typeof languages[0]) => {
    setSelectedLang(lang);
    setCode(lang.default);
  };

  const runCode = useCallback(async () => {
    if (!selectedProblem || isRunning) return;
    setIsRunning(true);
    setError(null);
    try {
      const data = await invokeFunction<{ testResults?: TestResult[] }>("evaluate-code", {
        body: {
          code,
          language: selectedLang.id,
          problem: {
            title: selectedProblem.title,
            description: selectedProblem.description,
            testCases: selectedProblem.testCases,
          },
          action: "run",
        },
        fallbackMessage: "Failed to run code.",
      });
      setTestResults(data.testResults || []);
    } catch (e) {
      const message = getErrorMessage(e, "Failed to run code.");
      setError(message);
      toast.error("Code execution failed.");
    } finally {
      setIsRunning(false);
    }
  }, [code, selectedLang, selectedProblem, isRunning]);

  const submitSolution = useCallback(async () => {
    if (!selectedProblem || isEvaluating) return;
    setIsEvaluating(true);
    setError(null);
    try {
      if (testResults.length === 0) await runCode();
      const data = await invokeFunction<{ evaluation: AIEvaluation; testResults?: TestResult[] }>(
        "evaluate-code",
        {
          body: {
            code,
            language: selectedLang.id,
            problem: {
              title: selectedProblem.title,
              description: selectedProblem.description,
              testCases: selectedProblem.testCases,
              constraints: selectedProblem.constraints,
            },
            action: "evaluate",
          },
          fallbackMessage: "AI evaluation failed.",
        },
      );
      setAIEvaluation(data.evaluation);
      if (data.testResults) setTestResults(data.testResults);
      stopTimer();
      setPhase("results");
    } catch (e) {
      const message = getErrorMessage(e, "AI evaluation failed.");
      setError(message);
      toast.error("Evaluation failed.");
    } finally {
      setIsEvaluating(false);
    }
  }, [code, selectedLang, selectedProblem, isEvaluating, testResults, runCode]);

  const resetToList = () => {
    stopTimer();
    setPhase("select");
    setTestResults([]);
    setAIEvaluation(null);
    setCode(selectedLang.default);
  };

  // ── Problem selection ──
  if (phase === "select") {
    const easyCount = problems.filter((p) => p.difficulty === "Easy").length;
    return (
      <div className="mx-auto max-w-[960px]">
        <div className="mb-6 border-b border-border/60 pb-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-primary" aria-hidden="true" />
            <span className="section-label">Coding lab</span>
          </div>
          <h1 className="text-display-lg text-foreground">Solve under real conditions.</h1>
          <p className="mt-2.5 max-w-xl text-[13.5px] leading-6 text-muted-foreground">
            Write a solution, run the test suite, then get an AI review of correctness,
            complexity and code quality.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_248px]">
          <section className="card-base overflow-hidden" aria-label="Problem set">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
              <h2 className="text-headline text-foreground">Problem set</h2>
              <div className="flex items-center gap-1.5">
                <span className="tag-muted">{problems.length} problems</span>
                <span className="tag-muted hidden sm:inline-flex">{easyCount} easy</span>
              </div>
            </div>
            <ul className="divide-y divide-border/60">
              {problems.map((problem, index) => (
                <li key={problem.title}>
                  <button
                    type="button"
                    onClick={() => startCoding(problem)}
                    className="group flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-surface-2/50"
                  >
                    <span className="w-5 shrink-0 text-center font-mono text-[10.5px] text-muted-foreground/35">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-surface-2 text-muted-foreground transition-colors group-hover:border-primary/25 group-hover:text-primary">
                      <Code2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-foreground">
                        {problem.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground/55">
                        {problem.testCases.length} test cases
                      </span>
                    </span>
                    <span className={difficultyTag(problem.difficulty)}>{problem.difficulty}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/25 transition-all group-hover:translate-x-0.5 group-hover:text-muted-foreground/70" />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <aside className="space-y-3">
            <div className="card-base overflow-hidden">
              <div className="border-b border-border/60 px-4 py-3">
                <h2 className="text-headline text-foreground">Language</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground/60">
                  Applied when you open a problem
                </p>
              </div>
              <div className="space-y-1 p-2">
                {languages.map((lang) => (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => changeLang(lang)}
                    aria-pressed={selectedLang.id === lang.id}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[12px] font-medium transition-colors",
                      selectedLang.id === lang.id
                        ? "bg-primary/[0.08] text-primary"
                        : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                    )}
                  >
                    {lang.label}
                    {selectedLang.id === lang.id && (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border/50 bg-surface-2/30 p-3.5">
              <div className="mb-2 flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-muted-foreground/50" />
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/50">
                  How it works
                </p>
              </div>
              <ol className="space-y-2">
                {["Write your solution", "Run the provided tests", "Submit for AI review"].map(
                  (step, index) => (
                    <li key={step} className="flex items-start gap-2 text-[11px] leading-4 text-muted-foreground/70">
                      <span className="mt-px font-mono text-[9px] text-primary/60">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {step}
                    </li>
                  ),
                )}
              </ol>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  // ── Results ──
  if (phase === "results" && aiEvaluation) {
    const passedCount = testResults.filter((t) => t.passed).length;
    const passRate = testResults.length ? Math.round((passedCount / testResults.length) * 100) : 0;
    return (
      <div className="mx-auto max-w-[960px] space-y-4">
        <div className="border-b border-border/60 pb-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-4 w-4 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
              <CheckCircle2 className="h-3 w-3 text-primary" />
            </span>
            <span className="section-label">Review complete</span>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-display-lg text-foreground">{selectedProblem?.title}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
                <span>{selectedProblem?.difficulty}</span>
                <span className="h-[3px] w-[3px] rounded-full bg-border-strong" />
                <span>{selectedLang.label}</span>
                <span className="h-[3px] w-[3px] rounded-full bg-border-strong" />
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {formatTime(elapsedTime)}
                </span>
              </p>
            </div>
            <button type="button" onClick={resetToList} className="btn-primary btn-sm w-fit gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              Another problem
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Correctness", value: `${aiEvaluation.correctness}%`, bar: aiEvaluation.correctness },
            { label: "Code quality", value: `${aiEvaluation.codeQuality}%`, bar: aiEvaluation.codeQuality },
            { label: "Tests passed", value: `${passedCount}/${testResults.length}`, bar: passRate },
            { label: "Time", value: formatTime(elapsedTime), bar: null },
          ].map((metric) => (
            <div key={metric.label} className="card-base p-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/55">
                {metric.label}
              </p>
              <p className="mt-2 font-display text-[24px] font-semibold leading-none tracking-[-0.03em] text-foreground tabular">
                {metric.value}
              </p>
              {metric.bar !== null ? (
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={cn("h-full rounded-full", barClass(metric.bar))}
                    style={{ width: `${metric.bar}%` }}
                  />
                </div>
              ) : (
                <div className="mt-3 h-1 rounded-full bg-surface-3" />
              )}
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <section className="card-base overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3.5">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <h2 className="text-headline text-foreground">AI review</h2>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-[13px] leading-6 text-secondary-foreground">{aiEvaluation.feedback}</p>
              {aiEvaluation.optimizations.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/50">
                    Suggested optimizations
                  </p>
                  <ul className="space-y-1.5">
                    {aiEvaluation.optimizations.map((optimization, index) => (
                      <li key={index} className="flex items-start gap-2 text-[12px] leading-5 text-muted-foreground">
                        <ArrowRight className="mt-1 h-3 w-3 shrink-0 text-primary/60" />
                        {optimization}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 divide-x divide-border/60 border-t border-border/60">
              <div className="px-5 py-3">
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/50">
                  Time complexity
                </p>
                <p className="mt-1 font-mono text-[13px] text-foreground">{aiEvaluation.timeComplexity}</p>
              </div>
              <div className="px-5 py-3">
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/50">
                  Space complexity
                </p>
                <p className="mt-1 font-mono text-[13px] text-foreground">{aiEvaluation.spaceComplexity}</p>
              </div>
            </div>
          </section>

          <section className="card-base overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
              <h2 className="text-headline text-foreground">Test cases</h2>
              <span className="text-[11px] text-muted-foreground/55">{passRate}% passing</span>
            </div>
            <ul className="divide-y divide-border/60">
              {testResults.map((result, index) => (
                <li key={index} className="flex items-center gap-2.5 px-5 py-2.5">
                  {result.passed ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                  )}
                  <span className="flex-1 text-[12px] text-secondary-foreground">Test {index + 1}</span>
                  <span
                    className={cn(
                      "text-[11px] font-medium",
                      result.passed ? "text-primary" : "text-destructive",
                    )}
                  >
                    {result.passed ? "Passed" : "Failed"}
                  </span>
                </li>
              ))}
              {testResults.length === 0 && (
                <li className="px-5 py-6 text-center text-[11.5px] text-muted-foreground/50">
                  No test results returned.
                </li>
              )}
            </ul>
          </section>
        </div>

        {aiEvaluation.suggestedAnswer && (
          <section className="card-base overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
              <h2 className="text-headline text-foreground">Reference solution</h2>
              <span className="tag-muted">{selectedLang.label}</span>
            </div>
            <pre className="max-h-[420px] overflow-auto bg-[hsl(240_7%_4%)] p-5 font-mono text-[12px] leading-5 text-secondary-foreground">
              {aiEvaluation.suggestedAnswer}
            </pre>
          </section>
        )}

        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground/50">
            Correctness and quality are judged by the AI reviewer.
          </p>
          <button type="button" onClick={resetToList} className="btn-secondary btn-sm gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Back to problem set
          </button>
        </div>
      </div>
    );
  }

  // ── Coding workspace ──
  return (
    <div className="mx-auto max-w-[1320px]">
      <div className="mb-4 flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={resetToList}
            className="btn-icon -ml-1.5 shrink-0"
            aria-label="Back to problem set"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate font-display text-[17px] font-semibold tracking-[-0.02em] text-foreground">
              {selectedProblem?.title}
            </h1>
            <div className="mt-0.5 flex items-center gap-2">
              <span className={difficultyTag(selectedProblem?.difficulty || "Easy")}>
                {selectedProblem?.difficulty}
              </span>
              <span className="text-[11px] text-muted-foreground/50">{selectedLang.label}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span className="tabular font-medium text-foreground">{formatTime(elapsedTime)}</span>
          </span>
          <div className="hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
          <span className="text-[11px] text-muted-foreground/50">
            {testResults.filter((t) => t.passed).length}/{testResults.length || selectedProblem?.testCases.length} tests
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-3 flex items-start gap-3 rounded-lg border border-destructive/25 bg-destructive/[0.06] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="flex-1 text-[12.5px] leading-5 text-destructive">{error}</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* Problem panel */}
        <section className="card-base flex max-h-[calc(100vh-190px)] min-h-[420px] flex-col overflow-hidden lg:max-h-[calc(100vh-170px)]">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <h2 className="text-headline text-foreground">Problem</h2>
            <span className="text-[10.5px] text-muted-foreground/45">
              {selectedProblem?.testCases.length} cases
            </span>
          </div>
          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            <p className="text-[12.5px] leading-6 text-secondary-foreground">{selectedProblem?.description}</p>

            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/45">
                Constraints
              </p>
              <ul className="space-y-1">
                {selectedProblem?.constraints.map((constraint, index) => (
                  <li key={index} className="flex items-start gap-2 font-mono text-[11px] leading-5 text-muted-foreground">
                    <span className="text-primary/40">·</span>
                    {constraint}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/45">
                Examples
              </p>
              <div className="space-y-2">
                {selectedProblem?.examples.map((example, index) => (
                  <div key={index} className="inset-panel space-y-1 p-3">
                    <p className="font-mono text-[11px] leading-5 text-foreground">
                      <span className="text-muted-foreground/50">Input  </span>
                      {example.input}
                    </p>
                    <p className="font-mono text-[11px] leading-5 text-foreground">
                      <span className="text-muted-foreground/50">Output </span>
                      {example.output}
                    </p>
                    {example.explanation && (
                      <p className="text-[10.5px] leading-4 text-muted-foreground/60">{example.explanation}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {testResults.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/45">
                  Latest run
                </p>
                <div className="divide-y divide-border/50 overflow-hidden rounded-lg border border-border/60">
                  {testResults.map((result, index) => (
                    <div key={index} className="flex items-center gap-2 bg-surface-2/30 px-3 py-2">
                      {result.passed ? (
                        <CheckCircle2 className="h-3 w-3 shrink-0 text-primary" />
                      ) : (
                        <XCircle className="h-3 w-3 shrink-0 text-destructive" />
                      )}
                      <span className="flex-1 text-[11px] text-secondary-foreground">Test {index + 1}</span>
                      <span
                        className={cn(
                          "text-[10.5px] font-medium",
                          result.passed ? "text-primary" : "text-destructive",
                        )}
                      >
                        {result.passed ? "Passed" : "Failed"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Editor */}
        <section className="card-base flex min-h-[520px] flex-col overflow-hidden lg:h-[calc(100vh-170px)]">
          <div className="flex items-center justify-between border-b border-border/60 bg-surface-2/30 px-3 py-2">
            <div className="flex items-center gap-1">
              {languages.map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => changeLang(lang)}
                  aria-pressed={selectedLang.id === lang.id}
                  className={cn(
                    "rounded-[5px] px-2 py-1 text-[11px] font-medium transition-colors",
                    selectedLang.id === lang.id
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground/60 hover:text-foreground",
                  )}
                >
                  {lang.label}
                </button>
              ))}
            </div>
            <span className="hidden items-center gap-1 text-[10px] text-muted-foreground/35 sm:flex">
              <Code2 className="h-3 w-3" />
              Monaco
            </span>
          </div>

          <div className="h-[420px] lg:h-auto lg:flex-1">
            <Editor
              height="100%"
              language={selectedLang.id}
              value={code}
              onChange={(value) => setCode(value || "")}
              theme="interview-lab"
              beforeMount={(monaco) => {
                monaco.editor.defineTheme("interview-lab", {
                  base: "vs-dark",
                  inherit: true,
                  rules: [],
                  colors: {
                    "editor.background": "#0b0b0d",
                    "editor.lineHighlightBackground": "#141418",
                    "editor.selectionBackground": "#1f3b32",
                    "editorLineNumber.foreground": "#3a3a42",
                    "editorLineNumber.activeForeground": "#8a8a96",
                    "editorGutter.background": "#0b0b0d",
                  },
                });
              }}
              options={{
                fontSize: 13,
                minimap: { enabled: false },
                padding: { top: 16, bottom: 16 },
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                wordWrap: "on",
                tabSize: 2,
                automaticLayout: true,
                fontFamily: "'JetBrains Mono', monospace",
                renderLineHighlight: "gutter",
                scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-surface-2/30 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground/45">
              <Terminal className="h-3 w-3" />
              Runs against the provided test cases
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={runCode}
                disabled={isRunning || isEvaluating}
                className="btn-secondary btn-sm gap-1.5"
              >
                {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Run
              </button>
              <button
                type="button"
                onClick={submitSolution}
                disabled={isEvaluating || isRunning}
                className="btn-primary btn-sm gap-1.5"
              >
                {isEvaluating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {isEvaluating ? "Reviewing…" : "Submit for review"}
              </button>
            </div>
          </div>
        </section>
      </div>

      <p className="mt-3 text-center text-[10.5px] text-muted-foreground/35">
        AI evaluation typically takes a few seconds. Your code is not stored after review.
      </p>
    </div>
  );
}
