"use client";

import React from "react";
import { Loader2, CheckCircle2, XCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GenerationProgressProps {
  currentStage: string;
  stageIndex: number;
  totalStages: number;
  error?: string | null;
  onCancel?: () => void;
  onRetry?: () => void;
}

const STAGES = [
  "Validating video URL",
  "Retrieving video information",
  "Retrieving transcript",
  "Processing transcript",
  "Analyzing lecture content",
  "Generating detailed notes",
  "Building mind map",
  "Preparing revision materials",
];

export default function GenerationProgress({
  currentStage,
  stageIndex,
  totalStages,
  error,
  onCancel,
  onRetry,
}: GenerationProgressProps) {
  if (error) {
    return (
      <div className="w-full max-w-lg mx-auto">
        <div className="rounded-xl border-2 border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/30">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-800 dark:text-red-300">
                Generation Failed
              </h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-400">
                {error}
              </p>
              {onRetry && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  className="mt-3"
                >
                  Try Again
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="rounded-xl border-2 border-indigo-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
            Generating your study notes...
          </h3>
          {onCancel && (
            <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Cancel">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {STAGES.map((stage, idx) => {
            const isActive =
              currentStage.toLowerCase().includes(stage.toLowerCase().split(" ")[0]) ||
              idx === stageIndex;
            const isCompleted = idx < stageIndex;

            return (
              <div
                key={stage}
                className="flex items-center gap-3"
                role="status"
                aria-label={`${stage}: ${isCompleted ? "completed" : isActive ? "in progress" : "pending"}`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                ) : isActive ? (
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin text-indigo-600" />
                ) : (
                  <div className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-200 dark:border-slate-600" />
                )}
                <span
                  className={`text-sm ${
                    isCompleted
                      ? "text-slate-500 dark:text-slate-400"
                      : isActive
                        ? "font-medium text-indigo-700 dark:text-indigo-400"
                        : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {stage}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-5 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all duration-500"
            style={{
              width: `${Math.min(100, ((stageIndex + 1) / totalStages) * 100)}%`,
            }}
          />
        </div>

        <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
          This may take 1–3 minutes depending on lecture length
        </p>
      </div>
    </div>
  );
}
