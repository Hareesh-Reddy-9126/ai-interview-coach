import { describe, it, expect } from "vitest";
import { cn, getErrorMessage } from "@/lib/utils";

describe("cn", () => {
  it("merges conditional classes and resolves Tailwind conflicts", () => {
    const isHidden = false;
    expect(cn("px-2 py-1", isHidden && "hidden", "px-4")).toContain("px-4");
    expect(cn("px-2", "px-4")).not.toContain("px-2");
  });
});

describe("getErrorMessage", () => {
  it("returns the message from an Error", () => {
    expect(getErrorMessage(new Error("boom"), "fallback")).toBe("boom");
  });

  it("returns a non-empty string thrown value", () => {
    expect(getErrorMessage("direct", "fallback")).toBe("direct");
  });

  it("falls back for empty or unknown values", () => {
    expect(getErrorMessage(new Error(""), "fallback")).toBe("fallback");
    expect(getErrorMessage(null, "fallback")).toBe("fallback");
    expect(getErrorMessage({}, "fallback")).toBe("fallback");
  });
});
