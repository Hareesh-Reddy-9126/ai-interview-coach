import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REQUEST_TIMEOUT_MS = 45000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[evaluate-code][${requestId}] Request received`);

  try {
    const body = await req.json();
    const { code, language, problem, action } = body;

    if (!code || !language || !problem) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const testCasesStr = (problem.testCases || []).map((tc: any, i: number) =>
      `Test ${i + 1}: Input: ${tc.input}, Expected Output: ${tc.expected}`
    ).join("\n");

    let systemPrompt: string;
    let userPrompt: string;
    let tools: any[] | undefined;
    let toolChoice: any | undefined;

    if (action === "run") {
      systemPrompt = `You are a precise code execution engine. Your job is to mentally execute the given code step-by-step for each test case and determine the exact output.

CRITICAL RULES:
- Trace through EVERY line of code literally — do not guess or approximate
- Handle edge cases exactly as the code would (off-by-one errors, null checks, type coercion)
- If the code has a bug, report what it ACTUALLY outputs, not what it should output
- For each test case, show what the code produces when run with that specific input
- Be precise about return types: [0,1] is different from "0,1" or (0,1)`;

      userPrompt = `Language: ${language}
Problem: ${problem.title}

Code to execute:
\`\`\`${language}
${code}
\`\`\`

Test Cases to run:
${testCasesStr}

Trace through the code for each test case. Determine the EXACT output.`;

      tools = [{
        type: "function",
        function: {
          name: "report_test_results",
          description: "Report the results of running code against test cases",
          parameters: {
            type: "object",
            properties: {
              testResults: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    input: { type: "string" },
                    expected: { type: "string" },
                    actual: { type: "string", description: "The actual output the code produces" },
                    passed: { type: "boolean" },
                  },
                  required: ["input", "expected", "actual", "passed"],
                  additionalProperties: false,
                },
              },
            },
            required: ["testResults"],
            additionalProperties: false,
          },
        },
      }];
      toolChoice = { type: "function", function: { name: "report_test_results" } };

    } else {
      systemPrompt = `You are a senior software engineer evaluating a coding interview solution. Provide a thorough, expert-level evaluation.

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
- Always provide a complete, working optimal solution in suggestedAnswer`;

      userPrompt = `Language: ${language}
Problem: ${problem.title}
Description: ${problem.description}
Constraints: ${(problem.constraints || []).join(", ")}

Candidate's Solution:
\`\`\`${language}
${code}
\`\`\`

Test Cases:
${testCasesStr}

Provide a comprehensive evaluation with test results, complexity analysis, and an optimal solution.`;

      tools = [{
        type: "function",
        function: {
          name: "evaluate_solution",
          description: "Provide comprehensive evaluation of a coding solution",
          parameters: {
            type: "object",
            properties: {
              testResults: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    input: { type: "string" },
                    expected: { type: "string" },
                    actual: { type: "string" },
                    passed: { type: "boolean" },
                  },
                  required: ["input", "expected", "actual", "passed"],
                  additionalProperties: false,
                },
              },
              evaluation: {
                type: "object",
                properties: {
                  timeComplexity: { type: "string", description: "e.g. O(n), O(n log n)" },
                  spaceComplexity: { type: "string", description: "e.g. O(1), O(n)" },
                  correctness: { type: "number", description: "0-100 score" },
                  codeQuality: { type: "number", description: "0-100 score" },
                  feedback: { type: "string", description: "Detailed paragraph evaluating the approach, correctness, edge cases, and style" },
                  optimizations: { type: "array", items: { type: "string" }, description: "Specific actionable optimization suggestions" },
                  suggestedAnswer: { type: "string", description: "Complete optimal solution code in the same language" },
                },
                required: ["timeComplexity", "spaceComplexity", "correctness", "codeQuality", "feedback", "optimizations", "suggestedAnswer"],
                additionalProperties: false,
              },
            },
            required: ["testResults", "evaluation"],
            additionalProperties: false,
          },
        },
      }];
      toolChoice = { type: "function", function: { name: "evaluate_solution" } };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    console.log(`[evaluate-code][${requestId}] Calling AI, action: ${action}`);

    let response;
    try {
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools,
          tool_choice: toolChoice,
        }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      if (fetchErr instanceof DOMException && fetchErr.name === "AbortError") {
        return new Response(JSON.stringify({ error: "Evaluation timed out. Please try again." }), {
          status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw fetchErr;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[evaluate-code][${requestId}] AI error: ${response.status} ${errText}`);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait and try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Code evaluation temporarily unavailable." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    // Extract from tool call
    let parsed;
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        parsed = JSON.parse(toolCall.function.arguments);
      } catch {
        console.warn(`[evaluate-code][${requestId}] Failed to parse tool call`);
      }
    }

    // Fallback to content
    if (!parsed) {
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        try {
          const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          parsed = JSON.parse(cleaned);
        } catch {
          console.warn(`[evaluate-code][${requestId}] Failed to parse content`);
        }
      }
    }

    if (!parsed) {
      return new Response(JSON.stringify({ error: "AI returned invalid response. Please try again." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clamp scores
    if (parsed.evaluation) {
      parsed.evaluation.correctness = Math.max(0, Math.min(100, Math.round(Number(parsed.evaluation.correctness) || 0)));
      parsed.evaluation.codeQuality = Math.max(0, Math.min(100, Math.round(Number(parsed.evaluation.codeQuality) || 0)));
    }

    console.log(`[evaluate-code][${requestId}] Success`);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(`[evaluate-code][${requestId}] Unhandled error:`, e);
    return new Response(JSON.stringify({ error: "An unexpected error occurred." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
