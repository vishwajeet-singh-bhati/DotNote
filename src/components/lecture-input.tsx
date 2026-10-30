"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Link as LinkIcon, AlertCircle } from "lucide-react";

interface LectureInputProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

const YOUTUBE_URL_PATTERN =
  /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)[a-zA-Z0-9_-]+/;

export default function LectureInput({ onSubmit, isLoading }: LectureInputProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const trimmed = url.trim();
      if (!trimmed) {
        setError("Please enter a YouTube URL.");
        return;
      }

      if (!YOUTUBE_URL_PATTERN.test(trimmed)) {
        setError(
          "Please enter a valid YouTube video URL (e.g., https://www.youtube.com/watch?v=...)",
        );
        return;
      }

      onSubmit(trimmed);
    },
    [url, onSubmit],
  );

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="relative">
        <div className="flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 py-3 shadow-sm transition-all duration-200 focus-within:border-indigo-400 focus-within:shadow-md dark:border-slate-700 dark:bg-slate-900">
          <LinkIcon className="h-5 w-5 shrink-0 text-slate-400" />
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError(null);
            }}
            placeholder="https://www.youtube.com/watch?v=..."
            className="flex-1 bg-transparent text-base text-slate-900 placeholder:text-slate-400 outline-none dark:text-slate-100"
            disabled={isLoading}
            aria-label="YouTube video URL"
            aria-describedby={error ? "url-error" : undefined}
            autoFocus
          />
        </div>

        {error && (
          <div
            id="url-error"
            role="alert"
            className="mt-2 flex items-center gap-2 text-sm text-red-600 dark:text-red-400"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <Button
        type="submit"
        size="xl"
        disabled={isLoading || !url.trim()}
        className="mt-4 w-full"
      >
        <Sparkles className="h-5 w-5" />
        {isLoading ? "Generating..." : "Generate Study Notes"}
      </Button>
    </form>
  );
}
