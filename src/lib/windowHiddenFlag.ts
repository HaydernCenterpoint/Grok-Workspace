/**
 * `html[data-window-hidden]` — CSS drops wallpaper pane blur while the
 * document is hidden (same GPU skip as `data-stream-perf` during a live turn).
 */

export const WINDOW_HIDDEN_DATASET = "windowHidden";

export function applyWindowHiddenFlag(
  dataset: DOMStringMap,
  hidden: boolean,
): void {
  if (hidden) {
    dataset[WINDOW_HIDDEN_DATASET] = "1";
    return;
  }
  delete dataset[WINDOW_HIDDEN_DATASET];
}

export function installWindowHiddenFlag(
  root: HTMLElement | null = typeof document !== "undefined"
    ? document.documentElement
    : null,
  getHidden: () => boolean = () =>
    typeof document !== "undefined" && document.visibilityState === "hidden",
): () => void {
  if (!root) return () => {};
  const sync = () => applyWindowHiddenFlag(root.dataset, getHidden());
  sync();
  if (typeof document === "undefined") return () => {};
  document.addEventListener("visibilitychange", sync);
  return () => {
    document.removeEventListener("visibilitychange", sync);
    delete root.dataset[WINDOW_HIDDEN_DATASET];
  };
}
