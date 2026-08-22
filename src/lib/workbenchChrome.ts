/**
 * Workbench chrome (Appearance → Interface).
 * localStorage-only — no Rust AppSettings.
 * Applied via `data-chrome` on `document.documentElement`.
 *
 * - `codex` (default): solid utilitarian shell, docked composer
 * - `classic`: floating composer + glass
 */

export type WorkbenchChrome = "codex" | "classic";

export const WORKBENCH_CHROME_STORAGE_KEY = "grok.workbenchChrome";
export const DEFAULT_WORKBENCH_CHROME: WorkbenchChrome = "codex";
export const WORKBENCH_CHROME_ATTR = "data-chrome";
export const WORKBENCH_CHROME_CHANGE_EVENT = "grok-workbench-chrome";

export const WORKBENCH_CHROMES: readonly WorkbenchChrome[] = [
  "codex",
  "classic",
] as const;

export interface WorkbenchChromeStorage {
  getItem(key: string): string | null;
  setItem?(key: string, value: string): void;
}

export function isWorkbenchChrome(value: unknown): value is WorkbenchChrome {
  return value === "codex" || value === "classic";
}

export function parseWorkbenchChrome(raw: unknown): WorkbenchChrome {
  if (typeof raw === "string" && isWorkbenchChrome(raw)) return raw;
  return DEFAULT_WORKBENCH_CHROME;
}

export function loadWorkbenchChrome(
  storage: WorkbenchChromeStorage = typeof localStorage !== "undefined"
    ? localStorage
    : { getItem: () => null, setItem: () => {} },
): WorkbenchChrome {
  try {
    return parseWorkbenchChrome(storage.getItem(WORKBENCH_CHROME_STORAGE_KEY));
  } catch {
    return DEFAULT_WORKBENCH_CHROME;
  }
}

export function saveWorkbenchChrome(
  chrome: WorkbenchChrome,
  storage: WorkbenchChromeStorage = typeof localStorage !== "undefined"
    ? localStorage
    : { getItem: () => null, setItem: () => {} },
): void {
  try {
    storage.setItem?.(WORKBENCH_CHROME_STORAGE_KEY, chrome);
  } catch {
    /* private mode / quota */
  }
}

export interface WorkbenchChromeRoot {
  setAttribute(name: string, value: string): void;
}

export function applyWorkbenchChrome(
  chrome: WorkbenchChrome,
  root: WorkbenchChromeRoot = typeof document !== "undefined"
    ? document.documentElement
    : { setAttribute: () => {} },
): void {
  root.setAttribute(WORKBENCH_CHROME_ATTR, chrome);
}

export function dispatchWorkbenchChromeChange(chrome: WorkbenchChrome): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(WORKBENCH_CHROME_CHANGE_EVENT, { detail: chrome }),
  );
}

export function setWorkbenchChrome(
  chrome: WorkbenchChrome,
  storage?: WorkbenchChromeStorage,
  root?: WorkbenchChromeRoot,
): void {
  saveWorkbenchChrome(chrome, storage);
  applyWorkbenchChrome(chrome, root);
  dispatchWorkbenchChromeChange(chrome);
}
