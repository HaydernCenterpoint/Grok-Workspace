/**
 * Full-bleed wallpaper media with pan/zoom focus (+ optional video clip).
 *
 * Layout is absolute (not object-fit alone) so focus works for video without
 * re-encoding. Video in/out is applied by seeking — source never truncated.
 *
 * Flash avoidance: prefer intrinsicSize from meta; stay invisible until layout
 * is ready (no cover→absolute jump).
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { WallpaperClip, WallpaperKind } from "@/lib/themeSkin";
import {
  DEFAULT_WALLPAPER_FOCUS,
  enforceVideoClip,
  normalizeWallpaperFocus,
  wallpaperMediaLayout,
  type WallpaperFocus,
} from "@/lib/themeSkin";
import {
  releaseWallpaperVideoElement,
  shouldParkWallpaperVideo,
  shouldPlayWallpaperVideo,
} from "@/lib/streamRenderPolicy";
import { readWallpaperVideoEnv } from "@/lib/wallpaperPark";
import { subscribeWindowFocused } from "@/lib/windowFocusFlag";

export type WallpaperMediaSize = { w: number; h: number };

export type WallpaperMediaLayerProps = {
  url: string;
  kind: WallpaperKind;
  focus?: WallpaperFocus | null;
  /** Video in/out (seconds). Omitted / null = full loop. */
  clip?: WallpaperClip | null;
  /**
   * Known natural size from wallpaper meta. When present, focus layout is
   * computed immediately — critical for video to avoid a proportion flash.
   */
  intrinsicSize?: WallpaperMediaSize | null;
  className?: string;
  mediaClassName?: string;
  /** Fired once when natural size is first measured (for meta backfill). */
  onIntrinsicSize?: (size: WallpaperMediaSize) => void;
};

function validSize(s: WallpaperMediaSize | null | undefined): s is WallpaperMediaSize {
  return !!s && s.w > 0 && s.h > 0 && Number.isFinite(s.w) && Number.isFinite(s.h);
}

function playWallpaperVideo(el: HTMLVideoElement): void {
  try {
    const pending = el.play();
    if (pending && typeof pending.catch === "function") {
      void pending.catch(() => {});
    }
  } catch {
    /* jsdom / autoplay policy */
  }
}

export function WallpaperMediaLayer({
  url,
  kind,
  focus,
  clip = null,
  intrinsicSize = null,
  className = "app-wallpaper-media",
  mediaClassName = "app-wallpaper-media__el",
  onIntrinsicSize,
}: WallpaperMediaLayerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLVideoElement | HTMLImageElement | null>(null);
  const reportedSizeRef = useRef<string | null>(null);
  const clipRef = useRef<WallpaperClip | null>(clip);

  const [view, setView] = useState<WallpaperMediaSize>({ w: 0, h: 0 });
  const [media, setMedia] = useState<WallpaperMediaSize>(() =>
    validSize(intrinsicSize) ? { w: intrinsicSize.w, h: intrinsicSize.h } : { w: 0, h: 0 },
  );
  const [videoParked, setVideoParked] = useState(() =>
    shouldParkWallpaperVideo(readWallpaperVideoEnv()),
  );
  // Release src+load while the node is still mounted, then unmount.
  // Unmount-with-src-set leaves WebView2 at play-level CPU/GPU.
  const [videoReleased, setVideoReleased] = useState(videoParked);

  const f = normalizeWallpaperFocus(focus ?? DEFAULT_WALLPAPER_FOCUS);
  clipRef.current = clip ?? null;

  // Seed / refresh from meta when the source changes.
  useLayoutEffect(() => {
    if (validSize(intrinsicSize)) {
      setMedia({ w: intrinsicSize.w, h: intrinsicSize.h });
    } else {
      setMedia({ w: 0, h: 0 });
    }
    reportedSizeRef.current = null;
  }, [url, intrinsicSize?.w, intrinsicSize?.h]);

  // Measure container before paint to avoid a 0→real view flash.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const apply = (w: number, h: number) => {
      setView((prev) => {
        if (Math.abs(prev.w - w) < 0.5 && Math.abs(prev.h - h) < 0.5) return prev;
        return { w, h };
      });
    };
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      apply(cr.width, cr.height);
    });
    const sync = () => {
      ro.disconnect();
      if (document.visibilityState === "hidden") return;
      apply(el.clientWidth, el.clientHeight);
      ro.observe(el);
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      ro.disconnect();
    };
  }, []);

  const publishSize = useCallback(
    (w: number, h: number) => {
      if (!(w > 0 && h > 0)) return;
      setMedia((prev) => {
        if (prev.w === w && prev.h === h) return prev;
        return { w, h };
      });
      const key = `${w}x${h}`;
      if (reportedSizeRef.current === key) return;
      reportedSizeRef.current = key;
      if (
        !validSize(intrinsicSize) ||
        intrinsicSize.w !== w ||
        intrinsicSize.h !== h
      ) {
        onIntrinsicSize?.({ w, h });
      }
    },
    [intrinsicSize, onIntrinsicSize],
  );

  const onReady = useCallback(() => {
    const el = mediaRef.current;
    if (!el) return;
    if (el instanceof HTMLVideoElement) {
      publishSize(el.videoWidth, el.videoHeight);
      const c = clipRef.current;
      if (c && Number.isFinite(c.start)) {
        try {
          el.currentTime = c.start;
        } catch {
          /* ignore */
        }
      }
      return;
    }
    publishSize(el.naturalWidth, el.naturalHeight);
  }, [publishSize]);

  useLayoutEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    if (el instanceof HTMLVideoElement) {
      if (el.readyState >= 1 && el.videoWidth > 0) {
        publishSize(el.videoWidth, el.videoHeight);
      }
      return;
    }
    if (el.complete && el.naturalWidth > 0) {
      publishSize(el.naturalWidth, el.naturalHeight);
    }
  }, [url, publishSize]);

  // Clip loop: disable native loop when a range is set; seek on timeupdate.
  useEffect(() => {
    if (kind !== "video" || videoParked) return;
    const el = mediaRef.current;
    if (!(el instanceof HTMLVideoElement)) return;

    const c = clip;
    el.loop = !c;

    if (c) {
      const startAt = () => {
        try {
          if (el.currentTime < c.start - 0.05 || el.currentTime >= c.end) {
            el.currentTime = c.start;
          }
        } catch {
          /* ignore */
        }
      };
      startAt();
      const onTime = () => {
        if (el.paused) return;
        enforceVideoClip(el, c);
      };
      const onEnded = () => {
        try {
          el.currentTime = c.start;
          playWallpaperVideo(el);
        } catch {
          /* ignore */
        }
      };
      el.addEventListener("timeupdate", onTime);
      el.addEventListener("ended", onEnded);
      return () => {
        el.removeEventListener("timeupdate", onTime);
        el.removeEventListener("ended", onEnded);
      };
    }

    return undefined;
  }, [kind, clip, url, videoParked]);

  // Park: drop src + load() while mounted, then unmount. Stream-perf only pauses.
  useLayoutEffect(() => {
    if (kind !== "video") {
      if (videoReleased) setVideoReleased(false);
      return;
    }
    if (!videoParked) {
      if (videoReleased) setVideoReleased(false);
      return;
    }
    const el = mediaRef.current;
    if (el instanceof HTMLVideoElement) {
      releaseWallpaperVideoElement(el);
    }
    if (!videoReleased) setVideoReleased(true);
  }, [kind, videoParked, videoReleased]);

  useLayoutEffect(() => {
    const syncPark = () => {
      setVideoParked(shouldParkWallpaperVideo(readWallpaperVideoEnv()));
    };
    syncPark();
    document.addEventListener("visibilitychange", syncPark);
    window.addEventListener("focus", syncPark);
    window.addEventListener("blur", syncPark);
    const unsubHostFocus = subscribeWindowFocused(() => syncPark());
    const root = document.documentElement;
    const obs = new MutationObserver(syncPark);
    obs.observe(root, {
      attributes: true,
      attributeFilter: ["data-setup-gate", "data-window-focused"],
    });
    return () => {
      document.removeEventListener("visibilitychange", syncPark);
      window.removeEventListener("focus", syncPark);
      window.removeEventListener("blur", syncPark);
      unsubHostFocus();
      obs.disconnect();
    };
  }, [kind, url]);

  useEffect(() => {
    if (kind !== "video" || videoParked) return;
    const applyPlay = () => {
      const el = mediaRef.current;
      if (!(el instanceof HTMLVideoElement)) return;
      const play = shouldPlayWallpaperVideo(readWallpaperVideoEnv());
      if (play) {
        playWallpaperVideo(el);
        return;
      }
      try {
        if (!el.paused) el.pause();
      } catch {
        /* ignore */
      }
    };
    applyPlay();
    const root = document.documentElement;
    const obs = new MutationObserver(applyPlay);
    obs.observe(root, {
      attributes: true,
      attributeFilter: ["data-stream-perf"],
    });
    return () => {
      obs.disconnect();
    };
  }, [kind, url, videoParked]);

  const layout =
    media.w > 0 && media.h > 0 && view.w > 0 && view.h > 0
      ? wallpaperMediaLayout(media.w, media.h, view.w, view.h, f)
      : null;

  const ready = layout !== null;

  const style: CSSProperties = layout
    ? {
        position: "absolute",
        width: layout.width,
        height: layout.height,
        left: layout.left,
        top: layout.top,
        maxWidth: "none",
        objectFit: "fill",
        opacity: 1,
      }
    : {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        opacity: 0,
      };

  const showVideo = kind === "video" && !videoReleased;

  return (
    <div
      ref={rootRef}
      className={className + (ready ? " is-ready" : "")}
      data-wallpaper-parked={kind === "video" && videoParked ? "1" : undefined}
      aria-hidden
    >
      {showVideo ? (
        <video
          ref={(el) => {
            mediaRef.current = el;
          }}
          className={mediaClassName}
          src={videoParked ? "" : url}
          autoPlay
          muted
          loop={!clip}
          playsInline
          disablePictureInPicture
          preload="metadata"
          style={style}
          onLoadedMetadata={onReady}
          onLoadedData={onReady}
        />
      ) : kind !== "video" ? (
        <img
          ref={(el) => {
            mediaRef.current = el;
          }}
          className={mediaClassName}
          src={url}
          alt=""
          decoding="async"
          draggable={false}
          style={style}
          onLoad={onReady}
        />
      ) : null}
    </div>
  );
}
