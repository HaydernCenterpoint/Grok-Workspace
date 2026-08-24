/**
 * Reviewable Codex / Claude / installed-skill import.
 * Host scans disk; this modal never walks home directories.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import * as api from "@/lib/api";
import { createT, type Locale, type MessageKey } from "@/i18n";
import { GlassModal } from "@/components/GlassModal";
import { IconRefresh } from "@/components/icons";
import {
  defaultSelectedIds,
  isImportSkipReason,
  isSelectableImportItem,
  summarizeImportCounts,
} from "@/lib/externalConfigImport";

export type ExternalImportFocus = "all" | "skills" | "mcp" | "providers";

export interface ExternalImportModalProps {
  open: boolean;
  onClose: () => void;
  locale: Locale;
  projectPath?: string | null;
  focus?: ExternalImportFocus;
  onImported?: () => void;
  onToast?: (msg: string, ms?: number) => void;
}

function statusKey(status: string): MessageKey {
  switch (status) {
    case "importable":
      return "ext.import.status.importable";
    case "exists":
      return "ext.import.status.exists";
    case "already_visible":
      return "ext.import.status.alreadyVisible";
    case "missing_key":
      return "ext.import.status.missing_key";
    case "broken":
      return "ext.import.status.broken";
    default:
      return "ext.import.status.skip";
  }
}

function sourceKey(source: string): MessageKey {
  switch (source) {
    case "codex":
      return "ext.import.source.codex";
    case "claude":
      return "ext.import.source.claude";
    case "claude_desktop":
      return "ext.import.source.claudeDesktop";
    case "cursor":
      return "ext.import.source.cursor";
    case "agents":
      return "ext.import.source.agents";
    case "grok":
      return "ext.import.source.grok";
    case "project":
      return "ext.import.source.project";
    default:
      return "ext.import.source.codex";
  }
}

function reasonKey(reason: string | null | undefined): MessageKey | null {
  if (!isImportSkipReason(reason)) return null;
  switch (reason) {
    case "secret":
      return "ext.import.reason.secret";
    case "env_redacted":
      return "ext.import.reason.env_redacted";
    case "headers_redacted":
      return "ext.import.reason.headers_redacted";
    case "no_api_key":
      return "ext.import.reason.no_api_key";
    case "missing_base_url":
      return "ext.import.reason.missing_base_url";
    case "missing_command":
      return "ext.import.reason.missing_command";
    case "missing_url":
      return "ext.import.reason.missing_url";
    case "invalid_name":
      return "ext.import.reason.invalid_name";
    case "already_exists":
      return "ext.import.reason.already_exists";
    case "already_visible":
      return "ext.import.reason.already_visible";
    case "unreadable":
      return "ext.import.reason.unreadable";
    case "broken":
      return "ext.import.reason.broken";
    case "shared_readonly":
      return "ext.import.reason.shared_readonly";
    case "not_mapped":
      return "ext.import.reason.not_mapped";
    case "official_only":
      return "ext.import.reason.official_only";
    default: {
      const _exhaustive: never = reason;
      return _exhaustive;
    }
  }
}

function sectionKey(kind: string): MessageKey {
  switch (kind) {
    case "skill":
      return "ext.import.section.skills";
    case "mcp":
      return "ext.import.section.mcp";
    case "provider":
      return "ext.import.section.providers";
    default:
      return "ext.import.section.permissions";
  }
}

const KIND_ORDER = ["skill", "mcp", "permission", "provider"] as const;

function kindMatchesFocus(kind: string, focus: ExternalImportFocus): boolean {
  if (focus === "all") return true;
  if (focus === "skills") return kind === "skill";
  if (focus === "mcp") return kind === "mcp" || kind === "permission";
  if (focus === "providers") return kind === "provider" || kind === "mcp";
  return true;
}

export function ExternalImportModal({
  open,
  onClose,
  locale,
  projectPath = null,
  focus = "all",
  onImported,
  onToast,
}: ExternalImportModalProps) {
  const tr = useMemo(() => createT(locale), [locale]);
  const [scan, setScan] = useState<api.ExternalImportScanResult | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [switchIndependent, setSwitchIndependent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const runScan = useCallback(async () => {
    if (!api.isTauri()) {
      setError(tr("ext.import.needTauri"));
      return;
    }
    setScanBusy(true);
    setError(null);
    try {
      const r = await api.externalImportScan(projectPath);
      setScan(r);
      const visible = r.items.filter((it) => kindMatchesFocus(it.kind, focus));
      setSelected(new Set(defaultSelectedIds(visible)));
      if (!r.writable) setSwitchIndependent(false);
    } catch (e) {
      setError(String(e));
      setScan(null);
    } finally {
      setScanBusy(false);
    }
  }, [focus, projectPath, tr]);

  useEffect(() => {
    if (!open) return;
    setResultMsg(null);
    void runScan();
  }, [open, runScan]);

  const visibleItems = useMemo(() => {
    const items = scan?.items ?? [];
    const focused = items.filter((it) => kindMatchesFocus(it.kind, focus));
    // Always show other kinds as a reviewable remainder when something was found.
    if (focus === "all" || focused.length === 0) return items;
    const rest = items.filter((it) => !kindMatchesFocus(it.kind, focus));
    return [...focused, ...rest];
  }, [focus, scan]);

  const groups = useMemo(() => {
    const map = new Map<string, api.ExternalImportItem[]>();
    for (const kind of KIND_ORDER) map.set(kind, []);
    for (const it of visibleItems) {
      const list = map.get(it.kind) ?? [];
      list.push(it);
      map.set(it.kind, list);
    }
    return KIND_ORDER.map((kind) => ({
      kind,
      items: map.get(kind) ?? [],
    })).filter((g) => g.items.length > 0);
  }, [visibleItems]);

  const selectableCount = visibleItems.filter(isSelectableImportItem).length;
  const selectedCount = visibleItems.filter(
    (it) => selected.has(it.id) && isSelectableImportItem(it),
  ).length;
  const needsSwitch = !scan?.writable && visibleItems.some(
    (it) =>
      selected.has(it.id) &&
      isSelectableImportItem(it) &&
      (it.kind === "mcp" || it.kind === "permission"),
  );

  const toggle = (id: string, selectable: boolean) => {
    if (!selectable || importBusy) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runImport = async () => {
    if (!api.isTauri() || !scan) return;
    const ids = visibleItems
      .filter((it) => selected.has(it.id) && isSelectableImportItem(it))
      .map((it) => it.id);
    if (ids.length === 0) return;
    setImportBusy(true);
    setError(null);
    try {
      const r = await api.externalImportApply({
        ids,
        projectPath,
        switchToIndependent: needsSwitch && switchIndependent,
      });
      const tone = summarizeImportCounts({
        imported: r.imported,
        skipped: r.skipped,
        failed: r.failed.length,
      });
      const msg =
        tone === "ok"
          ? tr("ext.import.done", {
              n: String(r.imported),
              skipped: String(r.skipped),
            })
          : tr("ext.import.donePartial", {
              n: String(r.imported),
              skipped: String(r.skipped),
              failed: String(r.failed.length),
            });
      setResultMsg(msg);
      if (r.switchedToIndependent) {
        onToast?.(tr("prov.switchedToIndependent"), 5200);
      }
      onToast?.(msg, 4200);
      onImported?.();
      await runScan();
    } catch (e) {
      setError(String(e));
    } finally {
      setImportBusy(false);
    }
  };

  const presentHomes = (scan?.homes ?? []).filter((h) => h.present);

  return (
    <GlassModal
      open={open}
      onClose={() => !importBusy && onClose()}
      title={tr("ext.import.title")}
      size="lg"
      closeLabel={tr("common.close")}
      wrapBody
      bodyClassName="prov-cc-modal-body"
      footer={
        <>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={importBusy}
            onClick={onClose}
          >
            {tr("common.cancel")}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={scanBusy || importBusy}
            onClick={() => void runScan()}
          >
            <IconRefresh size={14} />
            {tr("ext.import.rescan")}
          </button>
          <button
            type="button"
            className="btn btn--solid"
            disabled={
              importBusy ||
              scanBusy ||
              selectedCount === 0 ||
              (needsSwitch && !switchIndependent)
            }
            onClick={() => void runImport()}
          >
            {importBusy
              ? tr("ext.import.importing")
              : tr("ext.import.importAction", { n: String(selectedCount) })}
          </button>
        </>
      }
    >
      <p className="prov-cc-muted">{tr("ext.import.lead")}</p>
      <p className="prov-cc-muted">{tr("ext.import.honesty")}</p>

      {scanBusy && !scan ? (
        <p className="prov-cc-status" role="status">
          {tr("ext.import.scanning")}
        </p>
      ) : null}

      {error ? (
        <div className="prov-cc-empty" role="alert">
          <p>{error}</p>
        </div>
      ) : null}

      {scan && presentHomes.length > 0 ? (
        <details className="prov-cc-paths">
          <summary>{tr("ext.import.homes")}</summary>
          <ul>
            {presentHomes.map((h) => (
              <li key={`${h.source}:${h.path}`}>
                <code>
                  {h.label} — {h.path}
                </code>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {scan && visibleItems.length === 0 && !scanBusy ? (
        <p className="prov-cc-empty">{tr("ext.import.noneFound")}</p>
      ) : null}

      {groups.map((group) => (
        <section key={group.kind} className="ext-import-section">
          <h3 className="ext-import-section__title">{tr(sectionKey(group.kind))}</h3>
          {group.kind === "provider" ? (
            <p className="prov-cc-muted">{tr("ext.import.cannotProviders")}</p>
          ) : null}
          <ul className="prov-cc-list" role="list">
            {group.items.map((it) => {
              const selectable = isSelectableImportItem(it);
              const checked = selected.has(it.id);
              const reason = reasonKey(it.reason);
              return (
                <li
                  key={it.id}
                  className={
                    "prov-cc-item" +
                    (checked ? " is-checked" : "") +
                    (!selectable ? " is-disabled" : "")
                  }
                >
                  <label className="prov-cc-item__row">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!selectable || importBusy}
                      onChange={() => toggle(it.id, selectable)}
                    />
                    <span className="prov-cc-item__main">
                      <span className="prov-cc-item__name">
                        {it.name}
                        <span className="prov-cc-badge">{tr(sourceKey(it.source))}</span>
                      </span>
                      <span className="prov-cc-item__sub">{it.detail || "—"}</span>
                      <span
                        className={
                          "prov-cc-item__status prov-cc-item__status--" + it.status
                        }
                      >
                        {tr(statusKey(it.status))}
                        {reason ? ` — ${tr(reason)}` : ""}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {scan && !scan.writable ? (
        <div className="ext-import-switch">
          <p className="prov-cc-muted">{tr("ext.import.sharedWarning")}</p>
          <label className="ext-import-switch__row">
            <input
              type="checkbox"
              checked={switchIndependent}
              disabled={importBusy || !needsSwitch}
              onChange={(e) => setSwitchIndependent(e.target.checked)}
            />
            <span>
              {tr("ext.import.switchIndependent")}
              <span className="prov-cc-muted">
                {" "}
                {tr("ext.import.switchIndependentHint")}
              </span>
            </span>
          </label>
        </div>
      ) : null}

      {selectableCount > 0 ? (
        <p className="prov-cc-muted">
          {tr("ext.import.selectImportable", { n: String(selectableCount) })}
        </p>
      ) : null}

      {resultMsg ? (
        <p className="prov-cc-result" role="status">
          {resultMsg}
        </p>
      ) : null}
    </GlassModal>
  );
}
