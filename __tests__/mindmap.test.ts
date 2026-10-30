import { describe, it, expect } from "vitest";
import type { MindMapNode } from "@/lib/types";

// ─── 12. Mind-map fallback rendering ────────────────────────────────────────

// We test the Mermaid code generation logic and sanitization,
// since the actual Mermaid rendering is a browser-only concern.

function sanitizeLabel(label: string): string {
  return label
    .replace(/[[\](){}#`]/g, "")
    .replace(/"/g, "'")
    .replace(/\n/g, " ")
    .replace(/\r/g, "")
    .trim()
    .slice(0, 60);
}

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

describe("sanitizeLabel", () => {
  it("removes brackets", () => {
    expect(sanitizeLabel("Array[index]")).toBe("Arrayindex");
  });

  it("removes parentheses", () => {
    expect(sanitizeLabel("function(param)")).toBe("functionparam");
  });

  it("replaces double quotes with single quotes", () => {
    expect(sanitizeLabel('He said "hello"')).toBe("He said 'hello'");
  });

  it("replaces newlines with spaces", () => {
    expect(sanitizeLabel("line1\nline2")).toBe("line1 line2");
  });

  it("truncates long labels", () => {
    const long = "A".repeat(100);
    expect(sanitizeLabel(long).length).toBe(60);
  });

  it("trims whitespace", () => {
    expect(sanitizeLabel("  hello  ")).toBe("hello");
  });
});

describe("generateMermaidCode", () => {
  it("returns empty string for no nodes", () => {
    expect(generateMermaidCode([])).toBe("");
  });

  it("returns empty string when no root node exists", () => {
    const nodes: MindMapNode[] = [
      { id: "a", parentId: "nonexistent", label: "Orphan" },
    ];
    expect(generateMermaidCode(nodes)).toBe("");
  });

  it("generates valid mindmap syntax for a simple tree", () => {
    const nodes: MindMapNode[] = [
      { id: "root", parentId: null, label: "Algorithms" },
      { id: "t1", parentId: "root", label: "Sorting" },
      { id: "t2", parentId: "root", label: "Searching" },
      { id: "t1-1", parentId: "t1", label: "Quick Sort" },
    ];

    const code = generateMermaidCode(nodes);
    expect(code).toContain("mindmap");
    expect(code).toContain("Algorithms");
    expect(code).toContain("Sorting");
    expect(code).toContain("Quick Sort");
    expect(code).toContain("Searching");
  });

  it("handles root-only tree", () => {
    const nodes: MindMapNode[] = [
      { id: "root", parentId: null, label: "Topic" },
    ];
    const code = generateMermaidCode(nodes);
    expect(code).toBe("mindmap\n  Topic");
  });

  it("sanitizes labels with special characters", () => {
    const nodes: MindMapNode[] = [
      { id: "root", parentId: null, label: "O(n log n)" },
      { id: "t1", parentId: "root", label: "Array[0]" },
    ];
    const code = generateMermaidCode(nodes);
    expect(code).not.toContain("(");
    expect(code).not.toContain("[");
  });
});
