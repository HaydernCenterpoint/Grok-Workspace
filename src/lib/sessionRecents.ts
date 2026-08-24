/**
 * Per-session Recents stamp. Client-only, same storage style as sessionWorkMode.
 *
 * Recents `+` stamps the new session. Folder chats never list in Recents
 * (stamp ignored). Folderless + no stamp live under their work-mode surface.
 */

export const SESSION_RECENTS_STORAGE_KEY = "grok.sessionRecents";

export type SessionRecentsStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function defaultStorage(): SessionRecentsStorage {
  if (typeof localStorage !== "undefined") return localStorage;
  return { getItem: () => null, setItem: () => {} };
}

function normalizeId(sessionId: string | null | undefined): string | null {
  if (typeof sessionId !== "string") return null;
  const id = sessionId.trim();
  return id ? id : null;
}

export function parseSessionRecents(raw: unknown): string[] {
  if (raw == null || raw === "") return [];
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const id = normalizeId(typeof item === "string" ? item : null);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function loadSessionRecents(
  storage: SessionRecentsStorage = defaultStorage(),
): Set<string> {
  try {
    return new Set(parseSessionRecents(storage.getItem(SESSION_RECENTS_STORAGE_KEY)));
  } catch {
    return new Set();
  }
}

export function saveSessionRecents(
  ids: Iterable<string>,
  storage: SessionRecentsStorage = defaultStorage(),
): void {
  const cleaned = parseSessionRecents([...(ids ?? [])]);
  try {
    storage.setItem(SESSION_RECENTS_STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    /* private mode / quota */
  }
}

export function hasSessionRecent(
  recents: ReadonlySet<string>,
  sessionId: string | null | undefined,
): boolean {
  const id = normalizeId(sessionId);
  return !!id && recents.has(id);
}

export function addSessionRecents(
  recents: ReadonlySet<string>,
  sessionIds: readonly string[],
): Set<string> {
  const next = new Set(recents);
  let changed = false;
  for (const raw of sessionIds) {
    const id = normalizeId(raw);
    if (!id || next.has(id)) continue;
    next.add(id);
    changed = true;
  }
  if (!changed) {
    return recents instanceof Set ? recents : next;
  }
  return next;
}

export function removeSessionRecents(
  recents: ReadonlySet<string>,
  sessionIds: readonly string[],
): Set<string> {
  const next = new Set(recents);
  let changed = false;
  for (const raw of sessionIds) {
    const id = normalizeId(raw);
    if (!id || !next.has(id)) continue;
    next.delete(id);
    changed = true;
  }
  if (!changed) {
    return recents instanceof Set ? recents : next;
  }
  return next;
}
