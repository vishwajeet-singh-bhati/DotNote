import { describe, it, expect, beforeEach, afterAll } from "vitest";
import {
  extractVideoId,
  buildCanonicalUrl,
  buildTimestampUrl,
  formatTimestamp,
  validateConfig,
} from "@/lib/validation";

// ─── 1. Valid YouTube URL formats ───────────────────────────────────────────

describe("extractVideoId – valid URLs", () => {
  const validCases: [string, string][] = [
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/v/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLtest&index=1",
      "dQw4w9WgXcQ",
    ],
    ["http://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/abc-DEF_123", "abc-DEF_123"],
  ];

  for (const [url, expected] of validCases) {
    it(`extracts "${expected}" from ${url}`, () => {
      expect(extractVideoId(url)).toBe(expected);
    });
  }
});

// ─── 2. Invalid URLs and disallowed hosts ───────────────────────────────────

describe("extractVideoId – invalid URLs", () => {
  const invalidCases: [string, string][] = [
    ["not a url", "Invalid URL format"],
    ["https://www.google.com/watch?v=dQw4w9WgXcQ", "Unsupported host"],
    ["https://www.evil.com/youtube.com/watch?v=abc", "Unsupported host"],
    ["https://www.youtube.com/playlist?list=PLtest", "Could not extract"],
    ["https://www.youtube.com/", "Could not extract"],
    ["https://www.youtube.com/watch?v=short", "Could not extract"],
    ["https://www.youtube.com/watch", "Could not extract"],
    ["ftp://www.youtube.com/watch?v=dQw4w9WgXcQ", "Invalid protocol"],
  ];

  for (const [url, expectedMsg] of invalidCases) {
    it(`rejects ${url}`, () => {
      expect(() => extractVideoId(url)).toThrow(expectedMsg);
    });
  }
});

// ─── 4. Timestamp conversion and link generation ────────────────────────────

describe("formatTimestamp", () => {
  it("formats seconds < 1 hour", () => {
    expect(formatTimestamp(65)).toBe("1:05");
    expect(formatTimestamp(0)).toBe("0:00");
    expect(formatTimestamp(599)).toBe("9:59");
  });

  it("formats seconds >= 1 hour", () => {
    expect(formatTimestamp(3661)).toBe("1:01:01");
    expect(formatTimestamp(7200)).toBe("2:00:00");
  });
});

describe("buildCanonicalUrl", () => {
  it("builds a canonical YouTube URL", () => {
    expect(buildCanonicalUrl("dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
  });
});

describe("buildTimestampUrl", () => {
  it("appends timestamp parameter", () => {
    const url = buildTimestampUrl(
      "https://www.youtube.com/watch?v=abc",
      125.7,
    );
    expect(url).toBe("https://www.youtube.com/watch?v=abc&t=125s");
  });

  it("floors fractional seconds", () => {
    const url = buildTimestampUrl(
      "https://www.youtube.com/watch?v=abc",
      10.9,
    );
    expect(url).toBe("https://www.youtube.com/watch?v=abc&t=10s");
  });
});

// ─── 13. Missing environment variables ──────────────────────────────────────

describe("validateConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("throws when SUPADATA_API_KEY is missing", () => {
    delete process.env.SUPADATA_API_KEY;
    delete process.env.GROQ_API_KEY;
    expect(() => validateConfig()).toThrow("SUPADATA_API_KEY");
  });

  it("throws when GROQ_API_KEY is missing", () => {
    process.env.SUPADATA_API_KEY = "test-key";
    delete process.env.GROQ_API_KEY;
    expect(() => validateConfig()).toThrow("GROQ_API_KEY");
  });

  it("returns keys when both are set", () => {
    process.env.SUPADATA_API_KEY = "supa-key";
    process.env.GROQ_API_KEY = "groq-key";
    const result = validateConfig();
    expect(result.supadataKey).toBe("supa-key");
    expect(result.groqKey).toBe("groq-key");
  });
});

// ─── 14. Protection against key exposure ────────────────────────────────────

describe("key exposure protection", () => {
  it("validateConfig does not include keys in error messages", () => {
    const originalEnv = process.env;
    process.env = { ...originalEnv };
    delete process.env.SUPADATA_API_KEY;

    try {
      validateConfig();
    } catch (err: unknown) {
      const error = err as { message: string; userMessage?: string };
      expect(error.message).not.toContain("sk-");
      expect(error.userMessage ?? "").not.toContain("sk-");
    }

    process.env = originalEnv;
  });
});
