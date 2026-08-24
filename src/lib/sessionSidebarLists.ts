/**
 * Sidebar session buckets: per-surface folders + folderless stacks, then Recents.
 */
import { sortSessionsForSidebar } from "@/lib/sidebarDateGroups";
import {
  isRecentsSidebarSession,
  isSidebarOrphanSession,
  type SessionRow,
} from "@/lib/app/sidebarModels";
import { isWorkMode, WORK_MODES, type WorkMode } from "@/lib/grokOffice";
import { sessionWorkModeOf, type SessionWorkModeMap } from "@/lib/sessionWorkMode";
import {
  folderListKey,
  folderlessListKey,
  SESSION_LIST_RECENTS,
  type SessionSidebarOrderMap,
} from "@/lib/sessionSidebarOrder";

export type SidebarSessionLists = Record<string, SessionRow[]>;

export type SidebarActionScope = WorkMode | "recents";

export function isSidebarActionScope(
  value: unknown,
): value is SidebarActionScope {
  return value === "recents" || isWorkMode(value);
}

/** Section that currently lists this live chat. */
export function sidebarScopeOfSession(
  session: Pick<SessionRow, "id" | "projectId" | "archived">,
  projectIds: ReadonlySet<string>,
  recentsSet: ReadonlySet<string>,
  sessionWorkModes: SessionWorkModeMap,
): SidebarActionScope {
  if (isRecentsSidebarSession(session, projectIds, recentsSet)) return "recents";
  return sessionWorkModeOf(session.id, sessionWorkModes);
}

/**
 * Live chats in one sidebar section. Recents-stamped orphans stay out of
 * Build / Office / Studio so archive / select on a workspace cannot scoop them.
 */
export function sessionsInSidebarScope<T extends SessionRow>(input: {
  sessions: readonly T[];
  scope: SidebarActionScope;
  projectIds: ReadonlySet<string>;
  sessionWorkModes: SessionWorkModeMap;
  recentsSet: ReadonlySet<string>;
}): T[] {
  const { sessions, scope, projectIds, sessionWorkModes, recentsSet } = input;
  return sessions.filter((s) => {
    if (s.archived) return false;
    const recents = isRecentsSidebarSession(s, projectIds, recentsSet);
    if (scope === "recents") return recents;
    if (recents) return false;
    return sessionWorkModeOf(s.id, sessionWorkModes) === scope;
  });
}

/**
 * Pin first, then newest `updatedAt` (parsed timestamp — not locale labels).
 * Saved drag order (`orderMap`) must not freeze an older chat above a newer one.
 */
function orderList(sessions: SessionRow[]): SessionRow[] {
  return sortSessionsForSidebar(sessions);
}

export function buildSidebarSessionLists(input: {
  sessions: readonly SessionRow[];
  projectIds: ReadonlySet<string>;
  sessionWorkModes: SessionWorkModeMap;
  recentsSet: ReadonlySet<string>;
  /** Kept for callers; folder/workspace lists sort by recency, not this map. */
  orderMap?: SessionSidebarOrderMap;
}): SidebarSessionLists {
  const { sessions, projectIds, sessionWorkModes, recentsSet } = input;
  const live = sessions.filter((s) => !s.archived);
  const lists: SidebarSessionLists = {};

  for (const surface of WORK_MODES) {
    const folderless: SessionRow[] = [];
    const byFolder = new Map<string, SessionRow[]>();
    for (const s of live) {
      if (sessionWorkModeOf(s.id, sessionWorkModes) !== surface) continue;
      if (isSidebarOrphanSession(s, projectIds)) {
        if (!isRecentsSidebarSession(s, projectIds, recentsSet)) {
          folderless.push(s);
        }
        continue;
      }
      const pid = s.projectId;
      if (!pid) continue;
      const bucket = byFolder.get(pid);
      if (bucket) bucket.push(s);
      else byFolder.set(pid, [s]);
    }
    lists[folderlessListKey(surface)] = orderList(folderless);
    for (const [projectId, rows] of byFolder) {
      const key = folderListKey(surface, projectId);
      lists[key] = orderList(rows);
    }
  }

  const recents = live.filter((s) =>
    isRecentsSidebarSession(s, projectIds, recentsSet),
  );
  lists[SESSION_LIST_RECENTS] = sortSessionsForSidebar(recents);
  return lists;
}

export function sidebarNavSessionIdsFromLists(input: {
  lists: SidebarSessionLists;
  projects: readonly { id: string }[];
  surfaceOpen: Record<WorkMode, boolean>;
  expandedProjects: Record<string, boolean>;
  recentsOpen: boolean;
}): string[] {
  const ids: string[] = [];
  for (const surface of WORK_MODES) {
    if (input.surfaceOpen[surface] === false) continue;
    for (const proj of input.projects) {
      if (input.expandedProjects[proj.id] === false) continue;
      const rows = input.lists[folderListKey(surface, proj.id)] ?? [];
      for (const s of rows) ids.push(s.id);
    }
    for (const s of input.lists[folderlessListKey(surface)] ?? []) {
      ids.push(s.id);
    }
  }
  if (input.recentsOpen) {
    for (const s of input.lists[SESSION_LIST_RECENTS] ?? []) ids.push(s.id);
  }
  return ids;
}

export function sidebarSelectOrderIdsFromLists(input: {
  lists: SidebarSessionLists;
  projects: readonly { id: string }[];
}): string[] {
  const ids: string[] = [];
  for (const surface of WORK_MODES) {
    for (const proj of input.projects) {
      const rows = input.lists[folderListKey(surface, proj.id)] ?? [];
      for (const s of rows) ids.push(s.id);
    }
    for (const s of input.lists[folderlessListKey(surface)] ?? []) {
      ids.push(s.id);
    }
  }
  for (const s of input.lists[SESSION_LIST_RECENTS] ?? []) ids.push(s.id);
  return ids;
}
