import { describe, expect, it } from "vitest";
import { projectVisibleOnSurface } from "./sessionWorkMode";
import {
  PROJECT_WORK_MODE_STORAGE_KEY,
  defaultCreateProjectWorkspace,
  explicitProjectWorkMode,
  forgetProjectWorkMode,
  isCreateProjectWorkspace,
  loadProjectWorkModes,
  parseProjectWorkModes,
  projectWorkModeOf,
  saveProjectWorkModes,
  upsertProjectWorkMode,
  type ProjectWorkModeStorage,
} from "./projectWorkMode";

function memoryStorage(
  initial: Record<string, string> = {},
): ProjectWorkModeStorage & { data: Record<string, string> } {
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

describe("projectWorkMode", () => {
  it("defaults Create project to the current Build or Office surface", () => {
    expect(defaultCreateProjectWorkspace("code")).toBe("code");
    expect(defaultCreateProjectWorkspace("office")).toBe("office");
    expect(defaultCreateProjectWorkspace("studio")).toBe("code");
  });

  it("accepts only Build and Office as project homes", () => {
    expect(isCreateProjectWorkspace("code")).toBe(true);
    expect(isCreateProjectWorkspace("office")).toBe(true);
    expect(isCreateProjectWorkspace("studio")).toBe(false);
  });

  it("parses a map and drops junk / Studio", () => {
    expect(parseProjectWorkModes(null)).toEqual({});
    expect(parseProjectWorkModes("not-json")).toEqual({});
    expect(
      parseProjectWorkModes({ a: "office", b: "studio", "": "code" }),
    ).toEqual({ a: "office" });
    expect(parseProjectWorkModes('{"p1":"office","p2":"code"}')).toEqual({
      p1: "office",
      p2: "code",
    });
  });

  it("defaults missing project homes to Build", () => {
    expect(projectWorkModeOf(null, {})).toBe("code");
    expect(projectWorkModeOf("p1", {})).toBe("code");
    expect(projectWorkModeOf("p1", { p1: "office" })).toBe("office");
    expect(explicitProjectWorkMode("p1", {})).toBeNull();
    expect(explicitProjectWorkMode("p1", { p1: "office" })).toBe("office");
  });

  it("round-trips storage", () => {
    const storage = memoryStorage();
    expect(loadProjectWorkModes(storage)).toEqual({});
    saveProjectWorkModes({ a: "office" }, storage);
    expect(storage.data[PROJECT_WORK_MODE_STORAGE_KEY]).toBe(
      JSON.stringify({ a: "office" }),
    );
    expect(loadProjectWorkModes(storage)).toEqual({ a: "office" });
  });

  it("upserts and forgets without cloning when unchanged", () => {
    const map = { a: "office" as const };
    expect(upsertProjectWorkMode(map, "a", "office")).toBe(map);
    expect(upsertProjectWorkMode(map, "a", "code")).toEqual({ a: "code" });
    expect(forgetProjectWorkMode(map, "missing")).toBe(map);
    expect(forgetProjectWorkMode(map, "a")).toEqual({});
  });

  it("lands an empty project on Build or Office from its stored home", () => {
    const sessions: { id: string; projectId: string; archived?: boolean }[] =
      [];
    const chats = {};
    expect(
      projectVisibleOnSurface("empty", sessions, "code", chats),
    ).toBe(true);
    expect(
      projectVisibleOnSurface("empty", sessions, "office", chats),
    ).toBe(false);
    expect(
      projectVisibleOnSurface("office-home", sessions, "office", chats, {
        "office-home": "office",
      }),
    ).toBe(true);
    expect(
      projectVisibleOnSurface("office-home", sessions, "code", chats, {
        "office-home": "office",
      }),
    ).toBe(false);
    expect(
      projectVisibleOnSurface("build-home", sessions, "code", chats, {
        "build-home": "code",
      }),
    ).toBe(true);
    expect(
      projectVisibleOnSurface("build-home", sessions, "office", chats, {
        "build-home": "code",
      }),
    ).toBe(false);
  });

  it("keeps an explicit home visible even when chats live on the other surface", () => {
    const sessions = [{ id: "b", projectId: "p1", archived: false }];
    const chats = { b: "code" as const };
    const homes = { p1: "office" as const };
    expect(projectVisibleOnSurface("p1", sessions, "code", chats, homes)).toBe(
      true,
    );
    expect(
      projectVisibleOnSurface("p1", sessions, "office", chats, homes),
    ).toBe(true);
    expect(
      projectVisibleOnSurface("p1", sessions, "studio", chats, homes),
    ).toBe(false);
  });
});
