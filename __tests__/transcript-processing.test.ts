import { describe, it, expect } from "vitest";
import {
  normalizeText,
  normalizeTranscript,
  chunkTranscript,
  checkDurationLimit,
} from "@/lib/transcript-processing";
import type { Transcript, TranscriptSegment } from "@/lib/types";

function makeTranscript(
  texts: string[],
  startTimeStep = 5,
): Transcript {
  const segments: TranscriptSegment[] = texts.map((text, i) => ({
    id: `seg-${i}`,
    startTime: i * startTimeStep,
    endTime: (i + 1) * startTimeStep,
    text,
  }));

  return {
    segments,
    fullText: segments.map((s) => s.text).join(" "),
    totalDuration: segments.length * startTimeStep,
  };
}

// ─── 3. Transcript normalization ────────────────────────────────────────────

describe("normalizeText", () => {
  it("collapses multiple spaces", () => {
    expect(normalizeText("hello   world")).toBe("hello world");
  });

  it("normalizes line endings", () => {
    expect(normalizeText("hello\r\nworld\rfoo")).toBe("hello\nworld\nfoo");
  });

  it("trims whitespace", () => {
    expect(normalizeText("  hello world  ")).toBe("hello world");
  });

  it("preserves meaningful punctuation", () => {
    expect(normalizeText("O(n log n) = fast!")).toBe("O(n log n) = fast!");
  });

  it("collapses excessive newlines", () => {
    expect(normalizeText("a\n\n\n\n\nb")).toBe("a\n\nb");
  });

  it("preserves formulas and special chars", () => {
    expect(normalizeText("E = mc² and f(x) = x²")).toBe(
      "E = mc² and f(x) = x²",
    );
  });
});

describe("normalizeTranscript", () => {
  it("normalizes all segments", () => {
    const transcript = makeTranscript(["  hello  ", "  world  "]);
    const result = normalizeTranscript(transcript);
    expect(result.segments[0].text).toBe("hello");
    expect(result.segments[1].text).toBe("world");
    expect(result.fullText).toBe("hello world");
  });
});

// ─── 5. Transcript chunking and segment-reference preservation ──────────────

describe("chunkTranscript", () => {
  it("returns a single chunk for short transcripts", () => {
    const transcript = makeTranscript(["Hello world", "This is a test"]);
    const chunks = chunkTranscript(transcript, 10000);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].segments).toHaveLength(2);
    expect(chunks[0].index).toBe(0);
  });

  it("splits long transcripts into multiple chunks", () => {
    // Create a transcript with many segments totaling > 200 chars
    const texts = Array.from({ length: 50 }, (_, i) =>
      `This is segment number ${i} with enough text to make the total large.`,
    );
    const transcript = makeTranscript(texts);
    const chunks = chunkTranscript(transcript, 500);

    expect(chunks.length).toBeGreaterThan(1);

    // Every chunk should have segments
    for (const chunk of chunks) {
      expect(chunk.segments.length).toBeGreaterThan(0);
    }
  });

  it("preserves segment references in chunks", () => {
    const texts = Array.from({ length: 20 }, (_, i) =>
      `Segment ${i} with content to process.`,
    );
    const transcript = makeTranscript(texts);
    const chunks = chunkTranscript(transcript, 200);

    for (const chunk of chunks) {
      for (const seg of chunk.segments) {
        expect(seg.id).toMatch(/^seg-\d+$/);
        expect(typeof seg.startTime).toBe("number");
        expect(typeof seg.endTime).toBe("number");
      }
    }
  });

  it("adds overlap to non-first chunks", () => {
    const texts = Array.from({ length: 30 }, (_, i) =>
      `This is a longer segment number ${i} with sufficient text to trigger chunking.`,
    );
    const transcript = makeTranscript(texts);
    const chunks = chunkTranscript(transcript, 300);

    if (chunks.length > 1) {
      expect(chunks[0].overlapPrefix).toBeUndefined();
      expect(chunks[1].overlapPrefix).toBeDefined();
      expect(chunks[1].overlapPrefix!.length).toBeGreaterThan(0);
    }
  });

  it("assigns sequential indices", () => {
    const texts = Array.from({ length: 40 }, (_, i) =>
      `Segment ${i} with some text to fill the chunk size limit.`,
    );
    const transcript = makeTranscript(texts);
    const chunks = chunkTranscript(transcript, 200);

    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].index).toBe(i);
    }
  });
});

// ─── Duration limit ─────────────────────────────────────────────────────────

describe("checkDurationLimit", () => {
  it("does not throw for short videos", () => {
    const transcript = makeTranscript(["test"], 5);
    expect(() => checkDurationLimit(transcript, 3600)).not.toThrow();
  });

  it("throws for videos exceeding the limit", () => {
    const transcript: Transcript = {
      segments: [
        { id: "seg-0", startTime: 0, endTime: 7200, text: "long video" },
      ],
      fullText: "long video",
      totalDuration: 7200,
    };
    expect(() => checkDurationLimit(transcript, 3600)).toThrow("exceeds limit");
  });

  it("does not throw when duration is missing", () => {
    const transcript: Transcript = {
      segments: [
        { id: "seg-0", startTime: 0, endTime: 10, text: "test" },
      ],
      fullText: "test",
    };
    expect(() => checkDurationLimit(transcript, 3600)).not.toThrow();
  });
});
