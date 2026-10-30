import type { Transcript, TranscriptSegment, ProcessingChunk } from "./types";
import { LectureFlowError, ErrorCodes } from "./types";

const DEFAULT_CHUNK_CHAR_LIMIT = 13_000;
const OVERLAP_CHAR_COUNT = 300;

/**
 * Normalize transcript text: fix whitespace, preserve meaningful content.
 */
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Collapse multiple spaces (but not newlines)
    .replace(/[^\S\n]+/g, " ")
    // Remove excessive newlines (more than 2 in a row)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Normalize all transcript segments in place.
 */
export function normalizeTranscript(transcript: Transcript): Transcript {
  const segments = transcript.segments.map((seg) => ({
    ...seg,
    text: normalizeText(seg.text),
  }));

  const fullText = segments.map((s) => s.text).join(" ");

  return {
    ...transcript,
    segments,
    fullText,
  };
}

/**
 * Find the best split point at a sentence boundary near the target position.
 */
function findSentenceBoundary(text: string, targetPos: number): number {
  // Look backward up to 500 chars for a sentence boundary
  const searchStart = Math.max(0, targetPos - 500);
  const searchRegion = text.slice(searchStart, targetPos);

  // Find the last sentence-ending punctuation followed by a space or end
  const sentenceEnds = /[.!?]\s/g;
  let lastMatch = -1;
  let match: RegExpExecArray | null;

  while ((match = sentenceEnds.exec(searchRegion)) !== null) {
    lastMatch = searchStart + match.index + match[0].length;
  }

  // If we found a boundary within a reasonable range, use it
  if (lastMatch > 0 && targetPos - lastMatch < 500) {
    return lastMatch;
  }

  // Fall back to comma, semicolon, or other natural breaks
  const weakBreaks = /[,;:]\s/g;
  lastMatch = -1;
  while ((match = weakBreaks.exec(searchRegion)) !== null) {
    lastMatch = searchStart + match.index + match[0].length;
  }

  if (lastMatch > 0 && targetPos - lastMatch < 300) {
    return lastMatch;
  }

  // Final fallback: space boundary
  const lastSpace = text.lastIndexOf(" ", targetPos);
  return lastSpace > 0 ? lastSpace + 1 : targetPos;
}

/**
 * Map a character position in the concatenated text back to the source segment.
 */
function findSegmentAtPosition(
  segments: TranscriptSegment[],
  charPosition: number,
): number {
  let currentPos = 0;
  for (let i = 0; i < segments.length; i++) {
    const segLength = segments[i].text.length + 1; // +1 for the joining space
    if (currentPos + segLength > charPosition) {
      return i;
    }
    currentPos += segLength;
  }
  return segments.length - 1;
}

/**
 * Split the transcript into processing chunks with overlap.
 * Each chunk retains references to its source segments.
 */
export function chunkTranscript(
  transcript: Transcript,
  charLimit: number = DEFAULT_CHUNK_CHAR_LIMIT,
): ProcessingChunk[] {
  const { segments, fullText } = transcript;

  if (fullText.length <= charLimit) {
    return [
      {
        index: 0,
        text: fullText,
        segments: [...segments],
      },
    ];
  }

  const chunks: ProcessingChunk[] = [];
  let charPos = 0;
  let chunkIndex = 0;

  while (charPos < fullText.length) {
    const remainingLength = fullText.length - charPos;

    let endPos: number;
    if (remainingLength <= charLimit * 1.2) {
      // If remaining text is only slightly over the limit, take it all
      endPos = fullText.length;
    } else {
      endPos = findSentenceBoundary(fullText, charPos + charLimit);
    }

    const chunkText = fullText.slice(charPos, endPos);

    // Find which segments correspond to this chunk
    const startSegIdx = findSegmentAtPosition(segments, charPos);
    const endSegIdx = findSegmentAtPosition(segments, endPos - 1);

    const chunkSegments = segments.slice(startSegIdx, endSegIdx + 1);

    // Get overlap from the end of the previous chunk
    let overlapPrefix: string | undefined;
    if (chunkIndex > 0 && charPos > 0) {
      const overlapStart = Math.max(0, charPos - OVERLAP_CHAR_COUNT);
      overlapPrefix = fullText.slice(overlapStart, charPos);
    }

    chunks.push({
      index: chunkIndex,
      text: chunkText,
      segments: chunkSegments,
      overlapPrefix,
    });

    charPos = endPos;
    chunkIndex++;
  }

  return chunks;
}

/**
 * Check if the transcript exceeds the maximum allowed duration.
 */
export function checkDurationLimit(
  transcript: Transcript,
  maxDurationSeconds?: number,
): void {
  const limit = maxDurationSeconds ?? getMaxDuration();
  const duration = transcript.totalDuration;

  if (duration && duration > limit) {
    const minutes = Math.ceil(limit / 60);
    throw new LectureFlowError(
      `Video duration ${duration}s exceeds limit ${limit}s`,
      ErrorCodes.VIDEO_TOO_LONG,
      400,
      `This video is too long. The current maximum is approximately ${minutes} minutes. Please try a shorter lecture.`,
    );
  }
}

function getMaxDuration(): number {
  const envVal = process.env.MAX_VIDEO_DURATION_SECONDS;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 5400; // Default: 90 minutes
}

/**
 * Get the configured chunk character limit.
 */
export function getChunkCharLimit(): number {
  return DEFAULT_CHUNK_CHAR_LIMIT;
}
