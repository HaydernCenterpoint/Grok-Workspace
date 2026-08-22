import { describe, expect, it } from "vitest";
import { compileOfficeText } from "./compileMarkdown";
import { compileDocxParts, compilePptxParts } from "./compileOoxml";
import { compileXlsxBytes } from "./compileXlsx";
import { importCsvSheet, importMarkdownPaper, importOfficeExtract } from "./importDoc";
import { officeSkillMarkdown } from "./skillMd";
import {
  isOfficeDocPath,
  officeJsonRelative,
  officeOutputRelative,
  parseOfficeDoc,
  type OfficeDoc,
} from "./types";
import { exportFormatsFor } from "./types";

const paper: OfficeDoc = {
  v: 1,
  kind: "paper",
  title: "Q3 review",
  subtitle: "Risks",
  blocks: [
    { type: "h", level: 2, text: "Status" },
    { type: "p", text: "Ship this week." },
    { type: "ul", items: ["API quota"] },
    { type: "table", headers: ["Item", "Owner"], rows: [["Auth", "Ada"]] },
    { type: "callout", text: "Legal" },
    { type: "hr" },
  ],
};

const sheet: OfficeDoc = {
  v: 1,
  kind: "sheet",
  title: "Risks",
  sheets: [
    {
      name: "Risks",
      columns: [
        { key: "item", label: "Item" },
        { key: "score", label: "Score", kind: "number" },
      ],
      rows: [{ item: "Auth", score: 3 }],
    },
  ],
};

const deck: OfficeDoc = {
  v: 1,
  kind: "deck",
  title: "Launch",
  slides: [
    { title: "Launch", layout: "title" },
    { title: "Goals", layout: "bullets", bullets: ["Ship v1"] },
  ],
};

describe("officeDoc", () => {
  it("parses paper / sheet / deck and rejects junk", () => {
    expect(parseOfficeDoc(paper).ok).toBe(true);
    expect(parseOfficeDoc(sheet).ok).toBe(true);
    expect(parseOfficeDoc(deck).ok).toBe(true);
    expect(parseOfficeDoc({ v: 1, kind: "paper" }).ok).toBe(false);
    expect(parseOfficeDoc({ v: 2, kind: "paper", title: "x" }).ok).toBe(false);
    expect(parseOfficeDoc(`{"v":1,"kind":"paper","title":"A","blocks":[]}`).ok).toBe(
      true,
    );
  });

  it("classifies paths and sibling outputs", () => {
    expect(isOfficeDocPath("docs/q3.office.json")).toBe(true);
    expect(isOfficeDocPath("q3.json")).toBe(false);
    expect(officeOutputRelative("docs/q3.office.json", "docx")).toBe(
      "docs/q3.docx",
    );
    expect(officeJsonRelative("budget.xlsx")).toBe("budget.office.json");
    expect(exportFormatsFor("paper")).toEqual(["md", "docx"]);
    expect(exportFormatsFor("sheet")).toEqual(["csv", "xlsx"]);
    expect(exportFormatsFor("deck")).toEqual(["md", "pptx"]);
  });

  it("compiles markdown / csv / OOXML parts", () => {
    const md = compileOfficeText(paper).markdown;
    expect(md).toContain("# Q3 review");
    expect(md).toContain("Ship this week.");
    expect(compileOfficeText(sheet).csv).toContain("Item,Score");
    const docx = compileDocxParts(paper);
    expect(docx.some((e) => e.path === "word/document.xml" && e.text.includes("Q3 review"))).toBe(
      true,
    );
    const pptx = compilePptxParts(deck);
    expect(pptx.some((e) => e.path === "ppt/slides/slide2.xml")).toBe(true);
    expect(compileXlsxBytes(sheet).byteLength).toBeGreaterThan(100);
  });

  it("imports markdown, csv, and extracted slides", () => {
    const fromMd = importMarkdownPaper("# Brief\n\nHello\n\n- A\n- B\n", "x");
    expect(fromMd.kind).toBe("paper");
    expect(fromMd.blocks?.some((b) => b.type === "ul")).toBe(true);
    const fromCsv = importCsvSheet("Name,Qty\nAda,2\n", "Tracker");
    expect(fromCsv.sheets?.[0]?.rows[0]?.name).toBe("Ada");
    const fromPpt = importOfficeExtract(
      "deck",
      "--- Slide 1 ---\nKickoff\nHello\n--- Slide 2 ---\nNext\nShip",
      "Deck",
    );
    expect(fromPpt.slides).toHaveLength(2);
    expect(fromPpt.slides?.[0]?.title).toBe("Kickoff");
  });

  it("skill tells the agent to write IR, not OOXML", () => {
    const md = officeSkillMarkdown();
    expect(md).toContain('"kind": "paper"');
    expect(md).toContain("*.office.json");
    expect(md.toLowerCase()).toContain("do not");
  });
});
