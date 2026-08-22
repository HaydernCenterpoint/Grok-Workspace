import { invoke } from "./host";
import type { FsWriteResult } from "./fs";

export type OfficeExportEntry = { path: string; text: string };

export function officeExport(opts: {
  projectPath: string;
  relative: string;
  entries?: OfficeExportEntry[];
  bytesBase64?: string;
}) {
  return invoke<FsWriteResult>("office_export", {
    projectPath: opts.projectPath,
    relative: opts.relative,
    entries: opts.entries ?? null,
    bytesBase64: opts.bytesBase64 ?? null,
  });
}
