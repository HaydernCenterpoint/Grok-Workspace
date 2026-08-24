/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  WINDOW_FOCUSED_DATASET,
  WINDOW_FOCUSED_EVENT,
  __testResetWindowFocusedHost,
  applyWindowFocusedFlag,
  installWindowFocusedFlag,
  notifyWindowFocusedFromHost,
  parseWindowFocusedPayload,
  readWindowFocusedFlag,
  resolveWindowFocused,
  subscribeWindowFocused,
  windowFocusedHostLocked,
} from "./windowFocusFlag";

afterEach(() => {
  __testResetWindowFocusedHost();
});

describe("windowFocusFlag", () => {
  it("parses a boolean host payload and ignores junk", () => {
    expect(parseWindowFocusedPayload(true)).toBe(true);
    expect(parseWindowFocusedPayload(false)).toBe(false);
    expect(parseWindowFocusedPayload({ focused: true })).toBe(true);
    expect(parseWindowFocusedPayload({ focused: false })).toBe(false);
    expect(parseWindowFocusedPayload({ focused: "yes" })).toBeNull();
    expect(parseWindowFocusedPayload(null)).toBeNull();
    expect(parseWindowFocusedPayload("true")).toBeNull();
  });

  it("writes data-window-focused 1/0 and resolves fallback only when unknown", () => {
    const dataset: DOMStringMap = {};
    applyWindowFocusedFlag(dataset, true);
    expect(dataset[WINDOW_FOCUSED_DATASET]).toBe("1");
    expect(readWindowFocusedFlag(dataset)).toBe(true);
    applyWindowFocusedFlag(dataset, false);
    expect(dataset[WINDOW_FOCUSED_DATASET]).toBe("0");
    expect(readWindowFocusedFlag(dataset)).toBe(false);

    expect(resolveWindowFocused({ windowFocused: "0" }, true)).toBe(false);
    expect(resolveWindowFocused({ windowFocused: "1" }, false)).toBe(true);
    expect(resolveWindowFocused({}, true)).toBe(true);
    expect(resolveWindowFocused(undefined, false)).toBe(false);
  });

  it("host unfocus parks even when document.hasFocus stays true", async () => {
    const root = document.createElement("html");
    let send: (payload: unknown) => void = () => {};
    const listen = async (event: string, handler: (payload: unknown) => void) => {
      expect(event).toBe(WINDOW_FOCUSED_EVENT);
      send = handler;
      return () => {
        send = () => {};
      };
    };
    const seen: boolean[] = [];
    const unsub = subscribeWindowFocused((focused) => {
      seen.push(focused);
    });
    const stop = installWindowFocusedFlag(root, {
      listen,
      getFallbackFocus: () => true,
      queryHostFocused: async () => null,
      subscribeHostFocus: async () => () => {},
    });
    await Promise.resolve();
    await Promise.resolve();

    send(false);
    expect(readWindowFocusedFlag(root.dataset)).toBe(false);
    expect(windowFocusedHostLocked()).toBe(true);
    expect(seen).toContain(false);

    window.dispatchEvent(new Event("focus"));
    expect(readWindowFocusedFlag(root.dataset)).toBe(false);

    send(true);
    expect(readWindowFocusedFlag(root.dataset)).toBe(true);
    unsub();
    stop();
  });

  it("uses DOM focus only before a host event arrives", async () => {
    const root = document.createElement("html");
    let fallback = true;
    const stop = installWindowFocusedFlag(root, {
      listen: async () => () => {},
      getFallbackFocus: () => fallback,
      queryHostFocused: async () => null,
      subscribeHostFocus: async () => () => {},
    });
    await Promise.resolve();
    await Promise.resolve();

    fallback = false;
    window.dispatchEvent(new Event("blur"));
    expect(readWindowFocusedFlag(root.dataset)).toBe(false);

    notifyWindowFocusedFromHost(false, root.dataset);
    fallback = true;
    window.dispatchEvent(new Event("focus"));
    expect(readWindowFocusedFlag(root.dataset)).toBe(false);
    stop();
  });
});
