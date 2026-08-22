import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORK_MODE,
  OFFICE_HASH,
  OFFICE_START_KINDS,
  officeStartSeedKey,
  WORK_MODE_ATTR,
  WORK_MODE_STORAGE_KEY,
  WORK_MODES,
  applyWorkMode,
  composerPlaceholderKey,
  productTitleKey,
  workSurfaceChrome,
  isOfficeSideTabKind,
  isOfficeHash,
  isStudioHash,
  isOfficePath,
  isWorkMode,
  STUDIO_HASH,
  loadWorkMode,
  parseWorkMode,
  saveWorkMode,
  type WorkModeStorage,
} from "./grokOffice";

function memoryStorage(
  initial: Record<string, string> = {},
): WorkModeStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem(key) {
      return key in data ? data[key]! : null;
    },
    setItem(key, value) {
      data[key] = value;
    },
  };
}

describe("grokOffice", () => {
  it("defaults to code and rejects unknown values", () => {
    expect(DEFAULT_WORK_MODE).toBe("code");
    expect(parseWorkMode(null)).toBe("code");
    expect(parseWorkMode("")).toBe("code");
    expect(parseWorkMode("cowork")).toBe("code");
    expect(isWorkMode("code")).toBe(true);
    expect(isWorkMode("office")).toBe(true);
    expect(isWorkMode("studio")).toBe(true);
    expect(isWorkMode("cowork")).toBe(false);
    expect(WORK_MODES).toEqual(["code", "office", "studio"]);
  });

  it("persists and reloads", () => {
    const storage = memoryStorage();
    expect(loadWorkMode(storage)).toBe("code");
    saveWorkMode("office", storage);
    expect(storage.data[WORK_MODE_STORAGE_KEY]).toBe("office");
    expect(loadWorkMode(storage)).toBe("office");
  });

  it("apply writes data-work-mode", () => {
    const attrs = new Map<string, string>();
    const el = {
      setAttribute(name: string, value: string) {
        attrs.set(name, value);
      },
    };
    applyWorkMode("office", el);
    expect(attrs.get(WORK_MODE_ATTR)).toBe("office");
  });

  it("recognizes office hashes", () => {
    expect(isOfficeHash(OFFICE_HASH)).toBe(true);
    expect(isOfficeHash("#/office")).toBe(true);
    expect(isOfficeHash("#office")).toBe(true);
    expect(isOfficeHash("#/office/inbox")).toBe(true);
    expect(isOfficeHash("#/kanban")).toBe(false);
    expect(isOfficeHash("#/workbench")).toBe(false);
    expect(isOfficeHash("")).toBe(false);
    expect(isStudioHash(STUDIO_HASH)).toBe(true);
    expect(isStudioHash("#/studio")).toBe(true);
    expect(isStudioHash("#/office")).toBe(false);
  });

  it("classifies office document paths", () => {
    expect(isOfficePath("Q3-review.docx")).toBe(true);
    expect(isOfficePath("C:\\\\docs\\\\budget.xlsx")).toBe(true);
    expect(isOfficePath("/tmp/deck.PPTX")).toBe(true);
    expect(isOfficePath("notes.pdf")).toBe(true);
    expect(isOfficePath("docs/q3.office.json")).toBe(true);
    expect(isOfficePath("src/App.tsx")).toBe(false);
    expect(isOfficePath("README")).toBe(false);
  });

  it("picks composer placeholder by goal then office", () => {
    expect(
      composerPlaceholderKey({ goalMode: true, workMode: "office" }),
    ).toBe("composer.goalPlaceholder");
    expect(
      composerPlaceholderKey({ goalMode: false, workMode: "office" }),
    ).toBe("composer.officePlaceholder");
    expect(
      composerPlaceholderKey({
        goalMode: false,
        workMode: "office",
        hasBuildProject: true,
      }),
    ).toBe("composer.officePlaceholderFromBuild");
    expect(
      composerPlaceholderKey({ goalMode: false, workMode: "code" }),
    ).toBe("composer.placeholder");
    expect(
      composerPlaceholderKey({ goalMode: false, workMode: "studio" }),
    ).toBe("studio.placeholder");
  });

  it("titles the brand by work mode", () => {
    expect(productTitleKey("code")).toBe("sidebar.build");
    expect(productTitleKey("office")).toBe("sidebar.office");
    expect(productTitleKey("studio")).toBe("sidebar.studio");
  });

  it("seeds the composer per starter, naming the Build folder only for reports", () => {
    expect(OFFICE_START_KINDS).toEqual(["report", "slides", "sheet"]);
    expect(officeStartSeedKey("report", true)).toBe("composer.officeReportDraft");
    expect(officeStartSeedKey("report", false)).toBe(
      "composer.officeReportDraftGeneric",
    );
    expect(officeStartSeedKey("slides", true)).toBe("composer.officeSlidesDraft");
    expect(officeStartSeedKey("sheet", true)).toBe("composer.officeSheetDraft");
  });

  it("Office chrome is daily work, not a coding IDE", () => {
    const office = workSurfaceChrome("office");
    const studio = workSurfaceChrome("studio");
    const build = workSurfaceChrome("code");
    expect(office.kanbanNav).toBe(false);
    expect(studio.bottomTerminal).toBe(false);
    expect(office.bottomTerminal).toBe(false);
    expect(office.composerWorktrees).toBe(false);
    expect(office.sideTerminal).toBe(false);
    expect(office.sideReview).toBe(false);
    expect(office.composerModel).toBe(true);
    expect(office.composerProject).toBe(true);
    expect(studio.composerModel).toBe(false);
    expect(studio.composerAccess).toBe(false);
    expect(studio.composerProject).toBe(false);
    expect(studio.composerContext).toBe(false);
    expect(build.kanbanNav).toBe(true);
    expect(build.bottomTerminal).toBe(true);
    expect(build.composerModel).toBe(true);
    expect(isOfficeSideTabKind("file")).toBe(true);
    expect(isOfficeSideTabKind("terminal")).toBe(false);
  });
});
