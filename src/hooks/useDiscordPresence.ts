import { useEffect, useRef, useState } from "react";
import { createT, type Locale } from "@/i18n";
import * as api from "@/lib/api";
import {
  DISCORD_CLIENT_ID_CHANGE_EVENT,
  buildDiscordPresence,
  classifyPresenceProgress,
  loadDiscordClientId,
  presenceProgressKey,
  workspacePresenceKey,
} from "@/lib/discordPresence";
import type { WorkMode } from "@/lib/grokOffice";

const DEBOUNCE_MS = 400;
const MIN_INTERVAL_MS = 12_000;

export function useDiscordPresence(opts: {
  enabled: boolean;
  /** Main window only — secondary chats must not clear the live activity. */
  active: boolean;
  projectName: string;
  workMode: WorkMode;
  sessionState: string;
  percent: number | null;
  packageLabel: string;
  locale: Locale | string;
}): void {
  const startedAtRef = useRef(Math.floor(Date.now() / 1000));
  const lastKeyRef = useRef("");
  const lastSentAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const [clientId, setClientId] = useState(loadDiscordClientId);

  useEffect(() => {
    const onChange = () => setClientId(loadDiscordClientId());
    window.addEventListener(DISCORD_CLIENT_ID_CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener(DISCORD_CLIENT_ID_CHANGE_EVENT, onChange);
    };
  }, []);

  useEffect(() => {
    if (!opts.active || !api.isDesktopHost()) return;
    if (!opts.enabled) {
      lastKeyRef.current = "";
      void api.discordPresenceClear();
      return;
    }

    const tr = createT(opts.locale as Locale);
    const progress = classifyPresenceProgress(opts.sessionState);
    const payload = buildDiscordPresence({
      projectName: opts.projectName,
      workspaceLabel: tr(workspacePresenceKey(opts.workMode)),
      packageLabel: opts.packageLabel,
      progressLabel: tr(presenceProgressKey(progress)),
      percent: opts.percent,
      startSec: startedAtRef.current,
    });
    const key = `${payload.details}\n${payload.state}\n${clientId}`;
    const same = key === lastKeyRef.current;
    const due = Date.now() - lastSentAtRef.current >= MIN_INTERVAL_MS;
    if (same && !due) return;

    const send = () => {
      lastKeyRef.current = key;
      lastSentAtRef.current = Date.now();
      void api.discordPresenceUpdate({
        ...payload,
        clientId: clientId || undefined,
      });
    };

    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(send, same ? MIN_INTERVAL_MS : DEBOUNCE_MS);

    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    opts.active,
    opts.enabled,
    opts.locale,
    opts.packageLabel,
    opts.percent,
    opts.projectName,
    opts.sessionState,
    opts.workMode,
    clientId,
  ]);
}
