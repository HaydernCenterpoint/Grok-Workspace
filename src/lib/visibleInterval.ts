/**
 * Interval that sleeps while the document is hidden.
 * Hidden ticks are skipped; becoming visible fires once immediately.
 */

export type VisibleIntervalFns = {
  getVisibility?: () => DocumentVisibilityState;
  setIntervalFn?: (handler: () => void, ms: number) => unknown;
  clearIntervalFn?: (id: unknown) => void;
  addListener?: (type: "visibilitychange", handler: () => void) => void;
  removeListener?: (type: "visibilitychange", handler: () => void) => void;
};

export function startVisibleInterval(
  tick: () => void,
  ms: number,
  fns: VisibleIntervalFns = {},
): () => void {
  const getVisibility =
    fns.getVisibility ??
    (() =>
      typeof document !== "undefined" ? document.visibilityState : "visible");
  const setIntervalFn =
    fns.setIntervalFn ??
    ((handler: () => void, interval: number) =>
      globalThis.setInterval(handler, interval));
  const clearIntervalFn =
    fns.clearIntervalFn ??
    ((id: unknown) => globalThis.clearInterval(id as ReturnType<typeof setInterval>));
  const addListener =
    fns.addListener ??
    ((type: "visibilitychange", handler: () => void) => {
      document.addEventListener(type, handler);
    });
  const removeListener =
    fns.removeListener ??
    ((type: "visibilitychange", handler: () => void) => {
      document.removeEventListener(type, handler);
    });

  const run = () => {
    if (getVisibility() === "hidden") return;
    tick();
  };

  let id: unknown = null;
  const arm = () => {
    if (id != null) return;
    id = setIntervalFn(run, ms);
  };
  const disarm = () => {
    if (id == null) return;
    clearIntervalFn(id);
    id = null;
  };

  const onVis = () => {
    if (getVisibility() === "visible") {
      arm();
      tick();
      return;
    }
    disarm();
  };

  if (getVisibility() !== "hidden") arm();
  addListener("visibilitychange", onVis);
  return () => {
    disarm();
    removeListener("visibilitychange", onVis);
  };
}
