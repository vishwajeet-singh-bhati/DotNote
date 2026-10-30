"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import type { MindMapNode } from "@/lib/types";
import { AlertTriangle, ChevronRight, ChevronDown } from "lucide-react";

interface MindMapProps {
  nodes: MindMapNode[];
  videoUrl: string;
}

/**
 * Sanitize a label for use in Mermaid syntax.
 * Removes or escapes characters that would break mermaid parsing.
 */
function sanitizeLabel(label: string): string {
  return label
    .replace(/[[\](){}#`]/g, "")
    .replace(/"/g, "'")
    .replace(/\n/g, " ")
    .replace(/\r/g, "")
    .trim()
    .slice(0, 60);
}

/**
 * Generate Mermaid mindmap syntax from structured nodes.
 */
function generateMermaidCode(nodes: MindMapNode[]): string {
  if (nodes.length === 0) return "";

  const root = nodes.find((n) => n.parentId === null);
  if (!root) return "";

  const childrenMap = new Map<string, MindMapNode[]>();
  for (const node of nodes) {
    if (node.parentId !== null) {
      const children = childrenMap.get(node.parentId) ?? [];
      children.push(node);
      childrenMap.set(node.parentId, children);
    }
  }

  const lines: string[] = ["mindmap"];

  function addNode(node: MindMapNode, depth: number) {
    const indent = "  ".repeat(depth + 1);
    const label = sanitizeLabel(node.label);
    lines.push(`${indent}${label}`);

    const children = childrenMap.get(node.id) ?? [];
    for (const child of children) {
      addNode(child, depth + 1);
    }
  }

  addNode(root, 0);

  return lines.join("\n");
}

/**
 * Fallback: Render an accessible nested outline.
 */
function OutlineFallback({
  nodes,
}: {
  nodes: MindMapNode[];
}) {
  const root = nodes.find((n) => n.parentId === null);
  if (!root) return null;

  const childrenMap = new Map<string, MindMapNode[]>();
  for (const node of nodes) {
    if (node.parentId !== null) {
      const children = childrenMap.get(node.parentId) ?? [];
      children.push(node);
      childrenMap.set(node.parentId, children);
    }
  }

  function OutlineNode({ node, depth }: { node: MindMapNode; depth: number }) {
    const children = childrenMap.get(node.id) ?? [];
    const [expanded, setExpanded] = useState(depth < 2);
    const hasChildren = children.length > 0;

    return (
      <li className="my-1">
        <div className="flex items-start gap-1">
          {hasChildren ? (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-0.5 shrink-0 rounded p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-400" />
              )}
            </button>
          ) : (
            <span className="ml-5 shrink-0" />
          )}
          <span
            className={`${
              depth === 0
                ? "font-bold text-lg text-indigo-700 dark:text-indigo-400"
                : depth === 1
                  ? "font-semibold text-slate-800 dark:text-slate-200"
                  : "text-slate-700 dark:text-slate-300"
            }`}
          >
            {node.label}
          </span>
        </div>
        {hasChildren && expanded && (
          <ul className="ml-4 mt-1 border-l-2 border-slate-200 pl-3 dark:border-slate-700">
            {children.map((child) => (
              <OutlineNode key={child.id} node={child} depth={depth + 1} />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <nav aria-label="Mind map outline">
      <ul className="space-y-1">
        <OutlineNode node={root} depth={0} />
      </ul>
    </nav>
  );
}

export default function MindMap({ nodes }: MindMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState(false);
  const [svgContent, setSvgContent] = useState<string>("");

  const mermaidCode = useMemo(() => generateMermaidCode(nodes), [nodes]);

  useEffect(() => {
    if (!mermaidCode || !containerRef.current) return;

    let cancelled = false;

    async function renderMermaid() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          themeVariables: {
            primaryColor: "#e0e7ff",
            primaryTextColor: "#1e293b",
            primaryBorderColor: "#818cf8",
            lineColor: "#94a3b8",
            secondaryColor: "#f1f5f9",
            tertiaryColor: "#fef3c7",
          },
          mindmap: {
            padding: 16,
          },
          securityLevel: "strict",
        });

        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, mermaidCode);

        if (!cancelled) {
          setSvgContent(svg);
          setRenderError(false);
        }
      } catch (err) {
        console.warn("Mermaid render failed, using outline fallback:", err);
        if (!cancelled) {
          setRenderError(true);
        }
      }
    }

    renderMermaid();

    return () => {
      cancelled = true;
    };
  }, [mermaidCode]);

  if (nodes.length === 0) {
    return (
      <div className="rounded-lg bg-slate-50 p-8 text-center dark:bg-slate-800/50">
        <p className="text-slate-500 dark:text-slate-400">
          No mind map data available.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!renderError && svgContent ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div
            ref={containerRef}
            className="min-h-[200px] flex items-center justify-center"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        </div>
      ) : null}

      {renderError && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Interactive mind map could not be rendered. Showing outline view
            instead.
          </span>
        </div>
      )}

      <div className={renderError ? "" : "mt-4"}>
        <h4 className="mb-3 text-sm font-medium text-slate-500 dark:text-slate-400">
          {renderError ? "Topic Outline" : "Outline View"}
        </h4>
        <OutlineFallback nodes={nodes} />
      </div>
    </div>
  );
}
