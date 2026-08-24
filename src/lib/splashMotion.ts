/**
 * Boot splash / Setup overlay motion park.
 *
 * Infinite logo sheen + breathe keeps WebView2's compositor warm even when
 * the gate is sitting idle (timeout Retry, Welcome with no input) or the
 * window is visible but unfocused. `document.hidden` alone is not enough —
 * an unfocused-but-visible window stays `visibilityState === "visible"`.
 * Prefer Tauri `WindowEvent::Focused` (`data-window-focused`) over
 * `document.hasFocus()` — WebView can stay "focused" while another app is key.
 */

import { resolveWindowFocused, subscribeWindowFocused } from "./windowFocusFlag";

export const SPLASH_PARK_DATASET = "splashPark";
export const SETUP_GATE_DATASET = "setupGate";

export type SplashMotionEnv = {
  visibilityState: string;
  hasFocus: boolean;
  reducedMotion: boolean;
};

export function shouldRunSplashMotion(opts: {
  /** Caller still wants the probe/install sheen. */
  requested?: boolean;
  visibilityState?: string;
  hasFocus?: boolean;
  reducedMotion?: boolean;
}): boolean {
  if (opts.requested === false) return false;
  if (opts.reducedMotion) return false;
  if ((opts.visibilityState ?? "visible") === "hidden") return false;
  if (opts.hasFocus === false) return false;
  return true;
}

export function splashMotionShouldPark(env: SplashMotionEnv): boolean {
  return !shouldRunSplashMotion(env);
}

export function readSplashMotionEnv(
  doc: Pick<Document, "visibilityState" | "hasFocus"> | null | undefined =
    typeof document !== "undefined" ? document : undefined,
  matchReduced?: () => boolean,
): SplashMotionEnv {
  const visibilityState = doc?.visibilityState ?? "visible";
  const fallbackFocus =
    doc && typeof doc.hasFocus === "function" ? doc.hasFocus() : true;
  const hasFocus =
    doc == null
      ? true
      : resolveWindowFocused(
          typeof document !== "undefined"
            ? document.documentElement.dataset
            : undefined,
          fallbackFocus,
        );
  let reducedMotion = false;
  if (matchReduced) {
    reducedMotion = matchReduced();
  } else if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    try {
      reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      reducedMotion = false;
    }
  }
  return { visibilityState, hasFocus, reducedMotion };
}

export function applySplashParkFlag(
  dataset: DOMStringMap,
  park: boolean,
): void {
  if (park) {
    dataset[SPLASH_PARK_DATASET] = "1";
    return;
  }
  delete dataset[SPLASH_PARK_DATASET];
}

export function applySetupGateFlag(
  dataset: DOMStringMap,
  active: boolean,
): void {
  if (active) {
    dataset[SETUP_GATE_DATASET] = "1";
    return;
  }
  delete dataset[SETUP_GATE_DATASET];
}

export function readSetupGateFlag(
  dataset: { setupGate?: string } | null | undefined,
): boolean {
  return dataset?.setupGate === "1";
}

export function subscribeSplashMotionEnv(
  onChange: (env: SplashMotionEnv) => void,
  target: Document | undefined =
    typeof document !== "undefined" ? document : undefined,
): () => void {
  if (!target) return () => {};
  const sync = () => onChange(readSplashMotionEnv(target));
  target.addEventListener("visibilitychange", sync);
  const win = target.defaultView;
  win?.addEventListener("focus", sync);
  win?.addEventListener("blur", sync);
  const unsubHostFocus = subscribeWindowFocused(() => sync());
  let mq: MediaQueryList | null = null;
  try {
    mq = win?.matchMedia("(prefers-reduced-motion: reduce)") ?? null;
    mq?.addEventListener("change", sync);
  } catch {
    mq = null;
  }
  sync();
  return () => {
    target.removeEventListener("visibilitychange", sync);
    win?.removeEventListener("focus", sync);
    win?.removeEventListener("blur", sync);
    unsubHostFocus();
    try {
      mq?.removeEventListener("change", sync);
    } catch {
      /* jsdom */
    }
  };
}

export function installSplashParkFlag(
  root: HTMLElement | null =
    typeof document !== "undefined" ? document.documentElement : null,
): () => void {
  if (!root) return () => {};
  return subscribeSplashMotionEnv((env) => {
    applySplashParkFlag(root.dataset, splashMotionShouldPark(env));
  });
}
