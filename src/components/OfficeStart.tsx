/**
 * Grok Office start surface — daily-work starters above the composer.
 * Rows, not a card grid: picking one seeds the composer; the ACP agent still
 * does the work. Grok Build keeps its own welcome.
 */

import { useMemo } from "react";
import { createT, type Locale } from "@/i18n";
import {
  IconChevronRight,
  IconFileText,
  IconPresentation,
  IconTable,
} from "@/components/icons";
import { OFFICE_START_KINDS, type OfficeStartKind } from "@/lib/grokOffice";

export type OfficeStartProps = {
  locale: Locale | string;
  /** Named Grok Build folder carried into Office. */
  projectName?: string | null;
  onStart: (kind: OfficeStartKind) => void;
};

const LABEL_KEYS = {
  report: "office.start.report",
  slides: "office.start.slides",
  sheet: "office.start.sheet",
} as const;

function kindIcon(kind: OfficeStartKind) {
  switch (kind) {
    case "report":
      return <IconFileText size={16} />;
    case "slides":
      return <IconPresentation size={16} />;
    case "sheet":
      return <IconTable size={16} />;
  }
}

export function OfficeStart({
  locale,
  projectName = null,
  onStart,
}: OfficeStartProps) {
  const tr = useMemo(() => createT(locale as Locale), [locale]);
  const name = (projectName || "").trim();

  return (
    <div className="office-start">
      <h2 className="office-start__title">
        {name
          ? tr("office.startTitleFromBuild", { name })
          : tr("office.startTitle")}
      </h2>
      <ul className="office-start__list">
        {OFFICE_START_KINDS.map((kind) => (
          <li key={kind}>
            <button
              type="button"
              className="office-start__row"
              onClick={() => onStart(kind)}
            >
              <span className="office-start__icon" aria-hidden>
                {kindIcon(kind)}
              </span>
              <span className="office-start__label">{tr(LABEL_KEYS[kind])}</span>
              <IconChevronRight size={14} className="office-start__go" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
