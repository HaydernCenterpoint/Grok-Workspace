/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  applyLiveSplitWidth,
  beginWorkbenchSplitResize,
  createRafLiveSplitWriter,
  isWorkbenchSplitResizing,
  notifyWorkbenchSplitResize,
  queryWorkbenchSplitPane,
  resetWorkbenchSplitResizeForTests,
  subscribeWorkbenchSplitResize,
} from "./paneDragLive";

afterEach(() => {
  resetWorkbenchSplitResizeForTests();
});

describe("applyLiveSplitWidth", () => {
  it("writes the flex size tuple and rounds", () => {
    const el = document.createElement("div");
    expect(applyLiveSplitWidth(el, 240.4)).toBe(240);
    expect(el.style.width).toBe("240px");
    expect(el.style.minWidth).toBe("240px");
    expect(el.style.maxWidth).toBe("240px");
    expect(el.style.flexBasis).toBe("240px");
  });

  it("is a no-op on a missing node", () => {
    expect(applyLiveSplitWidth(null, 180)).toBe(180);
  });
});

describe("queryWorkbenchSplitPane", () => {
  it("picks the workbench sidebar and aside, not a nested aside", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div class="workbench">
        <aside class="sidebar"></aside>
        <main></main>
        <aside class="aside"><aside class="nested"></aside></aside>
      </div>
    `;
    expect(queryWorkbenchSplitPane("sidebar", root)?.className).toBe("sidebar");
    expect(queryWorkbenchSplitPane("aside", root)?.className).toBe("aside");
  });
});

describe("createRafLiveSplitWriter", () => {
  it("coalesces to the last size and flush paints immediately", () => {
    const el = document.createElement("div");
    const writer = createRafLiveSplitWriter();
    writer.enqueue(el, 200);
    writer.enqueue(el, 260);
    expect(writer.flush()).toBe(260);
    expect(el.style.width).toBe("260px");
    writer.cancel();
  });
});

describe("workbench split resize pub/sub", () => {
  it("tracks depth and notifies subscribers", () => {
    const seen: number[] = [];
    const unsub = subscribeWorkbenchSplitResize(() => seen.push(seen.length));
    expect(isWorkbenchSplitResizing()).toBe(false);
    const end = beginWorkbenchSplitResize();
    expect(isWorkbenchSplitResizing()).toBe(true);
    notifyWorkbenchSplitResize();
    expect(seen.length).toBe(1);
    end();
    expect(isWorkbenchSplitResizing()).toBe(false);
    expect(seen.length).toBe(2); // release also notifies
    end(); // idempotent
    expect(seen.length).toBe(2);
    unsub();
  });
});
