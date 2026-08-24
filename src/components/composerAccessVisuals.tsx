import {
  IconBolt,
  IconFileDiff,
  IconGrokMark,
  IconHandStop,
  IconShield,
  IconStop,
} from "@/components/icons";
import { type PermissionPolicyId } from "@/lib/grokCatalog";
import { policyToCliPermissionMode } from "@/lib/permissionModeMap";

export function asPermissionPolicyId(id: string): PermissionPolicyId {
  switch (id) {
    case "ask":
    case "accept_edits":
    case "allow_for_session":
    case "auto":
    case "dont_ask":
    case "always_approve":
      return id;
    default:
      return "ask";
  }
}

/** ChatGPT-style triad in the composer sheet. */
export const COMPOSER_PRIMARY_POLICIES: readonly PermissionPolicyId[] = [
  "ask",
  "allow_for_session",
  "always_approve",
];

export function composerPolicyIcon(id: PermissionPolicyId, size = 18) {
  switch (id) {
    case "ask":
      return <IconHandStop size={size} />;
    case "accept_edits":
      return <IconFileDiff size={size} />;
    case "allow_for_session":
      return <IconShield size={size} />;
    case "auto":
      return <IconBolt size={size} />;
    case "dont_ask":
      return <IconStop size={size} />;
    case "always_approve":
      return <IconGrokMark size={size} title="Grok" />;
    default: {
      const _never: never = id;
      return _never;
    }
  }
}

export function composerPolicyCliMode(id: string) {
  return policyToCliPermissionMode(id);
}
