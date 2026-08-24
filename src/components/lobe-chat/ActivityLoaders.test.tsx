import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import React from "react";
import { ReasoningDots, ToolGrid } from "./ActivityLoaders";

describe("ActivityLoaders", () => {
  it("renders the 3-dot reasoning mark", () => {
    const html = renderToString(React.createElement(ReasoningDots));
    expect(html).toContain("act-dots");
    expect(html.match(/<span/g)?.length).toBe(4);
  });

  it("renders the 4-square tool mark", () => {
    const html = renderToString(React.createElement(ToolGrid));
    expect(html).toContain("act-tool-grid");
    expect(html.match(/<span/g)?.length).toBe(5);
  });
});
