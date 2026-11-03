/**
 * Semantic response cache for AI edge functions.
 *
 * Caches NVIDIA NIM responses keyed by a normalized prompt hash, with
 * Jaccard-similarity fuzzy matching for near-duplicate prompts. This cuts
 * repeated model calls (and cost) when many users ask the same or similar
 * interview questions.
 *
 * Storage: Supabase table `ai_response_cache` (see migration
 * 20261103000000_ai_response_cache.sql).
 *
 * Usage in an edge function:
 *   import { semanticCache } from "@/lib/semantic-cache";
 *   const cached = await semanticCache.lookup(normalizedPrompt);
 *   if (cached) return cached;
 *   const response = await callModel(...);
 *   await semanticCache.store(normalizedPrompt, response, ttlSeconds);
 */

import { supabase } from "@/integrations/supabase/client";

// Table is not yet in generated Supabase types; cast through `any` so the
// module compiles before the migration is applied.
function fromAny(table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from(table);
}

interface LookupOptions {
  threshold?: number; // Jaccard similarity threshold, 0-1 (default 0.85)
  maxCandidates?: number; // how many recent entries to compare against
}

const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * Normalize a prompt for caching: lowercase, collapse whitespace,
 * remove punctuation, sort words for order-invariant matching.
 */
export function normalizePrompt(prompt: string): string {
  return prompt
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .sort()
    .join(" ");
}

/**
 * Simple hash for the normalized prompt (FNV-1a, deterministic).
 */
export function hashPrompt(normalized: string): string {
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(16);
}

/**
 * Jaccard similarity between two word sets.
 */
export function jaccard(a: string, b: string): number {
  const setA = new Set(a.split(" ").filter(Boolean));
  const setB = new Set(b.split(" ").filter(Boolean));
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

export class SemanticCache {
  constructor(private ttlSeconds: number = CACHE_TTL_SECONDS) {}

  /**
   * Look up a cached response for a prompt. Returns the cached response
   * if an exact hash match or a high-similarity fuzzy match is found.
   */
  async lookup(
    prompt: string,
    options: LookupOptions = {},
  ): Promise<unknown | null> {
    const normalized = normalizePrompt(prompt);
    const promptHash = hashPrompt(normalized);
    const threshold = options.threshold ?? 0.85;
    const maxCandidates = options.maxCandidates ?? 50;

    // 1. Exact hash match
    try {
      const { data } = await fromAny("ai_response_cache")
        .select("response, expires_at")
        .eq("prompt_hash", promptHash)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (data?.response) {
        return data.response;
      }
    } catch {
      // Table may not exist yet — cache miss, continue
    }

    // 2. Fuzzy similarity match against recent entries
    try {
      const { data: candidates } = await fromAny("ai_response_cache")
        .select("prompt_text, response, expires_at")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(maxCandidates);

      if (candidates && candidates.length > 0) {
        let best: { response: unknown; similarity: number } | null = null;
        for (const c of candidates) {
          const sim = jaccard(normalized, normalizePrompt(c.prompt_text));
          if (sim >= threshold && (!best || sim > best.similarity)) {
            best = { response: c.response, similarity: sim };
          }
        }
        if (best) return best.response;
      }
    } catch {
      // Table may not exist — cache miss
    }

    return null;
  }

  /**
   * Store a response in the cache.
   */
  async store(prompt: string, response: unknown): Promise<void> {
    const normalized = normalizePrompt(prompt);
    const promptHash = hashPrompt(normalized);
    const expiresAt = new Date(
      Date.now() + this.ttlSeconds * 1000,
    ).toISOString();

    try {
      await fromAny("ai_response_cache").upsert(
        {
          prompt_hash: promptHash,
          prompt_text: normalized,
          response,
          expires_at: expiresAt,
        },
        { onConflict: "prompt_hash" },
      );
    } catch {
      // Table may not exist — silently skip caching
    }
  }

  /**
   * Clear expired entries (call via pg_cron or admin).
   */
  async cleanup(): Promise<void> {
    try {
      await fromAny("ai_response_cache")
        .delete()
        .lt("expires_at", new Date().toISOString());
    } catch {
      // ignore
    }
  }
}

export const semanticCache = new SemanticCache();
