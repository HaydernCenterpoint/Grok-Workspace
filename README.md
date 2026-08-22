<h1 align="center">Grok Workspace</h1>

<p align="center"><strong>Desktop workbench for the local Grok Build CLI</strong></p>
<p align="center">Three work surfaces — <strong>Build</strong>, <strong>Office</strong>, and <strong>Studio</strong> — on one Tauri app, one agent, one project folder.</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="Platforms" />
  <img src="https://img.shields.io/badge/Tauri-2-orange" alt="Tauri 2" />
  <img src="https://img.shields.io/badge/TypeScript-7-3178C6" alt="TypeScript 7" />
  <img src="https://img.shields.io/badge/note-unofficial-yellow" alt="Unofficial" />
  <a href="https://github.com/HaydernCenterpoint/grok-workspace"><img src="https://img.shields.io/github/stars/HaydernCenterpoint/grok-workspace?style=social" alt="GitHub stars" /></a>
</p>

> [!NOTE]
> **Grok Workspace is not an official xAI product.** It is a desktop shell around the real [`grok`](https://x.ai) CLI (`grok agent stdio` / ACP). Agent work needs a working Grok Build install and a signed-in account (or a custom relay). Without CLI you stay on the first-run wizard, or set `GROK_APP_ACP=mock` for UI-only development.

---

## What it is

The `grok` CLI is strong in a terminal. Daily work still needs a project sidebar, a permission bar, file previews, scheduled jobs, and a UI that is not a single chat box.

Grok Workspace is that workbench. Click the sidebar Grok logo to switch surface. The same trusted folder and the same ACP session stay bound — only the chrome changes.

| Surface | Job | What you see |
|---------|-----|----------------|
| **Grok Build** | Coding IDE | Chat + files, terminal, worktrees, skills, review, git chips. Host model / effort / access. |
| **Grok Office** | Papers, slides, sheets | Daily document work, not a Word/Excel clone. Files + plan only. Agent writes `*.office.json`; the app compiles `.docx` / `.xlsx` / `.pptx`. |
| **Grok Studio** | Imagine image / video | Normal chat (thinking + result above the composer). Locked Imagine bar: image/video, aspect, resolution, duration. Official login or official API key required. |

Deep links: `#/office`, `#/studio`. Slash: `/office`, `/studio`, `/report`.

**Stack:** Tauri 2 + Rust host · React + TypeScript 7 + Vite · Tailwind.

---

## Contents

1. [Surfaces](#surfaces)
2. [Features](#features)
3. [Requirements](#requirements)
4. [Run from source](#run-from-source)
5. [First run](#first-run)
6. [Discord Rich Presence](#discord-rich-presence)
7. [Session data](#session-data)
8. [Config paths](#config-paths)
9. [Network / proxy](#network--proxy)
10. [Platform notes](#platform-notes)
11. [Tests](#tests)
12. [License](#license)

---

## Surfaces

### Grok Build

Default coding workbench. The host owns the session state machine and talks to `grok agent stdio`. You get:

- Trusted project folders and a virtualized session sidebar (archive, fork, rewind)
- Multi-session streams that keep running after you switch chats
- Ask by default; allow once / session / deny; YOLO when you want unattended runs
- Plan / Goal progress, slash palette, Skills, MCP / plugins
- Bottom PTY + side terminal, git worktrees, session diffs
- Image / video / PDF / Office / code preview in Resources

### Grok Office

A **different UI**, not Build with a different placeholder. Hide kanban, terminal, worktrees, skills, review, and git chips. Keep chat + files.

The agent does not hand-author OOXML. It writes a small IR (`*.office.json`: `paper` / `sheet` / `deck`). Opening that file previews the report, table, or slides and can export Word, Excel, or PowerPoint. `/report` opens Office on the current Build folder and starts a project report. Existing `.xlsx` / `.pptx` can be captured back into JSON.

Office keeps its own model / access prefs in `localStorage` and does **not** write Host `composer_prefs_*`.

### Grok Studio

Imagine on a normal transcript — not a side canvas with “Generating…” under the box. Composer stays docked. Studio never activates custom providers (that would hijack Build’s route) and does not write Host composer prefs.

---

## Features

| Area | What you get |
|------|----------------|
| **Real Build sessions** | Default `grok agent stdio` (ACP); host-owned FSM; optional remote ACP server |
| **Projects & sessions** | Trusted dirs, import / continue CLI sessions, orphan cleanup |
| **Permissions** | Per-project policy; in-app confirms only (no `window.confirm` / `alert`) |
| **Composer** | Follow-up queue while busy; paste screenshots; context-usage chip |
| **Automations** | Scheduled list; create-from-chat; tray-only is enough for the scheduler |
| **Account & quota** | Official login, SuperGrok quota + heatmap, custom relays |
| **Custom relays** | Independent `GROK_HOME` (`~/.grok-app/agent-home`) so App does not rewrite `~/.grok` |
| **Appearance** | Skins (`.grokskin`), wallpaper crop, zen mode — apply always confirms first |
| **Remote IM** | Optional Bridge channels (Discord bot, Telegram, …) — separate from Rich Presence |
| **Discord Presence** | Project · surface · plan · progress · elapsed time (desktop Discord) |
| **Security** | Optional OS keychain; `secrets.json` `0600` fallback; never commit `auth.json` |
| **i18n** | 13 shipped locales (`de` `en` `es` `fil` `fr` `id` `it` `ja` `ko` `pt-BR` `ru` `ta` `uk`). Follows the OS language. Chinese OS → English for now |
| **Packaging** | Windows x64 · macOS ARM/Intel · Linux x64 (when you run a release build) |

---

## Requirements

- **Grok Build CLI** `0.2.112+` (product line 1.0+ recommended). Typical paths: `~/.grok/bin/grok`, `%USERPROFILE%\.grok\bin\grok.exe`, or `PATH`. Older CLIs reject flags this app sends. After `grok update`, fully quit and reopen the app.
- **Windows:** [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) (ships on Windows 11). Native Rust build needs **MSVC** (`vcvars64.bat`) for `pnpm dev`.
- **Node 22+**, **pnpm 9**, **Rust stable**. macOS also needs Xcode Command Line Tools.

This repository does not yet publish installers. Run from source (below) or build with `docs/BUILD.md`.

---

## Run from source

Clone your repo (not a third-party fork):

```bash
git clone https://github.com/HaydernCenterpoint/grok-workspace.git
cd grok-workspace
pnpm install
```

**Windows (PowerShell)** — load MSVC, then start the desktop host:

```powershell
$vcvars = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
cmd /c "call `"$vcvars`" && set PATH=%APPDATA%\npm;%PATH% && pnpm dev"
```

**macOS / Linux:**

```bash
pnpm dev                 # full desktop app (real CLI by default)
pnpm dev:ui              # Vite only
GROK_APP_ACP=mock pnpm dev
```

Vite HMR updates the UI only. Rust Host commands (Office export, Discord IPC, …) need a Host rebuild — fully quit `pnpm dev` and start it again.

---

## First run

1. Launch → setup wizard **requires** a working `grok` binary (install from the wizard or pick a path). Account / API key / relay is **skippable**.
2. If the CLI is already signed in, choose **Use existing CLI sign-in**.
3. **Add project** → trust a folder.
4. **Connect agent** → chat when Ready. Permission bar defaults to **Ask**.
5. Sidebar logo → switch Build / Office / Studio.

Windows can run the CLI through **WSL** (Settings → Runtime → CLI). An ACP server address still wins when set.

---

## Discord Rich Presence

When Discord desktop (Stable / PTB / Canary) is running, the app can show:

`{project} · {Grok Build | Office | Studio}`  
`{plan} · {idle | working | waiting | connecting} [· context %]`  
plus elapsed time from process start.

Toggle: **Settings → General → App → Show status on Discord** (on by default).

Discord only accepts a real **Application ID**. Create an app named **Grok Workspace** at the [Discord Developer Portal](https://discord.com/developers/applications), paste the ID in that Settings row, and keep **Display current activity** on (not Invisible). This is not Remote IM and not a bot.

---

## Session data

| Mode | `GROK_HOME` | Notes |
|------|-------------|--------|
| **Shared** (default) | `~/.grok` | Same home as terminal Grok Build. App **refuses** to rewrite `config.toml` there. |
| **Independent** | `~/.grok-app/agent-home` | App may write providers, privacy, workflows. |

Do not leave relay keys only in App secrets if you expect the CLI to see them in shared mode.

---

## Config paths

Override the app data root with **`GROK_APP_HOME`**.

| Platform | Typical path |
|----------|----------------|
| Windows | `%APPDATA%\grokapp\grok-app\` |
| macOS | `~/Library/Application Support/com.grokapp.grok-app/` |
| Fallback | `~/.grok-app/` |

```text
<app-data>/
  projects.json
  sessions_index.json
  settings.json
  secrets.json
  automations.json
  projects/
  sessions/
  logs/
  agent-home/          # independent-mode GROK_HOME
```

CLI login stays in **`~/.grok`** (`auth.json`, …). Never commit `auth.json`, `.env`, or `secrets.json`.

---

## Network / proxy

`auth.x.ai` / `grok.com` / `cli-chat-proxy.grok.com` may need a proxy.

1. **Settings → Runtime → Network** — System or Manual (e.g. `http://127.0.0.1:7890`), then **Test connection**.
2. Prefer System HTTP or a mixed-port proxy over TUN. The app injects `HTTP_PROXY` into agent processes.
3. If the CLI is already signed in, reuse it instead of Browser OAuth.

---

## Platform notes

**Windows:** close-to-tray is the default hide; quit from the tray. Optional taskbar unread overlay is **off** by default (Settings → General → App).

**macOS Gatekeeper** (unsigned / quarantine local builds):

```bash
xattr -cr /Applications/Grok.app
```

**Linux AppImage + Wayland (black window):** bundled WebKit can fail (`EGL_BAD_PARAMETER`). Prefer `.deb` / `.rpm` (system WebKit), or extract the AppImage and point `WEBKIT_EXEC_PATH` at system `webkit2gtk-4.1`. See [Tauri Linux graphics](https://v2.tauri.app/develop/debug/linux-graphics/).

**Linux sandbox (`SANDBOX_BLOCKED`):** Ubuntu 24.04+ may set `kernel.apparmor_restrict_unprivileged_userns=1`, which breaks bubblewrap. Fix with sysctl, or **Settings → Runtime → Sandbox → off**.

---

## Tests

```bash
pnpm typecheck
pnpm test
cd src-tauri && cargo test
```

Release packaging: [docs/BUILD.md](./docs/BUILD.md). Product rules for agents: [docs/llm-wiki/](./docs/llm-wiki/). Changelog: [CHANGELOG.md](./CHANGELOG.md).

---

## License

[MIT](./LICENSE)
