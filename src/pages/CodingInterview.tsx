import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
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

const difficultyTone = (difficulty: string) =>
  difficulty === "Easy"
    ? "text-primary"
    : difficulty === "Medium"
      ? "text-warning"
      : "text-destructive";

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
        <div className="mb-9 flex flex-col gap-6 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <span className="h-px w-7 bg-accent" aria-hidden="true" />
              <span className="section-label">Coding lab · Three problems</span>
            </div>
            <h1 className="text-display-lg text-foreground">Solve under real conditions.</h1>
            <p className="mt-4 max-w-xl text-[14px] leading-[1.7] text-muted-foreground">
              Write a solution, run the test suite, then get an AI review of correctness,
              complexity and code quality.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4 pb-1">
            <span className="mono-label">{problems.length} problems</span>
            <span className="h-3 w-px bg-border-strong" aria-hidden="true" />
            <span className="mono-label">{easyCount} easy</span>
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_248px] lg:gap-14">
          <section aria-label="Problem set">
            <div className="flex items-baseline justify-between border-b border-border pb-3">
              <h2 className="text-headline text-foreground">Problem set</h2>
              <span className="mono-label">Select to begin</span>
            </div>
            <ul className="border-b border-border">
              {problems.map((problem, index) => (
                <li key={problem.title}>
                  <button
                    type="button"
                    onClick={() => startCoding(problem)}
                    className="group grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-5 text-left transition-colors last:border-b-0 hover:bg-surface-2/25 sm:grid-cols-[34px_minmax(0,1fr)_auto_auto] sm:gap-5"
                  >
                    <span className="font-display text-[24px] font-light leading-none tracking-[-0.03em] tabular text-muted-foreground/30">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-display text-[20px] leading-none tracking-[-0.025em] text-foreground">
                        {problem.title}
                      </span>
                      <span className="mt-2 block font-mono text-[7.5px] uppercase tracking-[0.12em] text-muted-foreground/45">
                        {problem.testCases.length} test cases
                        <span className="sm:hidden"> · {problem.difficulty}</span>
                      </span>
                    </span>
                    <span
                      className={cn(
                        "hidden font-mono text-[7.5px] uppercase tracking-[0.13em] sm:block",
                        difficultyTone(problem.difficulty),
                      )}
                    >
                      {problem.difficulty}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/25 transition-all group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <aside>
            <div className="flex items-baseline justify-between border-b border-border pb-3">
              <h2 className="text-headline text-foreground">Language</h2>
              <Terminal className="h-3.5 w-3.5 text-muted-foreground/40" strokeWidth={1.7} />
            </div>
            <div className="border-b border-border">
              {languages.map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => changeLang(lang)}
                  aria-pressed={selectedLang.id === lang.id}
                  className={cn(
                    "flex w-full items-center justify-between border-b border-border py-2.5 text-left text-[12px] transition-colors last:border-b-0",
                    selectedLang.id === lang.id
                      ? "text-foreground"
                      : "text-muted-foreground/60 hover:text-foreground",
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "h-1 w-1",
                        selectedLang.id === lang.id ? "bg-accent" : "bg-transparent",
                      )}
                      aria-hidden="true"
                    />
                    {lang.label}
                  </span>
                  {selectedLang.id === lang.id && (
                    <span className="font-mono text-[7px] uppercase tracking-[0.12em] text-accent">
                      Active
                    </span>
                  )}
                </button>
              ))}
            </div>
            <p className="mt-3 font-mono text-[7.5px] uppercase tracking-[0.12em] text-muted-foreground/40">
              Applied when you open a problem
            </p>

            <div className="mt-8">
              <p className="mono-label border-b border-border pb-3">How it works</p>
              <ol className="divide-y divide-border border-b border-border">
                {["Write your solution", "Run the provided tests", "Submit for AI review"].map(
                  (step, index) => (
                    <li key={step} className="flex items-start gap-3 py-3">
                      <span className="font-mono text-[8px] text-accent/85">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="text-[11px] leading-[1.6] text-muted-foreground/75">
                        {step}
                      </span>
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
      <div className="mx-auto max-w-[960px]">
        <div className="border-b border-border pb-7">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-4 w-4 items-center justify-center border border-primary/30 bg-primary/[0.06]">
              <CheckCircle2 className="h-2.5 w-2.5 text-primary" />
            </span>
            <span className="section-label">Review complete · Coding dossier</span>
          </div>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-display-lg text-foreground">{selectedProblem?.title}</h1>
              <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[8.5px] uppercase tracking-[0.13em] text-muted-foreground/55">
                <span>{selectedProblem?.difficulty}</span>
                <span className="h-[3px] w-[3px] bg-border-strong" aria-hidden="true" />
                <span>{selectedLang.label}</span>
                <span className="h-[3px] w-[3px] bg-border-strong" aria-hidden="true" />
                <span className="inline-flex items-center gap-1.5">
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

        <div className="mt-7 grid grid-cols-2 gap-px border-y border-border bg-border lg:grid-cols-4">
          {[
            { label: "Correctness", value: `${aiEvaluation.correctness}%`, bar: aiEvaluation.correctness },
            { label: "Code quality", value: `${aiEvaluation.codeQuality}%`, bar: aiEvaluation.codeQuality },
            { label: "Tests passed", value: `${passedCount}/${testResults.length}`, bar: passRate },
            { label: "Time", value: formatTime(elapsedTime), bar: null },
          ].map((metric) => (
            <div key={metric.label} className="bg-background px-5 py-5">
              <p className="mono-label">{metric.label}</p>
              <p className="mt-3 font-display text-[26px] font-normal leading-none tracking-[-0.035em] text-foreground tabular sm:text-[30px]">
                {metric.value}
              </p>
              {metric.bar !== null ? (
                <div className="mt-4 h-px bg-border">
                  <div
                    className={cn("h-px", barClass(metric.bar))}
                    style={{ width: `${metric.bar}%` }}
                  />
                </div>
              ) : (
                <div className="mt-4 h-px bg-border" />
              )}
            </div>
          ))}
        </div>

        <div className="grid gap-10 border-b border-border py-9 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-14">
          <section aria-label="AI review">
            <div className="flex items-baseline justify-between border-b border-border pb-3">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-accent">
                  Verdict
                </span>
                <h2 className="text-headline text-foreground">AI review</h2>
              </div>
              <Zap className="h-3.5 w-3.5 text-muted-foreground/40" strokeWidth={1.7} />
            </div>
            <p className="mt-5 font-display text-[20px] font-light leading-[1.55] tracking-[-0.02em] text-secondary-foreground">
              {aiEvaluation.feedback}
            </p>
            {aiEvaluation.optimizations.length > 0 && (
              <div className="mt-6">
                <p className="mono-label mb-3">Suggested optimizations</p>
                <ul className="divide-y divide-border border-y border-border">
                  {aiEvaluation.optimizations.map((optimization, index) => (
                    <li key={index} className="flex items-start gap-3 py-3">
                      <span className="font-mono text-[8px] text-accent/85">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="text-[12px] leading-[1.7] text-muted-foreground">
                        {optimization}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-5 grid grid-cols-2 divide-x divide-border border-y border-border">
              <div className="py-4 pr-5">
                <p className="mono-label">Time complexity</p>
                <p className="mt-2 font-mono text-[13px] text-foreground">
                  {aiEvaluation.timeComplexity}
                </p>
              </div>
              <div className="py-4 pl-5">
                <p className="mono-label">Space complexity</p>
                <p className="mt-2 font-mono text-[13px] text-foreground">
                  {aiEvaluation.spaceComplexity}
                </p>
              </div>
            </div>
          </section>

          <section aria-label="Test cases">
            <div className="flex items-baseline justify-between border-b border-border pb-3">
              <h2 className="text-headline text-foreground">Test cases</h2>
              <span className="mono-label">{passRate}% passing</span>
            </div>
            <ul className="divide-y divide-border border-b border-border">
              {testResults.map((result, index) => (
                <li key={index} className="flex items-center gap-3 py-3">
                  {result.passed ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                  )}
                  <span className="flex-1 text-[12px] text-secondary-foreground">
                    Test {index + 1}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[7.5px] uppercase tracking-[0.13em]",
                      result.passed ? "text-primary" : "text-destructive",
                    )}
                  >
                    {result.passed ? "Passed" : "Failed"}
                  </span>
                </li>
              ))}
              {testResults.length === 0 && (
                <li className="py-6 text-center text-[11.5px] text-muted-foreground/50">
                  No test results returned.
                </li>
              )}
            </ul>
          </section>
        </div>

        {aiEvaluation.suggestedAnswer && (
          <section className="py-9">
            <div className="flex items-baseline justify-between border-b border-border pb-3">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-accent">
                  Model answer
                </span>
                <h2 className="text-headline text-foreground">Reference solution</h2>
              </div>
              <span className="mono-label">{selectedLang.label}</span>
            </div>
            <pre className="mt-4 max-h-[420px] overflow-auto bg-sidebar p-5 font-mono text-[12px] leading-6 text-[hsl(var(--sidebar-accent-foreground))]/85">
              {aiEvaluation.suggestedAnswer}
            </pre>
          </section>
        )}

        <div className="flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-muted-foreground/45">
            Correctness and quality are judged by the AI reviewer
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
      <div className="mb-6 flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
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
            <div className="mb-2 flex items-center gap-2.5">
              <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping bg-primary/50" />
                <span className="relative inline-flex h-1.5 w-1.5 bg-primary" />
              </span>
              <span className="section-label">Coding session in progress</span>
            </div>
            <h1 className="truncate font-display text-[clamp(1.7rem,2.6vw,2.3rem)] font-light leading-none tracking-[-0.035em] text-foreground">
              {selectedProblem?.title}
            </h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-5">
          <span className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">
            <Clock className="h-3.5 w-3.5" strokeWidth={1.6} />
            <span className="tabular font-medium text-foreground">{formatTime(elapsedTime)}</span>
          </span>
          <span className="h-3 w-px bg-border-strong" aria-hidden="true" />
          <span className="mono-label">
            {testResults.filter((t) => t.passed).length}/
            {testResults.length || selectedProblem?.testCases.length} tests
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-3 border border-destructive/30 bg-destructive/[0.05] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="flex-1 text-[12.5px] leading-5 text-destructive">{error}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-8">
        {/* Problem panel */}
        <section className="flex max-h-[calc(100vh-190px)] min-h-[320px] flex-col border border-border bg-card/40 sm:min-h-[420px] lg:max-h-[calc(100vh-170px)]">
          <div className="flex items-baseline justify-between border-b border-border px-4 py-3">
            <div className="flex items-baseline gap-2.5">
              <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-accent">
                Brief
              </span>
              <h2 className="text-headline text-foreground">Problem</h2>
            </div>
            <span className="mono-label">
              {selectedProblem?.testCases.length} cases
            </span>
          </div>
          <div className="flex-1 space-y-6 overflow-y-auto p-4">
            <p className="text-[12.5px] leading-[1.8] text-secondary-foreground">
              {selectedProblem?.description}
            </p>

            <div>
              <p className="mono-label mb-2.5">Constraints</p>
              <ul className="space-y-1.5 border-t border-border pt-3">
                {selectedProblem?.constraints.map((constraint, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2.5 font-mono text-[10.5px] leading-[1.7] text-muted-foreground"
                  >
                    <span className="mt-[7px] h-px w-2.5 shrink-0 bg-accent/60" />
                    {constraint}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mono-label mb-2.5">Examples</p>
              <div className="divide-y divide-border border-y border-border">
                {selectedProblem?.examples.map((example, index) => (
                  <div key={index} className="space-y-1.5 py-3">
                    <p className="font-mono text-[10.5px] leading-[1.7] text-foreground">
                      <span className="text-muted-foreground/45">Input&nbsp;&nbsp;</span>
                      {example.input}
                    </p>
                    <p className="font-mono text-[10.5px] leading-[1.7] text-foreground">
                      <span className="text-muted-foreground/45">Output&nbsp;</span>
                      {example.output}
                    </p>
                    {example.explanation && (
                      <p className="text-[10px] leading-[1.6] text-muted-foreground/60">
                        {example.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {testResults.length > 0 && (
              <div>
                <p className="mono-label mb-2.5">Latest run</p>
                <div className="divide-y divide-border border-y border-border">
                  {testResults.map((result, index) => (
                    <div key={index} className="flex items-center gap-2.5 py-2">
                      {result.passed ? (
                        <CheckCircle2 className="h-3 w-3 shrink-0 text-primary" />
                      ) : (
                        <XCircle className="h-3 w-3 shrink-0 text-destructive" />
                      )}
                      <span className="flex-1 text-[11px] text-secondary-foreground">
                        Test {index + 1}
                      </span>
                      <span
                        className={cn(
                          "font-mono text-[7.5px] uppercase tracking-[0.12em]",
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
        <section className="panel-ink flex min-h-[520px] flex-col overflow-hidden lg:h-[calc(100vh-170px)]">
          <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-2.5">
            <div className="flex items-center gap-4">
              {languages.map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => changeLang(lang)}
                  aria-pressed={selectedLang.id === lang.id}
                  className={cn(
                    "relative py-1 font-mono text-[8px] uppercase tracking-[0.13em] transition-colors",
                    selectedLang.id === lang.id
                      ? "text-[hsl(var(--sidebar-accent-foreground))]"
                      : "text-sidebar-foreground/45 hover:text-sidebar-foreground/80",
                  )}
                >
                  {lang.label}
                  <span
                    className={cn(
                      "absolute inset-x-0 -bottom-[11px] h-px transition-colors",
                      selectedLang.id === lang.id ? "bg-accent" : "bg-transparent",
                    )}
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
            <span className="hidden items-center gap-1.5 font-mono text-[7px] uppercase tracking-[0.14em] text-sidebar-foreground/35 sm:flex">
              <Code2 className="h-3 w-3" />
              Monaco
            </span>
          </div>

          <div className="h-[58vh] min-h-[300px] max-h-[420px] lg:h-auto lg:max-h-none lg:flex-1">
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
                    "editor.background": "#0c1712",
                    "editor.lineHighlightBackground": "#12241c",
                    "editor.selectionBackground": "#234638",
                    "editorLineNumber.foreground": "#3d5548",
                    "editorLineNumber.activeForeground": "#a7b8ac",
                    "editorGutter.background": "#0c1712",
                    "editorCursor.foreground": "#c9a86a",
                    "editorIndentGuide.background1": "#1a2c24",
                    "editorIndentGuide.activeBackground1": "#2e463b",
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

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sidebar-border bg-sidebar-accent/20 px-4 py-3">
            <div className="flex items-center gap-2 font-mono text-[7.5px] uppercase tracking-[0.12em] text-sidebar-foreground/40">
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
                {isRunning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Run
              </button>
              <button
                type="button"
                onClick={submitSolution}
                disabled={isEvaluating || isRunning}
                className="btn-invert btn-sm gap-1.5"
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

      <p className="mt-3 text-center font-mono text-[7.5px] uppercase tracking-[0.13em] text-muted-foreground/35">
        AI evaluation typically takes a few seconds · your code is not stored after review
      </p>
    </div>
  );
}
