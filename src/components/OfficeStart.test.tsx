import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import React from "react";
import { OfficeStart } from "@/components/OfficeStart";

describe("OfficeStart", () => {
  it("renders the Grok mark, daily-work slogan, and Office rows", () => {
    const html = renderToString(
      React.createElement(OfficeStart, {
        locale: "en",
        onStart: vi.fn(),
      }),
    );
    expect(html).toContain("office-start");
    expect(html).toContain("grok-logo");
    expect(html).toContain("Papers, slides, and sheets");
    expect(html).toContain("Project report");
    expect(html).toContain("Slide outline");
    expect(html).toContain("Tracking sheet");
    expect(html).not.toContain("Tell me your idea");
    expect(html).not.toContain("Turn your idea into code");
  });

  it("names a bound Build project without replacing the slogan", () => {
    const html = renderToString(
      React.createElement(OfficeStart, {
        locale: "en",
        projectName: "grok-app",
        onStart: vi.fn(),
      }),
    );
    expect(html).toContain("Papers, slides, and sheets");
    expect(html).toContain("Work from grok-app");
  });
});
