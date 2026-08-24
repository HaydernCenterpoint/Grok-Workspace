/**
 * Product surfaces: Grok Build (`code`), Grok Office (`office`), Grok Studio (`studio`).
 * Office = papers / slides / sheets on a document canvas. Studio = Imagine.
 * Not a second agent. Not a port of OfficeCLI.
 */

export type WorkMode = "code" | "office" | "studio";

export const WORK_MODES: readonly WorkMode[] = ["code", "office", "studio"] as const;

export const DEFAULT_WORK_MODE: WorkMode = "code";
export const WORK_MODE_STORAGE_KEY = "grok.workMode";
export const WORK_MODE_ATTR = "data-work-mode";
export const OFFICE_HASH = "#/office";
export const STUDIO_HASH = "#/studio";

/** Common document / slide / sheet extensions (preview + future tree filter). */
export const OFFICE_EXTENSIONS = new Set([
  ".doc",
  ".docx",
  ".odt",
  ".rtf",
  ".xls",
  ".xlsx",
  ".xlsm",
  ".ods",
  ".csv",
  ".ppt",
  ".pptx",
  ".odp",
  ".pdf",
  ".pages",
  ".numbers",
  ".key",
]);

export type WorkModeStorage = {
  getItem(key: string): string | null;
  setItem?(key: string, value: string): void;
};

export type WorkModeRoot = {
  setAttribute(name: string, value: string): void;
};

export function isWorkMode(value: unknown): value is WorkMode {
  return value === "code" || value === "office" || value === "studio";
}

export function parseWorkMode(raw: unknown): WorkMode {
  if (typeof raw === "string" && isWorkMode(raw)) return raw;
  return DEFAULT_WORK_MODE;
}

export function loadWorkMode(
  storage: WorkModeStorage = typeof localStorage !== "undefined"
    ? localStorage
    : { getItem: () => null, setItem: () => {} },
): WorkMode {
  try {
    return parseWorkMode(storage.getItem(WORK_MODE_STORAGE_KEY));
  } catch {
    return DEFAULT_WORK_MODE;
  }
}

export function saveWorkMode(
  mode: WorkMode,
  storage: WorkModeStorage = typeof localStorage !== "undefined"
    ? localStorage
    : { getItem: () => null, setItem: () => {} },
): void {
  try {
    storage.setItem?.(WORK_MODE_STORAGE_KEY, mode);
  } catch {
    /* private mode / quota */
  }
}

export function applyWorkMode(
  mode: WorkMode,
  root: WorkModeRoot = typeof document !== "undefined"
    ? document.documentElement
    : { setAttribute: () => {} },
): void {
  root.setAttribute(WORK_MODE_ATTR, mode);
}

export function isOfficeHash(hash: string): boolean {
  const raw = hash.replace(/^#\/?/, "").split("?")[0] ?? "";
  return raw === "office" || raw.startsWith("office/");
}

export function isStudioHash(hash: string): boolean {
  const raw = hash.replace(/^#\/?/, "").split("?")[0] ?? "";
  return raw === "studio" || raw.startsWith("studio/");
}

export function isOfficePath(path: string): boolean {
  const base = path.replace(/\\/g, "/").split("/").pop() ?? path;
  if (base.toLowerCase().endsWith(".office.json")) return true;
  const dot = base.lastIndexOf(".");
  if (dot < 0) return false;
  return OFFICE_EXTENSIONS.has(base.slice(dot).toLowerCase());
}

export function composerPlaceholderKey(opts: {
  goalMode: boolean;
  workMode: WorkMode;
  /** Named Grok Build folder bound into Office (not the general workspace). */
  hasBuildProject?: boolean;
}):
  | "composer.goalPlaceholder"
  | "studio.placeholder"
  | "composer.placeholder" {
  if (opts.goalMode) return "composer.goalPlaceholder";
  switch (opts.workMode) {
    case "office":
    case "code":
      return "composer.placeholder";
    case "studio":
      return "studio.placeholder";
    default: {
      const _never: never = opts.workMode;
      return _never;
    }
  }
}

export function productTitleKey(
  mode: WorkMode,
): "sidebar.build" | "sidebar.office" | "sidebar.studio" {
  switch (mode) {
    case "office":
      return "sidebar.office";
    case "studio":
      return "sidebar.studio";
    case "code":
      return "sidebar.build";
    default: {
      const _never: never = mode;
      return _never;
    }
  }
}

export function newSessionKey(
  mode: WorkMode,
):
  | "sidebar.newSession"
  | "sidebar.officeNewSession"
  | "sidebar.studioNewSession" {
  switch (mode) {
    case "office":
      return "sidebar.officeNewSession";
    case "studio":
      return "sidebar.studioNewSession";
    case "code":
      return "sidebar.newSession";
    default: {
      const _never: never = mode;
      return _never;
    }
  }
}

/**
 * What each product surface may show.
 * Build = coding workbench. Office / Studio hide coding chrome.
 * Studio also hides Build model / access / project chips (Imagine is locked).
 */
export type WorkSurfaceChrome = {
  kanbanNav: boolean;
  bottomTerminal: boolean;
  composerWorktrees: boolean;
  composerSkills: boolean;
  sideTerminal: boolean;
  sideReview: boolean;
  sideSkills: boolean;
  gitChangeChips: boolean;
  composerModel: boolean;
  composerAccess: boolean;
  composerProject: boolean;
  composerContext: boolean;
};

const QUIET_SHELL = {
  kanbanNav: false,
  bottomTerminal: false,
  composerWorktrees: false,
  composerSkills: false,
  sideTerminal: false,
  sideReview: false,
  sideSkills: false,
  gitChangeChips: false,
} as const;

export function workSurfaceChrome(mode: WorkMode): WorkSurfaceChrome {
  switch (mode) {
    case "studio":
      return {
        ...QUIET_SHELL,
        composerModel: false,
        composerAccess: false,
        composerProject: false,
        composerContext: false,
      };
    case "office":
      return {
        ...QUIET_SHELL,
        composerModel: true,
        composerAccess: true,
        composerProject: true,
        composerContext: true,
      };
    case "code":
      return {
        kanbanNav: true,
        bottomTerminal: true,
        composerWorktrees: true,
        composerSkills: true,
        sideTerminal: true,
        sideReview: true,
        sideSkills: true,
        gitChangeChips: true,
        composerModel: true,
        composerAccess: true,
        composerProject: true,
        composerContext: true,
      };
    default: {
      const _never: never = mode;
      return _never;
    }
  }
}

/** Office start-screen starters — papers, slides, sheets. */
export type OfficeStartKind = "report" | "slides" | "sheet";

export const OFFICE_START_KINDS: readonly OfficeStartKind[] = [
  "report",
  "slides",
  "sheet",
] as const;

export type OfficeWorkspaceLayout = "start" | "chat-only" | "split";

/**
 * Empty Office keeps the landing canvas. A transcript with no document
 * uses the full command column (Build/Studio hide their heroes the same
 * way). A loaded `*.office.json` / office file keeps the document split.
 */
export function resolveOfficeWorkspaceLayout(input: {
  showChat: boolean;
  hasDocument: boolean;
}): OfficeWorkspaceLayout {
  if (input.hasDocument) return "split";
  if (input.showChat) return "chat-only";
  return "start";
}

/**
 * Hide the Office start mark once this Office session is a live chat —
 * not only after the shell message array has a row. Working / hydrating
 * turns used to keep the logo + slogan on top of an empty command column.
 */
export function shouldShowOfficeCommandChat(input: {
  matchesOfficeSession: boolean;
  messageCount: number;
  sessionBusy?: boolean;
  journalLoading?: boolean;
  hasStreamingAssistant?: boolean;
}): boolean {
  if (!input.matchesOfficeSession) return false;
  return (
    input.messageCount > 0 ||
    input.sessionBusy === true ||
    input.journalLoading === true ||
    input.hasStreamingAssistant === true
  );
}

export type OfficeStartSeedKey =
  | "composer.officeReportDraft"
  | "composer.officeReportDraftGeneric"
  | "composer.officeSlidesDraft"
  | "composer.officeSheetDraft";

/** Composer seed for a starter. Only the report seed names the Build folder. */
export function officeStartSeedKey(
  kind: OfficeStartKind,
  hasBuildProject: boolean,
): OfficeStartSeedKey {
  switch (kind) {
    case "report":
      return hasBuildProject
        ? "composer.officeReportDraft"
        : "composer.officeReportDraftGeneric";
    case "slides":
      return "composer.officeSlidesDraft";
    case "sheet":
      return "composer.officeSheetDraft";
  }
}

const OFFICE_SIDE_KINDS = new Set(["file", "browser", "plan"]);

export function isOfficeSideTabKind(kind: string): boolean {
  return OFFICE_SIDE_KINDS.has(kind);
}
