# Grok Office

Daily knowledge-work **surface**: papers, slides, and spreadsheets. Same idea as ChatGPT Work / Claude Cowork — **not** a Word / Excel / PowerPoint clone, and **not** a second agent.

**Grok Build and Grok Office are completely different working UIs.** Build is a coding IDE. Office is daily document work. Do not ship Office as the Build chrome with a different placeholder.

## Two surfaces

| | Grok Build | Grok Office |
|---|---|---|
| Job | Coding workbench | Daily papers / slides / sheets |
| Main column | Chat + agent transcript | Chat as a work session (not “start chatting”) |
| Side pane | Files, browser, terminal, review, skills, plan | Files, browser, plan only |
| Nav | Kanban / Agents, scheduled | Scheduled only (no kanban) |
| Composer | Worktrees, skills, git change chips; Host model / access | Folder picker + Office model / access (own prefs, not Build Host) |
| Terminal | Bottom PTY + side terminal | Hidden |
| Switcher | Sidebar Grok logo | Same menu |

Mode is `code` | `office` (`src/lib/grokOffice.ts`, `html[data-work-mode]`, `localStorage` key `grok.workMode`). Chrome flags live in `workSurfaceChrome()`. Office CSS is `src/styles/workbench-office.css` (paper tint — not a thinner IDE).

## Product rules

- Entering Office: `setMainPane("chat")`, open the **files** side tab, uncollapse aside, close the bottom terminal, drop coding side tabs.
- Deep link: `#/office`. Slash: `/office`. Palette: `open-office`.
- **Switcher is the sidebar Grok logo** (Build / Office / Studio menu). Do not add a second sidebar nav row for Office.
- Chat may stay the main column. Do **not** add `mainPane: "office"` that kills the transcript unless product later asks for a document-canvas-first layout.
- No Settings catalog entry unless you add a Settings control.

## Build → Office project handoff

Same app, same folder, same ACP agent. Office does **not** copy or fork the repo.

| Action | What happens |
|---|---|
| Logo / `/office` / palette Open Office | Switch surface. **Keep** the current session and the bound Grok Build project. Files pane opens on that folder. |
| `/report` / palette **Write project report** | Switch to Office, start a **new work session on the same project**, seed a report draft. Agent reads the Build folder and writes `*.office.json` beside the chat. |

## Document processor (`*.office.json`)

Office is **not** a Word / Excel / PowerPoint clone. The agent writes a small open IR; the app compiles real files.

| Piece | Path |
|---|---|
| IR | `src/lib/officeDoc/` (`v: 1`, `kind`: `paper` \| `sheet` \| `deck`) |
| Agent skill | `.grok/skills/grok-office/SKILL.md` (written on Office enter; do not overwrite if the v1 marker is present) |
| Preview + export | `OfficeArtifactPreview` on `*.office.json` |
| Capture existing xlsx / pptx / docx-text | `captureOfficeFile` → sibling `*.office.json` |
| Pack | Host `office_export` (Rust zip for docx/pptx; SheetJS bytes for xlsx) |

This is the restructured Anthropic document-skill idea: **do not** have the model unzip OOXML. Write JSON. Compile in the app (SheetJS is already a dependency; docx/pptx are minimal OOXML).

| `kind` | Compile to |
|---|---|
| `paper` | Markdown + `.docx` |
| `sheet` | CSV + `.xlsx` (formulas are strings starting with `=`) |
| `deck` | Markdown + `.pptx` |

Opening `*.office.json` in the files pane renders the report / table / slides and offers Save Word / Excel / PowerPoint. Edit mode still shows the JSON.

## Start surface

`OfficeStart` (`src/components/OfficeStart.tsx`) replaces the plain empty copy when Office has no session. Left-aligned headline plus three starter rows (report / slides / sheet) sitting above the composer. Deliberately **not** Codex's centered mark plus equal card grid, and not a card grid at all. Picking a row seeds the composer via `officeStartSeedKey()`; the agent still does the work.

Empty copy and the composer placeholder name the Build project (`office.start*FromBuild`, `composer.officePlaceholderFromBuild`) when a real project is bound (not the general workspace).

## Do not

- Treat Office as Build-minus-a-few-buttons. Hide coding chrome **and** restyle the surface.
- Build an in-app Office suite or a new Electron/Tauri shell.
- Inject a second agent loop. The existing Grok Build ACP session writes the files.
- Ask the agent to author `word/document.xml` / `ppt/slides/*.xml` by hand.
- Filter the files tree so hard that `AGENTS.md` / source disappear (optional office-ish highlight is fine).
- Hard-code UI copy; use `sidebar.office*` / `composer.office*` / `slash.office*` / `office.start*` / `office.doc*`.
