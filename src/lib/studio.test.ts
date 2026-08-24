import { describe, expect, it } from "vitest";
import {
  classifyStudioError,
  clampStudioImageCount,
  extractStudioMediaPath,
  nextStudioAspect,
  studioAspectBox,
  wrapStudioAgentText,
} from "./studio";

describe("studio", () => {
  it("extracts backtick Windows and POSIX media paths", () => {
    expect(
      extractStudioMediaPath("Saved `C:\\Users\\me\\img.png` done"),
    ).toBe("C:\\Users\\me\\img.png");
    expect(
      extractStudioMediaPath("here `/Users/me/Movies/clip.mp4`"),
    ).toBe("/Users/me/Movies/clip.mp4");
    expect(extractStudioMediaPath("no media here")).toBeNull();
    expect(extractStudioMediaPath("`/img.png`")).toBeNull();
  });

  it("cycles aspect ratios", () => {
    expect(nextStudioAspect("2:3")).toBe("3:2");
    expect(nextStudioAspect("3:4")).toBe("2:3");
    expect(nextStudioAspect("nope")).toBe("2:3");
  });

  it("sizes the aspect preview box", () => {
    expect(studioAspectBox("16:9")).toEqual({ w: 16, h: 9 });
    expect(studioAspectBox("1:1")).toEqual({ w: 1, h: 1 });
    expect(studioAspectBox("bad")).toEqual({ w: 1, h: 1 });
  });

  it("wraps agent text without changing the user prompt line", () => {
    const wrapped = wrapStudioAgentText("Tạo ảnh Mèo", {
      kind: "image",
      aspect: "3:2",
      resolution: "1080p",
      duration: 6,
    });
    expect(wrapped.startsWith("Tạo ảnh Mèo")).toBe(true);
    expect(wrapped).toContain("image_gen");
    expect(wrapped).toContain("3:2");
    expect(wrapped).toMatch(/do not load a skill/i);
    expect(wrapped).not.toMatch(/exactly \d+ images/i);
  });

  it("clamps image count to 1–4", () => {
    expect(clampStudioImageCount(1)).toBe(1);
    expect(clampStudioImageCount(4)).toBe(4);
    expect(clampStudioImageCount(0)).toBe(1);
    expect(clampStudioImageCount(9)).toBe(4);
    expect(clampStudioImageCount(Number.NaN)).toBe(1);
  });

  it("asks the agent for exactly N images when count is above 1", () => {
    const wrapped = wrapStudioAgentText("Four cats", {
      kind: "image",
      aspect: "1:1",
      resolution: "1080p",
      duration: 6,
      count: 4,
    });
    expect(wrapped.startsWith("Four cats")).toBe(true);
    expect(wrapped).toContain("exactly 4 images");
    expect(wrapped).toContain("4 times");
    expect(wrapped).toContain("1:1");
  });

  it("ignores image count when wrapping video", () => {
    const wrapped = wrapStudioAgentText("A walk", {
      kind: "video",
      aspect: "16:9",
      resolution: "720p",
      duration: 10,
      count: 4,
    });
    expect(wrapped).toContain("image_to_video");
    expect(wrapped).not.toContain("exactly 4 images");
  });

  it("classifies generate errors", () => {
    expect(classifyStudioError("empty")).toBe("empty");
    expect(classifyStudioError(new Error("auth_required"))).toBe("auth");
    expect(classifyStudioError("cli_missing")).toBe("cli");
    expect(classifyStudioError("boom")).toBe("failed");
  });
});
