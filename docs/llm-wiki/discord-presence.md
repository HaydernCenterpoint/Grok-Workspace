# Discord Rich Presence

Desktop-only activity on Discord: current **plan / package**, **quota** (same remaining % as the sidebar), **model + effort**, **session**, and **elapsed time for this session / turn**. Not Remote IM.

## Surface

| Discord field | Source |
|---|---|
| Details | `{plan} · {quota remaining%}` (quota omitted when Host is silent — never invent 0% / 100%) |
| State | `{model} · {effort} · {session}` (title, or first 8 of the id if untitled) |
| Elapsed | `timestamps.start` — session open while idle; current turn while working |
| `assets.large_text` | Session (hover) |
| `assets.small_text` | `{model} · {effort}` (hover) |

Plan is the official subscription display string (`SuperGrok` / `SuperGrok Heavy`) or **Free**. Quota is `remainingPercent` from the same billing snapshot as the sidebar footer (custom route uses the provider balance chip when that is what the footer shows). Effort uses the catalog UI ladder (`Low` / `Medium` / `High` / `Extra high`). Discord activity lines may stay English; in-app Settings copy is i18n.

Toggle: Settings → General → App → **Show status on Discord** (`settings-anchor-discordPresence`). Default **on**. Pref is `localStorage` `grok.discordPresence`.

## Host

`src-tauri/src/discord_presence.rs` talks to Discord IPC (`discord-ipc-0`…`9`). Soft-fail if Discord is closed. Commands: `discord_presence_update` (details / state / `start_sec` / optional `large_text` + `small_text`) / `discord_presence_clear` / `discord_presence_probe`. Hover assets do not send `large_image` / `small_image` until Rich Presence art is uploaded on the Discord app.

Discord shows the **Developer Portal application name**, not a string we invent. Create an app named **Grok Workspace** at [Discord Developer Portal](https://discord.com/developers/applications) and paste the Application ID in Settings (or set `GROK_DISCORD_CLIENT_ID`). Vite HMR does not load new Host commands — fully quit and start `pnpm dev` / the desktop binary after this feature lands.

Settings status keys: `settings.discordPresence.status.*`.

## Do not

- Drive presence from a secondary session window (it would clear the main activity).
- Send tokens, paths, or prompts.
- Hard-code UI copy; use `settings.discordPresence*` / `discord.presence.*`.
- Treat this as Remote IM / a Discord bot.
