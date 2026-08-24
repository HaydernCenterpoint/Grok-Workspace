import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const lobePart3 = join(here, "../components/lobe-chat/lobe-chat.part3.css");
const thread = join(here, "../components/lobe-chat/ConversationThread.tsx");

describe("shared composer card measure", () => {
  it("defines --composer-width-max and Codex dock uses it", () => {
    const tokens = readFileSync(join(here, "tokens.css"), "utf8");
    expect(tokens).toContain("--composer-width-max: 52rem");
    const codex = readFileSync(join(here, "workbench-codex.css"), "utf8");
    expect(codex).toContain("max-width: min(100%, var(--composer-width-max))");
    expect(codex).not.toMatch(
      /\.composer-stack \{[\s\S]*max-width: var\(--chat-width-max/,
    );
  });

  it("pins Build / Office / Studio transcripts to the composer token", () => {
    const part3 = readFileSync(lobePart3, "utf8");
    expect(part3).toMatch(
      /html\[data-work-mode="code"\]\[data-chat-width\]/,
    );
    expect(part3).toMatch(
      /html\[data-work-mode="office"\]\[data-chat-width\]/,
    );
    expect(part3).toMatch(
      /html\[data-work-mode="studio"\]\[data-chat-width\]/,
    );
    expect(part3).toContain(
      "--chat-width-max: var(--composer-width-max, 52rem)",
    );
    expect(part3).toMatch(
      /html\[data-work-mode="code"\] \.lobe-chat__inner/,
    );
    expect(part3).toMatch(
      /html\[data-work-mode="office"\] \.lobe-chat__inner/,
    );
    expect(part3).toMatch(
      /html\[data-work-mode="studio"\] \.lobe-chat__inner/,
    );
    expect(part3).toContain(
      "max-width: min(100%, var(--composer-width-max, 52rem))",
    );
    expect(part3).toContain("margin-inline: auto");
  });

  it("Codex dock caps ConversationThread inner, not the unused conversation-content slot", () => {
    const codex = readFileSync(join(here, "workbench-codex.css"), "utf8");
    const src = readFileSync(thread, "utf8");
    expect(src).toContain('className="lobe-chat__inner"');
    expect(src).not.toContain('data-slot="conversation-content"');
    expect(codex).toMatch(
      /\.lobe-chat__inner,[\s\S]*\.messages__col \{[\s\S]*max-width: min\(100%, var\(--composer-width-max/,
    );
    expect(codex).not.toMatch(
      /\[data-slot="conversation-content"\]\s*\{/,
    );
  });
});
