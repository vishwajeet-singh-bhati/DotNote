import { z } from "zod";

// ─── Transcript Types ───────────────────────────────────────────────────────

export const TranscriptSegmentSchema = z.object({
  id: z.string(),
  startTime: z.number(),
  endTime: z.number(),
  text: z.string(),
  language: z.string().optional(),
});

export type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>;

export const TranscriptSchema = z.object({
  segments: z.array(TranscriptSegmentSchema),
  fullText: z.string(),
  language: z.string().optional(),
  totalDuration: z.number().optional(),
});

export type Transcript = z.infer<typeof TranscriptSchema>;

// ─── Video Metadata ─────────────────────────────────────────────────────────

export const VideoMetadataSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  channel: z.string().optional(),
  duration: z.number().optional(),
  thumbnail: z.string().url().optional().nullable(),
  description: z.string().optional(),
});

export type VideoMetadata = z.infer<typeof VideoMetadataSchema>;

// ─── Source Reference ───────────────────────────────────────────────────────

export const SourceReferenceSchema = z.object({
  segmentId: z.string(),
  startTime: z.number(),
  text: z.string().optional(),
});

export type SourceReference = z.infer<typeof SourceReferenceSchema>;

// ─── Chunk Knowledge Extraction (Stage A output) ────────────────────────────

export const ExtractedDefinitionSchema = z.object({
  term: z.string(),
  definition: z.string(),
  example: z.string().optional(),
  sources: z.array(SourceReferenceSchema).optional(),
});

export const ExtractedConceptSchema = z.object({
  name: z.string(),
  explanation: z.string(),
  intuition: z.string().optional(),
  examples: z.array(z.string()).optional(),
  applications: z.array(z.string()).optional(),
  relatedConcepts: z.array(z.string()).optional(),
  sources: z.array(SourceReferenceSchema).optional(),
});

export const ExtractedFormulaSchema = z.object({
  formula: z.string(),
  variables: z.array(z.object({ name: z.string(), meaning: z.string() })).optional(),
  assumptions: z.array(z.string()).optional(),
  derivation: z.string().optional(),
  sources: z.array(SourceReferenceSchema).optional(),
});

export const ExtractedAlgorithmSchema = z.object({
  name: z.string(),
  purpose: z.string(),
  preconditions: z.array(z.string()).optional(),
  steps: z.array(z.string()),
  workedExample: z.string().optional(),
  timeComplexity: z.string().optional(),
  spaceComplexity: z.string().optional(),
  edgeCases: z.array(z.string()).optional(),
  sources: z.array(SourceReferenceSchema).optional(),
});

export const ExtractedComparisonSchema = z.object({
  items: z.array(z.string()),
  criteria: z.array(z.string()),
  details: z.array(z.array(z.string())).optional(),
  summary: z.string().optional(),
  sources: z.array(SourceReferenceSchema).optional(),
});

export const ChunkExtractionSchema = z.object({
  chunkIndex: z.number(),
  mainTopics: z.array(z.string()),
  subtopics: z.array(z.string()).optional(),
  definitions: z.array(ExtractedDefinitionSchema).optional(),
  concepts: z.array(ExtractedConceptSchema).optional(),
  formulas: z.array(ExtractedFormulaSchema).optional(),
  algorithms: z.array(ExtractedAlgorithmSchema).optional(),
  comparisons: z.array(ExtractedComparisonSchema).optional(),
  keyFacts: z.array(z.object({
    fact: z.string(),
    importance: z.string().optional(),
    sources: z.array(SourceReferenceSchema).optional(),
  })).optional(),
  examRelevantPoints: z.array(z.string()).optional(),
  assumptions: z.array(z.string()).optional(),
  exceptions: z.array(z.string()).optional(),
  examplesAndAnalogies: z.array(z.object({
    description: z.string(),
    relatedConcept: z.string().optional(),
    sources: z.array(SourceReferenceSchema).optional(),
  })).optional(),
});

export type ChunkExtraction = z.infer<typeof ChunkExtractionSchema>;

// ─── Mind Map Node ──────────────────────────────────────────────────────────

export const MindMapNodeSchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  label: z.string(),
  sources: z.array(SourceReferenceSchema).optional(),
});

export type MindMapNode = z.infer<typeof MindMapNodeSchema>;

// ─── Keyword / Glossary Entry ───────────────────────────────────────────────

export const GlossaryEntrySchema = z.object({
  term: z.string(),
  definition: z.string(),
  example: z.string().optional(),
  importance: z.string().optional(),
  isSupplementary: z.boolean().optional(),
  sources: z.array(SourceReferenceSchema).optional(),
});

export type GlossaryEntry = z.infer<typeof GlossaryEntrySchema>;

// ─── Revision Sheet ─────────────────────────────────────────────────────────

export const RevisionQuestionSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

export const RevisionSheetSchema = z.object({
  keyTakeaways: z.array(z.string()),
  importantFacts: z.array(z.string()),
  formulasToRemember: z.array(z.string()).optional(),
  preconditionsAndExceptions: z.array(z.string()).optional(),
  frequentlyConfusedConcepts: z.array(z.object({
    concepts: z.array(z.string()),
    clarification: z.string(),
  })).optional(),
  practiceQuestions: z.array(RevisionQuestionSchema).optional(),
  lastMinuteRevision: z.string().optional(),
});

export type RevisionSheet = z.infer<typeof RevisionSheetSchema>;

// ─── Complete Generated Notes (Final Output) ────────────────────────────────

export const GeneratedNotesSchema = z.object({
  video: VideoMetadataSchema,
  overview: z.string(),
  learningObjectives: z.array(z.string()),
  detailedNotes: z.string(), // Markdown string
  mindMap: z.array(MindMapNodeSchema),
  glossary: z.array(GlossaryEntrySchema),
  revision: RevisionSheetSchema,
  detectedLanguage: z.string().optional(),
  generatedAt: z.string(),
});

export type GeneratedNotes = z.infer<typeof GeneratedNotesSchema>;

// ─── API Request/Response ───────────────────────────────────────────────────

export const GenerateRequestSchema = z.object({
  url: z.string().url("Please provide a valid URL"),
});

export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

export interface GenerateProgressEvent {
  type: "progress" | "complete" | "error";
  stage?: string;
  stageIndex?: number;
  totalStages?: number;
  data?: GeneratedNotes;
  error?: string;
  errorCode?: string;
}

// ─── Processing Chunk ───────────────────────────────────────────────────────

export interface ProcessingChunk {
  index: number;
  text: string;
  segments: TranscriptSegment[];
  overlapPrefix?: string;
}

// ─── Error types ────────────────────────────────────────────────────────────

export class LectureFlowError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly userMessage?: string,
  ) {
    super(message);
    this.name = "LectureFlowError";
  }
}

export const ErrorCodes = {
  INVALID_URL: "INVALID_URL",
  VIDEO_NOT_FOUND: "VIDEO_NOT_FOUND",
  TRANSCRIPT_UNAVAILABLE: "TRANSCRIPT_UNAVAILABLE",
  TRANSCRIPT_FAILED: "TRANSCRIPT_FAILED",
  VIDEO_TOO_LONG: "VIDEO_TOO_LONG",
  QUOTA_EXHAUSTED: "QUOTA_EXHAUSTED",
  INVALID_API_KEY: "INVALID_API_KEY",
  RATE_LIMITED: "RATE_LIMITED",
  NETWORK_ERROR: "NETWORK_ERROR",
  JOB_TIMEOUT: "JOB_TIMEOUT",
  LLM_ERROR: "LLM_ERROR",
  LLM_VALIDATION_ERROR: "LLM_VALIDATION_ERROR",
  MISSING_CONFIG: "MISSING_CONFIG",
  PROCESSING_ERROR: "PROCESSING_ERROR",
  TIMEOUT: "TIMEOUT",
} as const;
