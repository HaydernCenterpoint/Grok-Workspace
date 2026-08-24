# Code quality progress

Ledger for `scripts/check-code-quality-gates.py`. CI `--mode final` is the merge gate.

## Waves

- Wave A: App.tsx freeze, no `window.confirm` / `alert` / `prompt` in `src/`.
- Wave B: Theme / composer / settings extracted; CSS split; commands + session_manager modules.
- Final: clippy `-D warnings`, `cargo fmt --check`, ESLint, Office sheet HTML sanitize.

## Status

FINAL: PASS

The numbered structural gates in CI already pass on this tree (App.tsx is a thin shell, Host commands live under `src-tauri/src/commands/`, session manager is a module dir). Residual product risk that is **not** a line-count gate is documented in [CODE-QUALITY-COMPLETION.md](./CODE-QUALITY-COMPLETION.md).
