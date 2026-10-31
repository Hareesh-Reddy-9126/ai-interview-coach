import { describe, it, expect, vi, beforeEach } from "vitest";
import { FunctionsHttpError } from "@supabase/supabase-js";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));

import { invokeFunction } from "@/lib/edge-functions";

describe("invokeFunction", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("returns the parsed response on success", async () => {
    invoke.mockResolvedValue({ data: { nextQuestion: "Tell me about yourself" }, error: null });

    const result = await invokeFunction<{ nextQuestion: string }>("interview-ai", {
      body: { role: "Engineer" },
    });

    expect(result.nextQuestion).toBe("Tell me about yourself");
    expect(invoke).toHaveBeenCalledWith("interview-ai", { body: { role: "Engineer" } });
  });

  it("surfaces the JSON error body returned by the function", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(
        new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429 }),
      ),
    });

    await expect(invokeFunction("interview-ai")).rejects.toThrow("Rate limit exceeded.");
  });

  it("falls back when the error body is not JSON", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(new Response("gateway error", { status: 502 })),
    });

    await expect(
      invokeFunction("interview-ai", { fallbackMessage: "AI is unavailable." }),
    ).rejects.toThrow("AI is unavailable.");
  });

  it("throws when the response payload contains an error field", async () => {
    invoke.mockResolvedValue({ data: { error: "Session not found" }, error: null });

    await expect(invokeFunction("compute-analytics")).rejects.toThrow("Session not found");
  });

  it("omits the body when none is provided", async () => {
    invoke.mockResolvedValue({ data: { weeks: [] }, error: null });

    await invokeFunction("generate-roadmap");

    expect(invoke).toHaveBeenCalledWith("generate-roadmap", { body: undefined });
  });
});
