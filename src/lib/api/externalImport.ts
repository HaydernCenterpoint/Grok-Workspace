/** Host scan / import for Codex + Claude config and installed skills. */

import { invoke } from "./host";

export type ExternalImportKind = "skill" | "mcp" | "provider" | "permission";

export type ExternalImportSource =
  | "codex"
  | "claude"
  | "claude_desktop"
  | "cursor"
  | "agents"
  | "grok"
  | "project"
  | string;

export interface ExternalHome {
  source: string;
  path: string;
  present: boolean;
  label: string;
}

export interface ExternalImportItem {
  id: string;
  kind: ExternalImportKind | string;
  source: ExternalImportSource;
  name: string;
  detail: string;
  path?: string | null;
  status: string;
  reason?: string | null;
  transport?: string | null;
  command?: string | null;
  args?: string[] | null;
  url?: string | null;
  baseUrl?: string | null;
  skillDir?: string | null;
  allow?: string[] | null;
  deny?: string[] | null;
  ask?: string[] | null;
}

export interface ExternalImportScanResult {
  sessionDataMode: string;
  writable: boolean;
  destSkills: string;
  destConfig: string;
  homes: ExternalHome[];
  items: ExternalImportItem[];
}

export interface ExternalImportFailure {
  id: string;
  reason: string;
}

export interface ExternalImportApplyResult {
  imported: number;
  skipped: number;
  failed: ExternalImportFailure[];
  switchedToIndependent: boolean;
  destSkills: string;
  destConfig: string;
}

export async function externalImportScan(projectPath?: string | null) {
  return invoke<ExternalImportScanResult>("external_import_scan", {
    projectPath: projectPath ?? null,
  });
}

export async function externalImportApply(body: {
  ids: string[];
  projectPath?: string | null;
  switchToIndependent?: boolean;
}) {
  return invoke<ExternalImportApplyResult>("external_import_apply", {
    body: {
      ids: body.ids,
      projectPath: body.projectPath ?? null,
      switchToIndependent: body.switchToIndependent ?? false,
    },
  });
}
