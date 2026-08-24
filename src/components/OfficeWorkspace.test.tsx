import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import React from "react";
import { OfficeWorkspace } from "@/components/OfficeWorkspace";

vi.mock("@/components/OfficeDocumentPreview", () => ({
  OfficeDocumentPreview: () => null,
}));
vi.mock("@/components/OfficeArtifactPreview", () => ({
  OfficeArtifactPreview: () => null,
}));

describe("OfficeWorkspace landing vs transcript", () => {
  it("shows the Office landing only on an empty start canvas", () => {
    const html = renderToString(
      React.createElement(OfficeWorkspace, {
        locale: "en",
        projectPath: null,
        enabled: true,
        showChat: false,
        onStart: vi.fn(),
        children: React.createElement("div", { "data-testid": "office-chat" }, "chat"),
      }),
    );
    expect(html).toContain('data-layout="start"');
    expect(html).toContain("office-start");
    expect(html).toContain("Papers, slides, and sheets");
    expect(html).not.toContain("office-chat");
  });

  it("unmounts the landing once the session has a transcript", () => {
    const html = renderToString(
      React.createElement(OfficeWorkspace, {
        locale: "en",
        projectPath: null,
        enabled: true,
        showChat: true,
        onStart: vi.fn(),
        children: React.createElement("div", { "data-testid": "office-chat" }, "chat"),
      }),
    );
    expect(html).toContain('data-layout="chat-only"');
    expect(html).toContain("office-workspace--chat-only");
    expect(html).toContain('data-surface="empty"');
    expect(html).not.toContain("office-start");
    expect(html).not.toContain("Papers, slides, and sheets");
    expect(html).not.toContain("Project report");
    expect(html).toContain("office-chat");
  });
});
