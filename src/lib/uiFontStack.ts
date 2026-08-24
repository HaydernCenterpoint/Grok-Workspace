/**
 * Bundled UI sans is official Inter (SIL OFL) — same family as the
 * Google Fonts / rsms desktop zip (variable opsz + wght).
 * grok.com lists Inter as the first fallback after commercial
 * `universalSans`; we ship Inter because Family Type files cannot
 * be redistributed. Code / terminal stay mono.
 */

import { joinCssFontStack } from "@/lib/cssFontFamily";

export const INTER_VARIABLE_FAMILY = "Inter Variable";
export const INTER_LABEL = "Inter";
export const UNIVERSAL_SANS_FAMILY = "universalSans";

/** CSS font-family list for html / chat / share cards. */
export const UI_SANS_STACK = joinCssFontStack([
  INTER_VARIABLE_FAMILY,
  INTER_LABEL,
  UNIVERSAL_SANS_FAMILY,
  "Universal Sans",
  "Roboto",
  "Open Sans",
  "Arial",
  "Segoe UI",
  "PingFang SC",
  "Hiragino Sans",
  "Microsoft YaHei UI",
  "Yu Gothic UI",
  "Malgun Gothic",
  "ui-sans-serif",
  "system-ui",
  "sans-serif",
  "Apple Color Emoji",
  "Segoe UI Emoji",
  "Segoe UI Symbol",
  "Noto Color Emoji",
]);

/** Map Settings / setup labels onto bundled / grok.com family names. */
export function resolveUiSansFamily(family: string): string {
  const t = family.trim();
  if (!t) return "";
  if (/^inter( variable)?$/i.test(t)) return INTER_VARIABLE_FAMILY;
  if (/^universal\s*sans( display)?$/i.test(t) || /^universalsans(display)?$/i.test(t)) {
    return UNIVERSAL_SANS_FAMILY;
  }
  return t;
}
