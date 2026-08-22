# Grok Studio

Image and video **surface** for Grok Imagine. Same chat column as Grok Build — thinking, reasoning, and the image/video card appear **above** the composer, like a normal chat. Not Grok Office.

## Surface

| | Grok Studio |
|---|---|
| Job | Generate images and short videos |
| Main column | Normal chat transcript (user prompt, thinking, tools, media) |
| Composer | Imagine (locked) + image / video / aspect / resolution / duration. No Build model, effort, access, or workspace chip |
| Prefs | Own `localStorage` overlay (`grok.surfaceComposerPrefs.v1`). Host `composer_prefs_*` stays Grok Build |
| Switcher | Sidebar Grok logo (Build / Office / Studio) |

Mode is `studio` (`src/lib/grokOffice.ts`, `html[data-work-mode]`, same `grok.workMode` key). Deep link `#/studio`. Slash `/studio`. Palette **Grok Studio**.

## How generate works

No second agent and no side “Generating…” under the box. Send goes through the current ACP session. The journal stores the user’s prompt; the agent text is wrapped (`wrapStudioAgentText`) so the model calls `image_gen` / `image_to_video` with the bar settings.

Official Grok login or official API key is required for Imagine tools.

## Do not

- Hide the transcript or put status only under the composer.
- Add Face / mic chrome until those tools exist.
- Hand-author Imagine HTTP.
- Hard-code UI copy; use `sidebar.studio*` / `slash.studio*` / `studio.*`.
