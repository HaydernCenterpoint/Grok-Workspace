import * as XLSX from "xlsx";
import {
  OFFICE_DOC_VERSION,
  type OfficeBlock,
  type OfficeDoc,
  type OfficeSheet,
  type OfficeSlide,
} from "./types";

function slugKey(label: string, index: number): string {
  const s = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || `c${index}`;
}

export function importMarkdownPaper(markdown: string, title: string): OfficeDoc {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: OfficeBlock[] = [];
  let i = 0;
  let inferred = title;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (!inferred && /^#\s+/.test(line)) {
      inferred = line.replace(/^#\s+/, "").trim();
      i += 1;
      continue;
    }
    if (/^###\s+/.test(line)) {
      blocks.push({ type: "h", level: 3, text: line.replace(/^###\s+/, "") });
    } else if (/^##\s+/.test(line)) {
      blocks.push({ type: "h", level: 2, text: line.replace(/^##\s+/, "") });
    } else if (/^#\s+/.test(line)) {
      blocks.push({ type: "h", level: 1, text: line.replace(/^#\s+/, "") });
    } else if (/^---+$/.test(line.trim())) {
      blocks.push({ type: "hr" });
    } else if (/^>\s+/.test(line)) {
      blocks.push({ type: "callout", text: line.replace(/^>\s+/, "") });
    } else if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^[-*]\s+/, ""));
        i += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    } else if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    } else if (line.trim()) {
      blocks.push({ type: "p", text: line });
    }
    i += 1;
  }
  return {
    v: OFFICE_DOC_VERSION,
    kind: "paper",
    title: inferred || "Untitled",
    blocks,
  };
}

export function importCsvSheet(csv: string, title: string): OfficeDoc {
  const wb = XLSX.read(csv, { type: "string" });
  const name = wb.SheetNames[0] ?? "Sheet1";
  const aoa = XLSX.utils.sheet_to_json<(string | number | boolean)[]>(
    wb.Sheets[name]!,
    { header: 1, defval: "" },
  );
  return {
    v: OFFICE_DOC_VERSION,
    kind: "sheet",
    title,
    sheets: [aoaToSheet(name, aoa)],
  };
}

function aoaToSheet(
  name: string,
  aoa: (string | number | boolean | null | undefined)[][],
): OfficeSheet {
  const header = (aoa[0] ?? []).map((h, i) => String(h ?? `Col ${i + 1}`));
  const columns = header.map((label, i) => ({
    key: slugKey(label, i),
    label,
  }));
  const rows = aoa.slice(1).map((row) => {
    const out: Record<string, string | number | boolean | null> = {};
    columns.forEach((col, i) => {
      const v = row[i];
      out[col.key] = v == null || v === "" ? null : v;
    });
    return out;
  });
  return { name: name.slice(0, 31), columns, rows };
}

export function importXlsxSheet(buffer: ArrayBuffer, title: string): OfficeDoc {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheets = wb.SheetNames.map((name) => {
    const aoa = XLSX.utils.sheet_to_json<(string | number | boolean)[]>(
      wb.Sheets[name]!,
      { header: 1, defval: "" },
    );
    return aoaToSheet(name, aoa);
  });
  return {
    v: OFFICE_DOC_VERSION,
    kind: "sheet",
    title,
    sheets: sheets.length ? sheets : [aoaToSheet("Sheet1", [[]])],
  };
}

/** Host `extract_office_text` format: `--- Slide N ---` / `--- Sheet N ---`. */
export function importOfficeExtract(
  kind: "paper" | "sheet" | "deck",
  text: string,
  title: string,
): OfficeDoc {
  const body = text.replace(/\r\n/g, "\n").trim();
  if (kind === "paper") {
    const blocks: OfficeBlock[] = body
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => ({ type: "p" as const, text: p }));
    return { v: OFFICE_DOC_VERSION, kind: "paper", title, blocks };
  }
  if (kind === "deck") {
    const chunks = body.split(/--- Slide \d+ ---\n?/i).filter((s) => s.trim());
    const slides: OfficeSlide[] = (chunks.length ? chunks : [body]).map((chunk) => {
      const lines = chunk.trim().split("\n").map((l) => l.trim()).filter(Boolean);
      return {
        title: lines[0] || title,
        layout: "bullets" as const,
        bullets: lines.slice(1),
      };
    });
    return {
      v: OFFICE_DOC_VERSION,
      kind: "deck",
      title,
      slides: slides.length ? slides : [{ title, layout: "title" }],
    };
  }
  const chunks = body.split(/--- Sheet \d+ ---\n?/i).filter((s) => s.trim());
  const sheets = (chunks.length ? chunks : [body]).map((chunk, i) =>
    aoaToSheet(
      `Sheet ${i + 1}`,
      chunk
        .trim()
        .split("\n")
        .map((line) => line.split(/\t|,/)),
    ),
  );
  return {
    v: OFFICE_DOC_VERSION,
    kind: "sheet",
    title,
    sheets: sheets.length ? sheets : [aoaToSheet("Sheet1", [[]])],
  };
}
