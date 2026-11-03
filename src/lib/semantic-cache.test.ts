import { describe, it, expect, vi, beforeEach } from "vitest";
import { SemanticCache, normalizePrompt, hashPrompt, jaccard } from "./semantic-cache";

const mockFrom = vi.fn();
const mockChain = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      mockFrom(table);
      return mockChain();
    },
  },
}));

describe("SemanticCache utilities", () => {
  describe("normalizePrompt", () => {
    it("lowercases and collapses whitespace", () => {
      expect(normalizePrompt("  Hello   WORLD  ")).toBe("hello world");
    });

    it("removes punctuation", () => {
      expect(normalizePrompt("Hello, world!")).toBe("hello world");
    });

    it("sorts words for order-invariant matching", () => {
      expect(normalizePrompt("b a c")).toBe("a b c");
      expect(normalizePrompt("c b a")).toBe("a b c");
    });
  });

  describe("hashPrompt", () => {
    it("produces deterministic output", () => {
      expect(hashPrompt("hello world")).toBe(hashPrompt("hello world"));
    });

    it("produces different output for different inputs", () => {
      expect(hashPrompt("hello")).not.toBe(hashPrompt("world"));
    });
  });

  describe("jaccard", () => {
    it("returns 1 for identical sets", () => {
      expect(jaccard("a b c", "a b c")).toBe(1);
    });

    it("returns 0 for disjoint sets", () => {
      expect(jaccard("a b c", "x y z")).toBe(0);
    });

    it("returns partial overlap", () => {
      expect(jaccard("a b c", "b c d")).toBeCloseTo(0.5);
    });
  });
});

describe("SemanticCache store/lookup (mocked)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("lookup returns null when table errors (not yet created)", async () => {
    mockChain.mockImplementation(() => {
      throw new Error("relation does not exist");
    });

    const cache = new SemanticCache();
    const result = await cache.lookup("How do I reverse a string?");
    expect(result).toBeNull();
  });

  it("store does not throw when table errors", async () => {
    mockChain.mockImplementation(() => {
      throw new Error("relation does not exist");
    });

    const cache = new SemanticCache();
    await expect(cache.store("prompt", { score: 80 })).resolves.toBeUndefined();
  });
});
