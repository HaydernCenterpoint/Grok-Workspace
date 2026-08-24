import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import React from "react";
import { StudioStart } from "@/components/StudioSurface";

describe("StudioStart", () => {
  it("renders the Grok mark and slogan, not Imagine copy", () => {
    const html = renderToString(
      React.createElement(StudioStart, { locale: "en" }),
    );
    expect(html).toContain("studio-start");
    expect(html).toContain("grok-logo");
    expect(html).toContain("Show me something");
    expect(html).not.toContain("Imagine an image");
    expect(html).not.toContain("Imagine a video");
    expect(html).not.toContain("Tell me your idea");
  });
});
