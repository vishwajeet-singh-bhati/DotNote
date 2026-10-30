import { LectureFlowError, ErrorCodes } from "@/lib/types";
import type { GenerateProgressEvent } from "@/lib/types";
import {
  GenerateRequestSchema,
  extractVideoId,
  buildCanonicalUrl,
  validateConfig,
} from "@/lib/validation";
import { fetchVideoMetadata, fetchTranscript } from "@/lib/supadata";
import {
  normalizeTranscript,
  chunkTranscript,
  checkDurationLimit,
} from "@/lib/transcript-processing";
import { generateNotes } from "@/lib/note-generation";

export const maxDuration = 300;

const TOTAL_STAGES = 7;

export async function POST(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      /** Send a progress event to the client. */
      function sendProgress(stage: string, stageIndex: number): void {
        const event: GenerateProgressEvent = {
          type: "progress",
          stage,
          stageIndex,
          totalStages: TOTAL_STAGES,
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      /** Send a complete event with the final data. */
      function sendComplete(data: GenerateProgressEvent["data"]): void {
        const event: GenerateProgressEvent = {
          type: "complete",
          data,
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      /** Send an error event and close the stream. */
      function sendError(error: string, errorCode?: string): void {
        const event: GenerateProgressEvent = {
          type: "error",
          error,
          errorCode,
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      try {
        // ── Step 1: Parse and validate the request body ─────────────────
        sendProgress("Validating video URL", 1);

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          sendError("Invalid request body. Please send a JSON object with a 'url' field.", ErrorCodes.INVALID_URL);
          controller.close();
          return;
        }

        const parseResult = GenerateRequestSchema.safeParse(body);
        if (!parseResult.success) {
          const message = parseResult.error.issues
            .map((e: { message: string }) => e.message)
            .join("; ");
          sendError(message, ErrorCodes.INVALID_URL);
          controller.close();
          return;
        }

        const { url } = parseResult.data;

        // Validate server-side config
        validateConfig();

        // Extract video ID and build canonical URL
        const videoId = extractVideoId(url);
        const canonicalUrl = buildCanonicalUrl(videoId);

        // ── Step 2: Fetch video metadata ────────────────────────────────
        sendProgress("Retrieving video information", 2);

        const metadata = await fetchVideoMetadata(canonicalUrl);

        // Check duration limit using metadata if available
        // We'll do a more precise check after fetching the transcript

        // ── Step 3: Fetch transcript ────────────────────────────────────
        sendProgress("Retrieving transcript", 3);

        const rawTranscript = await fetchTranscript(canonicalUrl);

        // Check duration limit
        checkDurationLimit(rawTranscript);

        // Normalize transcript
        const transcript = normalizeTranscript(rawTranscript);

        // ── Step 4: Chunk transcript ────────────────────────────────────
        sendProgress("Processing transcript", 4);

        const chunks = chunkTranscript(transcript);

        // ── Step 5: Generate notes via LLM ──────────────────────────────
        sendProgress("Generating detailed notes", 5);

        const notes = await generateNotes(chunks, metadata, transcript, (stage, index, total) => {
          sendProgress(`${stage} (${index}/${total})`, 5);
        });

        // ── Step 6: Mind map (already included in synthesis) ────────────
        sendProgress("Building mind map", 6);

        // ── Step 7: Revision materials (already included in synthesis) ──
        sendProgress("Preparing revision materials", 7);

        // ── Send complete event ─────────────────────────────────────────
        sendComplete(notes);
      } catch (error: unknown) {
        // Sanitize and log the error
        if (error instanceof LectureFlowError) {
          console.error(
            `[LectureFlow] ${error.code}: ${error.message}`,
          );
          sendError(
            error.userMessage ?? "An unexpected error occurred. Please try again.",
            error.code,
          );
        } else {
          // Sanitize: never expose raw error details or API keys
          const safeMessage =
            error instanceof Error ? error.message : "Unknown error";
          const sanitized = safeMessage
            .replace(/sk-[a-zA-Z0-9_-]+/g, "[REDACTED]")
            .replace(/key[=:]\s*\S+/gi, "key=[REDACTED]");
          console.error(`[LectureFlow] Unhandled error: ${sanitized}`);

          sendError(
            "An unexpected error occurred while generating notes. Please try again.",
            ErrorCodes.PROCESSING_ERROR,
          );
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
