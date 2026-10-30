import {
  type TranscriptSegment,
  type Transcript,
  type VideoMetadata,
  LectureFlowError,
  ErrorCodes,
} from "./types";
import { extractVideoId } from "./validation";

const SUPADATA_BASE_URL = "https://api.supadata.ai/v1";
const FETCH_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_ATTEMPTS = 60; // 5 minutes total

interface SupadataTranscriptContent {
  text?: string;
  offset?: number;
  duration?: number;
  startMs?: number;
  endMs?: number;
  start?: number;
  end?: number;
  lang?: string;
}

interface SupadataTranscriptResponse {
  content?: SupadataTranscriptContent[];
  lang?: string;
  // Async job fields
  jobId?: string;
  status?: string;
}

// GET /transcript/{jobId} returns the transcript fields at the top level
// (status, content, lang, error). Docs list: queued | active | completed | failed.
interface SupadataJobStatusResponse extends SupadataTranscriptResponse {
  status: string;
  /** Legacy nested shape, kept for backwards compatibility. */
  result?: SupadataTranscriptResponse;
  error?: string | { error?: string; message?: string; details?: string } | null;
}

interface SupadataVideoInfoResponse {
  title?: string;
  channel?: string | { id?: string; name?: string };
  channelName?: string;
  description?: string;
  duration?: number;
  durationMs?: number;
  lengthSeconds?: number;
  thumbnail?: string;
  thumbnailUrl?: string;
  thumbnails?: Array<{ url: string; width?: number; height?: number }>;
}

function getApiKey(): string {
  const key = process.env.SUPADATA_API_KEY;
  if (!key) {
    throw new LectureFlowError(
      "SUPADATA_API_KEY not configured",
      ErrorCodes.MISSING_CONFIG,
      503,
      "Transcript service is not configured.",
    );
  }
  return key;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new LectureFlowError(
        "Request timed out",
        ErrorCodes.NETWORK_ERROR,
        504,
        "The request to the transcript service timed out. Please try again.",
      );
    }
    throw new LectureFlowError(
      `Network error: ${error instanceof Error ? error.message : "Unknown"}`,
      ErrorCodes.NETWORK_ERROR,
      502,
      "Could not reach the transcript service. Please try again later.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

const RATE_LIMIT_MAX_RETRIES = 3;
const RATE_LIMIT_BASE_DELAY_MS = 1_500;
const RATE_LIMIT_MAX_DELAY_MS = 10_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * GET a Supadata URL. On HTTP 429 it waits (honoring Retry-After when present,
 * otherwise exponential backoff) and retries a few times before returning the
 * 429 response to the caller.
 */
async function supadataFetch(url: string, apiKey: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetchWithTimeout(url, {
      method: "GET",
      headers: { "x-api-key": apiKey },
    });

    if (response.status !== 429 || attempt >= RATE_LIMIT_MAX_RETRIES) {
      return response;
    }

    await response.text().catch(() => undefined); // release the connection
    const retryAfterSeconds = Number(response.headers?.get?.("retry-after"));
    const delayMs =
      Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : RATE_LIMIT_BASE_DELAY_MS * 2 ** attempt;
    await sleep(Math.min(delayMs, RATE_LIMIT_MAX_DELAY_MS));
  }
}

function handleErrorResponse(status: number, body: string): never {
  switch (status) {
    case 401:
    case 403:
      throw new LectureFlowError(
        "Supadata API key invalid or unauthorized",
        ErrorCodes.INVALID_API_KEY,
        503,
        "The transcript service API key is invalid. Please check configuration.",
      );
    case 404:
      throw new LectureFlowError(
        "Video not found on Supadata",
        ErrorCodes.VIDEO_NOT_FOUND,
        404,
        "The video could not be found. Please check the URL and ensure the video is publicly accessible.",
      );
    case 429:
      throw new LectureFlowError(
        "Supadata rate limit exceeded",
        ErrorCodes.RATE_LIMITED,
        429,
        "The transcript service rate limit has been reached. Please wait a moment and try again.",
      );
    case 402:
      throw new LectureFlowError(
        "Supadata quota exhausted",
        ErrorCodes.QUOTA_EXHAUSTED,
        429,
        "The transcript service usage quota has been exhausted. Please try again later or upgrade the plan.",
      );
    default:
      throw new LectureFlowError(
        `Supadata error ${status}: ${body.slice(0, 200)}`,
        ErrorCodes.TRANSCRIPT_FAILED,
        502,
        "The transcript service returned an error. Please try again.",
      );
  }
}

function parseStartTime(item: SupadataTranscriptContent): number {
  if (item.offset != null) {
    return item.offset / 1000;
  }
  if (item.startMs != null) {
    return item.startMs / 1000;
  }
  if (item.start != null) {
    if (item.start > 10000) {
      return item.start / 1000;
    }
    return item.start;
  }
  return 0;
}

function parseEndTime(
  item: SupadataTranscriptContent,
  startTime: number,
): number {
  if (item.endMs != null) {
    return item.endMs / 1000;
  }
  if (item.end != null) {
    if (item.end > 10000) {
      return item.end / 1000;
    }
    return item.end;
  }
  if (item.duration != null) {
    // Supadata segment durations are in milliseconds.
    // If offset is present, or duration > 60 (a single subtitle line never exceeds 60s), treat as ms.
    const durationSeconds =
      item.offset != null || item.duration > 60
        ? item.duration / 1000
        : item.duration;
    return startTime + durationSeconds;
  }
  return startTime + 5;
}

function normalizeSegments(
  content: SupadataTranscriptContent[],
): TranscriptSegment[] {
  return content
    .filter((item) => item.text && item.text.trim().length > 0)
    .map((item, index) => {
      const startTime = parseStartTime(item);
      const endTime = parseEndTime(item, startTime);

      return {
        id: `seg-${index}`,
        startTime,
        endTime,
        text: item.text!.trim(),
      };
    });
}

export async function fetchVideoMetadata(
  videoUrl: string,
): Promise<VideoMetadata> {
  const apiKey = getApiKey();
  let videoId: string | null = null;
  try {
    videoId = extractVideoId(videoUrl);
  } catch {
    // ignore if URL doesn't contain a valid 11-char ID (e.g. in test mocks)
  }

  // Try /metadata first (standard multi-platform endpoint with ?url=)
  let response = await supadataFetch(
    `${SUPADATA_BASE_URL}/metadata?url=${encodeURIComponent(videoUrl)}`,
    apiKey,
  );

  // Fallback to /youtube/video?id= if /metadata returned 404
  if (!response.ok && response.status === 404 && videoId) {
    response = await supadataFetch(
      `${SUPADATA_BASE_URL}/youtube/video?id=${encodeURIComponent(videoId)}`,
      apiKey,
    );
  }

  if (!response.ok) {
    // Metadata is optional; we can proceed without it for some errors
    if (response.status === 404) {
      return {
        title: "Unknown Video",
        url: videoUrl,
      };
    }
    // For auth/rate errors, we should still throw
    if (response.status === 401 || response.status === 403 || response.status === 429) {
      const body = await response.text();
      handleErrorResponse(response.status, body);
    }
    return {
      title: "Unknown Video",
      url: videoUrl,
    };
  }

  const data: SupadataVideoInfoResponse = await response.json();

  let duration = data.duration ?? data.lengthSeconds;
  if (duration == null && data.durationMs != null) {
    duration = data.durationMs / 1000;
  } else if (duration != null && duration > 50000) {
    // Duration in milliseconds
    duration = duration / 1000;
  }

  const channelName =
    typeof data.channel === "object" && data.channel !== null
      ? data.channel.name
      : typeof data.channel === "string"
        ? data.channel
        : data.channelName;

  const thumbnail =
    data.thumbnail ??
    data.thumbnailUrl ??
    (data.thumbnails && data.thumbnails.length > 0
      ? data.thumbnails[data.thumbnails.length - 1].url
      : null);

  return {
    title: data.title ?? "Unknown Video",
    url: videoUrl,
    channel: channelName,
    duration: duration ?? undefined,
    thumbnail: thumbnail ?? undefined,
    description: data.description
      ? data.description.slice(0, 500)
      : undefined,
  };
}

function describeJobError(error: SupadataJobStatusResponse["error"]): string {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  return error.message ?? error.details ?? error.error ?? "Unknown error";
}

async function pollJobStatus(
  jobId: string,
  apiKey: string,
): Promise<SupadataTranscriptResponse> {
  let attempts = 0;

  while (attempts < POLL_MAX_ATTEMPTS) {
    attempts++;

    await new Promise((resolve) =>
      setTimeout(resolve, POLL_INTERVAL_MS),
    );

    const response = await supadataFetch(
      `${SUPADATA_BASE_URL}/transcript/${encodeURIComponent(jobId)}`,
      apiKey,
    );

    if (!response.ok) {
      const body = await response.text();
      handleErrorResponse(response.status, body);
    }

    const data: SupadataJobStatusResponse = await response.json();

    switch (data.status) {
      case "completed": {
        const result = data.result ?? (data.content ? data : undefined);
        if (!result) {
          throw new LectureFlowError(
            "Job completed but no result returned",
            ErrorCodes.TRANSCRIPT_FAILED,
            502,
            "The transcript was processed but no result was returned.",
          );
        }
        return result;
      }
      case "failed":
      case "error":
        throw new LectureFlowError(
          `Transcript job failed: ${describeJobError(data.error)}`,
          ErrorCodes.TRANSCRIPT_FAILED,
          502,
          "The transcript extraction failed. The video may not have captions available.",
        );
      case "queued":
      case "active":
      case "pending":
      case "processing":
        // Continue polling
        break;
      default:
        break;
    }
  }

  throw new LectureFlowError(
    `Job polling timed out after ${POLL_MAX_ATTEMPTS} attempts`,
    ErrorCodes.JOB_TIMEOUT,
    504,
    "Transcript extraction took too long. Please try again or use a shorter video.",
  );
}

export async function fetchTranscript(videoUrl: string): Promise<Transcript> {
  const apiKey = getApiKey();
  const params = new URLSearchParams({ url: videoUrl });

  const response = await supadataFetch(
    `${SUPADATA_BASE_URL}/transcript?${params.toString()}`,
    apiKey,
  );

  if (!response.ok) {
    const body = await response.text();

    // Check for transcript-specific errors
    if (response.status === 404 || response.status === 400) {
      // Try to parse the error for more context
      try {
        const errorData = JSON.parse(body);
        if (
          errorData.error?.includes("transcript") ||
          errorData.message?.includes("transcript")
        ) {
          throw new LectureFlowError(
            `Transcript unavailable: ${errorData.error ?? errorData.message}`,
            ErrorCodes.TRANSCRIPT_UNAVAILABLE,
            404,
            "No transcript is available for this video. The video may not have captions enabled.",
          );
        }
      } catch (e) {
        if (e instanceof LectureFlowError) throw e;
      }
    }

    handleErrorResponse(response.status, body);
  }

  // Handle 202 Accepted (async job)
  if (response.status === 202) {
    const asyncData: SupadataTranscriptResponse = await response.json();
    if (!asyncData.jobId) {
      throw new LectureFlowError(
        "Received async response without job ID",
        ErrorCodes.TRANSCRIPT_FAILED,
        502,
        "The transcript service returned an unexpected response.",
      );
    }
    const result = await pollJobStatus(asyncData.jobId, apiKey);
    return processTranscriptResponse(result);
  }

  const data: SupadataTranscriptResponse = await response.json();
  return processTranscriptResponse(data);
}

function processTranscriptResponse(
  data: SupadataTranscriptResponse,
): Transcript {
  if (!data.content || data.content.length === 0) {
    throw new LectureFlowError(
      "Transcript response contains no content",
      ErrorCodes.TRANSCRIPT_UNAVAILABLE,
      404,
      "No transcript content was found for this video.",
    );
  }

  const segments = normalizeSegments(data.content);

  if (segments.length === 0) {
    throw new LectureFlowError(
      "All transcript segments were empty",
      ErrorCodes.TRANSCRIPT_UNAVAILABLE,
      404,
      "The transcript for this video appears to be empty.",
    );
  }

  const fullText = segments.map((s) => s.text).join(" ");
  let totalDuration =
    segments.length > 0
      ? segments[segments.length - 1].endTime
      : undefined;

  if (totalDuration != null && totalDuration > 50000) {
    totalDuration = totalDuration / 1000;
  }

  return {
    segments,
    fullText,
    language: data.lang ?? undefined,
    totalDuration,
  };
}
