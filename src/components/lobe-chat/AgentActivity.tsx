import { memo } from "react";
/**
 * Mid-stream tool activity — Grok icon + one-line title.
 */

import type { Locale } from "@/i18n";
import type { ChatMessage } from "@/lib/session";
import { toolStepDisplayTitle } from "@/lib/session";
import { EndOfTurnChip } from "./EndOfTurnChip";
import { ToolGrid } from "./ActivityLoaders";

export {
  isToolStepMessage,
  isFailedToolStepMessage,
  pickLatestTurnTool,
  pickRunningTurnTool,
  toolStepDisplayTitle,
} from "@/lib/session";

export const LiveToolText = memo(function LiveToolText({
  message,
  locale: _locale,
}: {
  message: ChatMessage;
  locale: Locale;
}) {
  const title = toolStepDisplayTitle(message);
  if (!title) return null;

  return (
    <div
      className="grok-act__step is-running is-last"
      role="status"
      aria-live="polite"
      data-tool-id={message.toolCallId}
      title={message.toolDetail || message.toolPath || title}
    >
      <div className="grok-act__icon-col" aria-hidden>
        <span className="grok-act__icon">
          <ToolGrid />
        </span>
      </div>
      <span className="grok-act__label">{title}</span>
    </div>
  );
});

/** @deprecated Prefer EndOfTurnChip */
export function TurnCancelledRow({
  message,
  locale,
}: {
  message: ChatMessage;
  locale: Locale;
}) {
  return <EndOfTurnChip message={message} locale={locale} />;
}
