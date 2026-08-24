/**
 * Isolated busy chrome for a sidebar session row.
 * Subscribes only to busy membership (not full liveMap tool-title ticks).
 */

import { memo } from "react";
import { Tip } from "@/components/ui/tooltip";
import { useIsSessionBusy } from "@/hooks/useSessionLiveMap";
import { ReasoningDots } from "@/components/lobe-chat/ActivityLoaders";

/** Visible working 3-dot chip for a session row. */
export const SidebarSessionBusySpinner = memo(
  function SidebarSessionBusySpinner({
    sessionId,
    label,
  }: {
    sessionId: string;
    label: string;
  }) {
    const working = useIsSessionBusy(sessionId);
    if (!working) return null;
    return (
      <Tip label={label}>
        <span
          className="tree-l3__status"
          data-testid="sidebar-session-busy"
          aria-label={label}
        >
          <ReasoningDots className="tree-l3__spinner" />
        </span>
      </Tip>
    );
  },
);

export { useIsSessionBusy };
