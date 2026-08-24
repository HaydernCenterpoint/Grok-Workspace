import { afterEach, describe, expect, it, vi } from "vitest";
import { startVisibleInterval } from "./visibleInterval";

describe("startVisibleInterval", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("ticks while visible and skips while hidden", () => {
    vi.useFakeTimers();
    let visibility: DocumentVisibilityState = "visible";
    const tick = vi.fn();
    const visHandlers: Array<() => void> = [];
    const stop = startVisibleInterval(tick, 1000, {
      getVisibility: () => visibility,
      addListener: (_type, handler) => {
        visHandlers.push(handler);
      },
      removeListener: () => {},
    });

    vi.advanceTimersByTime(1000);
    expect(tick).toHaveBeenCalledTimes(1);

    visibility = "hidden";
    vi.advanceTimersByTime(3000);
    expect(tick).toHaveBeenCalledTimes(1);

    visibility = "visible";
    visHandlers[0]?.();
    expect(tick).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1000);
    expect(tick).toHaveBeenCalledTimes(3);
    stop();
  });

  it("clears the timer while hidden so the interval does not wake", () => {
    vi.useFakeTimers();
    let visibility: DocumentVisibilityState = "visible";
    const tick = vi.fn();
    const visHandlers: Array<() => void> = [];
    let liveIntervals = 0;
    const stop = startVisibleInterval(tick, 1000, {
      getVisibility: () => visibility,
      setIntervalFn: (handler, ms) => {
        liveIntervals += 1;
        return globalThis.setInterval(handler, ms);
      },
      clearIntervalFn: (id) => {
        liveIntervals -= 1;
        globalThis.clearInterval(id as ReturnType<typeof setInterval>);
      },
      addListener: (_type, handler) => {
        visHandlers.push(handler);
      },
      removeListener: () => {},
    });

    expect(liveIntervals).toBe(1);
    visibility = "hidden";
    visHandlers[0]?.();
    expect(liveIntervals).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(tick).not.toHaveBeenCalled();
    stop();
  });

  it("dispose stops ticks and visibility", () => {
    vi.useFakeTimers();
    const tick = vi.fn();
    let removed = false;
    const stop = startVisibleInterval(tick, 500, {
      getVisibility: () => "visible",
      addListener: () => {},
      removeListener: () => {
        removed = true;
      },
    });
    stop();
    vi.advanceTimersByTime(2000);
    expect(tick).not.toHaveBeenCalled();
    expect(removed).toBe(true);
  });
});
