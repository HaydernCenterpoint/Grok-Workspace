/**
 * ChatGPT-style update banner: Later hides the bar for this session only.
 * Keyed by version + banner kind so dismissing "downloading" does not hide
 * "ready" when the download finishes. sessionStorage clears on next launch.
 */

import type { AppUpdateStatusState } from "./appUpdateHonesty";

export const UPDATE_BANNER_DISMISS_STORAGE_KEY = "grok.updateBanner.later";

export type UpdateBannerKind =
  | "ready"
  | "downloading"
  | "manual"
  | "available";

export type UpdateBannerDismissRecord = {
  version: string;
  kind: UpdateBannerKind;
};

/** Minimal storage surface so unit tests need no jsdom. */
export interface UpdateBannerDismissStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultSessionStorage(): UpdateBannerDismissStorage {
  if (typeof sessionStorage !== "undefined") return sessionStorage;
  return { getItem: () => null, setItem: () => {} };
}

const BANNER_KINDS = new Set<UpdateBannerKind>([
  "ready",
  "downloading",
  "manual",
  "available",
]);

function isUpdateBannerKind(raw: string): raw is UpdateBannerKind {
  return BANNER_KINDS.has(raw as UpdateBannerKind);
}

export function updateBannerDismissToken(
  version: string,
  kind: UpdateBannerKind,
): string {
  return `${version.trim()}::${kind}`;
}

export function parseUpdateBannerDismissToken(
  raw: string | null | undefined,
): UpdateBannerDismissRecord | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const idx = text.lastIndexOf("::");
  if (idx <= 0) return null;
  const version = text.slice(0, idx).trim();
  const kind = text.slice(idx + 2).trim();
  if (!version || !isUpdateBannerKind(kind)) return null;
  return { version, kind };
}

export function loadUpdateBannerDismiss(
  storage: UpdateBannerDismissStorage = defaultSessionStorage(),
): UpdateBannerDismissRecord | null {
  try {
    return parseUpdateBannerDismissToken(
      storage.getItem(UPDATE_BANNER_DISMISS_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

export function saveUpdateBannerDismiss(
  version: string,
  kind: UpdateBannerKind,
  storage: UpdateBannerDismissStorage = defaultSessionStorage(),
): void {
  try {
    storage.setItem(
      UPDATE_BANNER_DISMISS_STORAGE_KEY,
      updateBannerDismissToken(version, kind),
    );
  } catch {
    /* private mode / quota */
  }
}

/**
 * Which banner to show for a live updater state.
 * `available` is only a banner when auto-download is off (otherwise it flashes
 * into downloading). Installing / restarting stay off — confirm + progress
 * already cover that.
 */
export function updateBannerKindForStatus(
  state: AppUpdateStatusState | string,
  opts?: { autoDownloadEnabled?: boolean },
): UpdateBannerKind | null {
  switch (state) {
    case "ready":
      return "ready";
    case "downloading":
      return "downloading";
    case "manual-required":
      return "manual";
    case "available":
      return opts?.autoDownloadEnabled === false ? "available" : null;
    case "idle":
    case "checking":
    case "up-to-date":
    case "installing":
    case "restarting":
    case "error":
      return null;
    default:
      return null;
  }
}

/** Show/hide given status + stored Later dismiss (version + kind). */
export function shouldShowUpdateBanner(input: {
  state: string;
  version?: string | null;
  dismissedVersion?: string | null;
  dismissedKind?: UpdateBannerKind | null;
  autoDownloadEnabled?: boolean;
}): boolean {
  const kind = updateBannerKindForStatus(input.state, {
    autoDownloadEnabled: input.autoDownloadEnabled,
  });
  if (!kind) return false;
  const version = (input.version ?? "").trim();
  if (!version && kind !== "downloading") return false;
  const dismissedVersion = (input.dismissedVersion ?? "").trim();
  if (input.dismissedKind === kind && dismissedVersion === version) {
    return false;
  }
  return true;
}
