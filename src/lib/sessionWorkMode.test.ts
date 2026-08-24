import { describe, expect, it } from "vitest";
import {
  SESSION_WORK_MODE_STORAGE_KEY,
  loadSessionWorkModes,
  parseSessionWorkModes,
  projectVisibleOnSurface,
  saveSessionWorkModes,
  consumePendingWorkMode,
  explicitSessionWorkMode,
  sessionMatchesSurface,
  sessionWorkModeOf,
  stampSessionHome,
  upsertSessionWorkMode,
  retagSessionsWorkMode,
  type SessionWorkModeStorage,
} from "./sessionWorkMode";

function memoryStorage(
  initial: Record<string, string> = {},
): SessionWorkModeStorage & { data: Record<string, string> } {
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

describe("sessionWorkMode", () => {
  it("parses a map and drops junk", () => {
    expect(parseSessionWorkModes(null)).toEqual({});
    expect(parseSessionWorkModes("not-json")).toEqual({});
    expect(parseSessionWorkModes({ a: "office", b: "nope", "": "studio" })).toEqual(
      { a: "office" },
    );
    expect(parseSessionWorkModes('{"s1":"studio","s2":"code"}')).toEqual({
      s1: "studio",
      s2: "code",
    });
  });

  it("defaults missing sessions to Build", () => {
    expect(sessionWorkModeOf(null, {})).toBe("code");
    expect(sessionWorkModeOf("s1", {})).toBe("code");
    expect(sessionWorkModeOf("s1", { s1: "office" })).toBe("office");
  });

  it("round-trips storage", () => {
    const storage = memoryStorage();
    expect(loadSessionWorkModes(storage)).toEqual({});
    saveSessionWorkModes({ a: "office" }, storage);
    expect(storage.data[SESSION_WORK_MODE_STORAGE_KEY]).toBe(
      JSON.stringify({ a: "office" }),
    );
    expect(loadSessionWorkModes(storage)).toEqual({ a: "office" });
  });

  it("treats drafts as matching unless a leftover pending stamp is for another surface", () => {
    expect(sessionMatchesSurface(null, {}, "office")).toBe(true);
    expect(sessionMatchesSurface(null, {}, "studio", "studio")).toBe(true);
    expect(sessionMatchesSurface(null, {}, "studio", "code")).toBe(false);
    expect(sessionMatchesSurface("s1", {}, "office")).toBe(false);
    expect(sessionMatchesSurface("s1", { s1: "office" }, "office")).toBe(true);
    expect(sessionMatchesSurface("s1", {}, "office", "office")).toBe(true);
    expect(sessionMatchesSurface("s1", {}, "office", "studio")).toBe(false);
  });

  it("does not let a pending stamp override a tagged session", () => {
    expect(
      sessionMatchesSurface("build", { build: "code" }, "studio", "studio"),
    ).toBe(false);
    expect(
      sessionMatchesSurface("studio", { studio: "studio" }, "code", "code"),
    ).toBe(false);
    expect(
      sessionMatchesSurface("studio", { studio: "studio" }, "studio", "code"),
    ).toBe(true);
  });

  it("locks the first stamp; pending and stampSessionHome cannot migrate it", () => {
    const office = stampSessionHome({}, "s1", "office");
    expect(office).toEqual({ s1: "office" });
    expect(stampSessionHome(office, "s1", "code")).toBe(office);
    expect(explicitSessionWorkMode("s1", office)).toBe("office");
    expect(explicitSessionWorkMode("s2", office)).toBeNull();
    expect(consumePendingWorkMode(office, "s1", "code")).toEqual({
      map: office,
      applied: null,
    });
    expect(consumePendingWorkMode(office, "s1", "office")).toEqual({
      map: office,
      applied: "office",
    });
  });

  it("create on Office stays Office after switching the pending surface to Build", () => {
    const { map } = consumePendingWorkMode({}, "office-chat", "office");
    expect(sessionWorkModeOf("office-chat", map)).toBe("office");
    const afterSwitch = consumePendingWorkMode(map, "office-chat", "code");
    expect(afterSwitch.map).toBe(map);
    expect(sessionWorkModeOf("office-chat", afterSwitch.map)).toBe("office");
    expect(sessionMatchesSurface("office-chat", afterSwitch.map, "office")).toBe(
      true,
    );
    expect(sessionMatchesSurface("office-chat", afterSwitch.map, "code")).toBe(
      false,
    );
  });

  it("create on Build is not listed as Office", () => {
    const { map } = consumePendingWorkMode({}, "build-chat", "code");
    expect(sessionWorkModeOf("build-chat", map)).toBe("code");
    expect(sessionMatchesSurface("build-chat", map, "office")).toBe(false);
    expect(sessionMatchesSurface("build-chat", map, "code")).toBe(true);
  });

  it("consumes a pending stamp so a new id matches before React setState", () => {
    const pending = "studio" as const;
    expect(sessionMatchesSurface("new-id", {}, "studio", pending)).toBe(true);
    const { map, applied } = consumePendingWorkMode({}, "new-id", pending);
    expect(applied).toBe("studio");
    expect(map).toEqual({ "new-id": "studio" });
    // Same-commit mismatch used to clear pending first, then see Build.
    expect(sessionMatchesSurface("new-id", map, "studio", null)).toBe(true);
    expect(sessionMatchesSurface("new-id", {}, "studio", null)).toBe(false);
    expect(consumePendingWorkMode({}, "new-id", null).applied).toBeNull();
  });

  it("upserts without cloning when unchanged", () => {
    const map = { a: "office" as const };
    expect(upsertSessionWorkMode(map, "a", "office")).toBe(map);
    expect(upsertSessionWorkMode(map, "a", "studio")).toEqual({ a: "studio" });
    expect(upsertSessionWorkMode(map, "  ", "studio")).toBe(map);
  });

  it("refuses to retag a stamped session to another workspace", () => {
    const map = { a: "code" as const, b: "office" as const };
    expect(retagSessionsWorkMode(map, ["a", "b", "c"], "studio")).toBe(map);
    expect(retagSessionsWorkMode(map, ["a"], "office")).toBe(map);
    expect(retagSessionsWorkMode(map, ["a"], "code")).toBe(map);
    expect(retagSessionsWorkMode({}, ["fresh"], "office")).toEqual({});
    expect(retagSessionsWorkMode({}, ["fresh"], "code")).toEqual({
      fresh: "code",
    });
  });

  it("shows empty projects only on Build; tagged chats split the folder", () => {
    const sessions = [
      { id: "b", projectId: "p1", archived: false },
      { id: "o", projectId: "p1", archived: false },
      { id: "dead", projectId: "p2", archived: true },
    ];
    const map = { b: "code" as const, o: "office" as const };
    expect(projectVisibleOnSurface("p1", sessions, "code", map)).toBe(true);
    expect(projectVisibleOnSurface("p1", sessions, "office", map)).toBe(true);
    expect(projectVisibleOnSurface("p1", sessions, "studio", map)).toBe(false);
    expect(projectVisibleOnSurface("p2", sessions, "code", map)).toBe(true);
    expect(projectVisibleOnSurface("p2", sessions, "office", map)).toBe(false);
    expect(projectVisibleOnSurface("empty", sessions, "code", map)).toBe(true);
    expect(projectVisibleOnSurface("empty", sessions, "studio", map)).toBe(false);
  });
});
