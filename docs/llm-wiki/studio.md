# Grok Studio

Image and video **surface** for Grok Imagine. Same chat column as Grok Build — thinking, reasoning, and the image/video card appear **above** the composer, like a normal chat. Not Grok Office.

## Surface

| | Grok Studio |
|---|---|
| Job | Generate images and short videos |
| Main column | Normal chat transcript (user prompt, thinking, tools, media) |
| Empty draft | Grok mark + slogan in the chat column (same hero as Build / Office). No Imagine headline. |
| Composer | Same 52rem Office/Build card (`--composer-width-max`). Sliding Image/Video segment + aspect chip. Image adds a 1–4 count chip (max 4; default 1). Video adds resolution / duration. Aspect preview follows the hovered (or focused) row; click still commits. No locked Imagine chip. No Build model, effort, access, or workspace chip |
| Prefs | Own `localStorage` overlay (`grok.surfaceComposerPrefs.v1`). Host `composer_prefs_*` stays Grok Build |
| Switcher | Sidebar Grok logo (Build / Office / Studio). Tree section `Grok Studio` with select / archive-older / plus (`+` starts a Studio session; folders + Studio-tagged folderless chats). Recents is only Recents `+` chats |

Mode is `studio` (`src/lib/grokOffice.ts`, `html[data-work-mode]`, same `grok.workMode` key). Deep link `#/studio`. Slash `/studio`. Palette **Grok Studio**. Transcript width matches the composer card (`--composer-width-max` on `.lobe-chat__inner`). Settings → Chat width does not override Build / Office / Studio. Do not stretch the composer to the full chat column.

## How generate works

No second agent and no side “Generating…” under the box. Send goes through the current ACP session. The journal stores the user’s prompt; the agent text is wrapped (`wrapStudioAgentText`) so the model calls `image_gen` / `image_to_video` with the bar settings. Image count > 1 tells the agent to call `image_gen` that many times (one image per call). Video ignores count.

Official Grok login or official API key is required for Imagine tools.

The image/video **card** is the answer. Host `session://generated_image` plus any absolute path in the assistant text become attachments. Bare prose paths still show the leftover card (markdown ticks / `![]()` / links inline as usual). Studio CSS sizes the frame to a reading card (`min(100%, 26rem)` and a height cap, driven by `--img-ar`) so `aspect-ratio` cannot collapse to 0×0 and a 4:3 still is not a full-column poster.

Left-click (or right-click) a generated still opens the media menu. **Send to Grok Build** / **Send to Grok Office** start a new draft on that surface, attach the file, and switch the user there. Video uses the same send rows on its existing menu. A Studio session never opens on Build or Office (and the reverse): each id is tagged; a leftover Build draft stamp cannot ride into Studio.

Live activity marks match Build and Office: 3-dot harmonic scale for thinking / work; 4-square blue pulse while Imagine tools (`image_gen` / `image_to_video`) run. Same `ConversationThread` chrome.

## Do not

- Hide the transcript or put status only under the composer.
- Add Face / mic chrome until those tools exist.
- Hand-author Imagine HTTP.
- Hard-code UI copy; use `sidebar.studio*` / `slash.studio*` / `studio.*`.
