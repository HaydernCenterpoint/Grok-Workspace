import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { MainTopOverflow } from "./MainTopOverflow";

describe("MainTopOverflow", () => {
  it("shows extras inline in classic chrome", () => {
    const html = renderToString(
      <MainTopOverflow
        chrome="classic"
        moreLabel="More"
        status={<span>status</span>}
        pinned={<span>pinned</span>}
        extras={<span>extras</span>}
        overflowItems={[]}
      />,
    );
    expect(html).toContain("status");
    expect(html).toContain("pinned");
    expect(html).toContain("extras");
    expect(html).not.toContain("main__chrome-more");
  });

  it("parks extras behind More in Codex chrome", () => {
    const html = renderToString(
      <MainTopOverflow
        chrome="codex"
        moreLabel="More"
        status={<span>status</span>}
        pinned={<span>pinned</span>}
        extras={<span>extras</span>}
        overflowItems={[
          { id: "aside", label: "Hide tools", onClick: vi.fn() },
        ]}
      />,
    );
    expect(html).toContain("main__top-actions--codex");
    expect(html).toContain("main__chrome-more");
    expect(html).toContain("main__chrome-overflow-slot");
    expect(html).toContain("status");
    expect(html).toContain("pinned");
  });
});
