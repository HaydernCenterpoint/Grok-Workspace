import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import React from "react";
import {
  ComposerProjectMenu,
  defaultWorkspaceMatchesQuery,
  filterProjectOptions,
} from "@/components/ComposerProjectMenu";

const labels = {
  noProject: "Default workspace",
  pickProject: "Project folder",
  chooseProject: "Choose project",
  searchProjects: "Search projects",
  newProject: "New project",
  projectsEmpty: "No matching projects",
};

describe("ComposerProjectMenu", () => {
  it("shows Choose project when no project is bound", () => {
    const html = renderToString(
      React.createElement(ComposerProjectMenu, {
        activeProject: null,
        projects: [],
        labels,
        variant: "context",
        onSelect: vi.fn(),
        onAdd: vi.fn(),
      }),
    );
    expect(html).toContain("Choose project");
    expect(html).toContain("composer__context-item--project");
    expect(html).toContain("composer__context-label");
    expect(html).toContain("is-muted");
    expect(html).not.toContain("g-icon");
  });

  it("filters projects by name or path", () => {
    const projects = [
      {
        id: "a",
        name: "RSU Manager System",
        path: "C:/src/rsu",
        trusted: true,
        pathOk: true,
      },
      {
        id: "b",
        name: "Palworld",
        path: "D:/games/pal",
        trusted: true,
        pathOk: true,
      },
    ];
    expect(filterProjectOptions(projects, "rsu").map((p) => p.id)).toEqual([
      "a",
    ]);
    expect(filterProjectOptions(projects, "games").map((p) => p.id)).toEqual([
      "b",
    ]);
    expect(defaultWorkspaceMatchesQuery("default", "Default workspace")).toBe(
      true,
    );
    expect(defaultWorkspaceMatchesQuery("pal", "Default workspace")).toBe(
      false,
    );
  });
});
