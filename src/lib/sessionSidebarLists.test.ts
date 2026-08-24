import { describe, expect, it } from "vitest";
import type { SessionRow } from "@/lib/app/sidebarModels";
import {
  buildSidebarSessionLists,
  sessionsInSidebarScope,
  sidebarScopeOfSession,
} from "./sessionSidebarLists";
import {
  folderListKey,
  folderlessListKey,
  SESSION_LIST_RECENTS,
} from "./sessionSidebarOrder";

function row(
  id: string,
  extra: Partial<SessionRow> = {},
): SessionRow {
  return {
    id,
    title: id,
    projectId: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...extra,
  };
}

describe("buildSidebarSessionLists", () => {
  const projectIds = new Set(["p1"]);

  it("keeps folder chats on the surface and out of Recents", () => {
    const lists = buildSidebarSessionLists({
      sessions: [
        row("xin", { projectId: "p1", title: "Xin chào" }),
        row("stamped-folder", { projectId: "p1" }),
      ],
      projectIds,
      sessionWorkModes: { xin: "office", "stamped-folder": "office" },
      recentsSet: new Set(["stamped-folder"]),
      orderMap: {},
    });
    expect(lists[folderListKey("office", "p1")]?.map((s) => s.id)).toEqual([
      "xin",
      "stamped-folder",
    ]);
    expect(lists[SESSION_LIST_RECENTS]).toEqual([]);
  });

  it("puts stamped orphans in Recents and unstamped orphans on their surface", () => {
    const lists = buildSidebarSessionLists({
      sessions: [
        row("recent-1"),
        row("hello"),
        row("cat"),
        row("explore"),
      ],
      projectIds,
      sessionWorkModes: { explore: "studio" },
      recentsSet: new Set(["recent-1"]),
      orderMap: {
        [folderlessListKey("code")]: ["cat", "hello"],
      },
    });
    expect(lists[SESSION_LIST_RECENTS]?.map((s) => s.id)).toEqual(["recent-1"]);
    expect(lists[folderlessListKey("code")]?.map((s) => s.id)).toEqual([
      "hello",
      "cat",
    ]);
    expect(lists[folderlessListKey("studio")]?.map((s) => s.id)).toEqual([
      "explore",
    ]);
    expect(lists[folderlessListKey("office")]).toEqual([]);
  });

  it("sorts folder chats by newest updatedAt, ignoring saved drag order", () => {
    const lists = buildSidebarSessionLists({
      sessions: [
        row("seven-hours", {
          projectId: "p1",
          updatedAt: "2026-08-23T05:00:00.000Z",
        }),
        row("twenty-three-min", {
          projectId: "p1",
          updatedAt: "2026-08-23T11:37:00.000Z",
        }),
        row("three-hours", {
          projectId: "p1",
          updatedAt: "2026-08-23T09:00:00.000Z",
        }),
      ],
      projectIds,
      sessionWorkModes: {
        "seven-hours": "code",
        "twenty-three-min": "code",
        "three-hours": "code",
      },
      recentsSet: new Set(),
      orderMap: {
        [folderListKey("code", "p1")]: [
          "seven-hours",
          "three-hours",
          "twenty-three-min",
        ],
      },
    });
    expect(lists[folderListKey("code", "p1")]?.map((s) => s.id)).toEqual([
      "twenty-three-min",
      "three-hours",
      "seven-hours",
    ]);
  });

  it("keeps pinned above a newer unpinned chat in the same folder", () => {
    const lists = buildSidebarSessionLists({
      sessions: [
        row("fresh", {
          projectId: "p1",
          updatedAt: "2026-08-23T12:00:00.000Z",
        }),
        row("old-pin", {
          projectId: "p1",
          updatedAt: "2026-08-22T12:00:00.000Z",
          pinned: true,
        }),
      ],
      projectIds,
      sessionWorkModes: { fresh: "code", "old-pin": "code" },
      recentsSet: new Set(),
      orderMap: {},
    });
    expect(lists[folderListKey("code", "p1")]?.map((s) => s.id)).toEqual([
      "old-pin",
      "fresh",
    ]);
  });

  it("keeps an Office-created folder chat on Office after a Build chat exists", () => {
    const lists = buildSidebarSessionLists({
      sessions: [
        row("office-home", { projectId: "p1" }),
        row("build-later", { projectId: "p1" }),
      ],
      projectIds,
      sessionWorkModes: { "office-home": "office", "build-later": "code" },
      recentsSet: new Set(),
      orderMap: {},
    });
    expect(lists[folderListKey("office", "p1")]?.map((s) => s.id)).toEqual([
      "office-home",
    ]);
    expect(lists[folderListKey("code", "p1")]?.map((s) => s.id)).toEqual([
      "build-later",
    ]);
    expect(lists[folderListKey("office", "p1")]?.some((s) => s.id === "build-later")).toBe(
      false,
    );
  });

  it("scopes archive/select pools to one workspace and keeps Recents out", () => {
    const sessions = [
      row("build-a", { projectId: "p1" }),
      row("office-a", { projectId: "p1" }),
      row("recent-a"),
    ];
    const recentsSet = new Set(["recent-a"]);
    const modes = { "build-a": "code" as const, "office-a": "office" as const };
    expect(
      sessionsInSidebarScope({
        sessions,
        scope: "office",
        projectIds,
        sessionWorkModes: modes,
        recentsSet,
      }).map((s) => s.id),
    ).toEqual(["office-a"]);
    expect(
      sessionsInSidebarScope({
        sessions,
        scope: "code",
        projectIds,
        sessionWorkModes: modes,
        recentsSet,
      }).map((s) => s.id),
    ).toEqual(["build-a"]);
    expect(
      sessionsInSidebarScope({
        sessions,
        scope: "recents",
        projectIds,
        sessionWorkModes: modes,
        recentsSet,
      }).map((s) => s.id),
    ).toEqual(["recent-a"]);
    expect(
      sidebarScopeOfSession(sessions[1]!, projectIds, recentsSet, modes),
    ).toBe("office");
    expect(
      sidebarScopeOfSession(sessions[2]!, projectIds, recentsSet, modes),
    ).toBe("recents");
  });
});
