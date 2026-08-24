import { describe, expect, it } from "vitest";
import {
  GENERAL_PROJECT_ID,
  isRecentsSidebarSession,
  isSidebarOrphanSession,
  isSurfaceFolderlessSession,
  surfaceFolderlessSessions,
} from "./sidebarModels";

describe("isSidebarOrphanSession", () => {
  const projectIds = new Set(["p1", "p2"]);

  it("keeps a bound live session on its surface", () => {
    expect(
      isSidebarOrphanSession({ projectId: "p1", archived: false }, projectIds),
    ).toBe(false);
  });

  it("puts a missing projectId in Recents", () => {
    expect(isSidebarOrphanSession({ projectId: null }, projectIds)).toBe(true);
    expect(isSidebarOrphanSession({ projectId: undefined }, projectIds)).toBe(
      true,
    );
    expect(isSidebarOrphanSession({}, projectIds)).toBe(true);
  });

  it("puts an unknown projectId in Recents", () => {
    expect(
      isSidebarOrphanSession({ projectId: "gone", archived: false }, projectIds),
    ).toBe(true);
  });

  it("excludes archived chats from Recents", () => {
    expect(
      isSidebarOrphanSession({ projectId: null, archived: true }, projectIds),
    ).toBe(false);
    expect(
      isSidebarOrphanSession({ projectId: "p1", archived: true }, projectIds),
    ).toBe(false);
    expect(
      isSidebarOrphanSession({ projectId: "gone", archived: true }, projectIds),
    ).toBe(false);
  });

  it("treats the retired general project as Recents", () => {
    expect(
      isSidebarOrphanSession(
        { projectId: GENERAL_PROJECT_ID, archived: false },
        projectIds,
      ),
    ).toBe(true);
  });
});

describe("Recents stamp vs surface folderless", () => {
  const projectIds = new Set(["p1"]);
  const recents = new Set(["recent-1", "stamped-folder"]);

  it("never lists a folder session in Recents even if stamped", () => {
    const folder = { id: "stamped-folder", projectId: "p1", archived: false };
    expect(isRecentsSidebarSession(folder, projectIds, recents)).toBe(false);
    expect(isSurfaceFolderlessSession(folder, projectIds, recents)).toBe(false);
  });

  it("lists a stamped orphan only in Recents", () => {
    const row = { id: "recent-1", projectId: null, archived: false };
    expect(isRecentsSidebarSession(row, projectIds, recents)).toBe(true);
    expect(isSurfaceFolderlessSession(row, projectIds, recents)).toBe(false);
  });

  it("lists an unstamped orphan on its work-mode surface", () => {
    const row = { id: "build-1", projectId: null, archived: false };
    expect(isRecentsSidebarSession(row, projectIds, recents)).toBe(false);
    expect(isSurfaceFolderlessSession(row, projectIds, recents)).toBe(true);
    expect(
      surfaceFolderlessSessions(
        [row, { id: "recent-1", projectId: null }],
        projectIds,
        recents,
        "code",
        {},
      ).map((s) => s.id),
    ).toEqual(["build-1"]);
    expect(
      surfaceFolderlessSessions(
        [{ id: "studio-1", projectId: null }],
        projectIds,
        recents,
        "studio",
        { "studio-1": "studio" },
      ).map((s) => s.id),
    ).toEqual(["studio-1"]);
  });
});
