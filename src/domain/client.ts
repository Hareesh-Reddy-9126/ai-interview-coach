/**
 * Circuit breaker — protects the app from cascading failures when NVIDIA NIM
 * (or any edge function) is degraded.
 *
 * States:
 *   CLOSED  — requests flow normally
 *   OPEN    — requests fail fast, no upstream call
 *   HALF_OPEN — trial requests allowed to test recovery
 *
 * Configuration is per-function-name so a slow `interview-ai` doesn't trip
 * breakers for `code-review` or `resume-analyze`.
 */

type BreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface BreakerConfig {
  failureThreshold: number;      // failures to trip
  successThreshold: number;      // successes in half-open to close
  timeoutMs: number;             // how long OPEN before half-open
  rollingWindowMs: number;       // window for failure counting
}

const DEFAULT_CONFIG: BreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  timeoutMs: 30_000,
  rollingWindowMs: 60_000,
};

interface FailureRecord {
  timestamp: number;
}

class CircuitBreaker {
  private state: BreakerState = "CLOSED";
  private failures: FailureRecord[] = [];
  private successesInHalfOpen = 0;
  private lastStateChange = Date.now();

  constructor(private name: string, private config: BreakerConfig = DEFAULT_CONFIG) {}

  private now() {
    return Date.now();
  }

  private prune() {
    const cutoff = this.now() - this.config.rollingWindowMs;
    this.failures = this.failures.filter((f) => f.timestamp > cutoff);
  }

  getState() {
    this.prune();
    if (this.state === "OPEN" && this.now() - this.lastStateChange >= this.config.timeoutMs) {
      this.transition("HALF_OPEN");
    }
    return this.state;
  }

  private transition(next: BreakerState) {
    this.state = next;
    this.lastStateChange = this.now();
    if (next === "HALF_OPEN") this.successesInHalfOpen = 0;
    console.debug(
      JSON.stringify({
        level: "debug",
        component: "circuit-breaker",
        name: this.name,
        state: next,
        ts: new Date().toISOString(),
      }),
    );
  }

  recordSuccess() {
    if (this.state === "HALF_OPEN") {
      this.successesInHalfOpen += 1;
      if (this.successesInHalfOpen >= this.config.successThreshold) {
        this.transition("CLOSED");
        this.failures = [];
      }
    } else if (this.state === "CLOSED") {
      // Keep failure window clean on success
      this.prune();
    }
  }

  recordFailure() {
    this.failures.push({ timestamp: this.now() });
    this.prune();
    if (
      this.state === "CLOSED" &&
      this.failures.length >= this.config.failureThreshold
    ) {
      this.transition("OPEN");
    } else if (this.state === "HALF_OPEN") {
      this.transition("OPEN");
    }
  }

  /**
   * Execute `fn` if the breaker allows. Throws `CircuitOpenError` when OPEN.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.getState() === "OPEN") {
      const err = new Error(`Circuit breaker OPEN for ${this.name}`);
      (err as CircuitOpenError).code = "CIRCUIT_OPEN";
      throw err;
    }
    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (e) {
      this.recordFailure();
      throw e;
    }
  }
}

export class CircuitOpenError extends Error {
  code = "CIRCUIT_OPEN";
  constructor(message: string) {
    super(message);
    this.name = "CircuitOpenError";
  }
}

// Registry — one breaker per edge function
const breakers = new Map<string, CircuitBreaker>();

export function getBreaker(name: string): CircuitBreaker {
  if (!breakers.has(name)) {
    breakers.set(name, new CircuitBreaker(name));
  }
  return breakers.get(name)!;
}

// ── Typed edge function client ─────────────────────────────────────────────

import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import {
  validateStartInterviewResponse,
  validateSubmitAnswerResponse,
  validateGenerateRoadmapResponse,
  validateAnalyzeResumeResponse,
  validateCodeReviewResponse,
} from "@/domain/types";

async function resolveErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: unknown };
      if (typeof body?.error === "string" && body.error.trim()) return body.error;
    } catch {
      // not JSON — fall through
    }
    return fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/**
 * Request coalescing — deduplicates in-flight calls with the same key.
 * Two users asking for "Google backend Easy" interview at the same time
 * share one NVIDIA call instead of two.
 */
const inflight = new Map<string, Promise<unknown>>();

function inflightKey(name: string, body: unknown): string {
  return `${name}:${JSON.stringify(body)}`;
}

async function runInFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const promise = fn().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

export interface InvokeOptions {
  body?: Record<string, unknown>;
  fallbackMessage?: string;
  cooldownMs?: number; // 0 = no coalescing
}

export async function invokeFunction<T>(
  name: string,
  options: InvokeOptions = {},
): Promise<T> {
  const fallback = options.fallbackMessage ?? "Something went wrong. Please try again.";
  const breaker = getBreaker(name);
  const cooldown = options.cooldownMs ?? 0;

  const call = async (): Promise<T> => {
    const { data, error } = await supabase.functions.invoke(name, {
      body: options.body,
    });

    if (error) throw new Error(await resolveErrorMessage(error, fallback));

    if (data && typeof data === "object" && "error" in data) {
      const message = (data as { error?: unknown }).error;
      if (typeof message === "string" && message.trim()) throw new Error(message);
    }

    return data as T;
  };

  const execute = cooldown > 0 ? () => runInFlight(inflightKey(name, options.body ?? {}), call) : call;

  const raw = await breaker.execute(execute);

  // Validate against the domain contract when possible
  switch (name) {
    case "start-interview":
    case "interview-start":
      return validateStartInterviewResponse(raw) as unknown as T;
    case "interview-ai":
    case "submit-answer":
      return validateSubmitAnswerResponse(raw) as unknown as T;
    case "generate-roadmap":
      return validateGenerateRoadmapResponse(raw) as unknown as T;
    case "resume-analyze":
    case "analyze-resume":
      return validateAnalyzeResumeResponse(raw) as unknown as T;
    case "code-review":
      return validateCodeReviewResponse(raw) as unknown as T;
    default:
      return raw;
  }
}
