/**
 * ChatGPT-style in-app update bar: ready / downloading / manual / available.
 * Later hides this session (sidebar icon stays). Restart now uses the existing
 * install confirm — never skips signed install+relaunch confirm.
 */

import { useCallback, useEffect, useState } from "react";
import { UpdateInstallConfirmModal } from "@/components/UpdateInstallConfirmModal";
import { useUpdaterContext } from "@/hooks/UpdaterProvider";
import type { UpdateStatus } from "@/hooks/useUpdater";
import {
  AUTO_DOWNLOAD_UPDATES_CHANGE_EVENT,
  loadAutoDownloadUpdatesPref,
} from "@/lib/autoDownloadUpdatesPref";
import { needsInstallAndRestartConfirm } from "@/lib/appUpdateHonesty";
import {
  loadUpdateBannerDismiss,
  saveUpdateBannerDismiss,
  shouldShowUpdateBanner,
  updateBannerKindForStatus,
  type UpdateBannerKind,
} from "@/lib/updateBannerDismiss";
import { isUpdateSimActive } from "@/lib/updateSim";
import * as api from "@/lib/api";
import type { MessageKey } from "@/i18n";

function statusVersion(status: UpdateStatus): string | undefined {
  if (
    status.state === "available" ||
    status.state === "downloading" ||
    status.state === "ready" ||
    status.state === "installing" ||
    status.state === "restarting" ||
    status.state === "manual-required" ||
    status.state === "up-to-date"
  ) {
    return status.version;
  }
  return undefined;
}

function titleKey(kind: UpdateBannerKind): MessageKey {
  switch (kind) {
    case "ready":
      return "update.banner.ready";
    case "downloading":
      return "update.banner.downloading";
    case "manual":
    case "available":
      return "update.banner.manual";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function UpdateReadyBanner({
  t,
}: {
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}) {
  const { status, applyAvailableUpdate, checkForUpdate } = useUpdaterContext();
  const [busyClick, setBusyClick] = useState(false);
  const [confirmInstall, setConfirmInstall] = useState(false);
  const [dismissed, setDismissed] = useState(() => loadUpdateBannerDismiss());
  const [autoDownloadEnabled, setAutoDownloadEnabled] = useState(() =>
    loadAutoDownloadUpdatesPref(),
  );

  useEffect(() => {
    const sync = () => setAutoDownloadEnabled(loadAutoDownloadUpdatesPref());
    window.addEventListener(AUTO_DOWNLOAD_UPDATES_CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener(AUTO_DOWNLOAD_UPDATES_CHANGE_EVENT, sync);
    };
  }, []);
  const version = statusVersion(status);
  const kind = updateBannerKindForStatus(status.state, { autoDownloadEnabled });
  const visible = shouldShowUpdateBanner({
    state: status.state,
    version,
    dismissedVersion: dismissed?.version,
    dismissedKind: dismissed?.kind,
    autoDownloadEnabled,
  });

  const runApply = useCallback(async () => {
    if (busyClick) return;
    if (status.state === "installing" || status.state === "restarting") return;
    setBusyClick(true);
    try {
      const result = await applyAvailableUpdate();
      if (result.kind === "manual") {
        const url = result.downloadUrl || result.releaseUrl;
        if (url) {
          try {
            await api.openExternalUrl(url);
          } catch {
            /* About still has the full error line */
          }
        }
      }
    } finally {
      setBusyClick(false);
    }
  }, [applyAvailableUpdate, busyClick, status.state]);

  const onRestartNow = useCallback(() => {
    if (busyClick) return;
    if (needsInstallAndRestartConfirm(status)) {
      setConfirmInstall(true);
      return;
    }
    void runApply();
  }, [busyClick, runApply, status]);

  const onDownload = useCallback(() => {
    if (busyClick) return;
    if (status.state === "manual-required") {
      void runApply();
      return;
    }
    if (status.state === "available") {
      // User-started download only — do not arm installWhenReady.
      void checkForUpdate();
    }
  }, [busyClick, checkForUpdate, runApply, status.state]);

  const onLater = useCallback(() => {
    if (!kind) return;
    const tokenVersion = (version ?? "").trim();
    saveUpdateBannerDismiss(tokenVersion, kind);
    setDismissed({ version: tokenVersion, kind });
  }, [kind, version]);

  if (!visible || !kind || (!api.isDesktopHost() && !isUpdateSimActive())) {
    return null;
  }

  const title =
    kind === "downloading"
      ? t(titleKey(kind), { version: version ? ` (${version})` : "" })
      : t(titleKey(kind), { version: version ?? "" });

  const busy =
    busyClick ||
    status.state === "installing" ||
    status.state === "restarting";

  return (
    <>
      <div
        className={
          "update-ready-banner" +
          (kind === "downloading" ? " update-ready-banner--quiet" : "")
        }
        role="status"
        aria-live="polite"
        data-update-banner={kind}
        data-update-state={status.state}
      >
        <div className="update-ready-banner__text">{title}</div>
        <div className="update-ready-banner__actions">
          {kind === "ready" ? (
            <button
              type="button"
              className="btn btn--solid"
              disabled={busy}
              onClick={() => onRestartNow()}
            >
              {t("update.banner.now")}
            </button>
          ) : null}
          {kind === "manual" || kind === "available" ? (
            <button
              type="button"
              className="btn btn--solid"
              disabled={busy}
              onClick={() => onDownload()}
            >
              {t("update.banner.download")}
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={() => onLater()}
          >
            {t("update.banner.later")}
          </button>
        </div>
      </div>
      <UpdateInstallConfirmModal
        open={confirmInstall}
        version={version}
        t={t}
        onClose={() => setConfirmInstall(false)}
        onConfirm={() => {
          setConfirmInstall(false);
          void runApply();
        }}
      />
    </>
  );
}
