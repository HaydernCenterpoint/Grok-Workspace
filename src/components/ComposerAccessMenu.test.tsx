import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import React from "react";
import { ComposerAccessMenu } from "@/components/ComposerModelMenu";
import {
  COMPOSER_PRIMARY_POLICIES,
  asPermissionPolicyId,
  composerPolicyCliMode,
} from "@/components/composerAccessVisuals";

const labels = {
  access: "Access",
  accessHint: "How should Grok actions be approved?",
  learnMore: "Learn more",
  permission: "Permission",
  policyAsk: "Ask for approval",
  policyAcceptEdits: "Accept edits",
  policySession: "Approve for me",
  policyAuto: "Auto",
  policyDontAsk: "Don't ask (deny)",
  policyYolo: "Full access",
  policyAskDesc: "Ask when needed",
  policyAcceptEditsDesc: "Auto-approve edits",
  policySessionDesc: "Session grant",
  policyAutoDesc: "Fewer prompts",
  policyDontAskDesc: "Deny tools",
  policyYoloDesc: "No prompts",
  policyShortAsk: "Ask",
  policyShortAccept: "Edits",
  policyShortSession: "Session",
  policyShortAuto: "Auto",
  policyShortDontAsk: "Deny",
  policyShortYolo: "Full",
};

describe("composerAccessVisuals", () => {
  it("keeps the ChatGPT triad first", () => {
    expect([...COMPOSER_PRIMARY_POLICIES]).toEqual([
      "ask",
      "allow_for_session",
      "always_approve",
    ]);
    expect(asPermissionPolicyId("nope")).toBe("ask");
    expect(composerPolicyCliMode("always_approve")).toBe("bypassPermissions");
  });
});

describe("ComposerAccessMenu", () => {
  it("renders a permission pill without Mode or Advanced chrome", () => {
    const html = renderToString(
      React.createElement(ComposerAccessMenu, {
        policy: "always_approve",
        labels,
        onPolicy: vi.fn(),
      }),
    );
    expect(html).toContain("cmm-run__pill");
    expect(html).toContain("Full access");
    expect(html).not.toContain("Permission:");
    expect(html).not.toContain("cmm__access-nav");
    expect(html).not.toContain("cmm__access-advanced");
  });
});
