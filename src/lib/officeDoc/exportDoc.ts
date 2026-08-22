import { applyFilePatch, officeExport, type FsWriteResult } from "@/lib/api";
import { compileOfficeText } from "./compileMarkdown";
import { compileDocxParts, compilePptxParts } from "./compileOoxml";
import { bytesToBase64, compileXlsxBytes } from "./compileXlsx";
import {
  officeOutputRelative,
  type OfficeDoc,
  type OfficeExportFormat,
} from "./types";

export type { OfficeExportFormat } from "./types";
export { exportFormatsFor } from "./types";

export async function exportOfficeDoc(opts: {
  projectPath: string;
  sourceRelative: string;
  doc: OfficeDoc;
  format: OfficeExportFormat;
}): Promise<FsWriteResult> {
  const relative = officeOutputRelative(opts.sourceRelative, opts.format);
  const text = compileOfficeText(opts.doc);
  switch (opts.format) {
    case "md":
      return applyFilePatch(opts.projectPath, relative, text.markdown).then(
        requireOk,
      );
    case "csv":
      return applyFilePatch(
        opts.projectPath,
        relative,
        text.csv ?? "",
      ).then(requireOk);
    case "docx":
      return officeExport({
        projectPath: opts.projectPath,
        relative,
        entries: compileDocxParts(opts.doc),
      });
    case "pptx":
      return officeExport({
        projectPath: opts.projectPath,
        relative,
        entries: compilePptxParts(opts.doc),
      });
    case "xlsx":
      return officeExport({
        projectPath: opts.projectPath,
        relative,
        bytesBase64: bytesToBase64(compileXlsxBytes(opts.doc)),
      });
    default: {
      const _never: never = opts.format;
      throw new Error(`unhandled format ${String(_never)}`);
    }
  }
}

function requireOk(r: {
  ok: boolean;
  absolutePath?: string | null;
  relativePath?: string | null;
  reason?: string | null;
}): FsWriteResult {
  if (!r.ok || !r.absolutePath || !r.relativePath) {
    throw new Error(r.reason || "write failed");
  }
  return {
    relativePath: r.relativePath,
    absolutePath: r.absolutePath,
    size: 0,
    mtimeMs: 0,
  };
}
