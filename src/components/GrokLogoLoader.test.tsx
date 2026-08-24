/**
 * @vitest-environment jsdom
 */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GrokLogoLoader } from "./GrokLogoLoader";

beforeEach(() => {
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("GrokLogoLoader", () => {
  it("parks the sheen when the probe is idle (timeout / Welcome)", () => {
    const { container } = render(
      <GrokLogoLoader label="Startup check timed out" active={false} />,
    );
    const el = container.querySelector(".grok-logo-loader");
    expect(el).toBeTruthy();
    expect(el?.classList.contains("is-active")).toBe(false);
    expect(el?.getAttribute("aria-busy")).toBeNull();
  });

  it("sheens while the probe is requested and the window is foreground", () => {
    const { container } = render(
      <GrokLogoLoader label="Checking Grok Build" active />,
    );
    const el = container.querySelector(".grok-logo-loader");
    expect(el?.classList.contains("is-active")).toBe(true);
    expect(el?.getAttribute("aria-busy")).toBe("true");
  });

  it("parks the sheen when the window blurs", () => {
    const { container } = render(
      <GrokLogoLoader label="Checking Grok Build" active />,
    );
    expect(
      container.querySelector(".grok-logo-loader")?.classList.contains("is-active"),
    ).toBe(true);
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(
      container.querySelector(".grok-logo-loader")?.classList.contains("is-active"),
    ).toBe(false);
  });
});
