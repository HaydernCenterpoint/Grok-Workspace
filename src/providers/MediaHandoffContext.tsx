/**
 * Chat image/video menus can send the file into a Build or Office draft.
 */

import { createContext, useContext, type ReactNode } from "react";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { IconCode, IconFileText } from "@/components/icons";
import {
  mediaHandoffTargets,
  type MediaHandoffTarget,
} from "@/lib/mediaHandoff";
import type { WorkMode } from "@/lib/grokOffice";

export type MediaHandoffApi = {
  workMode: WorkMode;
  label: (target: MediaHandoffTarget) => string;
  sendToSurface: (
    target: MediaHandoffTarget,
    media: { path: string; name?: string },
  ) => void;
};

const MediaHandoffContext = createContext<MediaHandoffApi | null>(null);

export function MediaHandoffProvider({
  value,
  children,
}: {
  value: MediaHandoffApi;
  children: ReactNode;
}) {
  return (
    <MediaHandoffContext.Provider value={value}>
      {children}
    </MediaHandoffContext.Provider>
  );
}

export function useMediaHandoff(): MediaHandoffApi | null {
  return useContext(MediaHandoffContext);
}

/** Extra context-menu rows: Send to Grok Build / Grok Office. */
export function useMediaHandoffMenuItems(
  path?: string,
  name?: string,
): ContextMenuItem[] {
  const handoff = useMediaHandoff();
  const p = path?.trim();
  if (!handoff || !p) return [];
  const targets = mediaHandoffTargets(handoff.workMode);
  if (targets.length === 0) return [];
  return [
    { separator: true },
    ...targets.map((target) => ({
      id: `send-${target}`,
      label: handoff.label(target),
      icon:
        target === "code" ? (
          <IconCode size={16} />
        ) : (
          <IconFileText size={16} />
        ),
      onClick: () => handoff.sendToSurface(target, { path: p, name }),
    })),
  ];
}
