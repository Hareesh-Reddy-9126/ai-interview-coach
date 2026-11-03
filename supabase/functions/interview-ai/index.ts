import {
  AiConfigError,
  AiProviderError,
  buildMessages,
  buildSystemPrompt,
  chatCompletion,
  checkRateLimit,
  corsHeaders,
  createRequestLogger,
  extractStructured,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  recordRequest,
} from "../_shared/nvidia.ts";

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;

interface TurnInput {
  question?: string;
  answer?: string;
}

interface ResumeContextInput {
  skills?: string[];
  technologies?: string[];
  projects?: string[];
  experience?: string[];
}

interface InterviewRequest {
  role?: string;
  company?: string;
  experience?: string;
  difficulty?: string;
  focus?: string;
  conversation?: TurnInput[];
  resume_context?: ResumeContextInput;
}

interface InterviewEvaluation {
  score: number | null;
  feedback: string | null;
  strengths: string[];
  improvements: string[];
  nextQuestion: string;
}

const evaluationTool = {
  type: "function",
  function: {
    name: "evaluate_interview_turn",
    description:
      "Evaluate the candidate's interview answer and provide the next question",
    parameters: {
      type: "object",
      properties: {
        score: {
          type: "number",
          description:
            "Score from 0-100 for the candidate's answer. Omit this property entirely for the opening question, when there is no answer to evaluate.",
        },
        feedback: {
          type: "string",
          description:
            "Detailed evaluation feedback referencing company-specific expectations. Omit this property entirely for the opening question.",
        },
        strengths: {
          type: "array",
          items: { type: "string" },
          description:
            "2-4 specific strengths observed in the answer. Each should reference something the candidate actually said.",
        },
        improvements: {
          type: "array",
          items: { type: "string" },
          description:
            "2-4 specific, actionable improvements. Each should explain what was missing and how to improve.",
        },
        nextQuestion: {
          type: "string",
          description:
            "The next interview question. Must be specific, relevant, and build on the conversation context.",
        },
      },
      required: ["strengths", "improvements", "nextQuestion"],
      additionalProperties: false,
    },
  },
};

function normalizeEvaluation(value: unknown): InterviewEvaluation | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  const rawScore = raw.score;
  const score =
    rawScore === null || rawScore === undefined
      ? null
      : Math.max(0, Math.min(100, Math.round(Number(rawScore))));

  const feedback =
    typeof raw.feedback === "string" && raw.feedback.trim()
      ? raw.feedback
      : null;

  const toStringArray = (input: unknown): string[] =>
    Array.isArray(input)
      ? input.filter((item): item is string => typeof item === "string")
      : [];

  const nextQuestion =
    typeof raw.nextQuestion === "string" && raw.nextQuestion.trim()
      ? raw.nextQuestion
      : null;

  if (!nextQuestion) return null;

  return {
    score: Number.isFinite(score) ? score : null,
    feedback,
    strengths: toStringArray(raw.strengths),
    improvements: toStringArray(raw.improvements),
    nextQuestion,
  };
}

/**
 * Simple deterministic hash (FNV-1a) for cache keys.
 */
function simpleHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(16);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  const log = createRequestLogger("interview-ai");
  log.info("Request received");

  try {
    const body = (await req.json()) as InterviewRequest;
    const { role, company, experience, difficulty } = body;

    if (!role || !company || !difficulty) {
      return jsonResponse(
        { error: "Missing required fields: role, company, difficulty" },
        400,
        req,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authentication is required so rate limits are attributable to a user.
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
      "interview-ai",
      RATE_LIMIT,
      RATE_WINDOW_MS,
    );
    if (!allowed) {
      return jsonResponse(
        { error: "Rate limit exceeded. Max 20 interview requests per hour." },
        429,
        req,
      );
    }

    const conversation = Array.isArray(body.conversation)
      ? body.conversation
          .filter((turn) => turn && typeof turn === "object")
          .slice(-10)
      : [];

    const systemPrompt = buildSystemPrompt(
      role,
      company,
      experience ?? "unknown",
      difficulty,
      body.resume_context,
      typeof body.focus === "string" ? body.focus : undefined,
    );

    const messages = buildMessages(systemPrompt, conversation);

    // ── Semantic cache lookup ──
    // Cache key: normalized system prompt + last user message.
    // Returns cached evaluation when the same/similar interview turn
    // has already been answered, avoiding a redundant NVIDIA call.
    const cachePrompt = `${systemPrompt}||${conversation.at(-1)?.answer || conversation.at(-1)?.question || ""}`;
    const cacheHash = await simpleHash(cachePrompt);
    const { data: cached } = await adminClient
      .from("ai_response_cache")
      .select("response")
      .eq("prompt_hash", cacheHash)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (cached?.response) {
      log.info("Cache hit, skipping NVIDIA call");
      await recordRequest(adminClient, user.id, "interview-ai");
      return jsonResponse(cached.response, 200, req);
    }

    await recordRequest(adminClient, user.id, "interview-ai");
    log.info(`Calling NVIDIA NIM, turns: ${conversation.length}`);

    const completion = await chatCompletion({
      messages,
      tools: [evaluationTool],
      toolChoice: {
        type: "function",
        function: { name: "evaluate_interview_turn" },
      },
      temperature: 0.6,
      maxTokens: 2048,
      timeoutMs: 45_000,
      thinking: false,
    });

    const parsed = normalizeEvaluation(extractStructured(completion));

    if (!parsed) {
      log.warn("NVIDIA returned an unparseable evaluation payload");
      return jsonResponse(
        { error: "AI returned an invalid response. Please try again." },
        502,
        req,
      );
    }

    // ── Store in cache ──
    try {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await adminClient.from("ai_response_cache").upsert(
        {
          prompt_hash: cacheHash,
          prompt_text: cachePrompt.slice(0, 1000),
          response: parsed,
          expires_at: expiresAt,
        },
        { onConflict: "prompt_hash" },
      );
    } catch {
      // Cache write failure is non-fatal
    }

    log.info(`Success, score: ${parsed.score}`);
    return jsonResponse(parsed, 200, req);
  } catch (error) {
    if (error instanceof AiConfigError) {
      log.error("NVIDIA_API_KEY is not configured");
      return jsonResponse(
        { error: "AI service not configured. Please contact support." },
        503,
        req,
      );
    }

    if (error instanceof AiProviderError) {
      log.error(`AI provider error (${error.status}): ${error.message}`);
      const status = error.status === 429 ? 429 : error.status === 402 ? 402 : 502;
      const message =
        status === 429
          ? "Rate limit exceeded. Please wait and try again."
          : status === 402
            ? "Usage limit reached. Please try again later."
            : "AI evaluation temporarily unavailable.";
      return jsonResponse({ error: message }, status, req);
    }

    log.error("Unhandled error", error);
    return jsonResponse(
      { error: "An unexpected error occurred. Please try again." },
      500,
      req,
    );
  }
});
