/**
 * Per-surface composer prefs. Host `composer_prefs_*` is Grok Build only.
 * Office and Studio keep their own model / mode / policy so switching
 * surfaces does not leak Build chips or overwrite Build Host prefs.
 */

import {
  DEFAULT_EFFORT,
  DEFAULT_MODEL_ID,
  isValidPolicy,
  SESSION_MODES,
} from "@/lib/grokCatalog";
import { isWorkMode, type WorkMode } from "@/lib/grokOffice";

export const SURFACE_COMPOSER_PREFS_KEY = "grok.surfaceComposerPrefs.v1";

export type SurfaceComposerChoice = {
  modelId: string;
  effort: string;
  mode: string;
  policy: string;
};

export type SurfaceComposerPrefsStore = {
  v: 1;
} & Partial<Record<WorkMode, SurfaceComposerChoice>>;

export type SurfaceComposerStorage = {
  getItem(key: string): string | null;
  setItem?(key: string, value: string): void;
};

export function persistComposerPrefsToHost(mode: WorkMode): boolean {
  return mode === "code";
}

export function defaultSurfaceComposerChoice(
  mode: WorkMode,
): SurfaceComposerChoice {
  switch (mode) {
    case "studio":
      return {
        modelId: DEFAULT_MODEL_ID,
        effort: DEFAULT_EFFORT,
        mode: "agent",
        policy: "ask",
      };
    case "office":
      return {
        modelId: DEFAULT_MODEL_ID,
        effort: DEFAULT_EFFORT,
        mode: "agent",
        policy: "ask",
      };
    case "code":
      return {
        modelId: DEFAULT_MODEL_ID,
        effort: DEFAULT_EFFORT,
        mode: "agent",
        policy: "ask",
      };
    default: {
      const _never: never = mode;
      return _never;
    }
  }
}

function isSessionMode(value: string): boolean {
  return SESSION_MODES.some((m) => m.id === value);
}

export function parseSurfaceComposerChoice(
  raw: unknown,
  fallback: SurfaceComposerChoice,
): SurfaceComposerChoice {
  if (!raw || typeof raw !== "object") return fallback;
  const row = raw as Partial<SurfaceComposerChoice>;
  const modelId =
    typeof row.modelId === "string" && row.modelId.trim()
      ? row.modelId.trim()
      : fallback.modelId;
  const effort =
    typeof row.effort === "string" && row.effort.trim()
      ? row.effort.trim()
      : fallback.effort;
  const mode =
    typeof row.mode === "string" && isSessionMode(row.mode)
      ? row.mode
      : fallback.mode;
  const policy =
    typeof row.policy === "string" && isValidPolicy(row.policy)
      ? row.policy
      : fallback.policy;
  return { modelId, effort, mode, policy };
}

export function parseSurfaceComposerPrefs(
  raw: unknown,
): SurfaceComposerPrefsStore {
  const empty: SurfaceComposerPrefsStore = { v: 1 };
  if (!raw || typeof raw !== "object") return empty;
  const row = raw as Record<string, unknown>;
  const out: SurfaceComposerPrefsStore = { v: 1 };
  for (const mode of ["code", "office", "studio"] as const) {
    if (mode in row) {
      out[mode] = parseSurfaceComposerChoice(
        row[mode],
        defaultSurfaceComposerChoice(mode),
      );
    }
  }
  return out;
}

function readStore(
  storage: SurfaceComposerStorage,
): SurfaceComposerPrefsStore {
  try {
    const raw = storage.getItem(SURFACE_COMPOSER_PREFS_KEY);
    if (!raw) return { v: 1 };
    return parseSurfaceComposerPrefs(JSON.parse(raw));
  } catch {
    return { v: 1 };
  }
}

function writeStore(
  next: SurfaceComposerPrefsStore,
  storage: SurfaceComposerStorage,
): void {
  try {
    storage.setItem?.(SURFACE_COMPOSER_PREFS_KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota */
  }
}

export function loadSurfaceComposerPrefs(
  storage: SurfaceComposerStorage = typeof localStorage !== "undefined"
    ? localStorage
    : { getItem: () => null },
): SurfaceComposerPrefsStore {
  return readStore(storage);
}

export function saveSurfaceComposerChoice(
  mode: WorkMode,
  choice: SurfaceComposerChoice,
  storage: SurfaceComposerStorage = typeof localStorage !== "undefined"
    ? localStorage
    : { getItem: () => null },
): void {
  if (!isWorkMode(mode)) return;
  const store = readStore(storage);
  writeStore(
    {
      ...store,
      v: 1,
      [mode]: parseSurfaceComposerChoice(
        choice,
        defaultSurfaceComposerChoice(mode),
      ),
    },
    storage,
  );
}

export function resolveSurfaceComposerChoice(
  mode: WorkMode,
  storage: SurfaceComposerStorage = typeof localStorage !== "undefined"
    ? localStorage
    : { getItem: () => null },
): SurfaceComposerChoice {
  const stored = readStore(storage)[mode];
  return stored ?? defaultSurfaceComposerChoice(mode);
}
