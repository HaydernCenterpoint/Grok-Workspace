/**
 * Layout preferences: sidebar width, aside width, aside collapsed default.
 * Durable key in localStorage (App config later).
 *
 * Right resource pane width is chrome-safe + content-aware:
 * - Never narrower than tabs + action icons (+ window min/max/close on Win)
 * - Soft-grow toward a preferred width for the active surface (preview kind,
 *   plan, diff, tree split); never auto-shrink below the user/current width
 *   except to enforce chrome min / viewport max.
 */

export const LAYOUT_STORAGE_KEY = "grok-app.layout";

/** Mirror phone CSS drawer breakpoint (`app.css` max-width: 820px). */
export const MIRROR_DRAWER_BREAKPOINT = 820;

export interface LayoutPrefs {
  sidebarWidth: number;
  asideWidth: number;
  /** Right pane defaults collapsed per §17.1 / autoplan Design D7. */
  asideCollapsed: boolean;
  /** Left project rail collapsed (Codex-style). */
  sidebarCollapsed: boolean;
}

/**
 * Self-drawn window controls (min / max / close) — 3 × 46px.
 * Matches `padding-right: 138px` in app.css for `.main__top` / `.rp-chrome`.
 */
export const WINDOW_CONTROLS_INSET = 138;

/**
 * Minimum width for tabs strip + chrome action cluster (open-loc, plan,
 * changes, tree, close) before any window-control inset.
 * ~100px tab name + ~160px actions + 20px chrome pad ≈ 280.
 */
export const ASIDE_CHROME_CONTENT_MIN = 280;

/**
 * Absolute floor for the right pane (Side Workbench min ≥ 400px per PLAN).
 * Still below chrome-safe when window controls are present — use
 * {@link asideChromeSafeMin} for the real floor.
 */
export const ASIDE_WIDTH_MIN = 400;

/**
 * Historical soft comfort width for the right pane. **Not a hard max** —
 * aside may grow with the window as long as chat keeps
 * {@link MAIN_CHAT_MIN_WIDTH}. Prefer {@link asideWidthMax} for the real cap.
 */
export const ASIDE_WIDTH_MAX = 720;

/**
 * Minimum width for the center chat column. Aside drag / auto-size must not
 * squeeze the conversation below this (composer + bubbles become unreadable).
 * Expanded side-overlay mode does not use this split (aside covers chat).
 */
export const MAIN_CHAT_MIN_WIDTH = 360;

/**
 * Leave at least this much for the main chat column when auto-sizing the aside.
 * Alias of {@link MAIN_CHAT_MIN_WIDTH} (kept for older call sites / docs).
 */
export const ASIDE_MAIN_RESERVE = MAIN_CHAT_MIN_WIDTH;

/**
 * Default open sidebar width — Codex rail (~240). Saved widths are not overwritten.
 * Used when clamping aside so chat keeps {@link MAIN_CHAT_MIN_WIDTH}.
 */
export const SIDEBAR_DEFAULT_WIDTH = 240;

/**
 * Narrowest *painted* open left rail (session titles + chrome still usable).
 * Live drag clamps here and stays open; collapse is a separate snap below
 * {@link SIDEBAR_COLLAPSE_THRESHOLD} (decided on pointer-up).
 */
export const SIDEBAR_WIDTH_MIN = 200;

/** Widest left rail before chat / aside become cramped. */
export const SIDEBAR_WIDTH_MAX = 420;

/**
 * Desired width below this on **pointer-up** → collapse.
 * Well under {@link SIDEBAR_WIDTH_MIN} so a short leftward drag from the
 * 240px default cannot slam the rail shut. Between this and open-min the
 * rail stays painted at min.
 */
export const SIDEBAR_COLLAPSE_THRESHOLD = 96;

/**
 * One-sample |ΔclientX| above this is treated as lost tracking (rebase),
 * not a real collapse swipe.
 */
export const SIDEBAR_DRAG_JUMP_PX = 160;

/** clientX this far outside the viewport is an impossible sample. */
export const SIDEBAR_DRAG_OUTSIDE_SLACK_PX = 64;

export type SidebarClampOpts = {
  /** `window.innerWidth` — caps max so chat (+ open aside) stay usable. */
  viewportWidth?: number;
  /** Horizontal space taken by the open right pane (0 when collapsed). */
  asideOccupiedWidth?: number;
};

/**
 * Clamp left-rail width to [min, max], optionally leaving room for chat + aside.
 */
export function clampSidebarWidth(
  w: number,
  opts?: SidebarClampOpts,
): number {
  if (!Number.isFinite(w)) return SIDEBAR_DEFAULT_WIDTH;
  let max = SIDEBAR_WIDTH_MAX;
  const vw = opts?.viewportWidth;
  if (typeof vw === "number" && Number.isFinite(vw) && vw > 0) {
    const aside = Math.max(0, opts?.asideOccupiedWidth ?? 0);
    const room = Math.floor(vw - MAIN_CHAT_MIN_WIDTH - aside);
    max = Math.min(max, Math.max(SIDEBAR_WIDTH_MIN, room));
  }
  return Math.min(max, Math.max(SIDEBAR_WIDTH_MIN, Math.round(w)));
}

/**
 * Live width while dragging — stays within open [min, max] only.
 * Desired values between {@link SIDEBAR_COLLAPSE_THRESHOLD} and min paint
 * at min and stay open. Collapse is decided on pointer-up via
 * {@link resolveSidebarDragEnd}, not a single move sample.
 */
export function clampSidebarDragWidth(
  w: number,
  opts?: SidebarClampOpts,
): number {
  return clampSidebarWidth(w, opts);
}

/** True when a (finite) desired width should snap the rail closed. */
export function shouldCollapseSidebarFromDesired(desired: number): boolean {
  return Number.isFinite(desired) && Math.round(desired) < SIDEBAR_COLLAPSE_THRESHOLD;
}

export type SidebarDragPointerSample = {
  clientX: number;
  previousClientX: number | null;
  viewportWidth: number;
};

export type SidebarDragPointerDecision = "apply" | "ignore" | "rebase";

/**
 * Drop or rebase impossible pointer samples so a stray `clientX` (0 on
 * Windows, off-window, or a huge jump) cannot collapse the rail.
 */
export function classifySidebarDragPointerSample(
  sample: SidebarDragPointerSample,
): SidebarDragPointerDecision {
  const { clientX, previousClientX, viewportWidth } = sample;
  if (!Number.isFinite(clientX)) return "ignore";
  // Windows sometimes emits clientX=0 while the pointer is mid-window.
  if (
    clientX === 0 &&
    previousClientX != null &&
    previousClientX > 16
  ) {
    return "ignore";
  }
  const vw = Number.isFinite(viewportWidth) ? viewportWidth : 0;
  if (vw > 0) {
    if (
      clientX < -SIDEBAR_DRAG_OUTSIDE_SLACK_PX ||
      clientX > vw + SIDEBAR_DRAG_OUTSIDE_SLACK_PX
    ) {
      return "ignore";
    }
  }
  if (
    previousClientX != null &&
    Number.isFinite(previousClientX) &&
    Math.abs(clientX - previousClientX) > SIDEBAR_DRAG_JUMP_PX
  ) {
    return "rebase";
  }
  return "apply";
}

export type SidebarDragEndResult =
  | { action: "collapse"; sidebarWidth: number }
  | { action: "open"; sidebarWidth: number };

export type SidebarDragEndOpts = SidebarClampOpts & {
  /**
   * Last *open* painted width. Stored on collapse so reopen is ≥ min,
   * never the crushed desired pixels.
   */
  lastOpenWidth?: number;
};

/**
 * Resolve pointer-up (not live move).
 * - desired &lt; snap threshold → close; persist last open width (≥ min)
 * - otherwise → stay open at the clamped desired width
 */
export function resolveSidebarDragEnd(
  w: number,
  opts?: SidebarDragEndOpts,
): SidebarDragEndResult {
  const raw = Number.isFinite(w) ? Math.round(w) : SIDEBAR_DEFAULT_WIDTH;
  if (shouldCollapseSidebarFromDesired(raw)) {
    const stored = clampSidebarWidth(
      opts?.lastOpenWidth ?? SIDEBAR_WIDTH_MIN,
      opts,
    );
    return { action: "collapse", sidebarWidth: stored };
  }
  return { action: "open", sidebarWidth: clampSidebarWidth(raw, opts) };
}

export const DEFAULT_LAYOUT: LayoutPrefs = {
  sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
  /** Comfortable default: tabs + actions + light preview. */
  asideWidth: 400,
  /**
   * Chat-first launch on every chrome. The tools pane is 400px of a 1200px
   * window; opening a file / terminal / review uncollapses it on demand
   * (`resourceOpenTarget`), so the conversation owns the frame until then.
   */
  asideCollapsed: true,
  /** Left session rail starts open; can fully hide via top-bar panel icon. */
  sidebarCollapsed: false,
};

/** True when CSS phone drawer / phone chrome rules apply (≤ 820px). */
export function isPhoneViewport(width: number): boolean {
  return Number.isFinite(width) && width <= MIRROR_DRAWER_BREAKPOINT;
}

/**
 * Mirror client on a phone-width viewport — full phone chrome (drawer, sheets).
 * Desktop (≥ 821px) never enters this path.
 */
export function isMirrorPhoneLayout(opts: {
  isMirror: boolean;
  viewportWidth: number;
}): boolean {
  return opts.isMirror && isPhoneViewport(opts.viewportWidth);
}

/**
 * On mirror phone viewports the sidebar is a full-height drawer over chat.
 * Start collapsed so first paint shows the conversation; toggle still opens it.
 */
export function withMirrorPhoneDrawerDefault(
  layout: LayoutPrefs,
  opts: { isMirror: boolean; viewportWidth: number },
): LayoutPrefs {
  if (isMirrorPhoneLayout(opts)) {
    return { ...layout, sidebarCollapsed: true };
  }
  return layout;
}

export type AsideClampOpts = {
  /** Right inset reserved for min/max/close (Win / custom chrome). */
  windowControlsInset?: number;
  /** `window.innerWidth` — caps max so chat stays usable. */
  viewportWidth?: number;
  /**
   * Horizontal space already taken by the left sidebar (0 when collapsed).
   * Defaults to 0 so callers that omit it still reserve the chat min only.
   */
  sidebarOccupiedWidth?: number;
};

/**
 * Chrome-safe minimum: tabs + action icons must not collide with window
 * controls. Platform without custom chrome uses `windowControlsInset: 0`.
 * Not capped by a fixed aside max — only floor is {@link ASIDE_WIDTH_MIN}.
 */
export function asideChromeSafeMin(opts?: AsideClampOpts): number {
  const inset = Math.max(0, opts?.windowControlsInset ?? 0);
  // Extra 40px so an active tab label remains readable beside actions.
  const min = ASIDE_CHROME_CONTENT_MIN + inset + 40;
  return Math.max(ASIDE_WIDTH_MIN, Math.round(min));
}

/**
 * Upper bound for the right pane when chat is still visible beside it.
 * Only constraint: leave ≥ {@link MAIN_CHAT_MIN_WIDTH} for the center column
 * (plus open left sidebar). No fixed 720px (or similar) hard max.
 * When viewport is unknown, returns a large number so clamp only applies min.
 * Expanded side-overlay does not use this (aside is full free area).
 */
export function asideWidthMax(opts?: AsideClampOpts): number {
  const vw = opts?.viewportWidth;
  if (typeof vw === "number" && Number.isFinite(vw) && vw > 0) {
    const sidebar = Math.max(0, opts?.sidebarOccupiedWidth ?? 0);
    // Keep chat ≥ MAIN_CHAT_MIN_WIDTH after sidebar.
    const room = Math.floor(vw - sidebar - MAIN_CHAT_MIN_WIDTH);
    // Narrow windows: room may be below chrome min — still return room so
    // clamp can prefer fitting over blowing past the chat floor.
    return Math.max(0, room);
  }
  // No viewport: do not invent a 720px ceiling.
  return Number.MAX_SAFE_INTEGER;
}

export function clampAsideWidth(w: number, opts?: AsideClampOpts): number {
  if (!Number.isFinite(w)) return DEFAULT_LAYOUT.asideWidth;
  const min = asideChromeSafeMin(opts);
  const max = asideWidthMax(opts);
  const raw = Math.round(w);
  // Squeezed frame: prefer the chat floor (max) over forcing chrome min.
  if (max < min) return Math.max(0, max);
  return Math.min(max, Math.max(min, raw));
}

/**
 * Minimum inner width to keep sidebar + chat floor + open resource pane readable.
 * Used to grow the OS window when opening a pane on a narrow frame.
 */
export function requiredWorkbenchInnerWidth(layout: {
  sidebarCollapsed?: boolean;
  sidebarWidth?: number;
  asideCollapsed?: boolean;
  asideWidth?: number;
}): number {
  const side = layout.sidebarCollapsed
    ? 0
    : Math.max(0, Math.round(layout.sidebarWidth ?? SIDEBAR_DEFAULT_WIDTH));
  const aside = layout.asideCollapsed
    ? 0
    : Math.max(
        ASIDE_WIDTH_MIN,
        Math.round(layout.asideWidth ?? DEFAULT_LAYOUT.asideWidth),
      );
  return side + MAIN_CHAT_MIN_WIDTH + aside;
}

/**
 * Active surface in the resource pane — drives preferred width.
 * Keep in sync with ResourceViewer preview / side modes.
 */
export type AsideSurface =
  | "empty"
  | "plan"
  | "diff"
  | "markdown"
  | "code"
  | "text"
  | "json"
  | "html"
  | "url"
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "office"
  | "binary"
  | "unknown";

export type AsideLayoutHint = {
  surface: AsideSurface;
  /** Preview | tree split open. */
  treeVisible: boolean;
  tabCount: number;
  windowControlsInset?: number;
};

/** Map FsReadResult / preview kind strings onto {@link AsideSurface}. */
export function asideSurfaceFromPreviewKind(
  kind: string | null | undefined,
): AsideSurface {
  const k = (kind || "").toLowerCase().trim();
  if (!k) return "empty";
  if (k === "markdown" || k === "md") return "markdown";
  if (k === "code" || k === "css" || k === "ts" || k === "tsx" || k === "js") {
    return "code";
  }
  if (k === "text" || k === "csv" || k === "config") return "text";
  if (k === "json") return "json";
  if (k === "html") return "html";
  if (k === "image") return "image";
  if (k === "video") return "video";
  if (k === "audio") return "audio";
  if (k === "pdf") return "pdf";
  if (
    k === "docx" ||
    k === "xlsx" ||
    k === "pptx" ||
    k === "odf" ||
    k === "office"
  ) {
    return "office";
  }
  if (k === "binary") return "binary";
  if (k === "url") return "url";
  // Host may classify sources as generic text with body.
  return "unknown";
}

/**
 * Preferred aside width for the active surface.
 * Policy: comfortable preview first; tree open adds split room; always ≥ chrome min.
 */
export function suggestAsideWidth(
  hint: AsideLayoutHint,
  opts?: AsideClampOpts,
): number {
  const clampOpts: AsideClampOpts = {
    windowControlsInset:
      hint.windowControlsInset ?? opts?.windowControlsInset ?? 0,
    viewportWidth: opts?.viewportWidth,
  };

  let base: number;
  switch (hint.surface) {
    case "empty":
      base = 380;
      break;
    case "plan":
      base = 500;
      break;
    case "diff":
      base = 540;
      break;
    case "markdown":
    case "code":
    case "text":
    case "json":
      base = 500;
      break;
    case "html":
    case "url":
      base = 580;
      break;
    case "image":
      base = 460;
      break;
    case "video":
      base = 580;
      break;
    case "audio":
      base = 400;
      break;
    case "pdf":
    case "office":
      base = 580;
      break;
    case "binary":
      base = 400;
      break;
    default:
      base = 420;
  }

  // File tree / changes list is a right split (~220 default tree width).
  if (hint.treeVisible) {
    base = Math.max(base + 180, 560);
  }

  // A few tabs: give the strip a little more room so names stay visible.
  if (hint.tabCount >= 3) {
    base += 24;
  } else if (hint.tabCount >= 2) {
    base += 12;
  }

  return clampAsideWidth(base, clampOpts);
}

/**
 * Merge current width with a content suggestion.
 * - Always enforces chrome-safe min / viewport max
 * - Soft-grows to suggestion (does not auto-shrink a wider user width)
 */
export function mergeAsideWidth(
  current: number,
  suggested: number,
  opts?: AsideClampOpts,
): number {
  const min = asideChromeSafeMin(opts);
  const max = asideWidthMax(opts);
  const cur = Number.isFinite(current) ? Math.round(current) : min;
  const sug = Number.isFinite(suggested) ? Math.round(suggested) : min;
  const grown = Math.max(cur, sug, min);
  return Math.min(max, grown);
}

export function parseLayout(
  raw: unknown,
  opts?: AsideClampOpts,
): LayoutPrefs {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_LAYOUT };
  const o = raw as Record<string, unknown>;
  return {
    sidebarWidth:
      typeof o.sidebarWidth === "number"
        ? clampSidebarWidth(o.sidebarWidth, {
            viewportWidth: opts?.viewportWidth,
            asideOccupiedWidth: 0,
          })
        : DEFAULT_LAYOUT.sidebarWidth,
    asideWidth:
      typeof o.asideWidth === "number"
        ? clampAsideWidth(o.asideWidth, opts)
        : DEFAULT_LAYOUT.asideWidth,
    // Aside open/closed is chrome-default on launch (not restored). See loadLayout.
    asideCollapsed: DEFAULT_LAYOUT.asideCollapsed,
    sidebarCollapsed:
      typeof o.sidebarCollapsed === "boolean"
        ? o.sidebarCollapsed
        : DEFAULT_LAYOUT.sidebarCollapsed,
  };
}

export function loadLayout(
  storage: {
    getItem(k: string): string | null;
  },
  opts?: AsideClampOpts,
): LayoutPrefs {
  try {
    const raw = storage.getItem(LAYOUT_STORAGE_KEY);
    const base = raw
      ? parseLayout(JSON.parse(raw), opts)
      : { ...DEFAULT_LAYOUT };
    // Launch chat-first regardless of chrome; parseLayout already pins the
    // default rather than restoring the last open/closed state.
    return { ...base, asideCollapsed: DEFAULT_LAYOUT.asideCollapsed };
  } catch {
    return { ...DEFAULT_LAYOUT };
  }
}

export function saveLayout(
  storage: { setItem(k: string, v: string): void },
  layout: LayoutPrefs,
): void {
  storage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
}
