import { afterEach, describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ComposerSendCluster } from "./ComposerDraftChrome";
import { setDraft } from "@/lib/composerDraftStore";
import type { MessageKey } from "@/i18n";
import type { SessionState } from "@/lib/session";

afterEach(() => {
  setDraft("");
});

const tr = (key: MessageKey) => key;

const idleProps = {
  attachmentsLength: 0,
  effectiveCanStop: false,
  connecting: false,
  sessionState: "ready" as SessionState,
  effectiveCanSend: true,
  shouldEnqueue: false,
  canShowQueueButton: () => false,
  onSend: () => {},
  onStop: () => {},
  tr,
};

describe("ComposerSendCluster", () => {
  it("puts counter-rotating gimbal rings on the idle send button", () => {
    setDraft("hello");
    const html = renderToString(<ComposerSendCluster {...idleProps} />);
    expect(html).toContain("composer__send composer__send--gimbal");
    expect(html.match(/composer__send-gimbal__ring--(?:outer|inner)/g)?.length).toBe(
      2,
    );
  });

  it("does not put gimbal rings on queue or stop", () => {
    setDraft("hello");
    const html = renderToString(
      <ComposerSendCluster
        {...idleProps}
        effectiveCanStop
        canShowQueueButton={() => true}
      />,
    );
    expect(html).not.toContain("composer__send--gimbal");
    expect(html).not.toContain("composer__send-gimbal__ring");
  });
});
