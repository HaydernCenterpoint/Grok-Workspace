import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTO_DOWNLOAD_UPDATES_CHANGE_EVENT,
  AUTO_DOWNLOAD_UPDATES_STORAGE_KEY,
  DEFAULT_AUTO_DOWNLOAD_UPDATES,
  loadAutoDownloadUpdatesPref,
  parseAutoDownloadUpdatesPref,
  saveAutoDownloadUpdatesPref,
} from "./autoDownloadUpdatesPref";

describe("autoDownloadUpdatesPref", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
  };

  it("defaults to on (current signed auto-download)", () => {
    expect(DEFAULT_AUTO_DOWNLOAD_UPDATES).toBe(true);
    expect(loadAutoDownloadUpdatesPref(storage)).toBe(true);
    expect(parseAutoDownloadUpdatesPref(null)).toBe(true);
    expect(parseAutoDownloadUpdatesPref("nope")).toBe(true);
    expect(parseAutoDownloadUpdatesPref("")).toBe(true);
  });

  it("parses true/false tokens", () => {
    expect(parseAutoDownloadUpdatesPref("1")).toBe(true);
    expect(parseAutoDownloadUpdatesPref("true")).toBe(true);
    expect(parseAutoDownloadUpdatesPref(true)).toBe(true);
    expect(parseAutoDownloadUpdatesPref("0")).toBe(false);
    expect(parseAutoDownloadUpdatesPref("false")).toBe(false);
    expect(parseAutoDownloadUpdatesPref(false)).toBe(false);
  });

  it("persists and reloads", () => {
    saveAutoDownloadUpdatesPref(false, storage);
    expect(store.get(AUTO_DOWNLOAD_UPDATES_STORAGE_KEY)).toBe("0");
    expect(loadAutoDownloadUpdatesPref(storage)).toBe(false);
    saveAutoDownloadUpdatesPref(true, storage);
    expect(store.get(AUTO_DOWNLOAD_UPDATES_STORAGE_KEY)).toBe("1");
    expect(loadAutoDownloadUpdatesPref(storage)).toBe(true);
  });

  it("dispatches change event when window is available", () => {
    const dispatch = vi.fn();
    vi.stubGlobal("window", { dispatchEvent: dispatch });
    saveAutoDownloadUpdatesPref(false, storage);
    expect(dispatch).toHaveBeenCalledTimes(1);
    const ev = dispatch.mock.calls[0][0] as CustomEvent;
    expect(ev.type).toBe(AUTO_DOWNLOAD_UPDATES_CHANGE_EVENT);
    expect(ev.detail).toBe(false);
    vi.unstubAllGlobals();
  });
});
