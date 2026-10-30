"use client";

import React from "react";
import type { RevisionSheet } from "@/lib/types";
import {
  Lightbulb,
  CheckCircle,
  Calculator,
  AlertTriangle,
  HelpCircle,
  Zap,
  Shuffle,
} from "lucide-react";

interface RevisionViewProps {
  revision: RevisionSheet;
}

function Section({
  icon: Icon,
  title,
  children,
  accent = "indigo",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  accent?: string;
}) {
  const colorMap: Record<string, string> = {
    indigo: "border-indigo-200 dark:border-indigo-900",
    green: "border-green-200 dark:border-green-900",
    amber: "border-amber-200 dark:border-amber-900",
    red: "border-red-200 dark:border-red-900",
    purple: "border-purple-200 dark:border-purple-900",
    blue: "border-blue-200 dark:border-blue-900",
    cyan: "border-cyan-200 dark:border-cyan-900",
  };

  const iconColorMap: Record<string, string> = {
    indigo: "text-indigo-600 dark:text-indigo-400",
    green: "text-green-600 dark:text-green-400",
    amber: "text-amber-600 dark:text-amber-400",
    red: "text-red-600 dark:text-red-400",
    purple: "text-purple-600 dark:text-purple-400",
    blue: "text-blue-600 dark:text-blue-400",
    cyan: "text-cyan-600 dark:text-cyan-400",
  };

  return (
    <div
      className={`rounded-lg border-2 ${colorMap[accent] || colorMap.indigo} bg-white p-5 dark:bg-slate-900`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon
          className={`h-5 w-5 ${iconColorMap[accent] || iconColorMap.indigo}`}
        />
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

export default function RevisionView({ revision }: RevisionViewProps) {
  return (
    <div className="space-y-5">
      {/* Key Takeaways */}
      <Section icon={Lightbulb} title="Key Takeaways" accent="indigo">
        <ul className="space-y-2">
          {revision.keyTakeaways.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
              <span className="mt-0.5 shrink-0 text-indigo-500">•</span>
              {item}
            </li>
          ))}
        </ul>
      </Section>

      {/* Important Facts */}
      <Section icon={CheckCircle} title="Important Facts" accent="green">
        <ul className="space-y-2">
          {revision.importantFacts.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
              <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />
              {item}
            </li>
          ))}
        </ul>
      </Section>

      {/* Formulas */}
      {revision.formulasToRemember && revision.formulasToRemember.length > 0 && (
        <Section icon={Calculator} title="Formulas to Remember" accent="blue">
          <ul className="space-y-2">
            {revision.formulasToRemember.map((item, i) => (
              <li
                key={i}
                className="rounded-md bg-blue-50 p-3 text-sm font-mono text-slate-800 dark:bg-blue-950/30 dark:text-slate-200"
              >
                {item}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Preconditions & Exceptions */}
      {revision.preconditionsAndExceptions && revision.preconditionsAndExceptions.length > 0 && (
        <Section icon={AlertTriangle} title="Preconditions & Exceptions" accent="amber">
          <ul className="space-y-2">
            {revision.preconditionsAndExceptions.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                {item}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Frequently Confused Concepts */}
      {revision.frequentlyConfusedConcepts && revision.frequentlyConfusedConcepts.length > 0 && (
        <Section icon={Shuffle} title="Frequently Confused Concepts" accent="red">
          <div className="space-y-3">
            {revision.frequentlyConfusedConcepts.map((item, i) => (
              <div
                key={i}
                className="rounded-md bg-red-50 p-3 dark:bg-red-950/20"
              >
                <p className="font-medium text-sm text-red-800 dark:text-red-300">
                  {item.concepts.join(" vs ")}
                </p>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-400">
                  {item.clarification}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Practice Questions */}
      {revision.practiceQuestions && revision.practiceQuestions.length > 0 && (
        <Section icon={HelpCircle} title="Practice Questions" accent="purple">
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400 italic">
            These are AI-generated practice questions based on the lecture
            content. They have not appeared in any actual examination.
          </p>
          <div className="space-y-4">
            {revision.practiceQuestions.map((q, i) => (
              <PracticeQuestion key={i} question={q.question} answer={q.answer} index={i} />
            ))}
          </div>
        </Section>
      )}

      {/* Last-Minute Revision */}
      {revision.lastMinuteRevision && (
        <Section icon={Zap} title="Last-Minute Revision" accent="cyan">
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line">
            {revision.lastMinuteRevision}
          </p>
        </Section>
      )}
    </div>
  );
}

function PracticeQuestion({
  question,
  answer,
  index,
}: {
  question: string;
  answer: string;
  index: number;
}) {
  const [showAnswer, setShowAnswer] = React.useState(false);

  return (
    <div className="rounded-md border border-purple-200 bg-purple-50/50 p-3 dark:border-purple-900 dark:bg-purple-950/20">
      <p className="font-medium text-sm text-slate-800 dark:text-slate-200">
        Q{index + 1}: {question}
      </p>
      {showAnswer ? (
        <div className="mt-2">
          <p className="text-sm text-slate-700 dark:text-slate-300">{answer}</p>
          <button
            onClick={() => setShowAnswer(false)}
            className="mt-1 text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400"
          >
            Hide Answer
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowAnswer(true)}
          className="mt-2 text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400"
        >
          Show Answer
        </button>
      )}
    </div>
  );
}
