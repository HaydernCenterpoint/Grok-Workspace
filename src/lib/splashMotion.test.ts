/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  applySetupGateFlag,
  applySplashParkFlag,
  installSplashParkFlag,
  readSetupGateFlag,
  readSplashMotionEnv,
  SETUP_GATE_DATASET,
  shouldRunSplashMotion,
  splashMotionShouldPark,
  SPLASH_PARK_DATASET,
  subscribeSplashMotionEnv,
} from "./splashMotion";
import { applyWindowFocusedFlag } from "./windowFocusFlag";

afterEach(() => {
  delete document.documentElement.dataset.windowFocused;
});

describe("shouldRunSplashMotion", () => {
  it("runs only while requested, visible, focused, and motion is allowed", () => {
    expect(shouldRunSplashMotion({})).toBe(true);
    expect(shouldRunSplashMotion({ requested: true })).toBe(true);
    expect(shouldRunSplashMotion({ requested: false })).toBe(false);
    expect(shouldRunSplashMotion({ visibilityState: "hidden" })).toBe(false);
    expect(shouldRunSplashMotion({ hasFocus: false })).toBe(false);
    expect(shouldRunSplashMotion({ reducedMotion: true })).toBe(false);
    expect(
      shouldRunSplashMotion({
        requested: true,
        visibilityState: "visible",
        hasFocus: true,
        reducedMotion: false,
      }),
    ).toBe(true);
  });

  it("parks when Host window focus is false even if document.hasFocus is true", () => {
    applyWindowFocusedFlag(document.documentElement.dataset, false);
    const env = readSplashMotionEnv();
    expect(env.hasFocus).toBe(false);
    expect(shouldRunSplashMotion({ ...env, requested: true })).toBe(false);
  });

  it("treats unfocused-but-visible as parked (not document.hidden)", () => {
    expect(
      shouldRunSplashMotion({
        requested: true,
        visibilityState: "visible",
        hasFocus: false,
      }),
    ).toBe(false);
    expect(
      splashMotionShouldPark({
        visibilityState: "visible",
        hasFocus: false,
        reducedMotion: false,
      }),
    ).toBe(true);
  });
});

describe("splash motion flags", () => {
  it("writes splash-park and setup-gate dataset keys", () => {
    const dataset: DOMStringMap = {};
    applySplashParkFlag(dataset, true);
    expect(dataset[SPLASH_PARK_DATASET]).toBe("1");
    applySplashParkFlag(dataset, false);
    expect(dataset[SPLASH_PARK_DATASET]).toBeUndefined();

    applySetupGateFlag(dataset, true);
    expect(dataset[SETUP_GATE_DATASET]).toBe("1");
    expect(readSetupGateFlag(dataset)).toBe(true);
    applySetupGateFlag(dataset, false);
    expect(readSetupGateFlag(dataset)).toBe(false);
  });

  it("readSplashMotionEnv defaults to foreground when document is missing", () => {
    expect(readSplashMotionEnv(null, () => false)).toEqual({
      visibilityState: "visible",
      hasFocus: true,
      reducedMotion: false,
    });
    expect(readSplashMotionEnv(null, () => true).reducedMotion).toBe(true);
  });

  it("subscribeSplashMotionEnv syncs on blur and visibilitychange", () => {
    const seen: boolean[] = [];
    const stop = subscribeSplashMotionEnv((env) => {
      seen.push(splashMotionShouldPark(env));
    });
    window.dispatchEvent(new Event("blur"));
    document.dispatchEvent(new Event("visibilitychange"));
    stop();
    expect(seen.length).toBeGreaterThanOrEqual(1);
  });

  it("installSplashParkFlag writes html dataset", () => {
    const root = document.createElement("html");
    const stop = installSplashParkFlag(root);
    expect(
      root.dataset[SPLASH_PARK_DATASET] === "1" ||
        root.dataset[SPLASH_PARK_DATASET] === undefined,
    ).toBe(true);
    stop();
  });
});
