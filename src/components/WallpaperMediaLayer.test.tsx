/**
 * @vitest-environment jsdom
 */
import "@/test/jsdomStubs";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applySetupGateFlag } from "@/lib/splashMotion";
import { wallpaperVideoIsCompositing } from "@/lib/streamRenderPolicy";
import {
  applyWindowFocusedFlag,
  publishWindowFocused,
} from "@/lib/windowFocusFlag";
import { WallpaperMediaLayer } from "./WallpaperMediaLayer";

const VIDEO_URL = "https://example.com/wallpaper.mp4";
const IMAGE_URL = "https://example.com/wallpaper.jpg";

function compositingFrom(container: HTMLElement): boolean {
  const video = container.querySelector("video");
  const parked =
    container.querySelector("[data-wallpaper-parked='1']") != null;
  return wallpaperVideoIsCompositing({
    parked,
    mounted: video != null,
    src: video?.getAttribute("src"),
  });
}

const playOrig = HTMLMediaElement.prototype.play;
const pauseOrig = HTMLMediaElement.prototype.pause;

function renderVideo() {
  return render(
    <WallpaperMediaLayer url={VIDEO_URL} kind="video" />,
  );
}

beforeEach(() => {
  applyWindowFocusedFlag(document.documentElement.dataset, true);
  delete document.documentElement.dataset.setupGate;
  delete document.documentElement.dataset.streamPerf;
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => "visible",
  });
  HTMLMediaElement.prototype.play = () => Promise.resolve();
  HTMLMediaElement.prototype.pause = () => {};
});

afterEach(() => {
  cleanup();
  HTMLMediaElement.prototype.play = playOrig;
  HTMLMediaElement.prototype.pause = pauseOrig;
  delete document.documentElement.dataset.windowFocused;
  delete document.documentElement.dataset.setupGate;
  delete document.documentElement.dataset.streamPerf;
});

describe("WallpaperMediaLayer park unload", () => {
  it("mounts the clip while focused and visible", () => {
    const { container } = renderVideo();
    const video = container.querySelector("video");
    expect(video).toBeTruthy();
    expect(video?.getAttribute("src")).toBe(VIDEO_URL);
    expect(container.querySelector("[data-wallpaper-parked='1']")).toBeNull();
    expect(compositingFrom(container)).toBe(true);
  });

  it("unmounts the video on OS unfocus and remounts the same clip on refocus", async () => {
    const loadCalls: string[] = [];
    const loadOrig = HTMLMediaElement.prototype.load;
    HTMLMediaElement.prototype.load = function load() {
      loadCalls.push(this.getAttribute("src") ?? this.src ?? "");
      return loadOrig.call(this);
    };
    try {
      const { container } = renderVideo();
      expect(container.querySelector("video")?.getAttribute("src")).toBe(
        VIDEO_URL,
      );

      act(() => {
        publishWindowFocused(false, document.documentElement.dataset);
      });

      await waitFor(() => {
        expect(container.querySelector("video")).toBeNull();
      });
      expect(loadCalls.length).toBeGreaterThan(0);
      expect(container.querySelector("[data-wallpaper-parked='1']")).toBeTruthy();
      expect(compositingFrom(container)).toBe(false);

      act(() => {
        publishWindowFocused(true, document.documentElement.dataset);
      });

      await waitFor(() => {
        expect(container.querySelector("video")?.getAttribute("src")).toBe(
          VIDEO_URL,
        );
      });
      expect(container.querySelector("[data-wallpaper-parked='1']")).toBeNull();
      expect(compositingFrom(container)).toBe(true);
    } finally {
      HTMLMediaElement.prototype.load = loadOrig;
    }
  });

  it("unmounts when document.hidden (src cleared / not compositing)", async () => {
    const { container } = renderVideo();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => {
      expect(container.querySelector("video")).toBeNull();
    });
    expect(compositingFrom(container)).toBe(false);
  });

  it("unmounts under the setup gate", async () => {
    const { container } = renderVideo();
    act(() => {
      applySetupGateFlag(document.documentElement.dataset, true);
    });
    await waitFor(() => {
      expect(container.querySelector("video")).toBeNull();
    });
    expect(compositingFrom(container)).toBe(false);
  });

  it("keeps the video mounted during live-turn stream-perf (pause only)", async () => {
    const { container } = renderVideo();
    act(() => {
      document.documentElement.dataset.streamPerf = "1";
    });
    await waitFor(() => {
      expect(container.querySelector("video")?.getAttribute("src")).toBe(
        VIDEO_URL,
      );
    });
    expect(container.querySelector("[data-wallpaper-parked='1']")).toBeNull();
    expect(compositingFrom(container)).toBe(true);
  });

  it("does not drop a still-image wallpaper when the window parks", () => {
    const { container } = render(
      <WallpaperMediaLayer url={IMAGE_URL} kind="image" />,
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe(IMAGE_URL);

    act(() => {
      publishWindowFocused(false, document.documentElement.dataset);
    });

    expect(container.querySelector("img")?.getAttribute("src")).toBe(IMAGE_URL);
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("[data-wallpaper-parked='1']")).toBeNull();
  });

  it("starts unloaded when the window is already OS-unfocused", () => {
    applyWindowFocusedFlag(document.documentElement.dataset, false);
    const { container } = renderVideo();
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("[data-wallpaper-parked='1']")).toBeTruthy();
    expect(compositingFrom(container)).toBe(false);
  });
});
