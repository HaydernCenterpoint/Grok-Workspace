import { describe, expect, it } from "vitest";
import {
  UPDATE_BANNER_DISMISS_STORAGE_KEY,
  loadUpdateBannerDismiss,
  parseUpdateBannerDismissToken,
  saveUpdateBannerDismiss,
  shouldShowUpdateBanner,
  updateBannerDismissToken,
  updateBannerKindForStatus,
} from "./updateBannerDismiss";

describe("updateBannerDismiss", () => {
  it("tokens are version + kind", () => {
    expect(updateBannerDismissToken("1.2.3", "ready")).toBe("1.2.3::ready");
    expect(parseUpdateBannerDismissToken("1.2.3::ready")).toEqual({
      version: "1.2.3",
      kind: "ready",
    });
    expect(parseUpdateBannerDismissToken("1.2.3::nope")).toBeNull();
    expect(parseUpdateBannerDismissToken("")).toBeNull();
  });

  it("persists Later for this session store", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
    };
    expect(loadUpdateBannerDismiss(storage)).toBeNull();
    saveUpdateBannerDismiss("1.2.3", "ready", storage);
    expect(store.get(UPDATE_BANNER_DISMISS_STORAGE_KEY)).toBe("1.2.3::ready");
    expect(loadUpdateBannerDismiss(storage)).toEqual({
      version: "1.2.3",
      kind: "ready",
    });
  });
});

describe("shouldShowUpdateBanner", () => {
  it("shows ready / downloading / manual when not dismissed", () => {
    expect(
      shouldShowUpdateBanner({ state: "ready", version: "1.2.3" }),
    ).toBe(true);
    expect(
      shouldShowUpdateBanner({ state: "downloading", version: "1.2.3" }),
    ).toBe(true);
    expect(
      shouldShowUpdateBanner({
        state: "manual-required",
        version: "1.2.3",
      }),
    ).toBe(true);
  });

  it("hides ready after Later for the same version + kind", () => {
    expect(
      shouldShowUpdateBanner({
        state: "ready",
        version: "1.2.3",
        dismissedVersion: "1.2.3",
        dismissedKind: "ready",
      }),
    ).toBe(false);
  });

  it("shows ready after Later on downloading (same version, other kind)", () => {
    expect(
      shouldShowUpdateBanner({
        state: "ready",
        version: "1.2.3",
        dismissedVersion: "1.2.3",
        dismissedKind: "downloading",
      }),
    ).toBe(true);
  });

  it("shows a newer version after Later on the old one", () => {
    expect(
      shouldShowUpdateBanner({
        state: "ready",
        version: "1.2.4",
        dismissedVersion: "1.2.3",
        dismissedKind: "ready",
      }),
    ).toBe(true);
  });

  it("hides available while auto-download is on; shows when off", () => {
    expect(
      shouldShowUpdateBanner({
        state: "available",
        version: "1.2.3",
        autoDownloadEnabled: true,
      }),
    ).toBe(false);
    expect(
      shouldShowUpdateBanner({
        state: "available",
        version: "1.2.3",
        autoDownloadEnabled: false,
      }),
    ).toBe(true);
    expect(
      shouldShowUpdateBanner({
        state: "available",
        version: "1.2.3",
        autoDownloadEnabled: false,
        dismissedVersion: "1.2.3",
        dismissedKind: "available",
      }),
    ).toBe(false);
  });

  it("hides idle / installing / missing version (except downloading)", () => {
    expect(shouldShowUpdateBanner({ state: "idle" })).toBe(false);
    expect(
      shouldShowUpdateBanner({ state: "installing", version: "1.2.3" }),
    ).toBe(false);
    expect(
      shouldShowUpdateBanner({ state: "restarting", version: "1.2.3" }),
    ).toBe(false);
    expect(shouldShowUpdateBanner({ state: "ready", version: "" })).toBe(false);
    expect(shouldShowUpdateBanner({ state: "downloading" })).toBe(true);
  });

  it("maps status to banner kind", () => {
    expect(updateBannerKindForStatus("ready")).toBe("ready");
    expect(updateBannerKindForStatus("downloading")).toBe("downloading");
    expect(updateBannerKindForStatus("manual-required")).toBe("manual");
    expect(
      updateBannerKindForStatus("available", { autoDownloadEnabled: false }),
    ).toBe("available");
    expect(
      updateBannerKindForStatus("available", { autoDownloadEnabled: true }),
    ).toBeNull();
    expect(updateBannerKindForStatus("error")).toBeNull();
  });
});
