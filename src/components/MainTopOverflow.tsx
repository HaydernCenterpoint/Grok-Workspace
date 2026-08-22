/**
 * Codex top bar: keep status visible, park extra chrome behind More.
 */
import { useState, type ReactNode } from "react";
import { ContextMenu } from "@/components/ContextMenu";
import { IconMenu } from "@/components/icons";
import { Tip } from "@/components/ui/tooltip";
import type { WorkbenchChrome } from "@/lib/workbenchChrome";

export type MainTopOverflowItem = {
  id: string;
  label: string;
  onClick: () => void;
};

export type MainTopOverflowProps = {
  chrome: WorkbenchChrome;
  moreLabel: string;
  status: ReactNode;
  /** Stay visible in Codex (compact workspace chips). */
  pinned?: ReactNode;
  extras: ReactNode;
  overflowItems: MainTopOverflowItem[];
};

export function MainTopOverflow({
  chrome,
  moreLabel,
  status,
  pinned,
  extras,
  overflowItems,
}: MainTopOverflowProps) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  if (chrome === "classic") {
    return (
      <div className="main__top-actions">
        {status}
        {pinned}
        {extras}
      </div>
    );
  }

  return (
    <div className="main__top-actions main__top-actions--codex">
      {status}
      {pinned}
      <div className="main__chrome-overflow-slot">{extras}</div>
      <Tip label={moreLabel}>
        <button
          type="button"
          className="chrome-btn main__chrome-more"
          aria-label={moreLabel}
          aria-haspopup="menu"
          aria-expanded={menu != null}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setMenu({ x: r.left, y: r.bottom + 4 });
          }}
        >
          <IconMenu size={16} />
        </button>
      </Tip>
      <ContextMenu
        open={menu != null}
        x={menu?.x ?? 0}
        y={menu?.y ?? 0}
        onClose={() => setMenu(null)}
        items={overflowItems.map((item) => ({
          id: item.id,
          label: item.label,
          onClick: item.onClick,
        }))}
      />
    </div>
  );
}
