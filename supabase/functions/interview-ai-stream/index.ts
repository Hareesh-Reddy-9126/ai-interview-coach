import {
  AiConfigError,
  AiProviderError,
  buildSystemPrompt,
  buildMessages,
  checkRateLimit,
  corsHeaders,
  createRequestLogger,
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
 * Chunk a finished string into word-sized SSE deltas. The evaluation already
 * contains the next question, so re-prompting the model just to animate text
 * would double the cost and could stream a different question than the one
 * that was scored.
 */
function questionChunks(question: string): string[] {
  const parts = question.match(/\S+\s*/g) ?? [question];
  const chunks: string[] = [];
  for (let index = 0; index < parts.length; index += 2) {
    chunks.push(parts.slice(index, index + 2).join(""));
  }
  return chunks;
}

/**
 * Simple deterministic hash (FNV-1a), identical to the non-streaming endpoint
 * so both paths share the same cache entries.
 */
function simpleHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(16);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * SSE stream endpoint for the interview AI.
 *
 * Instead of making the user wait 5-30s for a full AI response, this streams
 * tokens back as they're generated. The frontend renders them as they arrive,
 * giving an immediate "the interviewer is thinking" feeling.
 *
 * Cost model: one structured model call per turn, cached for 24 hours and
 * shared with the non-streaming endpoint. On a cache hit no model call is made
 * at all. The next question is sent as word deltas so the client keeps its
 * typing effect without a second generation.
 *
 * Protocol (text/event-stream):
 *   event: evaluation  data: { score, feedback, strengths, improvements }   (once, complete)
 *   event: token       data: "<text delta>"                                 (repeated while streaming)
 *   event: done        data: { nextQuestion }                               (final)
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  const log = createRequestLogger("interview-ai-stream");
  log.info("Stream request received");

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
      "interview-ai-stream",
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

    // ── Shared semantic cache ──
    // Same key shape as the non-streaming endpoint, so a turn evaluated by
    // either path is reused by the other.
    const cachePrompt = `${systemPrompt}||${conversation.at(-1)?.answer || conversation.at(-1)?.question || ""}`;
    const cacheHash = simpleHash(cachePrompt);

    const { data: cached } = await adminClient
      .from("ai_response_cache")
      .select("response")
      .eq("prompt_hash", cacheHash)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    await recordRequest(adminClient, user.id, "interview-ai-stream");

    let parsed = cached?.response ? normalizeEvaluation(cached.response) : null;
    if (parsed) {
      log.info("Cache hit, skipping NVIDIA call");
    } else {
      log.info(`Calling NVIDIA NIM, turns: ${conversation.length}`);

      const { chatCompletion, extractStructured } = await import(
        "../_shared/nvidia.ts"
      );

      const evaluationCompletion = await chatCompletion({
        messages,
        tools: [
          {
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
                      "Score from 0-100. Omit for opening question.",
                  },
                  feedback: {
                    type: "string",
                    description: "Evaluation feedback. Omit for opening question.",
                  },
                  strengths: {
                    type: "array",
                    items: { type: "string" },
                    description: "2-4 specific strengths.",
                  },
                  improvements: {
                    type: "array",
                    items: { type: "string" },
                    description: "2-4 specific improvements.",
                  },
                  nextQuestion: {
                    type: "string",
                    description: "The next interview question.",
                  },
                },
                required: ["strengths", "improvements", "nextQuestion"],
                additionalProperties: false,
              },
            },
          },
        ],
        toolChoice: {
          type: "function",
          function: { name: "evaluate_interview_turn" },
        },
        temperature: 0.6,
        maxTokens: 2048,
        timeoutMs: 45_000,
        thinking: false,
      });

      parsed = normalizeEvaluation(extractStructured(evaluationCompletion));

      if (!parsed) {
        return jsonResponse(
          { error: "AI returned an invalid response. Please try again." },
          502,
          req,
        );
      }

      // Non-fatal cache write: a failure only costs a future model call.
      try {
        const expiresAt = new Date(
          Date.now() + 24 * 60 * 60 * 1000,
        ).toISOString();
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
        // Ignore
      }
    }

    const evaluation = parsed;

    // Build an SSE stream:
    // 1. Send evaluation data immediately
    // 2. Emit the next question as word deltas for the typing effect
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        };

        try {
          send("evaluation", {
            score: evaluation.score,
            feedback: evaluation.feedback,
            strengths: evaluation.strengths,
            improvements: evaluation.improvements,
          });

          for (const chunk of questionChunks(evaluation.nextQuestion)) {
            send("token", { delta: chunk });
            await sleep(18);
          }

          send("done", { nextQuestion: evaluation.nextQuestion });
          controller.close();
        } catch (error) {
          if (error instanceof AiProviderError) {
            send("error", { message: error.message, status: error.status });
          } else {
            send("error", { message: "Stream interrupted. Please try again.", status: 500 });
          }
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        ...corsHeaders(req),
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // disable nginx buffering
      },
    });
  } catch (error) {
    if (error instanceof AiConfigError) {
      return jsonResponse(
        { error: "AI service not configured." },
        503,
        req,
      );
    }
    if (error instanceof AiProviderError) {
      return jsonResponse(
        { error: error.message },
        error.status,
        req,
      );
    }
    log.error("Unhandled stream error", error);
    return jsonResponse(
      { error: "An unexpected error occurred." },
      500,
      req,
    );
  }
});
