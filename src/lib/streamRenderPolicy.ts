/**
 * Streaming render / coalesce policy for chat UI.
 *
 * Long assistant turns re-parse markdown and re-render the App shell on every
 * chunk. On integrated-GPU Retina laptops (e.g. 2019 16" Intel MBP), that
 * thrash freezes the UI after a few tool-heavy turns. These knobs batch and
 * cheapen the hot path without changing final (non-streaming) fidelity.
 */

/** Default stream→React flush interval (ms). Higher = fewer App setStates. */
export const STREAM_COALESCE_FLUSH_MS = 110;

/**
 * Virtualize the transcript once this many rows exist (tool steps count).
 * Lower than historical 48 so "a few agent turns" already window the DOM.
 */
export const CHAT_VIRTUALIZE_THRESHOLD_PERF = 16;

/**
 * While streaming, re-run ReactMarkdown at most this often (ms).
 * Smooth/plain text can still update more often; only the parse is throttled.
 * ~9×/s keeps long answers fluid without an O(n) parse per token.
 */
export const STREAM_MARKDOWN_PARSE_MS = 110;

/**
 * Non-structural content notify throttle for the transcript store (ms).
 * Full text is always stored immediately; React only re-renders on this cadence.
 */
export const TRANSCRIPT_CONTENT_NOTIFY_MS = 84;

/**
 * Adaptive content-notify interval: longer on thermally limited laptops so
 * ConversationThread / live panels don't thrash every stream coalesce tick.
 */
export function resolveTranscriptContentNotifyMs(
  hardwareConcurrency: number = typeof navigator !== "undefined"
    ? navigator.hardwareConcurrency || 8
    : 8,
): number {
  if (hardwareConcurrency <= 8) return 110;
  if (hardwareConcurrency <= 12) return TRANSCRIPT_CONTENT_NOTIFY_MS;
  return 64;
}

/**
 * Historical threshold for the old plain-pre stream body. Kept as a length
 * breakpoint for adaptive markdown parse throttling only — we no longer drop
 * to bare markdown mid-turn (that caused visible `**` / fence flashes).
 */
export const STREAM_PLAIN_TEXT_CHAR_THRESHOLD = 2000;

/** Whether hardware looks like a thermally-limited laptop (Intel dual-GPU class). */
export function isLowPowerClient(
  hardwareConcurrency: number = typeof navigator !== "undefined"
    ? navigator.hardwareConcurrency || 8
    : 8,
): boolean {
  return hardwareConcurrency <= 12;
}

/**
 * Always keep live markdown while streaming. Plain-pre fallback was retired
 * because it showed bare markdown syntax until the turn settled.
 * Kept for call-site compatibility; always returns false.
 */
export function shouldUsePlainStreamBody(
  _contentLength: number,
  _streaming: boolean,
  _threshold: number = STREAM_PLAIN_TEXT_CHAR_THRESHOLD,
): boolean {
  return false;
}

/**
 * Adaptive ReactMarkdown re-parse interval while streaming.
 * Longer bodies re-parse less often so the hot path stays cheap without
 * switching to plain text.
 */
export function resolveStreamMarkdownParseMs(
  contentLength: number,
  streaming: boolean,
): number {
  if (!streaming) return 0;
  if (contentLength >= 12_000) return 280;
  if (contentLength >= STREAM_PLAIN_TEXT_CHAR_THRESHOLD) return 220;
  return STREAM_MARKDOWN_PARSE_MS;
}

/**
 * Adaptive coalesce interval: slightly longer on low core counts (typical
 * Intel dual-socket laptop cores / thermal throttle), shorter on big machines.
 */
export function resolveStreamFlushMs(
  hardwareConcurrency: number = typeof navigator !== "undefined"
    ? navigator.hardwareConcurrency || 8
    : 8,
): number {
  if (hardwareConcurrency <= 8) return 128;
  if (hardwareConcurrency <= 12) return STREAM_COALESCE_FLUSH_MS;
  return 72;
}

/** Scale chat virtual overscan down while streaming on low-power clients. */
export function resolveStreamOverscanScale(
  streaming: boolean,
  hardwareConcurrency?: number,
): number {
  if (!streaming) return 1;
  return isLowPowerClient(hardwareConcurrency) ? 0.55 : 0.75;
}

/**
 * Streaming markdown parse is throttled. On settle, paint the live source in
 * the same render — a useEffect flush leaves one frame of stale tree at the
 * tail (the end-of-answer flash).
 */
export function resolveMarkdownPaintSource(
  streaming: boolean,
  liveSource: string,
  throttledSource: string,
): string {
  return streaming ? throttledSource : liveSource;
}

/** `html[data-stream-perf]` as written by AppWorkbench during a live turn. */
export function readStreamPerfFlag(
  dataset: { streamPerf?: string } | null | undefined,
): boolean {
  return dataset?.streamPerf === "1";
}

export type WallpaperVideoPlayOpts = {
  visibilityState?: string;
  streamPerf?: boolean;
  setupGate?: boolean;
  hasFocus?: boolean;
};

/**
 * Park = OS-unfocused, `document.hidden`, or first-run setup gate.
 * Park must **unload** the `<video>` (unmount / clear src). `pause()` alone
 * still leaves WebView decoding/compositing at play-level CPU/GPU.
 * Live-turn `data-stream-perf` is pause-only — not a park.
 */
export function shouldParkWallpaperVideo(
  opts: Pick<WallpaperVideoPlayOpts, "visibilityState" | "setupGate" | "hasFocus">,
): boolean {
  if ((opts.visibilityState ?? "visible") === "hidden") return true;
  if (opts.hasFocus === false) return true;
  if (opts.setupGate) return true;
  return false;
}

/**
 * Wallpaper `<video>` should play only when the window is visible,
 * OS-focused (Tauri `WindowEvent::Focused` / `data-window-focused`, not only
 * `document.hasFocus()`), the first-run / timeout gate is down, and
 * stream-perf is off. CSS drops sidebar blur separately.
 */
export function shouldPlayWallpaperVideo(opts: WallpaperVideoPlayOpts): boolean {
  if (shouldParkWallpaperVideo(opts)) return false;
  return !opts.streamPerf;
}

/**
 * Parked wallpaper must not stay on the GPU compositor.
 * Unmount or `src=""` both count as not compositing.
 */
export function wallpaperVideoIsCompositing(state: {
  parked: boolean;
  mounted: boolean;
  src?: string | null;
}): boolean {
  if (state.parked || !state.mounted) return false;
  const src = typeof state.src === "string" ? state.src.trim() : "";
  return src.length > 0;
}

export type WallpaperVideoReleaseTarget = {
  pause?: () => void;
  removeAttribute?: (name: string) => void;
  src?: string;
  srcObject?: unknown;
  load?: () => void;
};

/**
 * WebView2 keeps the decoder/compositor at play-level cost if `<video>` is
 * unmounted while `src` is still set. Pause, drop src, then `load()` while
 * the node is still in the document — then let React unmount. Do not
 * `el.remove()` here: React still owns the fiber and will throw.
 */
export function releaseWallpaperVideoElement(
  el: WallpaperVideoReleaseTarget | null | undefined,
): void {
  if (!el) return;
  try {
    el.pause?.();
  } catch {
    /* jsdom / already detached */
  }
  try {
    if ("srcObject" in el) el.srcObject = null;
  } catch {
    /* ignore */
  }
  try {
    el.removeAttribute?.("src");
    el.src = "";
    el.load?.();
  } catch {
    /* ignore */
  }
}
