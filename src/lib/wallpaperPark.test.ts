/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import {
  applyWindowFocusedFlag,
  publishWindowFocused,
} from "@/lib/windowFocusFlag";
import {
  installWallpaperParkGuard,
  installWindowFocusParkHook,
  parkWallpaperPlayback,
  readWallpaperVideoEnv,
  releaseWallpaperVideosInDocument,
  subscribeWallpaperPark,
  wallpaperVideoCompositorShouldPark,
} from "./wallpaperPark";

describe("wallpaperPark", () => {
  it("parks the video compositor when OS-unfocused", () => {
    applyWindowFocusedFlag(document.documentElement.dataset, false);
    expect(readWallpaperVideoEnv().hasFocus).toBe(false);
    expect(wallpaperVideoCompositorShouldPark()).toBe(true);
    applyWindowFocusedFlag(document.documentElement.dataset, true);
    expect(wallpaperVideoCompositorShouldPark()).toBe(false);
  });

  it("releases only wallpaper <video> nodes (src + load)", () => {
    const loadOrig = HTMLMediaElement.prototype.load;
    const loads: string[] = [];
    HTMLMediaElement.prototype.load = function load() {
      loads.push(this.className);
      return loadOrig.call(this);
    };
    const layer = document.createElement("div");
    layer.className = "app-wallpaper-media";
    const wall = document.createElement("video");
    wall.className = "app-wallpaper-media__el";
    wall.setAttribute("src", "blob:http://tauri.localhost/clip");
    layer.appendChild(wall);
    const other = document.createElement("video");
    other.className = "chat-media";
    other.setAttribute("src", "blob:http://tauri.localhost/other");
    document.body.append(layer, other);
    try {
      releaseWallpaperVideosInDocument(document);
      expect(other.getAttribute("src")).toBe("blob:http://tauri.localhost/other");
      expect(loads).toEqual(["app-wallpaper-media__el"]);
    } finally {
      HTMLMediaElement.prototype.load = loadOrig;
      layer.remove();
      other.remove();
    }
  });

  it("releases src+load before the park callback so React unmount cannot win", () => {
    applyWindowFocusedFlag(document.documentElement.dataset, true);
    const loadOrig = HTMLMediaElement.prototype.load;
    const order: string[] = [];
    HTMLMediaElement.prototype.load = function load() {
      order.push("load");
      return loadOrig.call(this);
    };
    const layer = document.createElement("div");
    layer.className = "app-wallpaper-media";
    const wall = document.createElement("video");
    wall.className = "app-wallpaper-media__el";
    wall.setAttribute("src", "blob:http://tauri.localhost/clip");
    layer.appendChild(wall);
    document.body.append(layer);
    try {
      const stop = subscribeWallpaperPark((parked) => {
        if (parked) order.push("callback");
      });
      publishWindowFocused(false, document.documentElement.dataset);
      expect(order[0]).toBe("load");
      expect(order).toContain("callback");
      expect(order.indexOf("load")).toBeLessThan(order.indexOf("callback"));
      stop();
    } finally {
      HTMLMediaElement.prototype.load = loadOrig;
      layer.remove();
      applyWindowFocusedFlag(document.documentElement.dataset, true);
    }
  });

  it("parkWallpaperPlayback load()s then revokes the object URL", () => {
    const loadOrig = HTMLMediaElement.prototype.load;
    const revokeOrig = URL.revokeObjectURL;
    const order: string[] = [];
    HTMLMediaElement.prototype.load = function load() {
      order.push("load");
      return loadOrig.call(this);
    };
    URL.revokeObjectURL = (url: string) => {
      order.push(`revoke:${url}`);
    };
    const layer = document.createElement("div");
    layer.className = "app-wallpaper-media";
    const wall = document.createElement("video");
    wall.className = "app-wallpaper-media__el";
    wall.setAttribute("src", "blob:http://tauri.localhost/clip");
    layer.appendChild(wall);
    document.body.append(layer);
    try {
      parkWallpaperPlayback("blob:http://tauri.localhost/clip");
      expect(order[0]).toBe("load");
      expect(order).toContain("revoke:blob:http://tauri.localhost/clip");
    } finally {
      HTMLMediaElement.prototype.load = loadOrig;
      URL.revokeObjectURL = revokeOrig;
      layer.remove();
    }
  });

  it("Host unfocus hook load()s before React subscribers", () => {
    applyWindowFocusedFlag(document.documentElement.dataset, true);
    const loadOrig = HTMLMediaElement.prototype.load;
    const order: string[] = [];
    HTMLMediaElement.prototype.load = function load() {
      order.push("load");
      return loadOrig.call(this);
    };
    const layer = document.createElement("div");
    layer.className = "app-wallpaper-media";
    const wall = document.createElement("video");
    wall.className = "app-wallpaper-media__el";
    wall.setAttribute("src", "blob:http://tauri.localhost/clip");
    layer.appendChild(wall);
    document.body.append(layer);
    const stop = installWindowFocusParkHook();
    const unsub = subscribeWallpaperPark((parked) => {
      if (parked) order.push("callback");
    });
    try {
      publishWindowFocused(false, document.documentElement.dataset);
      expect(order[0]).toBe("load");
      expect(order.indexOf("load")).toBeLessThan(order.indexOf("callback"));
    } finally {
      HTMLMediaElement.prototype.load = loadOrig;
      unsub();
      stop();
      layer.remove();
      applyWindowFocusedFlag(document.documentElement.dataset, true);
    }
  });

  it("park guard load()s a remounted wallpaper video while parked", async () => {
    document.documentElement.setAttribute("data-wallpaper-parked", "1");
    const loadOrig = HTMLMediaElement.prototype.load;
    const loads: string[] = [];
    HTMLMediaElement.prototype.load = function load() {
      loads.push(this.className);
      return loadOrig.call(this);
    };
    const stop = installWallpaperParkGuard(document);
    const layer = document.createElement("div");
    layer.className = "app-wallpaper-media";
    const wall = document.createElement("video");
    wall.className = "app-wallpaper-media__el";
    wall.setAttribute("src", "blob:http://tauri.localhost/remount");
    try {
      layer.appendChild(wall);
      document.body.append(layer);
      await Promise.resolve();
      await Promise.resolve();
      expect(loads).toEqual(["app-wallpaper-media__el"]);
    } finally {
      HTMLMediaElement.prototype.load = loadOrig;
      stop();
      layer.remove();
      document.documentElement.removeAttribute("data-wallpaper-parked");
    }
  });
});
