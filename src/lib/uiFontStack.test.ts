import { describe, expect, it } from "vitest";
import {
  INTER_VARIABLE_FAMILY,
  resolveUiSansFamily,
  UI_SANS_STACK,
  UNIVERSAL_SANS_FAMILY,
} from "./uiFontStack";

describe("uiFontStack", () => {
  it("maps Settings labels onto Inter Variable", () => {
    expect(resolveUiSansFamily("")).toBe("");
    expect(resolveUiSansFamily("Inter")).toBe(INTER_VARIABLE_FAMILY);
    expect(resolveUiSansFamily("inter variable")).toBe(INTER_VARIABLE_FAMILY);
    expect(resolveUiSansFamily("Universal Sans")).toBe(UNIVERSAL_SANS_FAMILY);
    expect(resolveUiSansFamily("Georgia")).toBe("Georgia");
  });

  it("lists bundled Inter first", () => {
    expect(UI_SANS_STACK.startsWith(`"${INTER_VARIABLE_FAMILY}"`)).toBe(true);
  });
});
