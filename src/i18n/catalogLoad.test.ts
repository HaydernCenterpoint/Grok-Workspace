import { describe, expect, it } from "vitest";
import {
  isLocaleCatalogReady,
  loadLocaleCatalog,
  t,
} from "./index";

describe("on-demand locale catalogs", () => {
  it("keeps English ready without a loader", () => {
    expect(isLocaleCatalogReady("en")).toBe(true);
  });

  it("ja catalog supplies Japanese once loaded", async () => {
    await loadLocaleCatalog("ja");
    expect(isLocaleCatalogReady("ja")).toBe(true);
    expect(t("ja", "window.minimize")).not.toBe(t("en", "window.minimize"));
  });
});
