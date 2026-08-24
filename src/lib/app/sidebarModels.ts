/**
 * Sidebar project / session row shapes and Host list mappers.
 * Extracted from AppWorkbench (residual-appworkbench).
 */
import type { MessageKey } from "@/i18n";
import { normalizeProjectColor } from "@/lib/projectColor";
import { sanitizeExtraRules } from "@/lib/sessionExtraRules";
import { normalizeMaxAgentTurns } from "@/lib/sessionMaxAgentTurns";
import { sanitizeSystemPromptOverride } from "@/lib/sessionSystemPrompt";
import {
  sessionWorkModeOf,
  type SessionWorkModeMap,
} from "@/lib/sessionWorkMode";
import type { WorkMode } from "@/lib/grokOffice";

export interface Project {
  id: string;
  name: string;
  path: string;
  trusted: boolean;
  pathOk: boolean;
  pinned?: boolean;
  /** App-managed general workspace — cannot be removed. */
  system?: boolean;
  /** Project-level permission tier (L10). Null/undefined → app default. */
  permissionPolicy?: string | null;
  /** Project-level OS sandbox profile. Null/undefined → app Settings. */
  sandboxProfile?: string | null;
  /** Optional sidebar accent: token or #hex. Null/undefined → none. */
  color?: string | null;
}

/** Retired sidebar project id — sessions rehomed to orphan ("其他会话"). */
export const GENERAL_PROJECT_ID = "system:general";

export function isGeneralProject(p: { id?: string | null; system?: boolean } | null | undefined) {
  return !!p && (p.id === GENERAL_PROJECT_ID || !!p.system);
}

/** Treat legacy system:general bindings as unbound (other sessions). */
export function normalizeProjectId(id: string | null | undefined): string | null {
  if (!id || id === GENERAL_PROJECT_ID) return null;
  return id;
}

/**
 * Live chat with no known project folder (including retired `system:general`).
 * Folderless chats are Recents only when stamped; otherwise they sit on a surface.
 */
export function isSidebarOrphanSession(
  session: { projectId?: string | null; archived?: boolean },
  projectIds: ReadonlySet<string>,
): boolean {
  if (session.archived) return false;
  const id = normalizeProjectId(session.projectId);
  return !id || !projectIds.has(id);
}

/** Folder session is never Recents — stamp is ignored while a known project binds it. */
export function isRecentsSidebarSession(
  session: { id?: string; projectId?: string | null; archived?: boolean },
  projectIds: ReadonlySet<string>,
  recentsSet: ReadonlySet<string>,
): boolean {
  if (!isSidebarOrphanSession(session, projectIds)) return false;
  const id = typeof session.id === "string" ? session.id.trim() : "";
  return !!id && recentsSet.has(id);
}

/** Folderless + no Recents stamp → Grok Build / Office / Studio stack. */
export function isSurfaceFolderlessSession(
  session: { id?: string; projectId?: string | null; archived?: boolean },
  projectIds: ReadonlySet<string>,
  recentsSet: ReadonlySet<string>,
): boolean {
  return (
    isSidebarOrphanSession(session, projectIds) &&
    !isRecentsSidebarSession(session, projectIds, recentsSet)
  );
}

export function surfaceFolderlessSessions<
  T extends { id: string; projectId?: string | null; archived?: boolean },
>(
  sessions: readonly T[],
  projectIds: ReadonlySet<string>,
  recentsSet: ReadonlySet<string>,
  surface: WorkMode,
  map: SessionWorkModeMap,
): T[] {
  return sessions.filter(
    (s) =>
      isSurfaceFolderlessSession(s, projectIds, recentsSet) &&
      sessionWorkModeOf(s.id, map) === surface,
  );
}

export function projectDisplayName(
  p: { id?: string | null; name?: string | null; system?: boolean } | null | undefined,
  tr: (k: MessageKey, vars?: Record<string, string>) => string,
): string {
  if (!p || isGeneralProject(p)) return tr("composer.noProject");
  return (p?.name || "").trim() || tr("main.noProject");
}

/** Normalize API project rows; drop retired system:general if Host still returns it. */
export function normalizeProject(x: Project): Project {
  return {
    ...x,
    system: false,
    pinned: !!x.pinned,
    trusted: !!x.trusted,
    color: normalizeProjectColor(x.color) ?? null,
  };
}

export function mapProjectsList(list: Project[]): Project[] {
  return list
    .filter((p) => !isGeneralProject(p))
    .map((p) => normalizeProject({ ...p, pinned: !!p.pinned }));
}

export interface SessionRow {
  id: string;
  title: string;
  projectId: string | null;
  updatedAt: string;
  /** Last known model on session meta (from sessions_list). */
  modelId?: string | null;
  /** Last known effort on session meta when stored. */
  effort?: string | null;
  archived?: boolean;
  /** Pinned chats float to the top of the sidebar */
  pinned?: boolean;
  /** Shell scheduled-automation run */
  scheduled?: boolean;
  /** Linked git worktree this chat was opened against (optional). */
  worktreePath?: string | null;
  worktreeBranch?: string | null;
  isWorktreeSession?: boolean;
  /** Optional JSON Schema for structured model output. */
  jsonSchema?: string | null;
  /** Session-only plugin directories (`--plugin-dir`). */
  pluginDirs?: string[];
  /** Per-session extra rules (`--rules`). */
  extraRules?: string | null;
  /** Per-session max agent turns (`--max-turns`); null = inherit global. */
  maxAgentTurns?: number | null;
  /** Per-session system prompt override (`--system-prompt-override`). */
  systemPromptOverride?: string | null;
  /** Linked Grok agent session id (for CLI `--fork-session` / session/load). */
  agentSessionId?: string | null;
}

/** Normalize sessions_list / create rows into sidebar SessionRow shape. */
export function normalizeSessionRow(
  x: Partial<SessionRow> & {
    id: string;
    title?: string;
    projectId?: string | null;
    updatedAt?: string;
    agentSessionId?: string | null;
  },
): SessionRow {
  const worktreePath = (x.worktreePath || "").trim() || null;
  const worktreeBranch = (x.worktreeBranch || "").trim() || null;
  const isWorktreeSession = !!(x.isWorktreeSession || worktreePath);
  const agentSessionId = (x.agentSessionId || "").trim() || null;
  return {
    id: x.id,
    title: x.title || "",
    projectId: normalizeProjectId(x.projectId),
    updatedAt: x.updatedAt || "",
    archived: !!x.archived,
    pinned: !!x.pinned,
    scheduled: !!x.scheduled,
    worktreePath,
    worktreeBranch,
    isWorktreeSession,
    agentSessionId,
  };
}

/** Map host session index rows into sidebar/dashboard SessionRow. */
export function mapSessionListRow(
  x: Partial<SessionRow> & {
    id: string;
    title?: string;
    projectId?: string | null;
    updatedAt?: string;
    modelId?: string | null;
    effort?: string | null;
    jsonSchema?: string | null;
    pluginDirs?: string[] | null;
    extraRules?: string | null;
    maxAgentTurns?: number | null;
    systemPromptOverride?: string | null;
    agentSessionId?: string | null;
  },
): SessionRow {
  const schema =
    typeof x.jsonSchema === "string" && x.jsonSchema.trim()
      ? x.jsonSchema
      : null;
  const pluginDirs = Array.isArray(x.pluginDirs)
    ? x.pluginDirs.map((d) => String(d).trim()).filter(Boolean)
    : [];
  const extraRules = sanitizeExtraRules(
    typeof x.extraRules === "string" ? x.extraRules : null,
  );
  const maxAgentTurns = normalizeMaxAgentTurns(
    typeof x.maxAgentTurns === "number" ? x.maxAgentTurns : null,
  );
  const systemPromptOverride = sanitizeSystemPromptOverride(
    typeof x.systemPromptOverride === "string" ? x.systemPromptOverride : null,
  );
  return {
    ...normalizeSessionRow(x),
    modelId: x.modelId ?? null,
    effort: x.effort ?? null,
    jsonSchema: schema,
    pluginDirs,
    extraRules: extraRules || null,
    maxAgentTurns,
    systemPromptOverride: systemPromptOverride || null,
  };
}
