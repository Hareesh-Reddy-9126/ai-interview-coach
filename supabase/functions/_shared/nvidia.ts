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
  const configured = Deno.env.get("SITE_URL") ?? "*";
  return configured
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * Build CORS headers for a request. In production set SITE_URL to a
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
    body.chat_template_kwargs = {
      enable_thinking: options.thinking,
      force_nonempty_content: true,
    };
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
