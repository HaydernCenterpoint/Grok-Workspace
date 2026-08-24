/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import {
  applyWindowHiddenFlag,
  installWindowHiddenFlag,
  WINDOW_HIDDEN_DATASET,
} from "./windowHiddenFlag";

describe("windowHiddenFlag", () => {
  it("writes and clears html dataset", () => {
    const dataset: DOMStringMap = {};
    applyWindowHiddenFlag(dataset, true);
    expect(dataset[WINDOW_HIDDEN_DATASET]).toBe("1");
    applyWindowHiddenFlag(dataset, false);
    expect(dataset[WINDOW_HIDDEN_DATASET]).toBeUndefined();
  });

  it("syncs on install and visibilitychange", () => {
    const root = document.createElement("html");
    let hidden = true;
    const stop = installWindowHiddenFlag(root, () => hidden);
    expect(root.dataset[WINDOW_HIDDEN_DATASET]).toBe("1");
    hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(root.dataset[WINDOW_HIDDEN_DATASET]).toBeUndefined();
    stop();
  });
});
