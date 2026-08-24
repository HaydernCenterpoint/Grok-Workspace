/**
 * The boot splash paints before the JS bundle loads. It is logo-only —
 * no welcome title / detecting copy, and no BOOT_COPY table to drift.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const INDEX_HTML = resolve(__dirname, "../../index.html");

describe("boot splash", () => {
  const html = readFileSync(INDEX_HTML, "utf8");

  it("is the Grok mark only — no welcome or detecting copy", () => {
    expect(html).toContain("grok-logo-loader");
    expect(html).toContain("grok-logo-sheen");
    expect(html).not.toContain("boot-title");
    expect(html).not.toContain("boot-subtitle");
    expect(html).not.toContain("boot-logo");
    expect(html).not.toContain("var BOOT_COPY");
    expect(html).not.toContain("欢迎使用");
    expect(html).not.toContain("Welcome to Grok");
    expect(html).not.toContain("Checking Grok Build");
  });

  it("defaults html lang to English (unshipped zh does not paint first)", () => {
    expect(html).toMatch(/<html\b[^>]*\blang="en"/);
    expect(html).not.toMatch(/lang="zh-CN"/);
  });

  it("parks the boot sheen when the document is hidden", () => {
    expect(html).toContain("data-splash-park");
    expect(html).toContain("visibilitychange");
  });
});
