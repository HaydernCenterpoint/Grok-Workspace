import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import React from "react";
import { BuildWelcome } from "@/components/BuildWelcome";

describe("BuildWelcome", () => {
  it("renders the four Grok Build starter rows", () => {
    const html = renderToString(
      React.createElement(BuildWelcome, {
        locale: "en",
        onStart: vi.fn(),
      }),
    );
    expect(html).toContain("build-welcome");
    expect(html).toContain("build-welcome__row");
    expect(html).not.toContain("build-welcome__card");
    expect(html).toContain("See how this project works");
    expect(html).toContain("Turn your idea into code");
    expect(html).toContain("Review the latest changes");
    expect(html).toContain("Unstick a failure");
    expect(html).toContain('data-kind="explore"');
    expect(html).toContain('data-kind="feature"');
    expect(html).toContain('data-kind="review"');
    expect(html).toContain('data-kind="fix"');
  });
});
