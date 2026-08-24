/**
 * Grok Build welcome starters — four underlined rows under the logo + slogan.
 * Clicking a row seeds the composer; the ACP agent still does the work.
 * No card frames. Office keeps its own start list.
 */

import { useMemo } from "react";
import { createT, type Locale } from "@/i18n";
import {
  IconDoctor,
  IconFileDiff,
  IconSearch,
  IconSparkles,
} from "@/components/icons";
import {
  BUILD_WELCOME_KINDS,
  type BuildWelcomeKind,
} from "@/lib/buildWelcome";

export type BuildWelcomeProps = {
  locale: Locale | string;
  onStart: (kind: BuildWelcomeKind) => void;
};

const LABEL_KEYS = {
  explore: "build.welcome.explore",
  feature: "build.welcome.feature",
  review: "build.welcome.review",
  fix: "build.welcome.fix",
} as const;

function kindIcon(kind: BuildWelcomeKind) {
  switch (kind) {
    case "explore":
      return <IconSearch size={16} />;
    case "feature":
      return <IconSparkles size={16} />;
    case "review":
      return <IconFileDiff size={16} />;
    case "fix":
      return <IconDoctor size={16} />;
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

export function BuildWelcome({ locale, onStart }: BuildWelcomeProps) {
  const tr = useMemo(() => createT(locale as Locale), [locale]);

  return (
    <ul className="build-welcome" aria-label={tr("build.welcome.aria")}>
      {BUILD_WELCOME_KINDS.map((kind) => (
        <li key={kind}>
          <button
            type="button"
            className="build-welcome__row"
            data-kind={kind}
            onClick={() => onStart(kind)}
          >
            <span className="build-welcome__icon" aria-hidden>
              {kindIcon(kind)}
            </span>
            <span className="build-welcome__label">{tr(LABEL_KEYS[kind])}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
