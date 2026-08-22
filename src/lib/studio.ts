/**
 * Grok Studio — Imagine image / video on a dedicated surface.
 * Host calls official-aux image_gen (+ image_to_video). No second agent.
 */

import {
  officialAuxDispatch,
  officialAuxEnsureHome,
  wallpaperImagine,
} from "@/lib/api";

export type StudioKind = "image" | "video";
export type StudioResolution = "480p" | "720p" | "1080p";
export type StudioDuration = 6 | 10 | 15;

export const STUDIO_ASPECTS = [
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "2:3",
  "3:2",
] as const;

export type StudioAspect = (typeof STUDIO_ASPECTS)[number];

export type StudioItem = {
  id: string;
  kind: StudioKind;
  path: string;
  prompt: string;
};

export type StudioGenerateInput = {
  prompt: string;
  kind: StudioKind;
  aspect: StudioAspect;
  resolution: StudioResolution;
  duration: StudioDuration;
};

export type StudioErrorCode = "empty" | "auth" | "cli" | "failed";

const MEDIA_EXT = /\.(png|jpe?g|webp|gif|bmp|mp4|webm|mov)$/i;

export function nextStudioAspect(current: string): StudioAspect {
  const i = STUDIO_ASPECTS.indexOf(current as StudioAspect);
  return STUDIO_ASPECTS[(i + 1) % STUDIO_ASPECTS.length] ?? "1:1";
}

function looksAbsMedia(path: string): boolean {
  const p = path.trim();
  if (!MEDIA_EXT.test(p)) return false;
  if (/^[A-Za-z]:[\\/]/.test(p)) return true;
  if (p.startsWith("\\\\") || p.startsWith("//")) return true;
  return p.startsWith("/") && p.split("/").filter(Boolean).length >= 2;
}

/** First absolute image/video path in official-aux markdown. */
export function extractStudioMediaPath(text: string): string | null {
  const raw = (text || "").replace(/\r/g, "");
  for (const part of raw.split("`")) {
    const p = part.trim().replace(/^file:\/\//i, "");
    if (looksAbsMedia(p)) return p;
  }
  const win = raw.match(
    /[A-Za-z]:[\\/][^\s`"']+\.(?:png|jpe?g|webp|gif|bmp|mp4|webm|mov)/i,
  );
  if (win?.[0] && looksAbsMedia(win[0])) return win[0];
  const posix = raw.match(
    /\/(?:Users|home|tmp|var|opt|data)\/[^\s`"']+\.(?:png|jpe?g|webp|gif|bmp|mp4|webm|mov)/i,
  );
  if (posix?.[0] && looksAbsMedia(posix[0])) return posix[0];
  return null;
}

export function classifyStudioError(err: unknown): StudioErrorCode {
  const s = (err instanceof Error ? err.message : String(err || "")).toLowerCase();
  if (!s.trim()) return "failed";
  if (s.includes("empty prompt") || s === "empty") return "empty";
  if (
    s.includes("auth") ||
    s.includes("login") ||
    s.includes("credential") ||
    s.includes("sign in")
  ) {
    return "auth";
  }
  if (s.includes("cli") || s.includes("not found") || s.includes("cli_missing")) {
    return "cli";
  }
  return "failed";
}

function itemId(path: string): string {
  return `${path}:${Date.now()}`;
}

async function generateStill(
  prompt: string,
  aspect: StudioAspect,
): Promise<string> {
  await officialAuxEnsureHome();
  try {
    const text = await officialAuxDispatch("image_gen", {
      prompt,
      aspectRatio: aspect,
    });
    const path = extractStudioMediaPath(text);
    if (path) return path;
  } catch (err) {
    const fallback = await wallpaperImagine(prompt, aspect);
    const path = fallback.items.find((it) => it.localPath)?.localPath;
    if (path) return path;
    throw err;
  }
  const fallback = await wallpaperImagine(prompt, aspect);
  const path = fallback.items.find((it) => it.localPath)?.localPath;
  if (path) return path;
  throw new Error("imagine_failed");
}

/** Agent-only wrap. The journal keeps the user’s prompt. */
export function wrapStudioAgentText(
  userText: string,
  opts: {
    kind: StudioKind;
    aspect: StudioAspect;
    resolution: StudioResolution;
    duration: StudioDuration;
  },
): string {
  const body = userText.trim();
  if (opts.kind === "video") {
    return `${body}

[Grok Studio] Generate a short video for the prompt above.
1. Call image_gen with aspect_ratio ${opts.aspect}.
2. Then call image_to_video on that image (duration ${opts.duration}, resolution_name ${opts.resolution}).
3. Report each absolute output path. Do not invent paths. Do not draw with code.`;
  }
  return `${body}

[Grok Studio] Generate an image for the prompt above.
Call image_gen with aspect_ratio ${opts.aspect}.
Report the absolute path. Do not invent paths. Do not draw with code.`;
}

export async function generateStudioMedia(
  input: StudioGenerateInput,
): Promise<StudioItem> {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("empty");
  const still = await generateStill(prompt, input.aspect);
  if (input.kind === "image") {
    return { id: itemId(still), kind: "image", path: still, prompt };
  }
  const text = await officialAuxDispatch("image_to_video", {
    image: still,
    prompt,
    duration: input.duration,
    resolutionName: input.resolution,
  });
  const video = extractStudioMediaPath(text);
  if (!video) throw new Error("imagine_failed");
  return { id: itemId(video), kind: "video", path: video, prompt };
}
