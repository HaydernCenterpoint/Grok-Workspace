; Grok Workspace NSIS chrome. Tauri includes this before the MUI pages.
; Keep every string ASCII: makensis mangles non-ASCII from this template path,
; and BrandingText / page copy is user-visible.

; Welcome / Finish run dark to match the sidebar art; inner pages stay native.
!define MUI_ABORTWARNING
!define MUI_BGCOLOR 0A0A0A
!define MUI_TEXTCOLOR F2F2F2

!define MUI_WELCOMEPAGE_TITLE "Grok Workspace"
!define MUI_WELCOMEPAGE_TEXT "A light desktop workbench for the Grok Build CLI.$\r$\n$\r$\nThree surfaces - Build, Office, and Studio - on one app, one agent, one project folder.$\r$\n$\r$\nClick Next to continue."

!define MUI_FINISHPAGE_TITLE "Ready to work"
!define MUI_FINISHPAGE_TEXT "Grok Workspace is installed.$\r$\n$\r$\nOpen it, point it at a project folder, and connect the Grok Build CLI."
!define MUI_FINISHPAGE_RUN_TEXT "Open Grok Workspace"
