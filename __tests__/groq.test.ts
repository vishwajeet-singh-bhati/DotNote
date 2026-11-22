import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { callLLM } from "@/lib/groq";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("groq-sdk", () => ({
  default: class {
    chat = { completions: { create } };
  },
}));

afterEach(() => {
  create.mockReset();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Groq model fallback", () => {
  it("uses the configured fallback when the primary model is unavailable", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    vi.stubEnv("GROQ_MODEL", "primary-model");
    vi.stubEnv("GROQ_FALLBACK_MODEL", "fallback-model");
    vi.spyOn(console, "error").mockImplementation(() => {});
    create
      .mockRejectedValueOnce(new Error("model_not_found"))
      .mockResolvedValueOnce({
        choices: [{ message: { content: '{"topic":"BCNF"}' } }],
      });

    const result = await callLLM({ prompt: "Lecture" }, z.object({ topic: z.string() }));

    expect(result).toEqual({ topic: "BCNF" });
    expect(create.mock.calls.map(([request]) => request.model)).toEqual([
      "primary-model",
      "fallback-model",
    ]);
  });
});
