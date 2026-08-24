# Grok Office

Daily knowledge-work **surface**: papers, slides, and spreadsheets. Same ACP agent as Grok Build — **not** a second agent and **not** a port of [OfficeCLI](https://github.com/iOfficeAI/OfficeCLI) (C# OOXML DOM).

**Layout:** document canvas on top, command composer at the bottom, project/folder pane on the right. Theme is the one chosen at first-run / Settings — no Office paper tint.

**Grok Build and Grok Office are completely different working UIs.** Build is a coding IDE. Office is a document canvas. Do not ship Office as the Build chrome with a different placeholder.

## Two surfaces

| | Grok Build | Grok Office |
|---|---|---|
| Job | Coding workbench | Daily papers / slides / sheets |
| Main column | Chat + agent transcript | Document canvas above + command chat below |
| Side pane | Files, browser, terminal, review, skills, plan | Load Build project / choose folder + files, browser, plan |
| Nav | Kanban / Agents, scheduled | Scheduled only (no kanban) |
| Composer | Same 52rem card as Office / Studio (`--composer-width-max`). Worktrees, skills, git change chips; Host model / access | Same 52rem card as Build. No Office chip — the sidebar already says Office. Own model / access prefs |
| Transcript | Command column (markdown, thoughts, tools, chips) is the same 52rem centered measure as the composer. Settings → Chat width does not override Build / Office / Studio. | Same pin as Build (`html[data-work-mode] .lobe-chat__inner`) |
| Terminal | Bottom PTY + side terminal | Hidden |
| Switcher | Sidebar Grok logo | Same menu |

Mode is `code` | `office` | `studio` (`src/lib/grokOffice.ts`, `html[data-work-mode]`, `localStorage` key `grok.workMode`). Each chat also stores a **sticky** surface in `grok.sessionWorkMode` (`sessionId → workMode`, first write wins) so the sidebar can group Build / Office / Studio. Missing ids default to Build. Chrome flags live in `workSurfaceChrome()`. Office CSS is `src/styles/workbench-office.css` (shared theme tokens — not a cream paper overlay).

## Product rules

- Entering Office: `setMainPane("chat")`, ensure the **files** side tab exists, uncollapse aside **the first time this process**, close the bottom terminal, drop coding side tabs. If the user collapses the pane, Build ↔ Office must not force it open again (Files button still opens it).
- Deep link: `#/office`. Slash: `/office`. Palette: `open-office`.
- **Switcher is the sidebar Grok logo** (Build / Office / Studio menu). The session tree lists **project folders and folderless chats** under those three surfaces. Each surface header has select / archive-older / collapse / plus (scoped to that workspace). Build and Office plus is a solid menu: new chat on that surface (no Recents stamp) or Create project already aimed at that workspace. Studio plus starts a studio session. Recents (after Studio) is only for chats started from Recents `+`. A folder session never also appears in Recents. A chat’s `grok.sessionWorkMode` stamp is sticky — opening the same folder on another surface does not move it. Do not add a second *nav* row for Office.
- Canvas-first lives in `OfficeWorkspace` **above** the existing chat + composer. Do **not** add `mainPane: "office"` that deletes the transcript.
- No Settings catalog entry unless you add a Settings control.
- Office start is the **empty canvas**: centered Grok mark + one daily-work slogan (`office.welcomeSlogan`), then Office’s own starter rows. Grok Build’s empty chat uses four underlined coding lines — do not merge the two start lists. Entering Office via the logo, `#/office`, `/office`, or palette **Open Office** must not paint a Build transcript on that canvas; start an empty Office draft unless the open chat is already tagged Office.
- Live activity marks are shared with Build and Studio: 3-dot harmonic scale for thinking / “Working for”; 4-square blue pulse for a running tool. Same `ConversationThread` chrome.

## Build → Office project handoff

Same app, same folder, same ACP agent. Office does **not** copy or fork the repo.

| Action | What happens |
|---|---|
| Logo / `/office` / palette Open Office | Switch surface. **Keep** the bound Grok Build **project**. If the open chat is not an Office session, start an empty Office draft — do not show the Build transcript. Files pane opens on that folder. |
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

OfficeCLI’s idea we keep: the file **is** the document; the composer is the command line; the right pane is the folder. We do **not** graft OfficeCLI’s OOXML path-DOM. Agent writes `*.office.json`; the canvas edits that IR; compile is Save Word / Excel / PowerPoint.

This is the restructured Anthropic document-skill idea: **do not** have the model unzip OOXML. Write JSON. Compile in the app (SheetJS is already a dependency; docx/pptx are minimal OOXML).

| `kind` | Compile to |
|---|---|
| `paper` | Markdown + `.docx` |
| `sheet` | CSV + `.xlsx` (formulas are strings starting with `=`) |
| `deck` | Markdown + `.pptx` |

Opening `*.office.json` (files pane or latest in the project) fills the **canvas**. Fields are editable and write back to the JSON. Save Word / Excel / PowerPoint still compiles. Binary `.docx` / `.xlsx` / `.pptx` preview on the canvas; capture to `*.office.json` to edit.

## Start surface

`OfficeStart` (`src/components/OfficeStart.tsx`) sits on the **empty canvas**. Centered Grok mark (same as Build welcome) + `office.welcomeSlogan`, then three starter rows (report / slides / sheet). A bound Build folder can add a quiet `office.startTitleFromBuild` line — not a second wordmark. Picking a row writes a blank `docs/*.office.json` when a folder is bound and seeds the composer via `officeStartSeedKey()`; the agent still does the work.

The command transcript under the canvas stays hidden until an Office session is a live chat, so a Build greeting cannot stack under the start rows. Once that session has user/assistant content, is **Working** / streaming, or is still loading its journal — and no document is open — **unmount** the start mark. Do not leave the logo/hints on a running turn while the shell message array is still empty. The command column then fills the stage above the docked composer. A loaded `*.office.json` / office file still uses the canvas + chat split. The composer placeholder matches Build (`composer.placeholder`).

## Do not

- Treat Office as Build-minus-a-few-buttons. Hide coding chrome **and** restyle the surface.
- Port OfficeCLI or hand-author OOXML in the agent. The canvas edits `*.office.json`.
- Inject a second agent loop. The existing Grok Build ACP session writes the files.
- Ask the agent to author `word/document.xml` / `ppt/slides/*.xml` by hand.
- Filter the files tree so hard that `AGENTS.md` / source disappear (optional office-ish highlight is fine).
- Hard-code UI copy; use `sidebar.office*` / `composer.office*` / `slash.office*` / `office.start*` / `office.doc*` / `office.canvas*` / `office.pane*`.
