import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ComposerDock } from "./ComposerDock";

describe("ComposerDock", () => {
  it("docks Codex chrome and skips the welcome mark", () => {
    const html = renderToString(
      <ComposerDock
        chrome="codex"
        welcome
        sideDock={false}
        welcomeMark={<span>welcome-mark</span>}
      >
        composer
      </ComposerDock>,
    );
    expect(html).toContain("composer-wrap--dock");
    expect(html).not.toContain("composer-wrap--float");
    expect(html).not.toContain("composer-wrap--welcome");
    expect(html).not.toContain("welcome-mark");
  });

  it("keeps the classic floating welcome card", () => {
    const html = renderToString(
      <ComposerDock
        chrome="classic"
        welcome
        sideDock={false}
        welcomeMark={<span>welcome-mark</span>}
      >
        composer
      </ComposerDock>,
    );
    expect(html).toContain("composer-wrap--float");
    expect(html).toContain("composer-wrap--welcome");
    expect(html).toContain("welcome-mark");
  });

  it("does not dock on phone even when chrome is Codex", () => {
    const html = renderToString(
      <ComposerDock chrome="codex" welcome sideDock={false} phone>
        composer
      </ComposerDock>,
    );
    expect(html).toContain("composer-wrap--float");
    expect(html).toContain("composer-wrap--welcome");
  });
});
