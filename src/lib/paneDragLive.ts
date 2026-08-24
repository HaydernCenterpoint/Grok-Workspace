/**
 * In-flow split drag writes the pane box on the element.
 * React layout state commits on pointer-up so AppWorkbench does not
 * reconcile every pointermove.
 */

export type WorkbenchSplitPane = "sidebar" | "aside";

export function queryWorkbenchSplitPane(
  which: WorkbenchSplitPane,
  root: ParentNode = document,
): HTMLElement | null {
  return root.querySelector(
    which === "sidebar" ? ".workbench > .sidebar" : ".workbench > .aside",
  );
}

/** Same tuple as `paneSplitSizeStyle(n, "x")`. */
export function applyLiveSplitWidth(
  el: HTMLElement | null,
  sizePx: number,
): number {
  const n = Math.max(0, Math.round(sizePx));
  if (!el) return n;
  const px = `${n}px`;
  el.style.width = px;
  el.style.minWidth = px;
  el.style.maxWidth = px;
  el.style.flexBasis = px;
  return n;
}

export type RafLiveSplitWriter = {
  enqueue(el: HTMLElement | null, sizePx: number): void;
  flush(): number;
  cancel(): void;
};

/**
 * One `applyLiveSplitWidth` per animation frame. Pointer-up should `flush`
 * so the last sample lands before React commits layout.
 */
export function createRafLiveSplitWriter(
  onApply?: (sizePx: number) => void,
): RafLiveSplitWriter {
  let rafId = 0;
  let el: HTMLElement | null = null;
  let size = 0;

  const paint = (): number => {
    const n = applyLiveSplitWidth(el, size);
    onApply?.(n);
    return n;
  };

  return {
    enqueue(nextEl, sizePx) {
      el = nextEl;
      size = sizePx;
      if (typeof requestAnimationFrame !== "function") {
        paint();
        return;
      }
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        paint();
      });
    },
    flush() {
      if (rafId && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      return paint();
    },
    cancel() {
      if (rafId && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    },
  };
}

let splitResizeDepth = 0;
const splitResizeListeners = new Set<() => void>();

export function isWorkbenchSplitResizing(): boolean {
  return splitResizeDepth > 0;
}

export function notifyWorkbenchSplitResize(): void {
  for (const fn of [...splitResizeListeners]) {
    try {
      fn();
    } catch {
      /* isolate listeners */
    }
  }
}

/**
 * Mark a live sidebar/aside drag so native webviews can keep applying bounds
 * even if a leftover pane-split motion token is still set.
 */
export function beginWorkbenchSplitResize(): () => void {
  splitResizeDepth += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    splitResizeDepth = Math.max(0, splitResizeDepth - 1);
    notifyWorkbenchSplitResize();
  };
}

export function subscribeWorkbenchSplitResize(fn: () => void): () => void {
  splitResizeListeners.add(fn);
  return () => {
    splitResizeListeners.delete(fn);
  };
}

/** After layout commit: sync now, then once more on the next two frames. */
export function scheduleWorkbenchSplitResizeFlush(): void {
  notifyWorkbenchSplitResize();
  if (typeof requestAnimationFrame !== "function") return;
  requestAnimationFrame(() => {
    notifyWorkbenchSplitResize();
    requestAnimationFrame(() => {
      notifyWorkbenchSplitResize();
    });
  });
}

export function resetWorkbenchSplitResizeForTests(): void {
  splitResizeDepth = 0;
  splitResizeListeners.clear();
}
