import { describe, expect, it } from "vitest";
import {
  blankOfficeDoc,
  nextOfficeRel,
  officeStartToKind,
  pickLatestOfficeHit,
  serializeOfficeDoc,
} from "./officeCanvas";
import { parseOfficeDoc } from "./officeDoc";

describe("officeCanvas", () => {
  it("maps start rows to IR kinds and round-trips JSON", () => {
    expect(officeStartToKind("report")).toBe("paper");
    expect(officeStartToKind("sheet")).toBe("sheet");
    expect(officeStartToKind("slides")).toBe("deck");
    const doc = blankOfficeDoc("paper", "Brief");
    expect(parseOfficeDoc(serializeOfficeDoc(doc)).ok).toBe(true);
  });

  it("picks a free docs/*.office.json name and the newest hit", () => {
    expect(nextOfficeRel("paper", [])).toBe("docs/untitled-report.office.json");
    expect(
      nextOfficeRel("paper", ["docs/untitled-report.office.json"]),
    ).toBe("docs/untitled-report-2.office.json");
    expect(
      pickLatestOfficeHit([
        { relativePath: "a.office.json", mtimeMs: 1 },
        { relativePath: "b.office.json", mtimeMs: 9 },
      ])?.relativePath,
    ).toBe("b.office.json");
    expect(pickLatestOfficeHit([])).toBeNull();
  });
});
