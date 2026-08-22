import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORKBENCH_CHROME,
  WORKBENCH_CHROME_ATTR,
  WORKBENCH_CHROME_STORAGE_KEY,
  WORKBENCH_CHROMES,
  applyWorkbenchChrome,
  isWorkbenchChrome,
  loadWorkbenchChrome,
  parseWorkbenchChrome,
  saveWorkbenchChrome,
  setWorkbenchChrome,
  type WorkbenchChromeStorage,
} from "./workbenchChrome";

function memoryStorage(
  initial: Record<string, string> = {},
): WorkbenchChromeStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem(key) {
      return key in data ? data[key]! : null;
    },
    setItem(key, value) {
      data[key] = value;
    },
  };
}

describe("workbenchChrome", () => {
  it("defaults to codex and rejects unknown values", () => {
    expect(DEFAULT_WORKBENCH_CHROME).toBe("codex");
    expect(parseWorkbenchChrome(null)).toBe("codex");
    expect(parseWorkbenchChrome("")).toBe("codex");
    expect(parseWorkbenchChrome("glass")).toBe("codex");
    expect(isWorkbenchChrome("codex")).toBe(true);
    expect(isWorkbenchChrome("classic")).toBe(true);
    expect(isWorkbenchChrome("glass")).toBe(false);
    expect(WORKBENCH_CHROMES).toEqual(["codex", "classic"]);
  });

  it("persists and reloads", () => {
    const storage = memoryStorage();
    expect(loadWorkbenchChrome(storage)).toBe("codex");
    saveWorkbenchChrome("classic", storage);
    expect(storage.data[WORKBENCH_CHROME_STORAGE_KEY]).toBe("classic");
    expect(loadWorkbenchChrome(storage)).toBe("classic");
  });

  it("apply and set write data-chrome", () => {
    const attrs = new Map<string, string>();
    const el = {
      setAttribute(name: string, value: string) {
        attrs.set(name, value);
      },
    };
    applyWorkbenchChrome("classic", el);
    expect(attrs.get(WORKBENCH_CHROME_ATTR)).toBe("classic");
    const storage = memoryStorage();
    setWorkbenchChrome("codex", storage, el);
    expect(storage.data[WORKBENCH_CHROME_STORAGE_KEY]).toBe("codex");
    expect(attrs.get(WORKBENCH_CHROME_ATTR)).toBe("codex");
  });
});
