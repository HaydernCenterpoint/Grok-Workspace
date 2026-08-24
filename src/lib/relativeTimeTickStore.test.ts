/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __testAdvanceRelativeTimeTick,
  __testResetRelativeTimeTickStore,
  getRelativeTimeTick,
  subscribeRelativeTimeTick,
  subscribeRelativeTimeTickNoop,
} from "./relativeTimeTickStore";

describe("relativeTimeTickStore", () => {
  afterEach(() => {
    __testResetRelativeTimeTickStore();
    vi.useRealTimers();
  });

  it("starts at 0 and advances on test helper", () => {
    expect(getRelativeTimeTick()).toBe(0);
    expect(__testAdvanceRelativeTimeTick()).toBe(1);
    expect(getRelativeTimeTick()).toBe(1);
  });

  it("notifies subscribers when tick advances", () => {
    const spy = vi.fn();
    const unsub = subscribeRelativeTimeTick(spy);
    __testAdvanceRelativeTimeTick();
    expect(spy).toHaveBeenCalledTimes(1);
    unsub();
    __testAdvanceRelativeTimeTick();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("noop subscribe never fires", () => {
    const spy = vi.fn();
    const unsub = subscribeRelativeTimeTickNoop(spy);
    __testAdvanceRelativeTimeTick();
    expect(spy).not.toHaveBeenCalled();
    unsub();
  });

  it("interval ticks every 60s while subscribed", () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const unsub = subscribeRelativeTimeTick(spy);
    expect(getRelativeTimeTick()).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(getRelativeTimeTick()).toBe(1);
    expect(spy).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(getRelativeTimeTick()).toBe(2);
    unsub();
  });

  it("parks the 60s timer while the document is hidden", () => {
    vi.useFakeTimers();
    const prev = Object.getOwnPropertyDescriptor(document, "visibilityState");
    const spy = vi.fn();
    const unsub = subscribeRelativeTimeTick(spy);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(180_000);
    expect(getRelativeTimeTick()).toBe(0);
    expect(spy).not.toHaveBeenCalled();
    unsub();
    if (prev) Object.defineProperty(document, "visibilityState", prev);
  });
});
