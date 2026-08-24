import { readSetupGateFlag } from "@/lib/splashMotion";
import {
  readStreamPerfFlag,
  releaseWallpaperVideoElement,
  shouldParkWallpaperVideo,
} from "@/lib/streamRenderPolicy";
import {
  resolveWindowFocused,
  setWindowFocusParkHook,
  subscribeWindowFocused,
} from "@/lib/windowFocusFlag";

export function readWallpaperVideoEnv(): {
  visibilityState: string;
  streamPerf: boolean;
  setupGate: boolean;
  hasFocus: boolean;
} {
  if (typeof document === "undefined") {
    return {
      visibilityState: "visible",
      streamPerf: false,
      setupGate: false,
      hasFocus: true,
    };
  }
  return {
    visibilityState: document.visibilityState,
    streamPerf: readStreamPerfFlag(document.documentElement.dataset),
    setupGate: readSetupGateFlag(document.documentElement.dataset),
    hasFocus: resolveWindowFocused(
      document.documentElement.dataset,
      typeof document.hasFocus === "function" ? document.hasFocus() : true,
    ),
  };
}

export function wallpaperVideoCompositorShouldPark(): boolean {
  return shouldParkWallpaperVideo(readWallpaperVideoEnv());
}

const WALLPAPER_VIDEO_SELECTOR = [
  ".app-wallpaper-media video",
  ".settings-wallpaper__media video",
  "video.app-wallpaper-media__el",
  "video.settings-wallpaper__media-el",
].join(", ");

function collectBlobSrc(el: HTMLVideoElement): string[] {
  const out: string[] = [];
  for (const u of [el.currentSrc, el.src]) {
    if (typeof u === "string" && u.startsWith("blob:")) out.push(u);
  }
  return out;
}

function revokeBlobUrl(url: string | null | undefined): void {
  if (!url) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    /* already revoked / non-blob */
  }
}

/** `src=""` + `load()` wallpaper clips before revoke/unmount. */
export function releaseWallpaperVideosInDocument(
  root: ParentNode | null = typeof document !== "undefined" ? document : null,
): string[] {
  if (!root) return [];
  const nodes = root.querySelectorAll(WALLPAPER_VIDEO_SELECTOR);
  const blobs: string[] = [];
  for (const el of nodes) {
    if (!(el instanceof HTMLVideoElement)) continue;
    blobs.push(...collectBlobSrc(el));
    releaseWallpaperVideoElement(el);
  }
  return blobs;
}

/** Rising-edge park: unload clips, then revoke. React setState must not run first. */
export function parkWallpaperPlayback(objectUrl?: string | null): void {
  const blobs = releaseWallpaperVideosInDocument();
  for (const u of blobs) revokeBlobUrl(u);
  revokeBlobUrl(objectUrl);
}

/**
 * While `data-wallpaper-parked`, a remounted wallpaper `<video>` is released
 * immediately (CDP needed this — React can restore `src={url}` after park).
 */
export function installWallpaperParkGuard(
  root: ParentNode | null = typeof document !== "undefined" ? document : null,
): () => void {
  if (!root || typeof MutationObserver === "undefined") return () => {};
  const scan = () => {
    if (typeof document === "undefined") return;
    if (document.documentElement.getAttribute("data-wallpaper-parked") !== "1") {
      return;
    }
    releaseWallpaperVideosInDocument(root);
  };
  const obs = new MutationObserver(scan);
  const target =
    root instanceof Document ? (root.body ?? root.documentElement) : root;
  obs.observe(target, { childList: true, subtree: true });
  return () => obs.disconnect();
}

/**
 * Host OS-unfocus runs this before ThemeProvider `setState`, so `load()` hits
 * a live `<video>` instead of a node React already unmounted.
 */
export function installWindowFocusParkHook(): () => void {
  setWindowFocusParkHook((focused) => {
    if (focused) return;
    releaseWallpaperVideosInDocument();
  });
  return () => setWindowFocusParkHook(null);
}

export function subscribeWallpaperPark(onPark: (parked: boolean) => void): () => void {
  if (typeof document === "undefined") return () => {};
  let lastParked: boolean | null = null;
  const sync = () => {
    const parked = wallpaperVideoCompositorShouldPark();
    if (parked && lastParked !== true) {
      releaseWallpaperVideosInDocument();
    }
    lastParked = parked;
    onPark(parked);
  };
  sync();
  document.addEventListener("visibilitychange", sync, true);
  window.addEventListener("focus", sync, true);
  window.addEventListener("blur", sync, true);
  const unsubHostFocus = subscribeWindowFocused(() => sync());
  const obs = new MutationObserver(sync);
  obs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-setup-gate", "data-window-focused"],
  });
  return () => {
    document.removeEventListener("visibilitychange", sync, true);
    window.removeEventListener("focus", sync, true);
    window.removeEventListener("blur", sync, true);
    unsubHostFocus();
    obs.disconnect();
  };
}
