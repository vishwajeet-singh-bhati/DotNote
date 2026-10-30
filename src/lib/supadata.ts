import {
  type TranscriptSegment,
  type Transcript,
  type VideoMetadata,
  LectureFlowError,
  ErrorCodes,
} from "./types";

const SUPADATA_BASE_URL = "https://api.supadata.ai/v1";
const FETCH_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_ATTEMPTS = 60; // 5 minutes total

interface SupadataTranscriptContent {
  text?: string;
  startMs?: number;
  endMs?: number;
  start?: number;
  end?: number;
  duration?: number;
}

interface SupadataTranscriptResponse {
  content?: SupadataTranscriptContent[];
  lang?: string;
  // Async job fields
  jobId?: string;
  status?: string;
}

interface SupadataJobStatusResponse {
  status: "pending" | "processing" | "completed" | "failed" | "error";
  result?: SupadataTranscriptResponse;
  error?: string;
}

interface SupadataVideoInfoResponse {
  title?: string;
  channel?: string;
  channelName?: string;
  description?: string;
  duration?: number;
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

function normalizeSegments(
  content: SupadataTranscriptContent[],
): TranscriptSegment[] {
  return content
    .filter((item) => item.text && item.text.trim().length > 0)
    .map((item, index) => {
      const startTime =
        item.startMs != null
          ? item.startMs / 1000
          : item.start != null
            ? item.start
            : 0;

      const endTime =
        item.endMs != null
          ? item.endMs / 1000
          : item.end != null
            ? item.end
            : item.duration != null
              ? startTime + item.duration
              : startTime + 5; // Default 5s segment

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
  const params = new URLSearchParams({ url: videoUrl });
  const response = await fetchWithTimeout(
    `${SUPADATA_BASE_URL}/youtube/video?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
      },
    },
  );

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

  const duration = data.duration ?? data.lengthSeconds;
  const thumbnail =
    data.thumbnail ??
    data.thumbnailUrl ??
    (data.thumbnails && data.thumbnails.length > 0
      ? data.thumbnails[data.thumbnails.length - 1].url
      : null);

  return {
    title: data.title ?? "Unknown Video",
    url: videoUrl,
    channel: data.channel ?? data.channelName,
    duration: duration ?? undefined,
    thumbnail: thumbnail ?? undefined,
    description: data.description
      ? data.description.slice(0, 500)
      : undefined,
  };
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

    const response = await fetchWithTimeout(
      `${SUPADATA_BASE_URL}/job/${encodeURIComponent(jobId)}`,
      {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
        },
      },
    );

    if (!response.ok) {
      const body = await response.text();
      handleErrorResponse(response.status, body);
    }

    const data: SupadataJobStatusResponse = await response.json();

    switch (data.status) {
      case "completed":
        if (!data.result) {
          throw new LectureFlowError(
            "Job completed but no result returned",
            ErrorCodes.TRANSCRIPT_FAILED,
            502,
            "The transcript was processed but no result was returned.",
          );
        }
        return data.result;
      case "failed":
      case "error":
        throw new LectureFlowError(
          `Transcript job failed: ${data.error ?? "Unknown error"}`,
          ErrorCodes.TRANSCRIPT_FAILED,
          502,
          "The transcript extraction failed. The video may not have captions available.",
        );
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

  const response = await fetchWithTimeout(
    `${SUPADATA_BASE_URL}/transcript?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
      },
    },
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
  const totalDuration =
    segments.length > 0
      ? segments[segments.length - 1].endTime
      : undefined;

  return {
    segments,
    fullText,
    language: data.lang ?? undefined,
    totalDuration,
  };
}
