/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createT } from "@/i18n";
import "@/test/jsdomStubs";
import {
  SetupAppearance,
  setupUiFontOptions,
} from "@/components/SetupAppearance";

vi.mock("@/providers/ThemeProvider", () => ({
  useThemeShell: () => ({
    themePreference: "dark",
    applyThemeChoice: vi.fn(),
    skin: "default",
    applySkinChoice: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
});

describe("setupUiFontOptions", () => {
  it("puts system default first and keeps a custom family", () => {
    const opts = setupUiFontOptions("Comic Sans MS", "System default");
    expect(opts[0]).toEqual({ value: "", label: "System default" });
    expect(opts.some((row) => row.value === "Comic Sans MS")).toBe(true);
    expect(opts.some((row) => row.value === "Segoe UI")).toBe(true);
  });

  it("does not duplicate a listed family", () => {
    const opts = setupUiFontOptions("Georgia", "System default");
    expect(opts.filter((row) => row.value === "Georgia")).toHaveLength(1);
  });
});

describe("SetupAppearance", () => {
  it("renders theme, accent, font, and size controls", () => {
    const onContinue = vi.fn();
    render(<SetupAppearance tr={createT("en")} onContinue={onContinue} />);
    expect(screen.getByTestId("setup-appearance")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Light" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Dark" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "System" })).toBeTruthy();
    expect(screen.getByRole("listbox", { name: "Accent" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
