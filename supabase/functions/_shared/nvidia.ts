/**
 * Shared NVIDIA NIM client for Supabase Edge Functions.
 *
 * NVIDIA NIM exposes an OpenAI-compatible Chat Completions API at
 * https://integrate.api.nvidia.com/v1. All AI features route through this
 * module so provider details, retries, timeouts and JSON parsing live in one
 * place.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const NVIDIA_BASE_URL =
  Deno.env.get("NVIDIA_BASE_URL") ?? "https://integrate.api.nvidia.com/v1";

/** Primary reasoning model (Nemotron 3.5 Super VL, 120B total / 12B active). */
export const NVIDIA_MODEL =
  Deno.env.get("NVIDIA_MODEL") ?? "nvidia/nemotron-3.5-super-vl-120b-a12b";

/** Fallback model used if the primary endpoint/model is unavailable. */
export const NVIDIA_FALLBACK_MODEL =
  Deno.env.get("NVIDIA_FALLBACK_MODEL") ?? "nvidia/nemotron-3-ultra-550b-a55b";

const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_ATTEMPTS = 2;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class AiConfigError extends Error {
  constructor(message = "AI service is not configured.") {
    super(message);
    this.name = "AiConfigError";
  }
}

export class AiProviderError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "AiProviderError";
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

const DEFAULT_ALLOWED_HEADERS = [
  "authorization",
  "x-client-info",
  "apikey",
  "content-type",
  "x-supabase-client-platform",
  "x-supabase-client-platform-version",
  "x-supabase-client-runtime",
  "x-supabase-client-runtime-version",
].join(", ");

function allowedOrigins(): string[] {
  const configured =
    Deno.env.get("CORS_ALLOWED_ORIGINS") ??
    Deno.env.get("SITE_URL") ??
    "*";
  return configured
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * Build CORS headers for a request. In production set CORS_ALLOWED_ORIGINS to a
 * comma-separated allowlist (e.g. "https://app.example.com,https://example.com").
 */
export function corsHeaders(req?: Request): Record<string, string> {
  const origins = allowedOrigins();
  const requestOrigin = req?.headers.get("origin") ?? "";
  const wildcard = origins.includes("*");
  const originAllowed = wildcard || origins.includes(requestOrigin);

  return {
    "Access-Control-Allow-Origin": wildcard
      ? "*"
      : originAllowed
        ? requestOrigin
        : origins[0] ?? "null",
    "Access-Control-Allow-Headers": DEFAULT_ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function jsonResponse(
  body: unknown,
  status = 200,
  req?: Request,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export function optionsResponse(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

// ---------------------------------------------------------------------------
// Chat Completions
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  tools?: unknown[];
  toolChoice?: unknown;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  timeoutMs?: number;
  model?: string;
  fallbackModel?: string;
  /** Enable Nemotron's reasoning trace (disabled by default for latency). */
  thinking?: boolean;
}

interface RawChoiceMessage {
  content?: string | null;
  tool_calls?: Array<{
    id?: string;
    type?: string;
    function?: { name?: string; arguments?: string };
  }>;
}

interface RawCompletion {
  choices?: Array<{ message?: RawChoiceMessage }>;
  error?: { message?: string };
}

interface RawStreamChunk {
  choices?: Array<{ delta?: RawChoiceMessage; index?: number }>;
  error?: { message?: string };
}

/**
 * Call NVIDIA NIM with Server-Sent Events streaming.
 *
 * Yields text delta strings as they arrive from the model.
 * Falls back to the fallback model on hard failures (not mid-stream).
 */
export async function* chatCompletionStream(
  options: ChatCompletionOptions,
): AsyncGenerator<string, void, unknown> {
  const apiKey = Deno.env.get("NVIDIA_API_KEY");
  if (!apiKey) throw new AiConfigError();

  const model = options.model ?? NVIDIA_MODEL;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
      body: JSON.stringify({
        ...buildRequestBody(model, options),
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new AiProviderError(
        `NVIDIA stream failed (${response.status}): ${errorText.slice(0, 400)}`,
        response.status,
      );
    }

    const reader = response.body?.getReader();
    if (!reader) throw new AiProviderError("No response body from NVIDIA.", 502);

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // keep incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === ":") continue; // heartbeat or blank
          if (trimmed.startsWith(":")) continue; // comment
          if (!trimmed.startsWith("data:")) continue;

          const data = trimmed.slice(5).trimStart();
          if (data === "[DONE]") return;

          try {
            const parsed = JSON.parse(data) as RawStreamChunk;
            const delta = parsed.choices?.[0]?.delta;
            const content = delta?.content;
            if (typeof content === "string" && content.length > 0) {
              yield content;
            }
          } catch {
            // malformed chunk — skip
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } finally {
    clearTimeout(timeout);
  }
}

function buildRequestBody(
  model: string,
  options: ChatCompletionOptions,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages: options.messages,
    temperature: options.temperature ?? 0.6,
    top_p: options.topP ?? 0.95,
    max_tokens: options.maxTokens ?? 4096,
  };

  if (options.tools?.length) {
    body.tools = options.tools;
    body.tool_choice = options.toolChoice ?? "auto";
  }

  // Only send Nemotron-specific template kwargs when explicitly requested.
  if (options.thinking !== undefined) {
    body.chat_template_kwargs = { enable_thinking: options.thinking };
  }

  return body;
}

async function requestCompletion(
  model: string,
  options: ChatCompletionOptions,
  apiKey: string,
): Promise<RawCompletion> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(buildRequestBody(model, options)),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new AiProviderError(
        `NVIDIA request failed (${response.status}): ${errorText.slice(0, 400)}`,
        response.status,
      );
    }

    return (await response.json()) as RawCompletion;
  } finally {
    clearTimeout(timeout);
  }
}

function isRetryable(error: unknown): boolean {
  if (error instanceof AiProviderError) {
    return [408, 429, 500, 502, 503, 504].includes(error.status);
  }
  return error instanceof TypeError; // network failure
}

function abortToProviderError(error: unknown): AiProviderError {
  if (error instanceof DOMException && error.name === "AbortError") {
    return new AiProviderError("AI request timed out. Please try again.", 504);
  }
  return new AiProviderError("AI provider is temporarily unavailable.", 502);
}

/**
 * Call NVIDIA NIM with retries and an automatic fallback model.
 *
 * Returns the raw OpenAI-compatible completion object.
 */
export async function chatCompletion(
  options: ChatCompletionOptions,
): Promise<RawCompletion> {
  const apiKey = Deno.env.get("NVIDIA_API_KEY");
  if (!apiKey) throw new AiConfigError();

  const primary = options.model ?? NVIDIA_MODEL;
  const fallback = options.fallbackModel ?? NVIDIA_FALLBACK_MODEL;

  const models = primary === fallback ? [primary] : [primary, fallback];
  let lastError: unknown;

  for (const model of models) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await requestCompletion(model, options, apiKey);
      } catch (error) {
        lastError = error;
        if (!isRetryable(error) || attempt === MAX_ATTEMPTS) break;
        await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
      }
    }

    // Only fall through to the fallback model for availability problems.
    if (!isRetryable(lastError)) break;
  }

  if (lastError instanceof AiProviderError) throw lastError;
  throw abortToProviderError(lastError);
}

// ---------------------------------------------------------------------------
// Structured output parsing
// ---------------------------------------------------------------------------

/**
 * Extract a structured JSON value from an OpenAI-compatible completion.
 * Handles tool calls, plain JSON, fenced JSON and prose-wrapped JSON.
 */
export function extractStructured<T>(completion: RawCompletion): T | null {
  const message = completion?.choices?.[0]?.message;
  if (!message) return null;

  const toolArguments = message.tool_calls?.[0]?.function?.arguments;
  if (typeof toolArguments === "string" && toolArguments.trim()) {
    try {
      return JSON.parse(toolArguments) as T;
    } catch {
      // fall through to content parsing
    }
  }

  const content = message.content;
  if (typeof content !== "string" || !content.trim()) return null;

  const cleaned = content
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Rate limiting (service-role client)
// ---------------------------------------------------------------------------

/**
 * Minimal structural type for the Supabase client used by the shared
 * rate-limit helpers. The concrete client is created dynamically inside each
 * function, so only the query surface used here needs to be typed.
 */
interface RateLimitQuery extends PromiseLike<{ count: number | null }> {
  eq: (column: string, value: string) => RateLimitQuery;
  gte: (column: string, value: string) => PromiseLike<{ count: number | null }>;
}

interface SupabaseAdmin {
  from: (table: string) => {
    select: (
      columns?: string,
      options?: {
        count?: "exact" | "planned" | "estimated";
        head?: boolean;
      },
    ) => RateLimitQuery;
    insert: (values: Record<string, unknown>) => PromiseLike<unknown>;
  };
}

export async function checkRateLimit(
  supabase: SupabaseAdmin,
  userId: string,
  endpoint: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMs).toISOString();
  const { count } = await supabase
    .from("rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("endpoint", endpoint)
    .gte("window_start", windowStart);

  return (count ?? 0) < limit;
}

export async function recordRequest(
  supabase: SupabaseAdmin,
  userId: string,
  endpoint: string,
): Promise<void> {
  await supabase.from("rate_limits").insert({
    user_id: userId,
    endpoint,
    window_start: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

/**
 * Resolve the caller from the Authorization header using the anon client.
 * Returns null when the token is missing or invalid.
 */
export async function getAuthenticatedUser(
  supabaseUrl: string,
  supabaseAnonKey: string,
  authHeader: string | null,
): Promise<AuthenticatedUser | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;

  // Import lazily so cold starts stay fast for unauthenticated paths.
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? undefined };
}

// ---------------------------------------------------------------------------
// Prompt construction (shared by the streaming and non-streaming endpoints)
// ---------------------------------------------------------------------------

export interface TurnInput {
  question?: string;
  answer?: string;
}

export interface ResumeContextInput {
  skills?: string[];
  technologies?: string[];
  projects?: string[];
  experience?: string[];
}

const companyContext: Record<string, string> = {
  Amazon: `You embody Amazon's Leadership Principles culture. Frame every behavioral question around a specific LP (Customer Obsession, Ownership, Invent and Simplify, Are Right A Lot, Learn and Be Curious, Hire and Develop the Best, Insist on the Highest Standards, Think Big, Bias for Action, Frugality, Earn Trust, Dive Deep, Have Backbone, Deliver Results). Always name the LP you're testing. Expect STAR-format answers and probe for missing elements (Situation, Task, Action, Result with quantified impact). Push for "Tell me about a time when..." style questions.`,
  Google: `You embody Google's engineering culture: Googleyness, intellectual curiosity, and strong CS fundamentals. Focus heavily on algorithmic thinking, system design at massive scale (billions of users), and the ability to discuss trade-offs rigorously. Ask candidates to analyze time/space complexity, discuss alternative approaches, and think about edge cases. Value elegant, simple solutions over complex ones. Probe for "How would you handle 10x the scale?"`,
  Meta: `You embody Meta's engineering culture: Move Fast, Be Bold, Focus on Impact, Build Social Value. Prioritize product sense — ask "How would this feature impact 3 billion users?" Focus on coding efficiency, clean architecture, and the ability to ship quickly. Test infrastructure thinking and understanding of social/collaborative systems. Value engineers who think about user impact metrics.`,
  Microsoft: `You embody Microsoft's Growth Mindset culture. Evaluate collaboration skills, inclusive design thinking, and technical depth across the full stack. Ask about how candidates learn from failures. Test cloud/distributed systems knowledge. Value clear communication and the ability to break down complex problems for diverse audiences. Probe for cross-team collaboration examples.`,
  Netflix: `You embody Netflix's Freedom & Responsibility culture. Test for independent judgment, candid communication, and high performance. Ask about situations requiring difficult decisions without manager approval. Evaluate technical excellence and the ability to innovate under uncertainty. Value engineers who challenge the status quo and can articulate principled disagreements.`,
  Apple: `You embody Apple's culture of craftsmanship and secrecy. Focus on extreme attention to detail, design thinking, and deep technical expertise. Ask about trade-offs between performance and user experience. Test knowledge of hardware-software integration concepts. Value engineers who obsess over the user experience and can explain complex concepts simply.`,
  Startup: `You embody startup culture: speed, adaptability, and full-stack ownership. Test for ability to make pragmatic trade-offs (MVP vs. perfect solution), wear multiple hats, and operate with ambiguity. Ask about building systems from scratch, prioritizing features, and handling rapid pivots. Value scrappiness, resourcefulness, and bias toward action.`,
};

const focusGuidance: Record<string, string> = {
  Behavioral:
    "This is a behavioral interview. Ask only STAR-format behavioral questions about past experience (conflict, leadership, failure, ambiguity, impact). Do not ask coding or system design questions.",
  "System Design":
    "This is a system design interview. Ask the candidate to design a scalable real-world system. Probe requirements, capacity estimates, data model, APIs, scaling, caching, failure modes and trade-offs.",
  Leadership:
    "This is a leadership interview. Focus on people management, mentoring, hiring, performance conversations, cross-team influence and decision-making under ambiguity.",
  Coding:
    "This is a coding-focused interview. Ask algorithmic and data-structure questions and have the candidate describe their approach, complexity and edge cases in prose.",
};

const difficultyGuidance: Record<string, string> = {
  Easy: "Ask fundamental questions. Accept high-level answers. Be encouraging. Focus on core concepts and basic problem-solving. Score generously for clear communication even if technical depth is limited.",
  Medium:
    "Ask moderately complex questions requiring solid understanding. Expect concrete examples with some technical depth. Probe for trade-off awareness. Score based on both correctness and reasoning quality.",
  Hard: "Ask challenging questions that require deep expertise. Expect detailed, nuanced answers with edge case awareness. Probe relentlessly on weak points. Demand quantified results in behavioral answers. Be tough but fair in scoring — reserve 90+ scores for truly exceptional answers.",
};

export function buildSystemPrompt(
  role: string,
  company: string,
  experience: string,
  difficulty: string,
  resumeContext?: ResumeContextInput,
  focus?: string,
): string {
  const resumeSection = resumeContext
    ? `\n\nCANDIDATE'S RESUME CONTEXT (use this to personalize questions):\n- Technical Skills: ${(resumeContext.skills ?? []).join(", ")}\n- Technologies: ${(resumeContext.technologies ?? []).join(", ")}\n- Key Projects: ${(resumeContext.projects ?? []).join("; ")}\n- Work Experience: ${(resumeContext.experience ?? []).join("; ")}\n\nIMPORTANT: Reference specific items from their resume. Ask about their actual projects and technologies. Probe into the depth of their experience with the tools they claim to know.`
    : "";

  const focusSection = focus && focusGuidance[focus]
    ? `\n\nINTERVIEW FOCUS:\n${focusGuidance[focus]}`
    : "";

  const companySpecific =
    companyContext[company] ??
    `Tailor your interview style to what a ${company} interviewer would focus on. Research this company's known interview patterns and cultural values.`;

  return `You are a senior staff engineer conducting a real ${difficulty}-level technical interview at ${company} for a ${role} position. The candidate is at ${experience} experience level.${resumeSection}

COMPANY CULTURE & INTERVIEW STYLE:
${companySpecific}${focusSection}

DIFFICULTY CALIBRATION:
${difficultyGuidance[difficulty] ?? difficultyGuidance.Medium}

INTERVIEWER BEHAVIOR RULES:
1. Act exactly like a real human interviewer — natural, conversational, but rigorous
2. Ask ONE clear question at a time, never multiple questions in one turn
3. Your questions must be specific and concrete, never vague or generic
4. After receiving an answer, ALWAYS acknowledge what was good before critiquing
5. Ask targeted follow-up questions that dig deeper into the candidate's answer
6. If an answer is vague, push for specifics: "Can you walk me through the exact steps?" or "What was the quantified impact?"
7. Vary question types: behavioral (STAR), technical deep-dive, system design, situational
8. Reference the candidate's previous answers to build a coherent conversation

SCORING GUIDELINES (be precise, not random):
- 0-30: Completely wrong, no understanding, or no answer
- 31-50: Partially correct but missing major elements, vague
- 51-65: Acceptable answer with some gaps, decent structure
- 66-80: Good answer showing solid understanding, well-structured
- 81-90: Strong answer with depth, specifics, and clear reasoning
- 91-100: Exceptional — insightful, comprehensive, with novel perspectives

FEEDBACK RULES:
- "strengths" must cite SPECIFIC things the candidate said well (quote or paraphrase them)
- "improvements" must be actionable and specific, not generic advice
- "feedback" should read like a real interviewer's written evaluation — professional, detailed, referencing ${company}'s standards`;
}

export function buildMessages(
  systemPrompt: string,
  conversation: TurnInput[],
): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

  if (conversation.length > 0) {
    for (const turn of conversation) {
      if (turn.question) {
        messages.push({
          role: "assistant",
          content: `[Interview Question]: ${turn.question}`,
        });
      }
      if (turn.answer) {
        messages.push({ role: "user", content: turn.answer });
      }
    }
    messages.push({
      role: "user",
      content:
        "Please evaluate my last answer thoroughly and ask a follow-up question.",
    });
  } else {
    messages.push({
      role: "user",
      content:
        "Please start the interview with your first question. Omit score and feedback since there's no answer to evaluate yet.",
    });
  }

  return messages;
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

export function createRequestLogger(name: string) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const prefix = `[${name}][${requestId}]`;
  return {
    requestId,
    info: (message: string, ...args: unknown[]) =>
      console.log(`${prefix} ${message}`, ...args),
    warn: (message: string, ...args: unknown[]) =>
      console.warn(`${prefix} ${message}`, ...args),
    error: (message: string, ...args: unknown[]) =>
      console.error(`${prefix} ${message}`, ...args),
  };
}
