import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── 6 & 7 & 8. Supadata responses (sync, async, errors) ───────────────────

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  vi.stubEnv("SUPADATA_API_KEY", "test-supadata-key");
  mockFetch.mockReset();
  // Clear module cache so each test gets a fresh import
  vi.resetModules();
});

describe("fetchTranscript – synchronous response", () => {
  it("parses a successful transcript response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        content: [
          { text: "Hello world", startMs: 0, endMs: 5000 },
          { text: "This is a lecture", startMs: 5000, endMs: 10000 },
        ],
        lang: "en",
      }),
    });

    const { fetchTranscript } = await import("@/lib/supadata");
    const result = await fetchTranscript(
      "https://www.youtube.com/watch?v=test123",
    );
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0].text).toBe("Hello world");
    expect(result.segments[0].startTime).toBe(0);
    expect(result.segments[0].endTime).toBe(5);
    expect(result.segments[1].startTime).toBe(5);
    expect(result.language).toBe("en");
    expect(result.fullText).toContain("Hello world");
  });
});

describe("fetchTranscript – async job polling", () => {
  it("handles 202 response and polls for completion", { timeout: 15000 }, async () => {
    // First call returns 202 with jobId
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 202,
      json: async () => ({
        jobId: "job-123",
        status: "pending",
      }),
    });

    // Poll returns completed
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: "completed",
        result: {
          content: [{ text: "Polled transcript", start: 0, end: 10 }],
          lang: "en",
        },
      }),
    });

    const { fetchTranscript } = await import("@/lib/supadata");
    const result = await fetchTranscript(
      "https://www.youtube.com/watch?v=test456",
    );
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].text).toBe("Polled transcript");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe("fetchTranscript – error handling", () => {
  it("throws on 404 transcript unavailable", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () =>
        JSON.stringify({ error: "transcript not available" }),
    });

    const { fetchTranscript } = await import("@/lib/supadata");
    await expect(
      fetchTranscript("https://www.youtube.com/watch?v=test789"),
    ).rejects.toThrow();
  });

  it("throws on 401 unauthorized", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    const { fetchTranscript } = await import("@/lib/supadata");
    await expect(
      fetchTranscript("https://www.youtube.com/watch?v=test"),
    ).rejects.toThrow(/API key/i);
  });

  it("throws on 429 rate limit", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => "Too Many Requests",
    });

    const { fetchTranscript } = await import("@/lib/supadata");
    await expect(
      fetchTranscript("https://www.youtube.com/watch?v=test"),
    ).rejects.toThrow(/rate limit/i);
  });

  it("throws on empty transcript content", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        content: [],
        lang: "en",
      }),
    });

    const { fetchTranscript } = await import("@/lib/supadata");
    await expect(
      fetchTranscript("https://www.youtube.com/watch?v=test"),
    ).rejects.toThrow(/no content/i);
  });
});

describe("fetchVideoMetadata", () => {
  it("parses metadata correctly", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        title: "Test Lecture",
        channel: "Test Channel",
        duration: 1800,
        thumbnail: "https://img.youtube.com/vi/test/default.jpg",
        description: "A test lecture",
      }),
    });

    const { fetchVideoMetadata } = await import("@/lib/supadata");
    const result = await fetchVideoMetadata(
      "https://www.youtube.com/watch?v=test",
    );
    expect(result.title).toBe("Test Lecture");
    expect(result.channel).toBe("Test Channel");
    expect(result.duration).toBe(1800);
  });

  it("returns defaults on 404", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const { fetchVideoMetadata } = await import("@/lib/supadata");
    const result = await fetchVideoMetadata(
      "https://www.youtube.com/watch?v=test",
    );
    expect(result.title).toBe("Unknown Video");
  });
});
