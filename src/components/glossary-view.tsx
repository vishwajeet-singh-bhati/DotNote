"use client";

import React, { useState } from "react";
import type { GlossaryEntry } from "@/lib/types";
import SourceTimestamp from "@/components/source-timestamp";
import { Search, BookOpen, Info } from "lucide-react";

interface GlossaryViewProps {
  entries: GlossaryEntry[];
  videoUrl: string;
}

export default function GlossaryView({ entries, videoUrl }: GlossaryViewProps) {
  const [search, setSearch] = useState("");

  const filtered = entries.filter(
    (entry) =>
      entry.term.toLowerCase().includes(search.toLowerCase()) ||
      entry.definition.toLowerCase().includes(search.toLowerCase()),
  );

  if (entries.length === 0) {
    return (
      <div className="rounded-lg bg-slate-50 p-8 text-center dark:bg-slate-800/50">
        <BookOpen className="mx-auto h-8 w-8 text-slate-400" />
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          No keywords or definitions available.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search terms..."
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          aria-label="Search glossary"
        />
      </div>

      {/* Terms */}
      <div className="grid gap-3">
        {filtered.map((entry, idx) => (
          <div
            key={`${entry.term}-${idx}`}
            className="rounded-lg border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                {entry.term}
              </h4>
              {entry.isSupplementary && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                  <Info className="h-3 w-3" />
                  Supplementary
                </span>
              )}
            </div>

            <p className="mt-1.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {entry.definition}
            </p>

            {entry.example && (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium">Example:</span> {entry.example}
              </p>
            )}

            {entry.importance && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-500">
                <span className="font-medium">Importance:</span>{" "}
                {entry.importance}
              </p>
            )}

            {entry.sources && entry.sources.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {entry.sources.map((src, si) => (
                  <SourceTimestamp
                    key={si}
                    videoUrl={videoUrl}
                    startTime={src.startTime}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && search && (
          <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
            No terms matching &ldquo;{search}&rdquo;
          </p>
        )}
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500">
        {entries.length} term{entries.length !== 1 ? "s" : ""} total
      </p>
    </div>
  );
}
