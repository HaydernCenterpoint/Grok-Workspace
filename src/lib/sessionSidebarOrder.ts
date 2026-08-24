/**
 * Client-side sidebar session order for Grok Build / Office / Studio.
 * No host API — persist like sessionWorkMode (localStorage).
 *
 * Recents is not a reorder list. In-list drag reorder is disabled: each
 * folder / folderless stack sorts by pin then newest `updatedAt`. These
 * helpers remain for pin-group math and leftover stored maps.
 */

import {
  applyProjectPinPartition,
  reorderProjectInPinGroup,
  reorderProjectsByIds,
  resolveProjectDropIndex,
  type PinableProject,
} from "@/lib/app/projectOrder";
import { isWorkMode, type WorkMode } from "@/lib/grokOffice";

export const SESSION_SIDEBAR_ORDER_STORAGE_KEY = "grok.sessionSidebarOrder";

export const SESSION_LIST_RECENTS = "recents";

export type SessionSidebarOrderMap = Record<string, string[]>;

export type SessionSidebarOrderStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function defaultStorage(): SessionSidebarOrderStorage {
  if (typeof localStorage !== "undefined") return localStorage;
  return { getItem: () => null, setItem: () => {} };
}

function normalizeId(id: string | null | undefined): string | null {
  if (typeof id !== "string") return null;
  const t = id.trim();
  return t ? t : null;
}

export function folderlessListKey(surface: WorkMode): string {
  return `folderless:${surface}`;
}

export function folderListKey(surface: WorkMode, projectId: string): string {
  return `folder:${surface}:${projectId}`;
}

export function isReorderableSessionListKey(
  key: string | null | undefined,
): boolean {
  if (!key) return false;
  return key.startsWith("folderless:") || key.startsWith("folder:");
}

export function parseFolderlessListKey(
  key: string | null | undefined,
): WorkMode | null {
  if (!key || !key.startsWith("folderless:")) return null;
  const mode = key.slice("folderless:".length);
  return isWorkMode(mode) ? mode : null;
}

export function parseFolderListKey(
  key: string | null | undefined,
): { surface: WorkMode; projectId: string } | null {
  if (!key || !key.startsWith("folder:")) return null;
  const rest = key.slice("folder:".length);
  const colon = rest.indexOf(":");
  if (colon <= 0) return null;
  const surface = rest.slice(0, colon);
  const projectId = rest.slice(colon + 1).trim();
  if (!isWorkMode(surface) || !projectId) return null;
  return { surface, projectId };
}

export function parseSessionSidebarOrder(raw: unknown): SessionSidebarOrderMap {
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
  const out: SessionSidebarOrderMap = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const key = typeof k === "string" ? k.trim() : "";
    if (!key || !Array.isArray(v)) continue;
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const item of v) {
      const id = normalizeId(typeof item === "string" ? item : null);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    out[key] = ids;
  }
  return out;
}

export function loadSessionSidebarOrder(
  storage: SessionSidebarOrderStorage = defaultStorage(),
): SessionSidebarOrderMap {
  try {
    return parseSessionSidebarOrder(
      storage.getItem(SESSION_SIDEBAR_ORDER_STORAGE_KEY),
    );
  } catch {
    return {};
  }
}

export function saveSessionSidebarOrder(
  map: SessionSidebarOrderMap,
  storage: SessionSidebarOrderStorage = defaultStorage(),
): void {
  const cleaned = parseSessionSidebarOrder(map ?? {});
  try {
    storage.setItem(SESSION_SIDEBAR_ORDER_STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    /* private mode / quota */
  }
}

/**
 * Apply saved ids, then pin-partition. Unknown ids ignored; missing sessions
 * stay in prior relative order (typically pin-then-updatedAt).
 */
export function applySessionSidebarOrder<T extends PinableProject>(
  list: T[],
  orderedIds: readonly string[] | null | undefined,
): T[] {
  if (!list.length) return list;
  if (!orderedIds?.length) return applyProjectPinPartition(list);
  return reorderProjectsByIds(list, orderedIds);
}

export function reorderSessionInPinGroup<T extends PinableProject>(
  list: T[],
  fromIndex: number,
  toIndex: number,
): T[] {
  return reorderProjectInPinGroup(list, fromIndex, toIndex);
}

export function resolveSessionDropIndex(
  list: readonly PinableProject[],
  fromIndex: number,
  hoverIndex: number,
  placeAfter: boolean,
): number {
  return resolveProjectDropIndex(list, fromIndex, hoverIndex, placeAfter);
}

export function upsertSessionListOrder(
  map: SessionSidebarOrderMap,
  listKey: string,
  orderedIds: readonly string[],
): SessionSidebarOrderMap {
  const key = listKey.trim();
  if (!key) return map;
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const raw of orderedIds) {
    const id = normalizeId(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return { ...map, [key]: ids };
}
