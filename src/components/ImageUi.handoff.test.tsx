/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import "@/test/jsdomStubs";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImageUi } from "@/components/ImageUi";
import { MediaHandoffProvider } from "@/providers/MediaHandoffContext";

afterEach(cleanup);

const labels = {
  viewImage: "View image",
  copyImage: "Copy image",
  reveal: "Reveal in Explorer",
  copyPath: "Copy path",
};

describe("ImageUi media handoff", () => {
  it("opens the menu on left-click with Send to Build and Office from Studio", async () => {
    const user = userEvent.setup();
    const sendToSurface = vi.fn();
    render(
      <MediaHandoffProvider
        value={{
          workMode: "studio",
          label: (target) =>
            target === "code"
              ? "Send to Grok Build"
              : "Send to Grok Office",
          sendToSurface,
        }}
      >
        <ImageUi
          src="/tmp/tokyo.png"
          path="/tmp/tokyo.png"
          alt="Tokyo"
          labels={labels}
        />
      </MediaHandoffProvider>,
    );

    const frame = document.querySelector(".md-body__img-frame");
    expect(frame).toBeTruthy();
    await user.click(frame!);

    await user.click(
      screen.getByRole("menuitem", { name: "Send to Grok Build" }),
    );
    expect(sendToSurface).toHaveBeenCalledWith("code", {
      path: "/tmp/tokyo.png",
      name: "Tokyo",
    });
  });

  it("hides Send to Build when already on Build", async () => {
    const user = userEvent.setup();
    render(
      <MediaHandoffProvider
        value={{
          workMode: "code",
          label: (target) =>
            target === "code"
              ? "Send to Grok Build"
              : "Send to Grok Office",
          sendToSurface: vi.fn(),
        }}
      >
        <ImageUi
          src="/tmp/tokyo.png"
          path="/tmp/tokyo.png"
          labels={labels}
        />
      </MediaHandoffProvider>,
    );

    await user.click(document.querySelector(".md-body__img-frame")!);
    expect(
      screen.queryByRole("menuitem", { name: "Send to Grok Build" }),
    ).toBeNull();
    expect(
      screen.getByRole("menuitem", { name: "Send to Grok Office" }),
    ).toBeInTheDocument();
  });
});
