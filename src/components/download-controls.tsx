"use client";

import React, { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Download, Printer, Check } from "lucide-react";
import type { GeneratedNotes } from "@/lib/types";
import { exportAsMarkdown } from "@/lib/export";

interface DownloadControlsProps {
  notes: GeneratedNotes;
}

export default function DownloadControls({ notes }: DownloadControlsProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = useCallback(async () => {
    const markdown = exportAsMarkdown(notes);
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = markdown;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [notes]);

  const handleDownload = useCallback(() => {
    const markdown = exportAsMarkdown(notes);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${notes.video.title.replace(/[^a-zA-Z0-9\s-]/g, "").trim() || "lecture-notes"}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [notes]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleCopy}>
        {copied ? (
          <>
            <Check className="h-4 w-4" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            Copy All
          </>
        )}
      </Button>

      <Button variant="outline" size="sm" onClick={handleDownload}>
        <Download className="h-4 w-4" />
        Download .md
      </Button>

      <Button variant="outline" size="sm" onClick={handlePrint}>
        <Printer className="h-4 w-4" />
        Print / PDF
      </Button>
    </div>
  );
}
