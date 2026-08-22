# Discord Rich Presence

Desktop-only activity on Discord: current **project**, **workspace** (Grok Build / Office / Studio), **plan**, **progress**, and **elapsed time in this app**. Not Remote IM.

## Surface

| Discord line | Source |
|---|---|
| Details | `{project} · {workspace}` |
| State | `{plan} · {progress} [· {context %}]` |
| Elapsed | Process start (Discord `timestamps.start`) |

Plan is the official subscription display string (`SuperGrok` / `SuperGrok Heavy`) or **Free**. Progress is idle / working / waiting / connecting.

Toggle: Settings → General → App → **Show status on Discord** (`settings-anchor-discordPresence`). Default **on**. Pref is `localStorage` `grok.discordPresence`.

## Host

`src-tauri/src/discord_presence.rs` talks to Discord IPC (`discord-ipc-0`…`9`). Soft-fail if Discord is closed. Commands: `discord_presence_update` / `discord_presence_clear` / `discord_presence_probe`.

Discord shows the **Developer Portal application name**, not a string we invent. Create an app named **Grok App** at [Discord Developer Portal](https://discord.com/developers/applications) and paste the Application ID in Settings (or set `GROK_DISCORD_CLIENT_ID`). Vite HMR does not load new Host commands — fully quit and start `pnpm dev` / the desktop binary after this feature lands.

Settings status keys: `settings.discordPresence.status.*`.

## Do not

- Drive presence from a secondary session window (it would clear the main activity).
- Send tokens, paths, or prompts.
- Hard-code UI copy; use `settings.discordPresence*` / `discord.presence.*`.
- Treat this as Remote IM / a Discord bot.
