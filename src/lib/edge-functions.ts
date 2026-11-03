import { FunctionsHttpError } from "@supabase/supabase-js";
import {
  log,
  error as logError,
  metrics,
} from "@/domain/logger";
import {
  CircuitOpenError,
  invokeFunction as domainInvoke,
} from "@/domain/client";

/**
 * Extract a human-readable message from a Supabase Functions error.
 *
 * `functions.invoke` returns a generic "Edge Function returned a non-2xx
 * status code" message; the useful text lives in the JSON body attached to
 * `FunctionsHttpError.context`.
 */
async function resolveErrorMessage(
  error: unknown,
  fallback: string,
): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: unknown };
      if (typeof body?.error === "string" && body.error.trim()) {
        return body.error;
      }
    } catch {
      // Body was not JSON — fall through to the caller's message.
    }
    // The SDK's own message ("Edge Function returned a non-2xx status code")
    // is too generic to show to users, so prefer the caller's fallback.
    return fallback;
  }

  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/**
 * Invoke a Supabase Edge Function and return its parsed response.
 *
 * Now routes through the domain layer which adds:
 *   • Circuit breaker per function (fast-fail on degraded NVIDIA)
 *   • Request coalescing (dedupe identical in-flight calls)
 *   • Zod contract validation on AI responses
 *   • Structured logging + Prometheus metrics
 *
 * Throws an `Error` with the server-provided message on failure so callers can
 * surface something actionable to the user.
 */
export async function invokeFunction<T>(
  name: string,
  options: { body?: Record<string, unknown>; fallbackMessage?: string } = {},
): Promise<T> {
  const start = Date.now();
  const fallback = options.fallbackMessage ?? "Something went wrong. Please try again.";

  try {
    const result = await domainInvoke<T>(name, {
      ...options,
      cooldownMs: 250, // dedupe identical calls within 250ms
    });

    metrics.aiRequestsTotal.increment({ function: name, status: "success" });
    metrics.aiLatencyMs.observe(Date.now() - start, { function: name });

    log("info", "edge_function.success", {
      function: name,
      latency_ms: Date.now() - start,
    });

    return result;
  } catch (err) {
    const isCircuitOpen = err instanceof CircuitOpenError;
    metrics.aiErrorsTotal.increment({
      function: name,
      status: isCircuitOpen ? "circuit_open" : "error",
    });
    metrics.aiLatencyMs.observe(Date.now() - start, { function: name });

    logError("edge_function.error", {
      function: name,
      latency_ms: Date.now() - start,
      circuit_open: isCircuitOpen,
      message: err instanceof Error ? err.message : String(err),
    });

    if (isCircuitOpen) {
      throw new Error(
        "The AI interviewer is momentarily overloaded. Please try again in a few seconds.",
      );
    }

    throw new Error(await resolveErrorMessage(err, fallback));
  }
}
