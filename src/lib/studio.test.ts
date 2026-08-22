import { describe, expect, it } from "vitest";
import {
  classifyStudioError,
  extractStudioMediaPath,
  nextStudioAspect,
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
    expect(nextStudioAspect("1:1")).toBe("16:9");
    expect(nextStudioAspect("3:2")).toBe("1:1");
    expect(nextStudioAspect("nope")).toBe("1:1");
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
  });

  it("classifies generate errors", () => {
    expect(classifyStudioError("empty")).toBe("empty");
    expect(classifyStudioError(new Error("auth_required"))).toBe("auth");
    expect(classifyStudioError("cli_missing")).toBe("cli");
    expect(classifyStudioError("boom")).toBe("failed");
  });
});
