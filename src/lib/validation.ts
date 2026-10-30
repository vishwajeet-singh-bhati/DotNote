import { z } from "zod";
import { LectureFlowError, ErrorCodes } from "./types";

// ─── YouTube URL Validation ─────────────────────────────────────────────────

const YOUTUBE_HOSTS = new Set([
  "www.youtube.com",
  "youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

export function extractVideoId(urlString: string): string {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new LectureFlowError(
      `Invalid URL format: ${urlString}`,
      ErrorCodes.INVALID_URL,
      400,
      "Please provide a valid YouTube URL.",
    );
  }

  if (!YOUTUBE_HOSTS.has(parsed.hostname)) {
    throw new LectureFlowError(
      `Unsupported host: ${parsed.hostname}`,
      ErrorCodes.INVALID_URL,
      400,
      "Only YouTube URLs are supported. Please provide a youtube.com or youtu.be link.",
    );
  }

  // Only allow http/https protocols
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new LectureFlowError(
      "Invalid protocol",
      ErrorCodes.INVALID_URL,
      400,
      "Please provide a valid YouTube URL.",
    );
  }

  let videoId: string | null = null;

  if (parsed.hostname === "youtu.be" || parsed.hostname === "www.youtu.be") {
    // youtu.be/VIDEO_ID
    videoId = parsed.pathname.slice(1).split("/")[0] || null;
  } else {
    // youtube.com formats
    const pathname = parsed.pathname;

    if (pathname.startsWith("/watch")) {
      videoId = parsed.searchParams.get("v");
    } else if (pathname.startsWith("/shorts/")) {
      videoId = pathname.split("/shorts/")[1]?.split("/")[0] || null;
    } else if (pathname.startsWith("/embed/")) {
      videoId = pathname.split("/embed/")[1]?.split("/")[0] || null;
    } else if (pathname.startsWith("/v/")) {
      videoId = pathname.split("/v/")[1]?.split("/")[0] || null;
    }
  }

  if (!videoId || !VIDEO_ID_REGEX.test(videoId)) {
    throw new LectureFlowError(
      `Could not extract video ID from: ${urlString}`,
      ErrorCodes.INVALID_URL,
      400,
      "Could not find a valid video ID in the URL. Please check the link and try again.",
    );
  }

  return videoId;
}

export function buildCanonicalUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function buildTimestampUrl(videoUrl: string, startTimeSeconds: number): string {
  const seconds = Math.floor(startTimeSeconds);
  const separator = videoUrl.includes("?") ? "&" : "?";
  return `${videoUrl}${separator}t=${seconds}s`;
}

export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Request validation ─────────────────────────────────────────────────────

export const GenerateRequestSchema = z.object({
  url: z.string().min(1, "URL is required").url("Please provide a valid URL"),
});

// ─── Config validation ──────────────────────────────────────────────────────

export function validateConfig(): { supadataKey: string; groqKey: string } {
  const supadataKey = process.env.SUPADATA_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (!supadataKey) {
    throw new LectureFlowError(
      "SUPADATA_API_KEY is not configured",
      ErrorCodes.MISSING_CONFIG,
      503,
      "The transcript service is not configured. Please set the SUPADATA_API_KEY environment variable.",
    );
  }

  if (!groqKey) {
    throw new LectureFlowError(
      "GROQ_API_KEY is not configured",
      ErrorCodes.MISSING_CONFIG,
      503,
      "The AI service is not configured. Please set the GROQ_API_KEY environment variable.",
    );
  }

  return { supadataKey, groqKey };
}
