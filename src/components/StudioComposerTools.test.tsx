/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import "@/test/jsdomStubs";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StudioComposerTools } from "@/components/StudioSurface";

afterEach(cleanup);

describe("StudioComposerTools aspect preview", () => {
  it("wires a preview pane for every ratio so hover can swap the layout", async () => {
    const user = userEvent.setup();
    render(
      <StudioComposerTools
        locale="en"
        kind="image"
        aspect="2:3"
        resolution="1080p"
        duration={6}
        onKind={vi.fn()}
        onAspect={vi.fn()}
        count={1}
        onResolution={vi.fn()}
        onDuration={vi.fn()}
        onCount={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Aspect ratio 2:3" }));

    const panes = document.querySelectorAll("[data-preview]");
    expect([...panes].map((el) => el.getAttribute("data-preview"))).toEqual([
      "2:3",
      "3:2",
      "4:3",
      "1:1",
      "9:16",
      "16:9",
      "21:9",
      "5:2",
      "3:4",
    ]);
    expect(document.querySelector('[data-preview="2:3"]')).toHaveClass(
      "is-selected",
    );
    expect(document.querySelector('[data-preview="16:9"]')).not.toHaveClass(
      "is-selected",
    );
    expect(screen.getByRole("menuitem", { name: /16:9/ })).toHaveAttribute(
      "data-ratio",
      "16:9",
    );
  });

  it("offers 1–4 images on Image and hides the chip on Video", async () => {
    const user = userEvent.setup();
    const onCount = vi.fn();
    const { rerender } = render(
      <StudioComposerTools
        locale="en"
        kind="image"
        aspect="2:3"
        resolution="1080p"
        duration={6}
        count={1}
        onKind={vi.fn()}
        onAspect={vi.fn()}
        onResolution={vi.fn()}
        onDuration={vi.fn()}
        onCount={onCount}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Images: 1" }));
    expect(screen.getByRole("menuitem", { name: "1 image" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "4 images" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "4 images" }));
    expect(onCount).toHaveBeenCalledWith(4);

    rerender(
      <StudioComposerTools
        locale="en"
        kind="video"
        aspect="2:3"
        resolution="1080p"
        duration={6}
        count={4}
        onKind={vi.fn()}
        onAspect={vi.fn()}
        onResolution={vi.fn()}
        onDuration={vi.fn()}
        onCount={onCount}
      />,
    );
    expect(screen.queryByRole("button", { name: /Images:/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Resolution" })).toBeInTheDocument();
  });
});
