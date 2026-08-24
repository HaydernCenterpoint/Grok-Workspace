import { describe, expect, it } from "vitest";
import {
  attachmentFromMediaPath,
  isMediaHandoffTarget,
  mediaHandoffTargets,
} from "./mediaHandoff";

describe("mediaHandoff", () => {
  it("offers Build and Office from Studio, and the other daily surface from each", () => {
    expect(mediaHandoffTargets("studio")).toEqual(["code", "office"]);
    expect(mediaHandoffTargets("code")).toEqual(["office"]);
    expect(mediaHandoffTargets("office")).toEqual(["code"]);
  });

  it("builds a file attachment from a local media path", () => {
    expect(attachmentFromMediaPath("")).toBeNull();
    expect(attachmentFromMediaPath("/Users/me/tokyo.png")).toEqual({
      path: "/Users/me/tokyo.png",
      name: "tokyo.png",
      isDir: false,
    });
    expect(
      attachmentFromMediaPath("/tmp/clip.mp4", "Night walk"),
    ).toEqual({
      path: "/tmp/clip.mp4",
      name: "Night walk",
      isDir: false,
    });
  });

  it("narrows handoff targets", () => {
    expect(isMediaHandoffTarget("code")).toBe(true);
    expect(isMediaHandoffTarget("office")).toBe(true);
    expect(isMediaHandoffTarget("studio")).toBe(false);
  });
});
