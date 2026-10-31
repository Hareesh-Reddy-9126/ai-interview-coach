import {
  AiConfigError,
  AiProviderError,
  chatCompletion,
  checkRateLimit,
  createRequestLogger,
  extractStructured,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  recordRequest,
} from "../_shared/nvidia.ts";

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const MAX_CODE_CHARS = 20_000;

interface TestCase {
  input?: string;
  expected?: string;
}

interface ProblemInput {
  title?: string;
  description?: string;
  constraints?: string[];
  testCases?: TestCase[];
}

interface EvaluateCodeRequest {
  code?: string;
  language?: string;
  problem?: ProblemInput;
  action?: string;
}

interface TestResult {
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
}

interface Evaluation {
  timeComplexity: string;
  spaceComplexity: string;
  correctness: number;
  codeQuality: number;
  feedback: string;
  optimizations: string[];
  suggestedAnswer: string;
}

const testResultSchema = {
  type: "object",
  properties: {
    input: { type: "string" },
    expected: { type: "string" },
    actual: { type: "string", description: "The actual output the code produces" },
    passed: { type: "boolean" },
  },
  required: ["input", "expected", "actual", "passed"],
  additionalProperties: false,
};

const runTool = {
  type: "function",
  function: {
    name: "report_test_results",
    description: "Report the results of running code against test cases",
    parameters: {
      type: "object",
      properties: {
        testResults: {
          type: "array",
          items: testResultSchema,
        },
      },
      required: ["testResults"],
      additionalProperties: false,
    },
  },
};

const evaluateTool = {
  type: "function",
  function: {
    name: "evaluate_solution",
    description: "Provide comprehensive evaluation of a coding solution",
    parameters: {
      type: "object",
      properties: {
        testResults: {
          type: "array",
          items: testResultSchema,
        },
        evaluation: {
          type: "object",
          properties: {
            timeComplexity: {
              type: "string",
              description: "e.g. O(n), O(n log n)",
            },
            spaceComplexity: {
              type: "string",
              description: "e.g. O(1), O(n)",
            },
            correctness: { type: "number", description: "0-100 score" },
            codeQuality: { type: "number", description: "0-100 score" },
            feedback: {
              type: "string",
              description:
                "Detailed paragraph evaluating the approach, correctness, edge cases, and style",
            },
            optimizations: {
              type: "array",
              items: { type: "string" },
              description: "Specific actionable optimization suggestions",
            },
            suggestedAnswer: {
              type: "string",
              description:
                "Complete optimal solution code in the same language",
            },
          },
          required: [
            "timeComplexity",
            "spaceComplexity",
            "correctness",
            "codeQuality",
            "feedback",
            "optimizations",
            "suggestedAnswer",
          ],
          additionalProperties: false,
        },
      },
      required: ["testResults", "evaluation"],
      additionalProperties: false,
    },
  },
};

function buildTestCases(problem: ProblemInput): string {
  return (problem.testCases ?? [])
    .map(
      (testCase, index) =>
        `Test ${index + 1}: Input: ${testCase.input ?? ""}, Expected Output: ${
          testCase.expected ?? ""
        }`,
    )
    .join("\n");
}

function clampScore(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeTestResults(value: unknown): TestResult[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const raw = item as Record<string, unknown>;
      const expected =
        typeof raw.expected === "string"
          ? raw.expected
          : String(raw.expected ?? "");
      const passed = Boolean(raw.passed);
      const reportedActual =
        typeof raw.actual === "string" ? raw.actual : String(raw.actual ?? "");
      // A passing test's actual output is by definition its expected output.
      // Failing tests with no reported output still need a concrete value so the
      // UI never renders an empty result cell.
      const actual = reportedActual.trim() ||
        (passed ? expected : "No output returned");

      return {
        input: typeof raw.input === "string" ? raw.input : String(raw.input ?? ""),
        expected,
        actual,
        passed,
      };
    });
}

function normalizeEvaluation(value: unknown): Evaluation | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  const suggestedAnswer =
    typeof raw.suggestedAnswer === "string" ? raw.suggestedAnswer : "";

  return {
    timeComplexity:
      typeof raw.timeComplexity === "string" ? raw.timeComplexity : "Unknown",
    spaceComplexity:
      typeof raw.spaceComplexity === "string" ? raw.spaceComplexity : "Unknown",
    correctness: clampScore(raw.correctness),
    codeQuality: clampScore(raw.codeQuality),
    feedback: typeof raw.feedback === "string" ? raw.feedback : "",
    optimizations: toStringArray(raw.optimizations),
    suggestedAnswer,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  const log = createRequestLogger("evaluate-code");
  log.info("Request received");

  try {
    const body = (await req.json()) as EvaluateCodeRequest;
    const { code, language, problem } = body;
    const action = body.action === "run" ? "run" : "evaluate";

    if (!code || !language || !problem) {
      return jsonResponse(
        { error: "Missing required fields: code, language, problem" },
        400,
        req,
      );
    }

    if (code.length > MAX_CODE_CHARS) {
      return jsonResponse(
        { error: `Code exceeds the ${MAX_CODE_CHARS} character limit.` },
        413,
        req,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const user = await getAuthenticatedUser(
      supabaseUrl,
      supabaseAnonKey,
      req.headers.get("Authorization"),
    );
    if (!user) {
      return jsonResponse({ error: "Unauthorized" }, 401, req);
    }

    const { createClient } = await import(
      "https://esm.sh/@supabase/supabase-js@2"
    );
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const allowed = await checkRateLimit(
      adminClient,
      user.id,
      "evaluate-code",
      RATE_LIMIT,
      RATE_WINDOW_MS,
    );
    if (!allowed) {
      return jsonResponse(
        { error: "Rate limit exceeded. Max 30 code runs per hour." },
        429,
        req,
      );
    }

    const testCasesStr = buildTestCases(problem);

    const systemPrompt =
      action === "run"
        ? `You are a precise code execution engine. Your job is to mentally execute the given code step-by-step for each test case and determine the exact output.

CRITICAL RULES:
- Trace through EVERY line of code literally — do not guess or approximate
- Handle edge cases exactly as the code would (off-by-one errors, null checks, type coercion)
- If the code has a bug, report what it ACTUALLY outputs, not what it should output
- For each test case, show what the code produces when run with that specific input
- EVERY test result MUST include a non-empty "actual" field. For a passing test, "actual" equals "expected". For a failing test, "actual" is the exact wrong output (or "undefined" / "error: <message>")
- Be precise about return types: [0,1] is different from "0,1" or (0,1)`
        : `You are a senior software engineer evaluating a coding interview solution. Provide a thorough, expert-level evaluation.

EVALUATION CRITERIA:
1. CORRECTNESS: Does the code handle all test cases, edge cases, and boundary conditions?
2. TIME COMPLEXITY: Analyze precisely — don't guess. Walk through loops and recursive calls.
3. SPACE COMPLEXITY: Account for all data structures, call stack, and temporary variables.
4. CODE QUALITY: Variable naming, readability, idiomatic usage of the language, error handling.
5. APPROACH: Is this the optimal approach? What alternatives exist?

SCORING GUIDELINES:
- correctness 0-100: 100 = all test cases pass + handles all edge cases. Deduct heavily for bugs.
- codeQuality 0-100: Variable naming, structure, comments, idiom. 80+ = clean, professional code.

FEEDBACK RULES:
- Be specific: "Your hash map approach in line 3 is O(n) which is optimal" not "Good approach"
- Reference actual code: Point to specific lines or logic
- Always provide a complete, working optimal solution in suggestedAnswer

TEST RESULT RULES:
- EVERY test result MUST include a non-empty "actual" field, including tests that pass
- For a passing test, "actual" equals "expected"; for a failing test, "actual" is the exact wrong output
- Report one result per provided test case, in the same order`;

    const userPrompt =
      action === "run"
        ? `Language: ${language}
Problem: ${problem.title ?? ""}

Code to execute:
\`\`\`${language}
${code}
\`\`\`

Test Cases to run:
${testCasesStr}

Trace through the code for each test case. Determine the EXACT output.`
        : `Language: ${language}
Problem: ${problem.title ?? ""}
Description: ${problem.description ?? ""}
Constraints: ${(problem.constraints ?? []).join(", ")}

Candidate's Solution:
\`\`\`${language}
${code}
\`\`\`

Test Cases:
${testCasesStr}

Provide a comprehensive evaluation with test results, complexity analysis, and an optimal solution.`;

    await recordRequest(adminClient, user.id, "evaluate-code");
    log.info(`Calling NVIDIA NIM, action: ${action}`);

    const completion = await chatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [action === "run" ? runTool : evaluateTool],
      toolChoice:
        action === "run"
          ? { type: "function", function: { name: "report_test_results" } }
          : { type: "function", function: { name: "evaluate_solution" } },
      temperature: action === "run" ? 0.1 : 0.3,
      maxTokens: action === "run" ? 2048 : 4096,
      timeoutMs: 45_000,
      thinking: false,
    });

    const parsed = extractStructured<Record<string, unknown>>(completion);

    if (!parsed) {
      log.warn("NVIDIA returned an unparseable payload");
      return jsonResponse(
        { error: "AI returned invalid response. Please try again." },
        502,
        req,
      );
    }

    const testResults = normalizeTestResults(parsed.testResults);

    if (action === "run") {
      log.info(`Run completed, ${testResults.length} test case(s)`);
      return jsonResponse({ testResults }, 200, req);
    }

    const evaluation = normalizeEvaluation(parsed.evaluation);
    if (!evaluation) {
      log.warn("NVIDIA omitted the evaluation object");
      return jsonResponse(
        { error: "AI returned an incomplete evaluation. Please try again." },
        502,
        req,
      );
    }

    log.info(
      `Evaluation completed, correctness: ${evaluation.correctness}, quality: ${evaluation.codeQuality}`,
    );

    return jsonResponse({ testResults, evaluation }, 200, req);
  } catch (error) {
    if (error instanceof AiConfigError) {
      log.error("NVIDIA_API_KEY is not configured");
      return jsonResponse({ error: "AI service not configured." }, 503, req);
    }

    if (error instanceof AiProviderError) {
      log.error(`AI provider error (${error.status}): ${error.message}`);
      const status = error.status === 429 ? 429 : 502;
      return jsonResponse(
        {
          error:
            status === 429
              ? "Rate limit exceeded. Please wait and try again."
              : "Code evaluation temporarily unavailable.",
        },
        status,
        req,
      );
    }

    log.error("Unhandled error", error);
    return jsonResponse(
      { error: "An unexpected error occurred." },
      500,
      req,
    );
  }
});
