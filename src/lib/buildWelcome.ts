/**
 * Grok Build empty-chat starters. Cards seed the composer; the ACP agent
 * still does the work. Not an Office / Studio switcher.
 */

export type BuildWelcomeKind = "explore" | "feature" | "review" | "fix";

export const BUILD_WELCOME_KINDS: readonly BuildWelcomeKind[] = [
  "explore",
  "feature",
  "review",
  "fix",
] as const;

export type BuildWelcomeSeedKey =
  | "composer.buildWelcomeExplore"
  | "composer.buildWelcomeExploreNamed"
  | "composer.buildWelcomeFeature"
  | "composer.buildWelcomeFeatureNamed"
  | "composer.buildWelcomeReview"
  | "composer.buildWelcomeReviewNamed"
  | "composer.buildWelcomeFix"
  | "composer.buildWelcomeFixNamed";

/** Composer seed for a starter. Named keys only when a real Build folder is bound. */
export function buildWelcomeSeedKey(
  kind: BuildWelcomeKind,
  hasBuildProject: boolean,
): BuildWelcomeSeedKey {
  switch (kind) {
    case "explore":
      return hasBuildProject
        ? "composer.buildWelcomeExploreNamed"
        : "composer.buildWelcomeExplore";
    case "feature":
      return hasBuildProject
        ? "composer.buildWelcomeFeatureNamed"
        : "composer.buildWelcomeFeature";
    case "review":
      return hasBuildProject
        ? "composer.buildWelcomeReviewNamed"
        : "composer.buildWelcomeReview";
    case "fix":
      return hasBuildProject
        ? "composer.buildWelcomeFixNamed"
        : "composer.buildWelcomeFix";
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}
