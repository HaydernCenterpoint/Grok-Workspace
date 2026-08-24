/**
 * Live slash/@ detection used to run a perpetual rAF (~60 Hz) for the
 * whole workbench lifetime. Drive scans from draft/caret events and a
 * short burst so Enter-SoT (DOM one frame behind) still lands.
 */

/** Extra frames after an editor event (DOM can lag the draft store). */
export const COMPOSER_TOKEN_POLL_BURST_FRAMES = 2;

export function nextComposerTokenPollBurst(
  prev: number,
  requested: number,
): number {
  return Math.max(prev, requested);
}

/** Whether a document-level caret/key event should scan slash/@ tokens. */
export function composerTokenEventShouldKick(opts: {
  hidden: boolean;
  composerActive: boolean;
  slashPresent: boolean;
  atPresent: boolean;
}): boolean {
  if (opts.hidden) return false;
  return opts.composerActive || opts.slashPresent || opts.atPresent;
}
