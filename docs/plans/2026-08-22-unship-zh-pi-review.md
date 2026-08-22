## 结论：**未完成（pi 不可用）**

审查对象：暂时下架中文 UI（`zh` / `zh-TW` 移出 `LOCALES`，OS/设置回落 `en`，目录留盘）。

按 AGENTS.md §8 调用 `pi -p`（工具仅 `read`/`bash`）。本机 `Get-Command pi` 空。未用其它模型顶替审查。

**本项不得标为已 pi 审过。** 装好 `pi` 后重跑，有 blocker 再修。

自测（不能代替 pi）：`pnpm typecheck` 通过；Vitest `src/i18n` + settings/error/session/heatmap/kanban 通过。`cargo test` 因本机缺 `link.exe`（MSVC）编不过。
