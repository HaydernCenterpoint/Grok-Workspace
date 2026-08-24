/**
 * Settings → About: auto-download signed updates in the background.
 *
 * Local preference only (no Rust AppSettings field). Default is on — same as
 * the existing signed silent-download path. Off still allows background
 * discovery to surface `available` / `manual-required`; it must not call
 * `downloadUpdate` until the user starts it from the banner, About, or sidebar.
 */

export const AUTO_DOWNLOAD_UPDATES_STORAGE_KEY = "grok.autoDownloadUpdates";

/** Fired on `window` after a successful save (detail = boolean enabled). */
export const AUTO_DOWNLOAD_UPDATES_CHANGE_EVENT =
  "grok-auto-download-updates-change";

/** On by default — matches current signed auto-download behavior. */
export const DEFAULT_AUTO_DOWNLOAD_UPDATES = true;

/** Minimal storage surface so unit tests need no jsdom. */
export interface AutoDownloadUpdatesStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

function defaultStorage(): AutoDownloadUpdatesStorage {
  if (typeof localStorage !== "undefined") return localStorage;
  return { getItem: () => null, setItem: () => {} };
}

/** Parse stored value; invalid / empty → default on. */
export function parseAutoDownloadUpdatesPref(raw: unknown): boolean {
  if (raw === "0" || raw === "false" || raw === false) return false;
  if (raw === "1" || raw === "true" || raw === true) return true;
  return DEFAULT_AUTO_DOWNLOAD_UPDATES;
}

export function loadAutoDownloadUpdatesPref(
  storage: AutoDownloadUpdatesStorage = defaultStorage(),
): boolean {
  try {
    return parseAutoDownloadUpdatesPref(
      storage.getItem(AUTO_DOWNLOAD_UPDATES_STORAGE_KEY),
    );
  } catch {
    return DEFAULT_AUTO_DOWNLOAD_UPDATES;
  }
}

export function saveAutoDownloadUpdatesPref(
  enabled: boolean,
  storage: AutoDownloadUpdatesStorage = defaultStorage(),
): void {
  try {
    storage.setItem(
      AUTO_DOWNLOAD_UPDATES_STORAGE_KEY,
      enabled ? "1" : "0",
    );
  } catch {
    /* private mode / quota */
  }
  if (
    typeof window !== "undefined" &&
    typeof window.dispatchEvent === "function"
  ) {
    try {
      window.dispatchEvent(
        new CustomEvent(AUTO_DOWNLOAD_UPDATES_CHANGE_EVENT, {
          detail: enabled,
        }),
      );
    } catch {
      /* ignore */
    }
  }
}
