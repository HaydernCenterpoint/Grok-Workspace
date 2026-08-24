import { describe, expect, it } from "vitest";
import {
  CHAT_VIRTUALIZE_THRESHOLD_PERF,
  readStreamPerfFlag,
  resolveStreamFlushMs,
  resolveStreamMarkdownParseMs,
  resolveStreamOverscanScale,
  resolveMarkdownPaintSource,
  resolveTranscriptContentNotifyMs,
  releaseWallpaperVideoElement,
  shouldParkWallpaperVideo,
  shouldPlayWallpaperVideo,
  shouldUsePlainStreamBody,
  wallpaperVideoIsCompositing,
  STREAM_COALESCE_FLUSH_MS,
  STREAM_MARKDOWN_PARSE_MS,
  STREAM_PLAIN_TEXT_CHAR_THRESHOLD,
  TRANSCRIPT_CONTENT_NOTIFY_MS,
} from "./streamRenderPolicy";

describe("streamRenderPolicy", () => {
  it("virtualize threshold is early enough for multi-turn agent chats", () => {
    expect(CHAT_VIRTUALIZE_THRESHOLD_PERF).toBeLessThanOrEqual(24);
    expect(CHAT_VIRTUALIZE_THRESHOLD_PERF).toBeGreaterThanOrEqual(12);
  });

  it("never drops to plain stream body (keeps live markdown)", () => {
    expect(shouldUsePlainStreamBody(100, true)).toBe(false);
    expect(
      shouldUsePlainStreamBody(STREAM_PLAIN_TEXT_CHAR_THRESHOLD, true),
    ).toBe(false);
    expect(
      shouldUsePlainStreamBody(STREAM_PLAIN_TEXT_CHAR_THRESHOLD + 50_000, true),
    ).toBe(false);
    expect(
      shouldUsePlainStreamBody(STREAM_PLAIN_TEXT_CHAR_THRESHOLD + 1, false),
    ).toBe(false);
  });

  it("markdown parse interval lengthens for long streaming bodies", () => {
    expect(resolveStreamMarkdownParseMs(100, false)).toBe(0);
    expect(resolveStreamMarkdownParseMs(100, true)).toBe(
      STREAM_MARKDOWN_PARSE_MS,
    );
    expect(
      resolveStreamMarkdownParseMs(STREAM_PLAIN_TEXT_CHAR_THRESHOLD, true),
    ).toBeGreaterThan(STREAM_MARKDOWN_PARSE_MS);
    expect(resolveStreamMarkdownParseMs(12_000, true)).toBeGreaterThan(
      resolveStreamMarkdownParseMs(STREAM_PLAIN_TEXT_CHAR_THRESHOLD, true),
    );
  });

  it("flush ms scales with hardware concurrency", () => {
    expect(resolveStreamFlushMs(4)).toBeGreaterThanOrEqual(STREAM_COALESCE_FLUSH_MS);
    expect(resolveStreamFlushMs(12)).toBe(STREAM_COALESCE_FLUSH_MS);
    expect(resolveStreamFlushMs(16)).toBeLessThan(STREAM_COALESCE_FLUSH_MS);
  });

  it("settled markdown paints live source, not the throttle lag", () => {
    expect(resolveMarkdownPaintSource(true, "live", "lag")).toBe("lag");
    expect(resolveMarkdownPaintSource(false, "live", "lag")).toBe("live");
    expect(resolveMarkdownPaintSource(false, "final", "final")).toBe("final");
  });

  it("overscan scale shrinks only while streaming", () => {
    expect(resolveStreamOverscanScale(false, 12)).toBe(1);
    expect(resolveStreamOverscanScale(true, 12)).toBeLessThan(1);
    expect(resolveStreamOverscanScale(true, 16)).toBeLessThan(1);
    expect(resolveStreamOverscanScale(true, 12)).toBeLessThan(
      resolveStreamOverscanScale(true, 16),
    );
  });

  it("content notify ms scales with hardware concurrency", () => {
    expect(resolveTranscriptContentNotifyMs(4)).toBeGreaterThanOrEqual(
      TRANSCRIPT_CONTENT_NOTIFY_MS,
    );
    expect(resolveTranscriptContentNotifyMs(12)).toBe(
      TRANSCRIPT_CONTENT_NOTIFY_MS,
    );
    expect(resolveTranscriptContentNotifyMs(16)).toBeLessThan(
      TRANSCRIPT_CONTENT_NOTIFY_MS,
    );
  });

  it("reads html dataset.streamPerf", () => {
    expect(readStreamPerfFlag(undefined)).toBe(false);
    expect(readStreamPerfFlag({})).toBe(false);
    expect(readStreamPerfFlag({ streamPerf: "0" })).toBe(false);
    expect(readStreamPerfFlag({ streamPerf: "1" })).toBe(true);
  });

  it("pauses wallpaper video when hidden, unfocused, setup gate, or stream-perf", () => {
    expect(shouldPlayWallpaperVideo({})).toBe(true);
    expect(shouldPlayWallpaperVideo({ visibilityState: "visible" })).toBe(true);
    expect(shouldPlayWallpaperVideo({ visibilityState: "hidden" })).toBe(false);
    expect(
      shouldPlayWallpaperVideo({
        visibilityState: "visible",
        hasFocus: false,
      }),
    ).toBe(false);
    expect(shouldPlayWallpaperVideo({ hasFocus: false })).toBe(false);
    expect(shouldPlayWallpaperVideo({ setupGate: true })).toBe(false);
    expect(shouldPlayWallpaperVideo({ streamPerf: true })).toBe(false);
    expect(
      shouldPlayWallpaperVideo({
        visibilityState: "visible",
        streamPerf: true,
      }),
    ).toBe(false);
  });

  it("parks (unload) on hidden, OS-unfocus, or setup gate — not stream-perf", () => {
    expect(shouldParkWallpaperVideo({})).toBe(false);
    expect(shouldParkWallpaperVideo({ visibilityState: "visible" })).toBe(false);
    expect(shouldParkWallpaperVideo({ visibilityState: "hidden" })).toBe(true);
    expect(
      shouldParkWallpaperVideo({
        visibilityState: "visible",
        hasFocus: false,
      }),
    ).toBe(true);
    expect(shouldParkWallpaperVideo({ hasFocus: false })).toBe(true);
    expect(shouldParkWallpaperVideo({ setupGate: true })).toBe(true);
    expect(shouldParkWallpaperVideo({ visibilityState: "visible", setupGate: false })).toBe(
      false,
    );
  });

  it("treats park as not compositing (unmounted or src cleared)", () => {
    expect(
      wallpaperVideoIsCompositing({
        parked: true,
        mounted: true,
        src: "https://example.com/wall.mp4",
      }),
    ).toBe(false);
    expect(
      wallpaperVideoIsCompositing({
        parked: true,
        mounted: false,
        src: null,
      }),
    ).toBe(false);
    expect(
      wallpaperVideoIsCompositing({
        parked: false,
        mounted: true,
        src: "",
      }),
    ).toBe(false);
    expect(
      wallpaperVideoIsCompositing({
        parked: false,
        mounted: false,
        src: "https://example.com/wall.mp4",
      }),
    ).toBe(false);
    expect(
      wallpaperVideoIsCompositing({
        parked: false,
        mounted: true,
        src: "https://example.com/wall.mp4",
      }),
    ).toBe(true);
  });

  it("releases src + load so park does not unmount a live decoder", () => {
    const calls: string[] = [];
    const el = {
      pause: () => {
        calls.push("pause");
      },
      removeAttribute: (name: string) => {
        calls.push(`remove:${name}`);
      },
      src: "blob:http://tauri.localhost/clip",
      load: () => {
        calls.push("load");
      },
    };
    releaseWallpaperVideoElement(el);
    expect(el.src).toBe("");
    expect(calls).toEqual(["pause", "remove:src", "load"]);
  });
});
