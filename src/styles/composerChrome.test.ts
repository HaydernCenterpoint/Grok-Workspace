import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

describe("shared composer chrome", () => {
  it("darkens the model pill and keeps project / toolbar contrast tokens", () => {
    const composer = readFileSync(join(here, "chat.part2.css"), "utf8");
    const model = readFileSync(join(here, "composer.part1.css"), "utf8");
    const row = readFileSync(join(here, "chat.part4.css"), "utf8");
    const menus = readFileSync(join(here, "chat.part6.css"), "utf8");

    expect(composer).toContain("--composer-model-pill-bg");
    expect(composer).toContain(
      ".composer__context-bar .composer__context-item--project",
    );
    expect(model).toContain("var(--composer-model-pill-bg");
    expect(model).toContain(".cmm--model .cmm__trigger");
    expect(row).toContain(".composer__row .icon-btn--plus");
    expect(row).toContain(".composer__row .icon-btn--skills");
    expect(menus).toContain(".cmm--model .cmm__trigger-text--short");
  });
});
