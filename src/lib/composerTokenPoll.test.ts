import { describe, expect, it } from "vitest";
import {
  COMPOSER_TOKEN_POLL_BURST_FRAMES,
  composerTokenEventShouldKick,
  nextComposerTokenPollBurst,
} from "./composerTokenPoll";

describe("composerTokenPoll", () => {
  it("parks while hidden even if the composer is focused", () => {
    expect(
      composerTokenEventShouldKick({
        hidden: true,
        composerActive: true,
        slashPresent: true,
        atPresent: false,
      }),
    ).toBe(false);
  });

  it("kicks while the composer is active or a token menu is open", () => {
    expect(
      composerTokenEventShouldKick({
        hidden: false,
        composerActive: true,
        slashPresent: false,
        atPresent: false,
      }),
    ).toBe(true);
    expect(
      composerTokenEventShouldKick({
        hidden: false,
        composerActive: false,
        slashPresent: true,
        atPresent: false,
      }),
    ).toBe(true);
    expect(
      composerTokenEventShouldKick({
        hidden: false,
        composerActive: false,
        slashPresent: false,
        atPresent: true,
      }),
    ).toBe(true);
    expect(
      composerTokenEventShouldKick({
        hidden: false,
        composerActive: false,
        slashPresent: false,
        atPresent: false,
      }),
    ).toBe(false);
  });

  it("keeps the longer burst window", () => {
    expect(nextComposerTokenPollBurst(0, COMPOSER_TOKEN_POLL_BURST_FRAMES)).toBe(
      COMPOSER_TOKEN_POLL_BURST_FRAMES,
    );
    expect(nextComposerTokenPollBurst(3, 1)).toBe(3);
  });
});
