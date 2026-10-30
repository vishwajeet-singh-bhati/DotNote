"use client";

import React from "react";

interface SourceTimestampProps {
  videoUrl: string;
  startTime: number;
  label?: string;
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

export default function SourceTimestamp({
  videoUrl,
  startTime,
  label,
}: SourceTimestampProps) {
  const seconds = Math.floor(startTime);
  const timestampUrl = `${videoUrl}&t=${seconds}s`;
  const displayTime = label ?? formatTimestamp(startTime);

  return (
    <a
      href={timestampUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-xs font-mono text-indigo-600 hover:bg-indigo-100 transition-colors dark:bg-indigo-950 dark:text-indigo-400 dark:hover:bg-indigo-900"
      title={`Jump to ${displayTime} in the video`}
    >
      📍 {displayTime}
    </a>
  );
}
