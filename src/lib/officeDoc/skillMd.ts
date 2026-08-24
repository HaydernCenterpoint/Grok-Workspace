export const OFFICE_SKILL_REL = ".grok/skills/grok-office/SKILL.md";
export const OFFICE_SKILL_MARKER = "<!-- grok-office-doc v1 -->";

/** Restructured agent skill: write IR, let the app compile OOXML. */
export function officeSkillMarkdown(): string {
  return `---
name: grok-office
description: Create or revise Grok Office papers, management sheets, and slide decks. Use when the user asks for a report, brief, spreadsheet, tracker, or presentation. Write *.office.json — do not hand-author docx/xlsx/pptx XML.
---

${OFFICE_SKILL_MARKER}

# Grok Office documents

A \`.office.json\` file is the source. Grok Office opens it on the canvas above the composer and compiles Word / Excel / PowerPoint from there.

Do **not** unzip OOXML or write \`word/document.xml\` yourself.

## File

Save under the project, e.g. \`docs/q3-report.office.json\`.

\`\`\`json
{
  "v": 1,
  "kind": "paper",
  "title": "Q3 review",
  "subtitle": "Optional",
  "blocks": [
    { "type": "h", "level": 2, "text": "Status" },
    { "type": "p", "text": "Ship the tracker this week." },
    { "type": "ul", "items": ["Risk: API quota", "Next: load test"] },
    { "type": "table", "headers": ["Item", "Owner"], "rows": [["Auth", "Ada"]] },
    { "type": "callout", "text": "Needs legal review." },
    { "type": "hr" }
  ]
}
\`\`\`

\`kind\` is \`paper\` | \`sheet\` | \`deck\`.

### Sheet

\`\`\`json
{
  "v": 1,
  "kind": "sheet",
  "title": "Risk register",
  "sheets": [{
    "name": "Risks",
    "columns": [
      { "key": "item", "label": "Item", "kind": "text" },
      { "key": "score", "label": "Score", "kind": "number" },
      { "key": "total", "label": "Total" }
    ],
    "rows": [
      { "item": "Auth", "score": 3, "total": "=B2" }
    ]
  }]
}
\`\`\`

Formulas are strings that start with \`=\`.

### Deck

\`\`\`json
{
  "v": 1,
  "kind": "deck",
  "title": "Launch review",
  "slides": [
    { "title": "Launch review", "layout": "title" },
    { "title": "Goals", "layout": "bullets", "bullets": ["Ship v1", "Keep P0 green"] },
    { "title": "Split", "layout": "two-col", "left": ["Done"], "right": ["Next"] }
  ]
}
\`\`\`

\`layout\`: \`title\` | \`bullets\` | \`two-col\` | \`table\`.

## Existing files

Read \`.docx\` / \`.xlsx\` / \`.pptx\` in the files pane. For a spreadsheet you can ask Office to capture it to \`.office.json\`, then edit the JSON.

## After writing

The Office canvas above the composer picks up the file. Tell the user they can edit it there and use Save Word / Excel / PowerPoint.
`;
}
