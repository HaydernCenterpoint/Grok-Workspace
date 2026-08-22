import type { OfficeBlock, OfficeDoc, OfficeSheet, OfficeSlide } from "./types";

function renderBlock(block: OfficeBlock): string {
  switch (block.type) {
    case "h":
      return `${"#".repeat(block.level)} ${block.text}`;
    case "p":
      return block.text;
    case "ul":
      return block.items.map((item) => `- ${item}`).join("\n");
    case "ol":
      return block.items.map((item, i) => `${i + 1}. ${item}`).join("\n");
    case "table": {
      const headers = block.headers.length ? block.headers : ["Col"];
      const sep = headers.map(() => "---");
      const rows = block.rows.map((row) =>
        headers.map((_, i) => row[i] ?? "").join(" | "),
      );
      return [
        `| ${headers.join(" | ")} |`,
        `| ${sep.join(" | ")} |`,
        ...rows.map((r) => `| ${r} |`),
      ].join("\n");
    }
    case "callout":
      return `> ${block.text}`;
    case "hr":
      return "---";
    default: {
      const _never: never = block;
      return String(_never);
    }
  }
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function sheetToCsv(sheet: OfficeSheet): string {
  const headers = sheet.columns.map((c) => csvEscape(c.label));
  const rows = sheet.rows.map((row) =>
    sheet.columns
      .map((c) => {
        const v = row[c.key];
        if (v == null) return "";
        return csvEscape(String(v));
      })
      .join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}

function slideToMarkdown(slide: OfficeSlide, index: number): string {
  const lines = [`## ${slide.title || `Slide ${index + 1}`}`];
  const layout = slide.layout ?? "bullets";
  switch (layout) {
    case "title":
      break;
    case "bullets":
      for (const b of slide.bullets ?? []) lines.push(`- ${b}`);
      break;
    case "two-col":
      lines.push("### Left");
      for (const b of slide.left ?? []) lines.push(`- ${b}`);
      lines.push("### Right");
      for (const b of slide.right ?? []) lines.push(`- ${b}`);
      break;
    case "table":
      if (slide.table) {
        lines.push(
          renderBlock({
            type: "table",
            headers: slide.table.headers,
            rows: slide.table.rows,
          }),
        );
      }
      break;
    default: {
      const _never: never = layout;
      void _never;
    }
  }
  if (slide.notes) lines.push(`\n_${slide.notes}_`);
  return lines.join("\n");
}

/** Portable markdown / csv from an OfficeDoc (no binary). */
export function compileOfficeText(
  doc: OfficeDoc,
): { markdown: string; csv: string | null } {
  const head = [`# ${doc.title}`];
  if (doc.subtitle) head.push(doc.subtitle);
  switch (doc.kind) {
    case "paper":
      return {
        markdown: [...head, "", ...(doc.blocks ?? []).map(renderBlock)].join(
          "\n\n",
        ),
        csv: null,
      };
    case "sheet": {
      const sheets = doc.sheets ?? [];
      const md = [
        ...head,
        "",
        ...sheets.map((s) => `## ${s.name}\n\n${sheetToCsv(s)}`),
      ].join("\n\n");
      return { markdown: md, csv: sheets[0] ? sheetToCsv(sheets[0]) : "" };
    }
    case "deck":
      return {
        markdown: [
          ...head,
          "",
          ...(doc.slides ?? []).map(slideToMarkdown),
        ].join("\n\n"),
        csv: null,
      };
    default: {
      const _never: never = doc.kind;
      return { markdown: String(_never), csv: null };
    }
  }
}
