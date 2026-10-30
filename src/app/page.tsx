"use client";

import React, { useState, useCallback, useRef } from "react";
import LectureInput from "@/components/lecture-input";
import GenerationProgress from "@/components/generation-progress";
import NotesView from "@/components/notes-view";
import MindMap from "@/components/mind-map";
import GlossaryView from "@/components/glossary-view";
import RevisionView from "@/components/revision-view";
import DownloadControls from "@/components/download-controls";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import type { GeneratedNotes, GenerateProgressEvent } from "@/lib/types";
import {
  GraduationCap,
  BookOpen,
  Brain,
  FileText,
  ClipboardList,
  ArrowLeft,
  ExternalLink,
  Shield,
  Sparkles,
  Network,
  BookMarked,
} from "lucide-react";

type AppState = "idle" | "loading" | "success" | "error";

export default function HomePage() {
  const [state, setState] = useState<AppState>("idle");
  const [notes, setNotes] = useState<GeneratedNotes | null>(null);
  const [currentStage, setCurrentStage] = useState("");
  const [stageIndex, setStageIndex] = useState(0);
  const [totalStages, setTotalStages] = useState(8);
  const [error, setError] = useState<string | null>(null);
  const [submittedUrl, setSubmittedUrl] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const handleSubmit = useCallback(async (url: string) => {
    setState("loading");
    setError(null);
    setNotes(null);
    setSubmittedUrl(url);
    setCurrentStage("Validating video URL");
    setStageIndex(0);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: controller.signal,
      });

      if (!response.ok && !response.body) {
        const errData = await response.json().catch(() => null);
        throw new Error(
          errData?.error ?? `Server error (${response.status})`,
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response stream available");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process SSE events
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const dataMatch = line.match(/^data:\s*(.+)$/m);
          if (!dataMatch) continue;

          try {
            const event: GenerateProgressEvent = JSON.parse(dataMatch[1]);

            switch (event.type) {
              case "progress":
                setCurrentStage(event.stage ?? "Processing...");
                setStageIndex(event.stageIndex ?? 0);
                setTotalStages(event.totalStages ?? 8);
                break;
              case "complete":
                if (event.data) {
                  setNotes(event.data);
                  setState("success");
                }
                break;
              case "error":
                setError(event.error ?? "An unexpected error occurred.");
                setState("error");
                break;
            }
          } catch {
            // Skip malformed events
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        const dataMatch = buffer.match(/^data:\s*(.+)$/m);
        if (dataMatch) {
          try {
            const event: GenerateProgressEvent = JSON.parse(dataMatch[1]);
            if (event.type === "complete" && event.data) {
              setNotes(event.data);
              setState("success");
            } else if (event.type === "error") {
              setError(event.error ?? "An unexpected error occurred.");
              setState("error");
            }
          } catch {
            // Skip
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setState("idle");
        return;
      }
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again.",
      );
      setState("error");
    }
  }, []);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState("idle");
  }, []);

  const handleReset = useCallback(() => {
    setState("idle");
    setNotes(null);
    setError(null);
    setCurrentStage("");
    setStageIndex(0);
    setSubmittedUrl("");
  }, []);

  const handleRetry = useCallback(() => {
    if (submittedUrl) {
      handleSubmit(submittedUrl);
    }
  }, [submittedUrl, handleSubmit]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/80 print:hidden sticky top-0 z-50">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white hover:opacity-80 transition-opacity"
          >
            <GraduationCap className="h-6 w-6 text-indigo-600" />
            LectureFlow
          </button>
          {state === "success" && (
            <Button variant="outline" size="sm" onClick={handleReset}>
              <ArrowLeft className="h-4 w-4" />
              New Lecture
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* ─── IDLE STATE: Landing Page ─────────────────── */}
        {state === "idle" && (
          <div className="flex flex-col items-center pt-8 pb-16 md:pt-16">
            {/* Hero */}
            <div className="text-center max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
                <Sparkles className="h-4 w-4" />
                AI-Powered Study Notes
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
                Turn lectures into{" "}
                <span className="text-indigo-600 dark:text-indigo-400">
                  knowledge
                </span>
              </h1>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                Paste a YouTube lecture link and get detailed study notes, a
                visual mind map, a glossary of key terms, and revision material
                — all powered by AI.
              </p>
            </div>

            {/* Input */}
            <div className="mt-10 w-full max-w-2xl">
              <LectureInput onSubmit={handleSubmit} isLoading={false} />
            </div>

            {/* Features */}
            <div className="mt-14 grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                {
                  icon: FileText,
                  label: "Detailed Notes",
                  desc: "Comprehensive lecture notes with examples",
                },
                {
                  icon: Network,
                  label: "Mind Map",
                  desc: "Visual topic hierarchy",
                },
                {
                  icon: BookMarked,
                  label: "Glossary",
                  desc: "Key terms & definitions",
                },
                {
                  icon: ClipboardList,
                  label: "Revision Sheet",
                  desc: "Exam prep & practice questions",
                },
              ].map((feature) => (
                <div
                  key={feature.label}
                  className="flex flex-col items-center rounded-lg border border-slate-200 bg-white p-4 text-center dark:border-slate-700 dark:bg-slate-900"
                >
                  <feature.icon className="h-6 w-6 text-indigo-500" />
                  <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {feature.label}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* Privacy Note */}
            <div className="mt-8 flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <Shield className="h-4 w-4 shrink-0" />
              <span>
                Your results stay in your browser session. Nothing is saved to a
                database.
              </span>
            </div>
          </div>
        )}

        {/* ─── LOADING STATE ──────────────────────────── */}
        {state === "loading" && (
          <div className="flex flex-col items-center pt-16">
            <GenerationProgress
              currentStage={currentStage}
              stageIndex={stageIndex}
              totalStages={totalStages}
              onCancel={handleCancel}
            />
          </div>
        )}

        {/* ─── ERROR STATE ────────────────────────────── */}
        {state === "error" && (
          <div className="flex flex-col items-center pt-16">
            <GenerationProgress
              currentStage=""
              stageIndex={0}
              totalStages={8}
              error={error}
              onRetry={handleRetry}
            />
            <Button
              variant="ghost"
              onClick={handleReset}
              className="mt-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Start Over
            </Button>
          </div>
        )}

        {/* ─── SUCCESS STATE: Results ─────────────────── */}
        {state === "success" && notes && (
          <div className="pb-16">
            {/* Video Info Header */}
            <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                {notes.video.thumbnail && (
                  <img
                    src={notes.video.thumbnail}
                    alt={notes.video.title}
                    className="h-24 w-40 shrink-0 rounded-lg object-cover sm:h-20 sm:w-36"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                    {notes.video.title}
                  </h2>
                  {notes.video.channel && (
                    <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                      {notes.video.channel}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <a
                      href={notes.video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Watch Video
                    </a>
                    {notes.video.duration && (
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {Math.round(notes.video.duration / 60)} min
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0">
                  <DownloadControls notes={notes} />
                </div>
              </div>

              {/* Overview */}
              <div className="mt-4 rounded-lg bg-indigo-50/50 p-4 dark:bg-indigo-950/20">
                <h3 className="text-sm font-semibold text-indigo-800 dark:text-indigo-300 mb-1">
                  Overview
                </h3>
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line">
                  {notes.overview}
                </p>
              </div>

              {/* Learning Objectives */}
              {notes.learningObjectives.length > 0 && (
                <div className="mt-3">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Learning Objectives
                  </h3>
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {notes.learningObjectives.map((obj, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400"
                      >
                        <span className="mt-0.5 shrink-0 text-indigo-500">
                          ✓
                        </span>
                        {obj}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Tabs */}
            <Tabs defaultValue="notes">
              <TabsList className="w-full flex flex-wrap h-auto gap-1 sm:inline-flex sm:h-11 sm:w-auto">
                <TabsTrigger value="notes" className="gap-1.5">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Detailed</span> Notes
                </TabsTrigger>
                <TabsTrigger value="mindmap" className="gap-1.5">
                  <Brain className="h-4 w-4" />
                  Mind Map
                </TabsTrigger>
                <TabsTrigger value="glossary" className="gap-1.5">
                  <BookOpen className="h-4 w-4" />
                  <span className="hidden sm:inline">Keywords &</span> Glossary
                </TabsTrigger>
                <TabsTrigger value="revision" className="gap-1.5">
                  <ClipboardList className="h-4 w-4" />
                  Revision
                </TabsTrigger>
              </TabsList>

              <TabsContent value="notes">
                <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-8 dark:border-slate-700 dark:bg-slate-900">
                  <NotesView
                    markdown={notes.detailedNotes}
                    videoUrl={notes.video.url}
                  />
                </div>
              </TabsContent>

              <TabsContent value="mindmap">
                <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-8 dark:border-slate-700 dark:bg-slate-900">
                  <MindMap nodes={notes.mindMap} videoUrl={notes.video.url} />
                </div>
              </TabsContent>

              <TabsContent value="glossary">
                <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-8 dark:border-slate-700 dark:bg-slate-900">
                  <GlossaryView
                    entries={notes.glossary}
                    videoUrl={notes.video.url}
                  />
                </div>
              </TabsContent>

              <TabsContent value="revision">
                <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-8 dark:border-slate-700 dark:bg-slate-900">
                  <RevisionView revision={notes.revision} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 dark:border-slate-800 dark:bg-slate-950 print:hidden">
        <div className="mx-auto max-w-6xl px-4 text-center text-xs text-slate-500 dark:text-slate-400">
          <p>
            LectureFlow — AI-Powered Lecture Notes Generator.
          </p>
          <p className="mt-1">
            Results are AI-generated and may not be 100% accurate. Always verify
            with your course materials.
          </p>
        </div>
      </footer>
    </div>
  );
}
