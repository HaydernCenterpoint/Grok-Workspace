/**
 * Send a Studio (or chat) image/video into a Build or Office draft.
 */

import { pathBasename, type Attachment } from "@/lib/attachments";
import type { WorkMode } from "@/lib/grokOffice";

export type MediaHandoffTarget = "code" | "office";

export function isMediaHandoffTarget(
  value: unknown,
): value is MediaHandoffTarget {
  return value === "code" || value === "office";
}

/** Surfaces that can receive the current media (never the one already open). */
export function mediaHandoffTargets(
  from: WorkMode,
): readonly MediaHandoffTarget[] {
  switch (from) {
    case "studio":
      return ["code", "office"];
    case "code":
      return ["office"];
    case "office":
      return ["code"];
    default: {
      const _never: never = from;
      return _never;
    }
  }
}

export function attachmentFromMediaPath(
  path: string,
  name?: string,
): Attachment | null {
  const p = path.trim();
  if (!p) return null;
  return {
    path: p,
    name: (name ?? pathBasename(p)).trim() || pathBasename(p),
    isDir: false,
  };
}
