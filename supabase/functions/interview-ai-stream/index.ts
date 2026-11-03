import {
  AiConfigError,
  AiProviderError,
  buildSystemPrompt,
  buildMessages,
  chatCompletionStream,
  checkRateLimit,
  corsHeaders,
  createRequestLogger,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  recordRequest,
  type ChatMessage,
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
 * SSE stream endpoint for the interview AI.
 *
 * Instead of making the user wait 5-30s for a full AI response, this streams
 * tokens back as they're generated. The frontend renders them as they arrive,
 * giving an immediate "the interviewer is thinking" feeling.
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

    await recordRequest(adminClient, user.id, "interview-ai-stream");
    log.info(`Streaming NVIDIA NIM, turns: ${conversation.length}`);

    // First, get a complete structured evaluation (non-streaming, with tools)
    // so we have scores + feedback immediately.
    // Then stream the nextQuestion text for the typing effect.

    // We can't import chatCompletion (non-streaming) from shared without
    // duplicating logic, so we do a direct non-streaming fetch here for the
    // evaluation, then stream the question text.
    const { chatCompletion } = await import("../_shared/nvidia.ts");

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

    const { extractStructured } = await import("../_shared/nvidia.ts");
    const parsed = normalizeEvaluation(extractStructured(evaluationCompletion));

    if (!parsed) {
      return jsonResponse(
        { error: "AI returned an invalid response. Please try again." },
        502,
        req,
      );
    }

    // Build an SSE stream:
    // 1. Send evaluation data immediately
    // 2. Stream nextQuestion tokens
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        };

        try {
          // Send evaluation first
          send("evaluation", {
            score: parsed.score,
            feedback: parsed.feedback,
            strengths: parsed.strengths,
            improvements: parsed.improvements,
          });

          // Now stream the nextQuestion text.
          // We re-prompt the model without tools to get natural language output
          // that we can stream token by token.
          const streamMessages: ChatMessage[] = [
            { role: "system", content: systemPrompt },
            ...messages.slice(1), // skip the system prompt (already included)
            {
              role: "user",
              content:
                "Output ONLY the next interview question as plain text. No JSON, no markdown, no labels. Just the question.",
            },
          ];

          const streamGen = chatCompletionStream({
            messages: streamMessages,
            temperature: 0.7,
            maxTokens: 1024,
            timeoutMs: 45_000,
            thinking: false,
          });

          let fullQuestion = "";
          for await (const delta of streamGen) {
            fullQuestion += delta;
            send("token", { delta });
          }

          send("done", { nextQuestion: fullQuestion.trim() || parsed.nextQuestion });
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
