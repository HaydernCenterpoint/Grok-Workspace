# Code quality completion handoff

This note is the merge-gate companion to `scripts/check-code-quality-gates.py --mode final`.
It records what already landed, what is intentionally left, and how residual risk is contained.

## What the final gate already proves

- Product UI does not call `window.confirm`, `window.alert`, or `window.prompt`.
- Legacy `src/components/chat/ConversationThread.tsx` is gone or wired; `SlashPalette` is not an orphan.
- CI runs clippy (`-D warnings`), `cargo fmt --check`, ESLint, and this script.
- `src/App.tsx` is a thin boot shell (not the workbench God component).
- Theme / wallpaper live in `ThemeProvider`; composer and settings are extracted.
- Domain CSS is split (`chat`, `composer`, `sidebar`, `settings`, and siblings).
- Host commands live under `src-tauri/src/commands/`; `session_manager` is a module directory.

## Office sheet HTML

`OfficeDocumentPreview` still uses `dangerouslySetInnerHTML` for sheet cells so
formulas and wrapping can render. The HTML is passed through
`sanitizeOfficeSheetHtml` (`src/lib/sanitizeOfficeHtml.ts`) before paint. The
quality-gate helper `office_preview_unsafe()` treats that sanitize marker as
the allowed path.

## xlsx residual risk

`package.json` still depends on SheetJS via the official tarball:

`xlsx` = `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`

That pin is intentional:

1. The npm `xlsx` registry package has a long CVE history. The root lockfile
   hygiene script forbids a root `package-lock.json` so an accidental
   `npm install` cannot reintroduce the old vulnerable tree.
2. Grok Office compiles `*.office.json` sheets to `.xlsx` with SheetJS bytes
   on the Host / renderer pack path (see `docs/llm-wiki/office.md`). Replacing
   SheetJS is a product project, not a drive-by CI edit.
3. Preview does not dump raw `sheet_to_html` into the DOM. Capture of an
   existing `.xlsx` goes through `captureOfficeFile` into sibling JSON; the
   canvas edits JSON, then Save Excel compiles again.

Until SheetJS is replaced, treat xlsx as a **compile/capture helper**, not a
generic spreadsheet engine. Do not add a second xlsx parser. Do not feed
untrusted workbook HTML to the WebView without `sanitizeOfficeSheetHtml`.

## What this note is not

- It is not a claim that every 1000-line file is gone. The budget gate still
  allows a fixed count; shrinking further is follow-up, not a blocker.
- It is not a security audit of SheetJS itself. The override is documented
  here so CI can distinguish “forgotten CVE” from “known, contained pin”.
- It is not a license to skip `pnpm audit:prod` on other production deps.

## Follow-ups (non-blocking)

- Replace SheetJS with a smaller writer when Office export no longer needs it.
- Restore `zh` / `zh-TW` tray variants when Chinese UI ships again; they are
  parked (`from_lang_tag` maps `zh*` → English) and allowed as dead_code.
- Keep adding Host / frontend tests next to idle-path and stream-throttle work
  rather than growing `App.tsx`.

## Pointers

- Gate script: `scripts/check-code-quality-gates.py`
- Office rules: `docs/llm-wiki/office.md`
- i18n / unshipped Chinese: `docs/llm-wiki/i18n.md`
- Dialogs: `docs/llm-wiki/dialogs.md`
- CI: `.github/workflows/ci.yml` (`frontend` job, `--mode final`)
