import { describe, expect, it } from "vitest";
import {
  SESSION_LIST_RECENTS,
  applySessionSidebarOrder,
  folderListKey,
  folderlessListKey,
  isReorderableSessionListKey,
  parseFolderListKey,
  parseFolderlessListKey,
  parseSessionSidebarOrder,
  reorderSessionInPinGroup,
  resolveSessionDropIndex,
} from "./sessionSidebarOrder";

type S = { id: string; pinned?: boolean };

const s = (id: string, pinned = false): S => ({ id, pinned });

describe("sessionSidebarOrder keys", () => {
  it("names folderless / folder lists and rejects Recents for reorder", () => {
    expect(folderlessListKey("office")).toBe("folderless:office");
    expect(folderListKey("studio", "p1")).toBe("folder:studio:p1");
    expect(parseFolderlessListKey("folderless:code")).toBe("code");
    expect(parseFolderListKey("folder:office:abc")).toEqual({
      surface: "office",
      projectId: "abc",
    });
    expect(isReorderableSessionListKey(folderlessListKey("code"))).toBe(true);
    expect(isReorderableSessionListKey(folderListKey("code", "p"))).toBe(true);
    expect(isReorderableSessionListKey(SESSION_LIST_RECENTS)).toBe(false);
  });
});

describe("applySessionSidebarOrder", () => {
  it("applies saved ids, ignores unknown, appends missing, pin-partitions", () => {
    const list = [s("a"), s("b"), s("c", true), s("d")];
    const next = applySessionSidebarOrder(list, ["d", "gone", "c", "a"]);
    expect(next.map((x) => x.id)).toEqual(["c", "d", "a", "b"]);
  });

  it("returns pin-partitioned default when no saved ids", () => {
    const list = [s("u1"), s("p1", true), s("u2")];
    expect(applySessionSidebarOrder(list, []).map((x) => x.id)).toEqual([
      "p1",
      "u1",
      "u2",
    ]);
    expect(applySessionSidebarOrder(list, null).map((x) => x.id)).toEqual([
      "p1",
      "u1",
      "u2",
    ]);
  });
});

describe("reorderSessionInPinGroup", () => {
  it("reorders only inside the same pin group", () => {
    const list = [s("p1", true), s("p2", true), s("u1"), s("u2")];
    expect(
      reorderSessionInPinGroup(list, 3, 2).map((x) => x.id),
    ).toEqual(["p1", "p2", "u2", "u1"]);
    // Cross-group dest clamps to the unpinned start (u1 stays put).
    expect(reorderSessionInPinGroup(list, 2, 0).map((x) => x.id)).toEqual([
      "p1",
      "p2",
      "u1",
      "u2",
    ]);
  });
});

describe("parseSessionSidebarOrder", () => {
  it("drops junk keys and duplicate ids", () => {
    expect(parseSessionSidebarOrder(null)).toEqual({});
    expect(parseSessionSidebarOrder("nope")).toEqual({});
    expect(
      parseSessionSidebarOrder({
        "folderless:code": ["a", "a", "", "b"],
        bad: "x",
      }),
    ).toEqual({ "folderless:code": ["a", "b"] });
  });
});

describe("resolveSessionDropIndex", () => {
  it("clamps to the dragged pin group", () => {
    const list = [s("p1", true), s("u1"), s("u2")];
    expect(resolveSessionDropIndex(list, 2, 0, false)).toBe(1);
  });
});
