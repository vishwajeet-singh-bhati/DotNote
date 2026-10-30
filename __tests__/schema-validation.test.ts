import { describe, it, expect } from "vitest";
import {
  GeneratedNotesSchema,
  ChunkExtractionSchema,
  GlossaryEntrySchema,
  MindMapNodeSchema,
  RevisionSheetSchema,
} from "@/lib/types";

// ─── 9. Valid LLM output schema ────────────────────────────────────────────

describe("LLM output schema validation – valid data", () => {
  it("validates a complete GeneratedNotes object", () => {
    const valid = {
      video: {
        title: "Test Lecture",
        url: "https://www.youtube.com/watch?v=test",
        channel: "Test Channel",
        duration: 1800,
        thumbnail: "https://img.youtube.com/vi/test/default.jpg",
      },
      overview: "This lecture covers testing.",
      learningObjectives: ["Understand testing fundamentals"],
      detailedNotes: "## Testing\n\nNotes here...",
      mindMap: [
        { id: "root", parentId: null, label: "Testing" },
        { id: "topic-1", parentId: "root", label: "Unit Tests" },
      ],
      glossary: [
        {
          term: "Unit Test",
          definition: "A test for individual units of code",
          importance: "Critical for code quality",
          isSupplementary: false,
        },
      ],
      revision: {
        keyTakeaways: ["Testing is important"],
        importantFacts: ["Tests catch bugs early"],
        formulasToRemember: [],
        practiceQuestions: [
          { question: "What is a unit test?", answer: "A test for units" },
        ],
      },
      generatedAt: new Date().toISOString(),
    };

    const result = GeneratedNotesSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("validates a ChunkExtraction", () => {
    const valid = {
      chunkIndex: 0,
      mainTopics: ["Algorithms"],
      subtopics: ["Sorting"],
      definitions: [
        {
          term: "Quick Sort",
          definition: "A divide-and-conquer sorting algorithm",
          sources: [{ segmentId: "seg-5", startTime: 25 }],
        },
      ],
      concepts: [],
      keyFacts: [
        {
          fact: "Average case O(n log n)",
          importance: "Exam relevant",
          sources: [{ segmentId: "seg-10", startTime: 50 }],
        },
      ],
    };

    const result = ChunkExtractionSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});

// ─── 10. Malformed or incomplete LLM output ─────────────────────────────────

describe("LLM output schema validation – invalid data", () => {
  it("rejects missing required fields in GeneratedNotes", () => {
    const invalid = {
      video: { title: "Test" },
      // Missing url in video, missing other top-level fields
    };

    const result = GeneratedNotesSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects invalid video URL format", () => {
    const invalid = {
      video: {
        title: "Test",
        url: "not-a-url",
      },
      overview: "test",
      learningObjectives: [],
      detailedNotes: "",
      mindMap: [],
      glossary: [],
      revision: {
        keyTakeaways: [],
        importantFacts: [],
      },
      generatedAt: "2024-01-01",
    };

    const result = GeneratedNotesSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects ChunkExtraction with missing chunkIndex", () => {
    const invalid = {
      mainTopics: ["Test"],
    };

    const result = ChunkExtractionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects GlossaryEntry with missing definition", () => {
    const invalid = {
      term: "Test",
      // Missing definition
    };

    const result = GlossaryEntrySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects MindMapNode with missing id", () => {
    const invalid = {
      parentId: null,
      label: "Test",
    };

    const result = MindMapNodeSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects RevisionSheet with missing keyTakeaways", () => {
    const invalid = {
      importantFacts: ["test"],
    };

    const result = RevisionSheetSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
