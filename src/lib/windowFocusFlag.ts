/**
 * `html[data-window-focused]` — OS window key state from Tauri
 * `WindowEvent::Focused` (same signal as Host `MAIN_WINDOW_FOCUSED`).
 *
 * `document.hasFocus()` / `window` blur can stay true while another app is
 * in front — WebView2 reports the page as focused. Host emit +
 * `onFocusChanged` are authoritative once they arrive; DOM focus is only
 * the pre-host fallback.
 */

export const WINDOW_FOCUSED_EVENT = "app://window-focused";
export const WINDOW_FOCUSED_DATASET = "windowFocused";

export type WindowFocusedListen = (
  event: string,
  handler: (payload: unknown) => void,
) => Promise<() => void>;

type Listener = (focused: boolean) => void;

const listeners = new Set<Listener>();
let hostLocked = false;
let parkHook: Listener | null = null;

/** Runs inside `publishWindowFocused` before React subscribers. */
export function setWindowFocusParkHook(hook: Listener | null): void {
  parkHook = hook;
}

export function parseWindowFocusedPayload(payload: unknown): boolean | null {
  if (payload === true || payload === false) return payload;
  if (payload && typeof payload === "object" && "focused" in payload) {
    const focused = (payload as { focused: unknown }).focused;
    if (focused === true || focused === false) return focused;
  }
  return null;
}

export function applyWindowFocusedFlag(
  dataset: DOMStringMap,
  focused: boolean,
): void {
  dataset[WINDOW_FOCUSED_DATASET] = focused ? "1" : "0";
}

export function readWindowFocusedFlag(
  dataset: { windowFocused?: string } | null | undefined,
): boolean | null {
  if (dataset?.windowFocused === "0") return false;
  if (dataset?.windowFocused === "1") return true;
  return null;
}

/** Prefer the Host/OS flag; fall back to `document.hasFocus()` when unknown. */
export function resolveWindowFocused(
  dataset: { windowFocused?: string } | null | undefined,
  fallback: boolean,
): boolean {
  const flag = readWindowFocusedFlag(dataset);
  return flag ?? fallback;
}

export function subscribeWindowFocused(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishWindowFocused(
  focused: boolean,
  dataset?: DOMStringMap,
): void {
  if (dataset) applyWindowFocusedFlag(dataset, focused);
  parkHook?.(focused);
  for (const listener of listeners) listener(focused);
}

export function notifyWindowFocusedFromHost(
  focused: boolean,
  dataset?: DOMStringMap,
): void {
  hostLocked = true;
  publishWindowFocused(focused, dataset);
}

export function windowFocusedHostLocked(): boolean {
  return hostLocked;
}

export function __testResetWindowFocusedHost(): void {
  hostLocked = false;
  parkHook = null;
}

export function installWindowFocusedFlag(
  root: HTMLElement | null = typeof document !== "undefined"
    ? document.documentElement
    : null,
  opts?: {
    listen?: WindowFocusedListen;
    getFallbackFocus?: () => boolean;
    queryHostFocused?: () => Promise<boolean | null>;
    subscribeHostFocus?: (
      handler: (focused: boolean) => void,
    ) => Promise<() => void>;
  },
): () => void {
  if (!root) return () => {};

  const getFallbackFocus =
    opts?.getFallbackFocus ??
    (() =>
      typeof document !== "undefined" &&
      typeof document.hasFocus === "function"
        ? document.hasFocus()
        : true);

  const apply = (focused: boolean) => {
    publishWindowFocused(focused, root.dataset);
  };

  apply(true);

  const onDom = () => {
    if (hostLocked) return;
    apply(getFallbackFocus());
  };
  if (typeof window !== "undefined") {
    window.addEventListener("focus", onDom);
    window.addEventListener("blur", onDom);
  }

  let cancelled = false;
  let unlistenHost = () => {};
  let unlistenChanged = () => {};

  void (async () => {
    const listen =
      opts?.listen ??
      (async (event, handler) => {
        const { listen: hostListen } = await import("@/lib/api/host");
        return hostListen<unknown>(event, handler);
      });
    const queryHostFocused =
      opts?.queryHostFocused ??
      (async () => {
        try {
          const { getCurrentWindow } = await import("@tauri-apps/api/window");
          return await getCurrentWindow().isFocused();
        } catch {
          return null;
        }
      });
    const subscribeHostFocus =
      opts?.subscribeHostFocus ??
      (async (handler) => {
        try {
          const { getCurrentWindow } = await import("@tauri-apps/api/window");
          return await getCurrentWindow().onFocusChanged(({ payload }) => {
            handler(!!payload);
          });
        } catch {
          return () => {};
        }
      });

    try {
      const initial = await queryHostFocused();
      if (cancelled) return;
      if (initial === true || initial === false) {
        notifyWindowFocusedFromHost(initial, root.dataset);
      }
    } catch {
      /* browser / tests */
    }

    try {
      unlistenHost = await listen(WINDOW_FOCUSED_EVENT, (payload) => {
        const parsed = parseWindowFocusedPayload(payload);
        if (parsed === null) return;
        notifyWindowFocusedFromHost(parsed, root.dataset);
      });
    } catch {
      unlistenHost = () => {};
    }

    try {
      unlistenChanged = await subscribeHostFocus((focused) => {
        notifyWindowFocusedFromHost(focused, root.dataset);
      });
    } catch {
      unlistenChanged = () => {};
    }

    if (cancelled) {
      unlistenHost();
      unlistenChanged();
    }
  })();

  return () => {
    cancelled = true;
    unlistenHost();
    unlistenChanged();
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", onDom);
      window.removeEventListener("blur", onDom);
    }
    delete root.dataset[WINDOW_FOCUSED_DATASET];
  };
}
