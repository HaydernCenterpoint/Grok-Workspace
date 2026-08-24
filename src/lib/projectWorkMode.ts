/**
 * Per-project home surface for Create project (Build / Office).
 * Client-only map, same storage style as `grok.sessionWorkMode`.
 * Empty folders use this home; chats can still split a folder across surfaces.
 * Missing ids default to Build (`code`). Studio is not a project home.
 */

import { DEFAULT_WORK_MODE, type WorkMode } from "@/lib/grokOffice";

export const PROJECT_WORK_MODE_STORAGE_KEY = "grok.projectWorkMode";

/** Workspaces a new project can land in. Studio is not a project home. */
export type CreateProjectWorkspace = "code" | "office";

export type ProjectWorkModeMap = Record<string, WorkMode>;

export type ProjectWorkModeStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function defaultStorage(): ProjectWorkModeStorage {
  if (typeof localStorage !== "undefined") return localStorage;
  return { getItem: () => null, setItem: () => {} };
}

function normalizeId(projectId: string | null | undefined): string | null {
  if (typeof projectId !== "string") return null;
  const id = projectId.trim();
  return id ? id : null;
}

export function isCreateProjectWorkspace(
  value: unknown,
): value is CreateProjectWorkspace {
  return value === "code" || value === "office";
}

/** Current Build / Office surface wins; Studio and unknown fall back to Build. */
export function defaultCreateProjectWorkspace(
  current: WorkMode,
): CreateProjectWorkspace {
  return current === "office" ? "office" : "code";
}

export function parseProjectWorkModes(raw: unknown): ProjectWorkModeMap {
  if (raw == null || raw === "") return {};
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: ProjectWorkModeMap = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const id = normalizeId(k);
    if (!id || !isCreateProjectWorkspace(v)) continue;
    out[id] = v;
  }
  return out;
}

export function loadProjectWorkModes(
  storage: ProjectWorkModeStorage = defaultStorage(),
): ProjectWorkModeMap {
  try {
    return parseProjectWorkModes(storage.getItem(PROJECT_WORK_MODE_STORAGE_KEY));
  } catch {
    return {};
  }
}

export function saveProjectWorkModes(
  map: ProjectWorkModeMap,
  storage: ProjectWorkModeStorage = defaultStorage(),
): void {
  const cleaned: ProjectWorkModeMap = {};
  for (const [k, v] of Object.entries(map ?? {})) {
    const id = normalizeId(k);
    if (!id || !isCreateProjectWorkspace(v)) continue;
    cleaned[id] = v;
  }
  try {
    storage.setItem(PROJECT_WORK_MODE_STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    /* private mode / quota */
  }
}

export function projectWorkModeOf(
  projectId: string | null | undefined,
  map: ProjectWorkModeMap,
): WorkMode {
  const id = normalizeId(projectId);
  if (!id) return DEFAULT_WORK_MODE;
  const mode = map[id];
  return isCreateProjectWorkspace(mode) ? mode : DEFAULT_WORK_MODE;
}

export function explicitProjectWorkMode(
  projectId: string | null | undefined,
  map: ProjectWorkModeMap,
): CreateProjectWorkspace | null {
  const id = normalizeId(projectId);
  if (!id) return null;
  const mode = map[id];
  return isCreateProjectWorkspace(mode) ? mode : null;
}

export function upsertProjectWorkMode(
  map: ProjectWorkModeMap,
  projectId: string | null | undefined,
  mode: CreateProjectWorkspace,
): ProjectWorkModeMap {
  const id = normalizeId(projectId);
  if (!id || !isCreateProjectWorkspace(mode)) return map;
  if (map[id] === mode) return map;
  return { ...map, [id]: mode };
}

export function forgetProjectWorkMode(
  map: ProjectWorkModeMap,
  projectId: string | null | undefined,
): ProjectWorkModeMap {
  const id = normalizeId(projectId);
  if (!id || !(id in map)) return map;
  const next = { ...map };
  delete next[id];
  return next;
}
