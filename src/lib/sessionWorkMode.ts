/**
 * Per-session work surface (`code` | `office` | `studio`).
 * Client-only map (`grok.sessionWorkMode`): sessionId → home surface.
 * Creating a chat stamps that surface; the stamp is sticky (first write wins).
 * Drag / retag cannot move a chat to another workspace. Missing ids default
 * to Build (`code`).
 */

import {
  DEFAULT_WORK_MODE,
  isWorkMode,
  type WorkMode,
} from "@/lib/grokOffice";
import {
  explicitProjectWorkMode,
  projectWorkModeOf,
  type ProjectWorkModeMap,
} from "@/lib/projectWorkMode";

export const SESSION_WORK_MODE_STORAGE_KEY = "grok.sessionWorkMode";

export type SessionWorkModeMap = Record<string, WorkMode>;

export type SessionWorkModeStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function defaultStorage(): SessionWorkModeStorage {
  if (typeof localStorage !== "undefined") return localStorage;
  return { getItem: () => null, setItem: () => {} };
}

function normalizeId(sessionId: string | null | undefined): string | null {
  if (typeof sessionId !== "string") return null;
  const id = sessionId.trim();
  return id ? id : null;
}

export function parseSessionWorkModes(raw: unknown): SessionWorkModeMap {
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
  const out: SessionWorkModeMap = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const id = normalizeId(k);
    if (!id || !isWorkMode(v)) continue;
    out[id] = v;
  }
  return out;
}

export function loadSessionWorkModes(
  storage: SessionWorkModeStorage = defaultStorage(),
): SessionWorkModeMap {
  try {
    return parseSessionWorkModes(storage.getItem(SESSION_WORK_MODE_STORAGE_KEY));
  } catch {
    return {};
  }
}

export function saveSessionWorkModes(
  map: SessionWorkModeMap,
  storage: SessionWorkModeStorage = defaultStorage(),
): void {
  const cleaned: SessionWorkModeMap = {};
  for (const [k, v] of Object.entries(map ?? {})) {
    const id = normalizeId(k);
    if (!id || !isWorkMode(v)) continue;
    cleaned[id] = v;
  }
  try {
    storage.setItem(SESSION_WORK_MODE_STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    /* private mode / quota */
  }
}

export function sessionWorkModeOf(
  sessionId: string | null | undefined,
  map: SessionWorkModeMap,
): WorkMode {
  const id = normalizeId(sessionId);
  if (!id) return DEFAULT_WORK_MODE;
  const mode = map[id];
  return isWorkMode(mode) ? mode : DEFAULT_WORK_MODE;
}

/**
 * A chat is visible on a surface only when it belongs there.
 *
 * - Draft (no id): leftover `pending` from another surface is a mismatch so
 *   switching Build → Studio does not keep a Build-stamped unsent draft.
 * - Tagged id: the stored tag wins. A pending stamp must not let a Build
 *   thread paint on Studio (or the reverse).
 * - Untagged id: pending (first send) wins; otherwise default Build.
 */
export function sessionMatchesSurface(
  sessionId: string | null | undefined,
  map: SessionWorkModeMap,
  surface: WorkMode,
  pendingSurface?: WorkMode | null,
): boolean {
  const id = normalizeId(sessionId);
  if (!id) {
    if (pendingSurface != null && pendingSurface !== surface) return false;
    return true;
  }
  const tagged = map[id];
  if (isWorkMode(tagged)) return tagged === surface;
  if (pendingSurface != null) return pendingSurface === surface;
  return sessionWorkModeOf(id, map) === surface;
}

/**
 * First-write session home. Once tagged, the chat stays on that surface.
 * Drag, retag helpers, surface switches, opening the same folder elsewhere,
 * and Recents regroup must not overwrite this stamp.
 */
export function stampSessionHome(
  map: SessionWorkModeMap,
  sessionId: string | null | undefined,
  mode: WorkMode,
): SessionWorkModeMap {
  const id = normalizeId(sessionId);
  if (!id || !isWorkMode(mode)) return map;
  if (isWorkMode(map[id])) return map;
  return { ...map, [id]: mode };
}

export function explicitSessionWorkMode(
  sessionId: string | null | undefined,
  map: SessionWorkModeMap,
): WorkMode | null {
  const id = normalizeId(sessionId);
  if (!id) return null;
  const mode = map[id];
  return isWorkMode(mode) ? mode : null;
}

/**
 * Write a pending surface onto a just-materialized id.
 *
 * Insert-only: an existing stamp wins so a leftover pending from a surface
 * switch cannot migrate a tagged chat. Callers must store `map` on their
 * ref *before* clearing the pending flag. React setState alone is one
 * commit too late: the mismatch effect would see an untagged id, default
 * it to Build, and `newChat()` the user off the thread they just sent on
 * (Studio / Office first send).
 */
export function consumePendingWorkMode(
  map: SessionWorkModeMap,
  sessionId: string | null | undefined,
  pending: WorkMode | null | undefined,
): { map: SessionWorkModeMap; applied: WorkMode | null } {
  if (pending == null || !isWorkMode(pending)) {
    return { map, applied: null };
  }
  const existing = explicitSessionWorkMode(sessionId, map);
  if (existing != null) {
    return { map, applied: existing === pending ? pending : null };
  }
  const next = stampSessionHome(map, sessionId, pending);
  return { map: next, applied: pending };
}

export function upsertSessionWorkMode(
  map: SessionWorkModeMap,
  sessionId: string | null | undefined,
  mode: WorkMode,
): SessionWorkModeMap {
  const id = normalizeId(sessionId);
  if (!id || !isWorkMode(mode)) return map;
  if (map[id] === mode) return map;
  return { ...map, [id]: mode };
}

/**
 * Drag / bulk helper. A stamped (or default-Build) home cannot change.
 * Same-surface calls may first-write the implicit Build default; a drop
 * onto another workspace is a no-op so the row snaps back.
 */
export function retagSessionsWorkMode(
  map: SessionWorkModeMap,
  sessionIds: readonly string[],
  mode: WorkMode,
): SessionWorkModeMap {
  if (!isWorkMode(mode) || sessionIds.length === 0) return map;
  let next = map;
  for (const raw of sessionIds) {
    const id = normalizeId(raw);
    if (!id) continue;
    if (sessionWorkModeOf(id, next) !== mode) continue;
    next = stampSessionHome(next, id, mode);
  }
  return next;
}

export type SurfaceSession = {
  id: string;
  projectId: string | null;
  archived?: boolean;
};

/**
 * Folder shows under a surface if it has a live chat there.
 * Empty folders use an explicit Create-project home, or Build when unset.
 * An explicit home stays listed even when its only chats live elsewhere.
 */
export function projectVisibleOnSurface(
  projectId: string,
  sessions: readonly SurfaceSession[],
  surface: WorkMode,
  map: SessionWorkModeMap,
  projectHomes: ProjectWorkModeMap = {},
): boolean {
  const active = sessions.filter(
    (s) => s.projectId === projectId && !s.archived,
  );
  const tagged = explicitProjectWorkMode(projectId, projectHomes);
  if (active.length === 0) {
    return surface === projectWorkModeOf(projectId, projectHomes);
  }
  if (active.some((s) => sessionWorkModeOf(s.id, map) === surface)) return true;
  return tagged != null && surface === tagged;
}
