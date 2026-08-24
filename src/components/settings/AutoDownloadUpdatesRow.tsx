/**
 * Settings → About: local auto-download pref (signed path only).
 */

import { useCallback, useEffect, useState } from "react";
import { UiSwitch } from "./shared";
import {
  AUTO_DOWNLOAD_UPDATES_CHANGE_EVENT,
  loadAutoDownloadUpdatesPref,
  saveAutoDownloadUpdatesPref,
} from "@/lib/autoDownloadUpdatesPref";
import type { MessageKey } from "@/i18n";

export function AutoDownloadUpdatesRow({
  t,
  rowHighlight,
}: {
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  rowHighlight: (anchorId: string) => string;
}) {
  const [enabled, setEnabled] = useState(() => loadAutoDownloadUpdatesPref());

  useEffect(() => {
    const sync = () => setEnabled(loadAutoDownloadUpdatesPref());
    window.addEventListener(AUTO_DOWNLOAD_UPDATES_CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener(AUTO_DOWNLOAD_UPDATES_CHANGE_EVENT, sync);
    };
  }, []);

  const onToggle = useCallback((next: boolean) => {
    saveAutoDownloadUpdatesPref(next);
    setEnabled(next);
  }, []);

  return (
    <div
      className={
        "settings-row" + rowHighlight("settings-anchor-autoDownloadUpdates")
      }
      id="settings-anchor-autoDownloadUpdates"
    >
      <div className="settings-row__text">
        <div className="settings-row__label">
          {t("settings.autoDownloadUpdates")}
        </div>
        <div className="settings-row__desc">
          {t("settings.autoDownloadUpdatesDesc")}
        </div>
      </div>
      <UiSwitch
        checked={enabled}
        label={t("settings.autoDownloadUpdates")}
        onChange={onToggle}
      />
    </div>
  );
}
