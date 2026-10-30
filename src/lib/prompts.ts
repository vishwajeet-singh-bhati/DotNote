import type { ProcessingChunk, ChunkExtraction } from "./types";

/**
 * Build the prompt for Stage A: extracting structured knowledge from a transcript chunk.
 */
export function buildChunkExtractionPrompt(
  chunk: ProcessingChunk,
  totalChunks: number,
): string {
  const segmentContext = chunk.segments
    .slice(0, 5)
    .map((s) => `[${s.id}: ${s.startTime.toFixed(1)}s]`)
    .join(", ");

  const overlapNote = chunk.overlapPrefix
    ? `\n\nCONTEXT FROM PREVIOUS SECTION (for continuity, do not re-extract):\n"${chunk.overlapPrefix}"\n`
    : "";

  return `You are analyzing chunk ${chunk.index + 1} of ${totalChunks} from a lecture transcript.
Your task is to extract ALL knowledge from this chunk in a structured format.

IMPORTANT RULES:
1. Extract EVERY definition, concept, formula, algorithm, example, and important fact.
2. Do NOT summarize or compress — preserve the full detail of explanations.
3. Retain the teacher's own examples and analogies.
4. For each piece of information, include source references using segment IDs where you can identify them.
5. Mark assumptions, preconditions, and exceptions explicitly.
6. If the teacher compares concepts, extract the comparison with all criteria.
7. Do NOT invent information not present in the transcript.
8. If something is unclear in the transcript, note the uncertainty.

Source segments in this chunk include: ${segmentContext}
When citing sources, use the segment ID format "seg-N" where N corresponds to the segment index.
${overlapNote}
TRANSCRIPT CHUNK:
"""
${chunk.text}
"""

Respond with a JSON object matching this schema:
{
  "chunkIndex": ${chunk.index},
  "mainTopics": ["string - main topics covered in this chunk"],
  "subtopics": ["string - subtopics"],
  "definitions": [
    {
      "term": "the term being defined",
      "definition": "full definition as explained",
      "example": "example if provided",
      "sources": [{"segmentId": "seg-N", "startTime": 0}]
    }
  ],
  "concepts": [
    {
      "name": "concept name",
      "explanation": "detailed explanation preserving the teacher's words",
      "intuition": "intuitive explanation if provided",
      "examples": ["examples given"],
      "applications": ["applications mentioned"],
      "relatedConcepts": ["related concepts mentioned"],
      "sources": [{"segmentId": "seg-N", "startTime": 0}]
    }
  ],
  "formulas": [
    {
      "formula": "the formula or equation",
      "variables": [{"name": "var", "meaning": "what it represents"}],
      "assumptions": ["assumptions stated"],
      "derivation": "derivation steps if provided",
      "sources": [{"segmentId": "seg-N", "startTime": 0}]
    }
  ],
  "algorithms": [
    {
      "name": "algorithm name",
      "purpose": "what it does",
      "preconditions": ["required conditions"],
      "steps": ["step 1", "step 2"],
      "workedExample": "worked example if provided",
      "timeComplexity": "if mentioned",
      "spaceComplexity": "if mentioned",
      "edgeCases": ["edge cases discussed"],
      "sources": [{"segmentId": "seg-N", "startTime": 0}]
    }
  ],
  "comparisons": [
    {
      "items": ["item A", "item B"],
      "criteria": ["criterion 1", "criterion 2"],
      "details": [["A's value for criterion 1", "A's value for criterion 2"], ["B's value for criterion 1", "B's value for criterion 2"]],
      "summary": "summary of comparison",
      "sources": [{"segmentId": "seg-N", "startTime": 0}]
    }
  ],
  "keyFacts": [
    {
      "fact": "important fact stated",
      "importance": "why it matters",
      "sources": [{"segmentId": "seg-N", "startTime": 0}]
    }
  ],
  "examRelevantPoints": ["points the teacher emphasized as important"],
  "assumptions": ["assumptions mentioned"],
  "exceptions": ["exceptions or edge cases mentioned"],
  "examplesAndAnalogies": [
    {
      "description": "the example or analogy",
      "relatedConcept": "which concept it illustrates",
      "sources": [{"segmentId": "seg-N", "startTime": 0}]
    }
  ]
}

Include only sections that have actual content from the chunk. Empty arrays are fine for sections with no relevant content.`;
}

/**
 * Build the prompt for Stage B: synthesizing all extracted knowledge into final lecture notes.
 */
export function buildSynthesisPrompt(
  extractions: ChunkExtraction[],
  videoTitle: string,
  videoUrl: string,
): string {
  const extractionSummary = JSON.stringify(extractions, null, 1);

  return `You are generating comprehensive lecture notes from extracted knowledge.

VIDEO: "${videoTitle}"
URL: ${videoUrl}

Below is structured knowledge extracted from ${extractions.length} chunks of the lecture transcript. Your task is to synthesize this into complete, well-organized lecture notes.

CRITICAL RULES:
1. Reconstruct the logical teaching order — organize by topic, not by chunk.
2. Merge duplicate definitions/explanations but preserve ALL unique details.
3. Connect related topics across chunks.
4. Preserve the teacher's examples, analogies, and explanations — these are valuable.
5. Maintain consistent terminology throughout.
6. Do NOT lose important details during synthesis.
7. Preserve source references (segment IDs and timestamps) alongside claims.
8. Distinguish lecture-derived content from any supplementary explanation you add.
9. Do NOT invent facts, formulas, proofs, or examples not in the source material.
10. If the transcript was unclear about something, note the uncertainty.

EXTRACTED KNOWLEDGE:
${extractionSummary}

Generate a JSON response with this structure:
{
  "overview": "A detailed introduction (3-5 paragraphs) explaining what the lecture teaches, its overall purpose, and how the major concepts fit together.",
  
  "learningObjectives": [
    "What a student should understand after studying this lecture (5-10 objectives)"
  ],
  
  "detailedNotes": "COMPREHENSIVE Markdown-formatted lecture notes. Use the following format where applicable:\\n\\n## Main Topic\\n\\n### Subtopic\\n\\n**Definition:** ...\\n\\n**Intuition:** ...\\n\\n**Explanation:** ...\\n\\n**Example:** ...\\n\\nFor algorithms: Purpose, Preconditions, Steps, Worked Example, Complexity, Edge Cases.\\nFor formulas: Formula, Variables, Assumptions, Derivation.\\nFor comparisons: Use Markdown tables.\\nFor code: Use fenced code blocks with language.\\n\\nInclude source references as [📍 MM:SS](url&t=Ns) links.\\nWrite DETAILED notes, not a brief summary. These should be useful to a student who wants to study without replaying the video.\\nAim for thorough coverage — at least 2000 words for substantial lectures.",
  
  "mindMap": [
    {"id": "root", "parentId": null, "label": "Lecture Topic"},
    {"id": "topic-1", "parentId": "root", "label": "Major Topic 1"},
    {"id": "subtopic-1-1", "parentId": "topic-1", "label": "Subtopic"}
  ],
  
  "glossary": [
    {
      "term": "Technical term",
      "definition": "Clear definition",
      "example": "Example if useful",
      "importance": "Why it matters",
      "isSupplementary": false,
      "sources": [{"segmentId": "seg-N", "startTime": 0}]
    }
  ],
  
  "revision": {
    "keyTakeaways": ["Most important points from the lecture"],
    "importantFacts": ["Facts to remember"],
    "formulasToRemember": ["Key formulas"],
    "preconditionsAndExceptions": ["Important conditions and exceptions"],
    "frequentlyConfusedConcepts": [
      {
        "concepts": ["Concept A", "Concept B"],
        "clarification": "How they differ"
      }
    ],
    "practiceQuestions": [
      {
        "question": "AI-generated practice question based on lecture content",
        "answer": "Answer based on the lecture"
      }
    ],
    "lastMinuteRevision": "A concise summary (2-3 paragraphs) for last-minute revision before an exam."
  }
}

NOTES FORMAT GUIDELINES:
- For the detailedNotes field, write rich Markdown with proper headings (## for main topics, ### for subtopics).
- Use **bold** for key terms, \`code\` for technical identifiers.
- Include timestamp links as [📍 MM:SS](${videoUrl}&t=Ns) where N is the start time in seconds.
- Use bullet points, numbered lists, and tables where appropriate.
- For mathematical formulas, use LaTeX notation: $formula$ for inline, $$formula$$ for display.
- Aim for comprehensive coverage. These are study notes, not a summary.`;
}

/**
 * Build a reduction prompt when intermediate extractions are too large for a single synthesis.
 */
export function buildReductionPrompt(
  extractions: ChunkExtraction[],
  groupIndex: number,
  totalGroups: number,
): string {
  const extractionData = JSON.stringify(extractions, null, 1);

  return `You are consolidating extracted lecture knowledge (group ${groupIndex + 1} of ${totalGroups}).

Merge the following chunk extractions into a single consolidated extraction. Rules:
1. Merge duplicate definitions — keep the most complete version.
2. Combine related concepts.
3. Preserve ALL unique information, examples, and source references.
4. Do NOT discard important details.
5. Maintain source references (segment IDs).

EXTRACTIONS TO CONSOLIDATE:
${extractionData}

Respond with a single JSON object in the ChunkExtraction format:
{
  "chunkIndex": ${groupIndex},
  "mainTopics": [...],
  "subtopics": [...],
  "definitions": [...],
  "concepts": [...],
  "formulas": [...],
  "algorithms": [...],
  "comparisons": [...],
  "keyFacts": [...],
  "examRelevantPoints": [...],
  "assumptions": [...],
  "exceptions": [...],
  "examplesAndAnalogies": [...]
}`;
}
