/**
 * Office canvas helpers — find / create / serialize `*.office.json`.
 * The file is the document (OfficeCLI idea); we keep the existing IR.
 */

import { projectCodebaseSearch } from "@/lib/api";
import {
  isOfficeDocPath,
  type OfficeDoc,
  type OfficeKind,
} from "@/lib/officeDoc";
import type { OfficeStartKind } from "@/lib/grokOffice";

export type OfficeDocHit = {
  relativePath: string;
  mtimeMs: number;
};

export function serializeOfficeDoc(doc: OfficeDoc): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}

export function officeStartToKind(kind: OfficeStartKind): OfficeKind {
  switch (kind) {
    case "report":
      return "paper";
    case "slides":
      return "deck";
    case "sheet":
      return "sheet";
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

export function blankOfficeDoc(kind: OfficeKind, title: string): OfficeDoc {
  switch (kind) {
    case "paper":
      return { v: 1, kind, title, blocks: [{ type: "p", text: "" }] };
    case "sheet":
      return {
        v: 1,
        kind,
        title,
        sheets: [
          {
            name: title,
            columns: [
              { key: "a", label: "A" },
              { key: "b", label: "B" },
            ],
            rows: [{ a: "", b: "" }],
          },
        ],
      };
    case "deck":
      return {
        v: 1,
        kind,
        title,
        slides: [{ title, layout: "title" }],
      };
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

export function nextOfficeRel(
  kind: OfficeKind,
  existingRels: string[],
): string {
  const stem =
    kind === "paper"
      ? "untitled-report"
      : kind === "sheet"
        ? "untitled-sheet"
        : "untitled-slides";
  const used = new Set(
    existingRels.map((r) => r.replace(/\\/g, "/").toLowerCase()),
  );
  for (let i = 0; i < 50; i++) {
    const name = i === 0 ? `${stem}.office.json` : `${stem}-${i + 1}.office.json`;
    const rel = `docs/${name}`;
    if (!used.has(rel) && !used.has(name)) return rel;
  }
  return `docs/${stem}-${Date.now()}.office.json`;
}

export function pickLatestOfficeHit(
  hits: readonly OfficeDocHit[],
): OfficeDocHit | null {
  if (!hits.length) return null;
  return [...hits].sort((a, b) => b.mtimeMs - a.mtimeMs)[0] ?? null;
}

export async function findOfficeDocs(
  projectPath: string,
): Promise<OfficeDocHit[]> {
  const result = await projectCodebaseSearch({
    projectPath,
    query: ".office.json",
    mode: "name",
    limit: 40,
  });
  return (result.hits ?? [])
    .map((h) => ({
      relativePath: (h.relativePath || h.path || "").replace(/\\/g, "/"),
      mtimeMs: h.mtimeMs ?? 0,
    }))
    .filter((h) => isOfficeDocPath(h.relativePath));
}
