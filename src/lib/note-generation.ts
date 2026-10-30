import { z } from "zod";
import type {
  ProcessingChunk,
  ChunkExtraction,
  GeneratedNotes,
  VideoMetadata,
  Transcript,
} from "./types";
import {
  ChunkExtractionSchema,
  GlossaryEntrySchema,
  MindMapNodeSchema,
  RevisionSheetSchema,
} from "./types";
import { callLLM } from "./groq";
import {
  buildChunkExtractionPrompt,
  buildSynthesisPrompt,
  buildReductionPrompt,
} from "./prompts";

// ─── Configuration ──────────────────────────────────────────────────────────

const MAX_EXTRACTIONS_FOR_SYNTHESIS = 5;
const REDUCTION_GROUP_SIZE = 3;

// ─── Stage A: Chunk Knowledge Extraction ────────────────────────────────────

export type ProgressCallback = (stage: string, index: number, total: number) => void;

async function extractChunkKnowledge(
  chunk: ProcessingChunk,
  totalChunks: number,
): Promise<ChunkExtraction> {
  const prompt = buildChunkExtractionPrompt(chunk, totalChunks);

  return callLLM(
    {
      prompt,
      systemPrompt:
        "You are an expert at analyzing lecture content. Extract ALL knowledge from the transcript chunk. Respond with valid JSON only.",
      maxTokens: 6000,
      temperature: 0.2,
    },
    ChunkExtractionSchema,
  );
}

// ─── Reduction (when too many extractions) ──────────────────────────────────

async function reduceExtractions(
  extractions: ChunkExtraction[],
): Promise<ChunkExtraction[]> {
  const groups: ChunkExtraction[][] = [];
  for (let i = 0; i < extractions.length; i += REDUCTION_GROUP_SIZE) {
    groups.push(extractions.slice(i, i + REDUCTION_GROUP_SIZE));
  }

  const reduced = await Promise.all(
    groups.map((group, idx) =>
      callLLM(
        {
          prompt: buildReductionPrompt(group, idx, groups.length),
          systemPrompt:
            "You are consolidating extracted lecture knowledge. Merge related items and preserve all unique details. Respond with valid JSON only.",
          maxTokens: 6000,
          temperature: 0.2,
        },
        ChunkExtractionSchema,
      ),
    ),
  );

  return reduced;
}

// ─── Stage B: Global Synthesis ──────────────────────────────────────────────

const SynthesisOutputSchema = z.object({
  overview: z.string(),
  learningObjectives: z.array(z.string()),
  detailedNotes: z.string(),
  mindMap: z.array(MindMapNodeSchema),
  glossary: z.array(GlossaryEntrySchema),
  revision: RevisionSheetSchema,
});

async function synthesizeNotes(
  extractions: ChunkExtraction[],
  video: VideoMetadata,
): Promise<z.infer<typeof SynthesisOutputSchema>> {
  // If too many extractions, reduce first
  let processedExtractions = extractions;
  while (processedExtractions.length > MAX_EXTRACTIONS_FOR_SYNTHESIS) {
    processedExtractions = await reduceExtractions(processedExtractions);
  }

  const prompt = buildSynthesisPrompt(
    processedExtractions,
    video.title,
    video.url,
  );

  return callLLM(
    {
      prompt,
      systemPrompt:
        "You are an expert educational content creator. Generate comprehensive, well-organized lecture notes from extracted knowledge. Write detailed notes, not a brief summary. Respond with valid JSON only.",
      maxTokens: 16000,
      temperature: 0.3,
    },
    SynthesisOutputSchema,
  );
}

// ─── Main Pipeline ──────────────────────────────────────────────────────────

export async function generateNotes(
  chunks: ProcessingChunk[],
  video: VideoMetadata,
  transcript: Transcript,
  onProgress?: ProgressCallback,
): Promise<GeneratedNotes> {
  // Stage A: Extract knowledge from each chunk
  const extractions: ChunkExtraction[] = [];

  for (let i = 0; i < chunks.length; i++) {
    onProgress?.("Analyzing lecture content", i + 1, chunks.length);

    const extraction = await extractChunkKnowledge(chunks[i], chunks.length);
    extractions.push(extraction);
  }

  // Stage B: Synthesize
  onProgress?.("Generating detailed notes", 1, 1);

  const synthesis = await synthesizeNotes(extractions, video);

  // Build final result
  const result: GeneratedNotes = {
    video,
    overview: synthesis.overview,
    learningObjectives: synthesis.learningObjectives,
    detailedNotes: synthesis.detailedNotes,
    mindMap: synthesis.mindMap,
    glossary: synthesis.glossary,
    revision: synthesis.revision,
    detectedLanguage: transcript.language,
    generatedAt: new Date().toISOString(),
  };

  return result;
}
