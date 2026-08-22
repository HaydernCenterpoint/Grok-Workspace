import { applyFilePatch } from "@/lib/api";
import { importOfficeExtract, importXlsxSheet } from "./importDoc";
import { officeJsonRelative } from "./types";

function stem(name: string): string {
  return name.replace(/\.[^./\\]+$/, "") || name;
}

export function canCaptureOfficeKind(kind: string): boolean {
  return kind === "xlsx" || kind === "pptx" || kind === "docx";
}

/** Turn an existing Office file into sibling `*.office.json`. */
export async function captureOfficeFile(opts: {
  projectPath: string;
  relativePath: string;
  name: string;
  kind: string;
  buffer?: ArrayBuffer | null;
  text?: string | null;
}): Promise<string> {
  const dest = officeJsonRelative(opts.relativePath);
  const title = stem(opts.name);
  const doc =
    opts.kind === "xlsx" && opts.buffer
      ? importXlsxSheet(opts.buffer, title)
      : opts.kind === "pptx" && opts.text
        ? importOfficeExtract("deck", opts.text, title)
        : opts.kind === "docx" && opts.text
          ? importOfficeExtract("paper", opts.text, title)
          : null;
  if (!doc) throw new Error("cannot capture");
  const r = await applyFilePatch(
    opts.projectPath,
    dest,
    `${JSON.stringify(doc, null, 2)}\n`,
  );
  if (!r.ok) throw new Error(r.reason || "write failed");
  return dest;
}
