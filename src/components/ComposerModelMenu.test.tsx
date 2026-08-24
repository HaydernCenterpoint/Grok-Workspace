import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import React from "react";
import { ComposerModelMenu } from "@/components/ComposerModelMenu";

const labels = {
  model: "Model",
  effort: "Effort",
  speed: "Speed",
  effortHigh: "High",
  effortMedium: "Medium",
  effortLow: "Low",
  effortXhigh: "Extra high",
  modelSearchPlaceholder: "Search models",
  modelSearchEmpty: "No matches",
  modelGroupOfficial: "Official",
  contextWindow: "Context window",
  contextWindowOfficial: "Official window",
  contextWindowCustom: "Custom window",
  contextWindowPlaceholder: "tokens",
  contextWindowSave: "Save",
  contextWindowOfficialHint: "Fixed on official",
};

describe("ComposerModelMenu trigger", () => {
  it("renders the model pill without a lightning glyph", () => {
    const html = renderToString(
      React.createElement(ComposerModelMenu, {
        modelId: "grok-4.6",
        effort: "xhigh",
        labels,
        onEffort: vi.fn(),
      }),
    );
    expect(html).toContain("cmm--model");
    expect(html).toContain("cmm__trigger");
    expect(html).not.toContain("cmm__icon");
    expect(html).not.toContain("tabler-icon-bolt");
  });
});
