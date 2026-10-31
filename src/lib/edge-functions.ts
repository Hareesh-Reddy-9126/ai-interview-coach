import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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
      // Body was not JSON — fall through.
    }
  }

  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/**
 * Invoke a Supabase Edge Function and return its parsed response.
 *
 * Throws an `Error` with the server-provided message on failure so callers can
 * surface something actionable to the user.
 */
export async function invokeFunction<T>(
  name: string,
  options: { body?: Record<string, unknown>; fallbackMessage?: string } = {},
): Promise<T> {
  const fallback = options.fallbackMessage ?? "Something went wrong. Please try again.";

  const { data, error } = await supabase.functions.invoke(name, {
    body: options.body,
  });

  if (error) throw new Error(await resolveErrorMessage(error, fallback));

  if (data && typeof data === "object" && "error" in data) {
    const message = (data as { error?: unknown }).error;
    if (typeof message === "string" && message.trim()) throw new Error(message);
  }

  return data as T;
}
