import { describe, expect, it } from "vitest";
import {
  SESSION_RECENTS_STORAGE_KEY,
  addSessionRecents,
  hasSessionRecent,
  loadSessionRecents,
  parseSessionRecents,
  removeSessionRecents,
  saveSessionRecents,
  type SessionRecentsStorage,
} from "./sessionRecents";

function memoryStorage(
  initial: Record<string, string> = {},
): SessionRecentsStorage & { data: Record<string, string> } {
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

describe("sessionRecents", () => {
  it("parses an id list and drops junk", () => {
    expect(parseSessionRecents(null)).toEqual([]);
    expect(parseSessionRecents("not-json")).toEqual([]);
    expect(parseSessionRecents({ a: true })).toEqual([]);
    expect(parseSessionRecents(["s1", "", "s1", " s2 ", 3])).toEqual([
      "s1",
      "s2",
    ]);
  });

  it("round-trips storage", () => {
    const storage = memoryStorage();
    expect(loadSessionRecents(storage)).toEqual(new Set());
    saveSessionRecents(["a", "b"], storage);
    expect(storage.data[SESSION_RECENTS_STORAGE_KEY]).toBe(
      JSON.stringify(["a", "b"]),
    );
    expect(loadSessionRecents(storage)).toEqual(new Set(["a", "b"]));
  });

  it("adds and removes without cloning when unchanged", () => {
    const set = new Set(["a"]);
    const added = addSessionRecents(set, ["a"]);
    expect([...added]).toEqual(["a"]);
    expect(hasSessionRecent(set, "a")).toBe(true);
    expect(hasSessionRecent(set, "b")).toBe(false);
    expect([...addSessionRecents(set, ["b"])]).toEqual(["a", "b"]);
    expect([...removeSessionRecents(set, ["a"])]).toEqual([]);
    expect([...removeSessionRecents(set, ["gone"])]).toEqual(["a"]);
  });
});
