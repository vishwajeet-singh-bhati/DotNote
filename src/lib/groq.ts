import Groq from "groq-sdk";
import { z } from "zod";
import { LectureFlowError, ErrorCodes } from "./types";

// ─── Configuration ──────────────────────────────────────────────────────────

function getGroqClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new LectureFlowError(
      "GROQ_API_KEY not configured",
      ErrorCodes.MISSING_CONFIG,
      503,
      "The AI service is not configured. Please set the GROQ_API_KEY environment variable.",
    );
  }
  return new Groq({ apiKey });
}

export function getModel(): string {
  return process.env.GROQ_MODEL || "openai/gpt-oss-120b";
}

export function getFallbackModel(): string {
  return process.env.GROQ_FALLBACK_MODEL || "openai/gpt-oss-20b";
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface LLMCallOptions {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  useFallback?: boolean;
}

// ─── Core LLM Call ──────────────────────────────────────────────────────────

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

/**
 * Make a structured JSON call to the Groq API.
 * Uses JSON mode and validates the response with the provided Zod schema.
 */
export async function callLLM<T>(
  options: LLMCallOptions,
  schema: z.ZodType<T>,
): Promise<T> {
  const client = getGroqClient();
  const model = options.useFallback ? getFallbackModel() : getModel();

  const systemMessage = options.systemPrompt ??
    "You are an expert educational content analyst. Always respond with valid JSON.";

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: options.prompt },
        ],
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 8000,
        response_format: { type: "json_object" },
      });

      const content = completion.choices?.[0]?.message?.content;
      if (!content) {
        throw new LectureFlowError(
          "Empty response from LLM",
          ErrorCodes.LLM_ERROR,
          502,
          "The AI model returned an empty response. Please try again.",
        );
      }

      // Parse JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        // Sometimes models wrap JSON in markdown code blocks
        const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
        if (jsonMatch?.[1]) {
          try {
            parsed = JSON.parse(jsonMatch[1]);
          } catch {
            throw new LectureFlowError(
              "Failed to parse LLM response as JSON",
              ErrorCodes.LLM_VALIDATION_ERROR,
              502,
              "The AI model returned an invalid response. Retrying...",
            );
          }
        } else {
          throw new LectureFlowError(
            "Failed to parse LLM response as JSON",
            ErrorCodes.LLM_VALIDATION_ERROR,
            502,
            "The AI model returned an invalid response. Retrying...",
          );
        }
      }

      // Validate with Zod
      const validated = schema.safeParse(parsed);
      if (!validated.success) {
        const issues = validated.error.issues
          .slice(0, 5)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ");

        // If this is the last retry, try partial parsing
        if (attempt === MAX_RETRIES) {
          // Try a lenient parse
          const lenient = schema.safeParse(parsed);
          if (lenient.success) return lenient.data;

          throw new LectureFlowError(
            `LLM output validation failed: ${issues}`,
            ErrorCodes.LLM_VALIDATION_ERROR,
            502,
            "The AI model output didn't match the expected format after multiple attempts.",
          );
        }

        throw new Error(`Validation failed: ${issues}`);
      }

      return validated.data;
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry non-transient errors
      if (error instanceof LectureFlowError) {
        if (
          error.code === ErrorCodes.MISSING_CONFIG ||
          error.code === ErrorCodes.INVALID_API_KEY
        ) {
          throw error;
        }
      }

      // Check for rate limiting from Groq
      if (
        error instanceof Error &&
        (error.message.includes("429") ||
          error.message.includes("rate_limit") ||
          error.message.toLowerCase().includes("rate limit"))
      ) {
        if (attempt === MAX_RETRIES) {
          throw new LectureFlowError(
            "Groq rate limit exceeded",
            ErrorCodes.RATE_LIMITED,
            429,
            "The AI service rate limit has been reached. Please wait a moment and try again.",
          );
        }
        // Wait longer for rate limits
        await new Promise((r) =>
          setTimeout(r, RETRY_DELAY_MS * (attempt + 2)),
        );
        continue;
      }

      // Check for quota/auth errors
      if (
        error instanceof Error &&
        (error.message.includes("401") ||
          error.message.includes("403") ||
          error.message.includes("authentication"))
      ) {
        throw new LectureFlowError(
          "Groq API authentication failed",
          ErrorCodes.INVALID_API_KEY,
          503,
          "The AI service API key is invalid. Please check configuration.",
        );
      }

      if (attempt < MAX_RETRIES) {
        await new Promise((r) =>
          setTimeout(r, RETRY_DELAY_MS * (attempt + 1)),
        );
        continue;
      }
    }
  }

  throw new LectureFlowError(
    `LLM call failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`,
    ErrorCodes.LLM_ERROR,
    502,
    "The AI model failed to generate a valid response. Please try again.",
  );
}
