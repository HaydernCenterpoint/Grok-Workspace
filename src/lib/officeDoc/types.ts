/**
 * Grok Office document IR — one JSON shape for papers, sheets, and decks.
 * Agent writes `*.office.json`; the app compiles OOXML / markdown / csv.
 */

export const OFFICE_DOC_VERSION = 1 as const;
export const OFFICE_DOC_SUFFIX = ".office.json";

export type OfficeKind = "paper" | "sheet" | "deck";

export const OFFICE_KINDS: readonly OfficeKind[] = [
  "paper",
  "sheet",
  "deck",
] as const;

export type OfficeBlock =
  | { type: "h"; level: 1 | 2 | 3; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "callout"; text: string }
  | { type: "hr" };

export type OfficeColumnKind = "text" | "number" | "date" | "status";

export type OfficeColumn = {
  key: string;
  label: string;
  kind?: OfficeColumnKind;
};

export type OfficeCell = string | number | boolean | null;

export type OfficeSheet = {
  name: string;
  columns: OfficeColumn[];
  rows: Record<string, OfficeCell>[];
};

export type OfficeSlideLayout = "title" | "bullets" | "two-col" | "table";

export type OfficeSlide = {
  title: string;
  layout?: OfficeSlideLayout;
  bullets?: string[];
  left?: string[];
  right?: string[];
  table?: { headers: string[]; rows: string[][] };
  notes?: string;
};

export type OfficeDoc = {
  v: typeof OFFICE_DOC_VERSION;
  kind: OfficeKind;
  title: string;
  subtitle?: string;
  blocks?: OfficeBlock[];
  sheets?: OfficeSheet[];
  slides?: OfficeSlide[];
};

export type OfficeParseOk = { ok: true; doc: OfficeDoc };
export type OfficeParseErr = { ok: false; error: string };
export type OfficeParseResult = OfficeParseOk | OfficeParseErr;

export function isOfficeKind(value: unknown): value is OfficeKind {
  return value === "paper" || value === "sheet" || value === "deck";
}

export function isOfficeDocPath(path: string): boolean {
  const base = path.replace(/\\/g, "/").split("/").pop() ?? path;
  return base.toLowerCase().endsWith(OFFICE_DOC_SUFFIX);
}

export type OfficeExportFormat = "md" | "csv" | "docx" | "xlsx" | "pptx";

export function exportFormatsFor(kind: OfficeKind): OfficeExportFormat[] {
  switch (kind) {
    case "paper":
      return ["md", "docx"];
    case "sheet":
      return ["csv", "xlsx"];
    case "deck":
      return ["md", "pptx"];
    default: {
      const _never: never = kind;
      return [_never as OfficeExportFormat];
    }
  }
}

export function officeJsonRelative(sourceRel: string): string {
  const n = sourceRel.replace(/\\/g, "/");
  if (isOfficeDocPath(n)) return n;
  const stem = n.replace(/\.[^./]+$/, "");
  return `${stem}${OFFICE_DOC_SUFFIX}`;
}

export function officeOutputRelative(sourceRel: string, ext: string): string {
  const n = sourceRel.replace(/\\/g, "/");
  const stem = n.toLowerCase().endsWith(OFFICE_DOC_SUFFIX)
    ? n.slice(0, -OFFICE_DOC_SUFFIX.length)
    : n.replace(/\.[^./]+$/, "");
  const cleanExt = ext.replace(/^\./, "");
  return `${stem}.${cleanExt}`;
}

function asString(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(asString);
}

function asStringTable(value: unknown): string[][] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => (Array.isArray(row) ? row.map(asString) : [asString(row)]));
}

function parseBlock(raw: unknown): OfficeBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  switch (o.type) {
    case "h": {
      const level = o.level === 2 || o.level === 3 ? o.level : 1;
      return { type: "h", level, text: asString(o.text) };
    }
    case "p":
      return { type: "p", text: asString(o.text) };
    case "ul":
      return { type: "ul", items: asStringList(o.items) };
    case "ol":
      return { type: "ol", items: asStringList(o.items) };
    case "table":
      return {
        type: "table",
        headers: asStringList(o.headers),
        rows: asStringTable(o.rows),
      };
    case "callout":
      return { type: "callout", text: asString(o.text) };
    case "hr":
      return { type: "hr" };
    default:
      return null;
  }
}

function parseColumn(raw: unknown, index: number): OfficeColumn {
  if (!raw || typeof raw !== "object") {
    return { key: `c${index}`, label: `Col ${index + 1}` };
  }
  const o = raw as Record<string, unknown>;
  const kind = o.kind;
  return {
    key: asString(o.key) || `c${index}`,
    label: asString(o.label) || asString(o.key) || `Col ${index + 1}`,
    kind:
      kind === "number" || kind === "date" || kind === "status" || kind === "text"
        ? kind
        : undefined,
  };
}

function parseSheet(raw: unknown, index: number): OfficeSheet {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const columns = Array.isArray(o.columns)
    ? o.columns.map(parseColumn)
    : [];
  const rows = Array.isArray(o.rows)
    ? o.rows.map((row) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return {};
        const src = row as Record<string, unknown>;
        const out: Record<string, OfficeCell> = {};
        for (const col of columns) {
          const v = src[col.key];
          if (typeof v === "number" || typeof v === "boolean" || typeof v === "string") {
            out[col.key] = v;
          } else if (v == null) {
            out[col.key] = null;
          } else {
            out[col.key] = asString(v);
          }
        }
        return out;
      })
    : [];
  return {
    name: (asString(o.name) || `Sheet ${index + 1}`).slice(0, 31),
    columns,
    rows,
  };
}

function parseSlide(raw: unknown): OfficeSlide {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const layout = o.layout;
  const table =
    o.table && typeof o.table === "object"
      ? {
          headers: asStringList((o.table as Record<string, unknown>).headers),
          rows: asStringTable((o.table as Record<string, unknown>).rows),
        }
      : undefined;
  return {
    title: asString(o.title),
    layout:
      layout === "title" ||
      layout === "bullets" ||
      layout === "two-col" ||
      layout === "table"
        ? layout
        : undefined,
    bullets: asStringList(o.bullets),
    left: asStringList(o.left),
    right: asStringList(o.right),
    table,
    notes: o.notes == null ? undefined : asString(o.notes),
  };
}

/** Parse and coerce unknown JSON into an OfficeDoc. */
export function parseOfficeDoc(raw: unknown): OfficeParseResult {
  if (typeof raw === "string") {
    try {
      return parseOfficeDoc(JSON.parse(raw) as unknown);
    } catch {
      return { ok: false, error: "invalid json" };
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "expected object" };
  }
  const o = raw as Record<string, unknown>;
  if (o.v !== OFFICE_DOC_VERSION) {
    return { ok: false, error: "unsupported version" };
  }
  if (!isOfficeKind(o.kind)) {
    return { ok: false, error: "kind must be paper, sheet, or deck" };
  }
  const title = asString(o.title).trim();
  if (!title) return { ok: false, error: "title required" };

  const doc: OfficeDoc = {
    v: OFFICE_DOC_VERSION,
    kind: o.kind,
    title,
    subtitle: o.subtitle == null ? undefined : asString(o.subtitle),
  };

  switch (o.kind) {
    case "paper":
      doc.blocks = Array.isArray(o.blocks)
        ? o.blocks.map(parseBlock).filter((b): b is OfficeBlock => b != null)
        : [];
      break;
    case "sheet":
      doc.sheets = Array.isArray(o.sheets) ? o.sheets.map(parseSheet) : [];
      if (doc.sheets.length === 0) {
        return { ok: false, error: "sheet needs at least one sheet" };
      }
      break;
    case "deck":
      doc.slides = Array.isArray(o.slides) ? o.slides.map(parseSlide) : [];
      if (doc.slides.length === 0) {
        return { ok: false, error: "deck needs at least one slide" };
      }
      break;
    default: {
      const _never: never = o.kind;
      return { ok: false, error: `unhandled kind ${String(_never)}` };
    }
  }
  return { ok: true, doc };
}
