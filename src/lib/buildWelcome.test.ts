import { describe, expect, it } from "vitest";
import {
  BUILD_WELCOME_KINDS,
  buildWelcomeSeedKey,
  type BuildWelcomeKind,
} from "./buildWelcome";

describe("buildWelcomeSeedKey", () => {
  it("keeps the four Grok Build starters in display order", () => {
    expect(BUILD_WELCOME_KINDS).toEqual([
      "explore",
      "feature",
      "review",
      "fix",
    ]);
  });

  it("names the bound Build folder in every seed", () => {
    const named: Record<BuildWelcomeKind, string> = {
      explore: "composer.buildWelcomeExploreNamed",
      feature: "composer.buildWelcomeFeatureNamed",
      review: "composer.buildWelcomeReviewNamed",
      fix: "composer.buildWelcomeFixNamed",
    };
    const generic: Record<BuildWelcomeKind, string> = {
      explore: "composer.buildWelcomeExplore",
      feature: "composer.buildWelcomeFeature",
      review: "composer.buildWelcomeReview",
      fix: "composer.buildWelcomeFix",
    };
    for (const kind of BUILD_WELCOME_KINDS) {
      expect(buildWelcomeSeedKey(kind, true)).toBe(named[kind]);
      expect(buildWelcomeSeedKey(kind, false)).toBe(generic[kind]);
    }
  });
});
