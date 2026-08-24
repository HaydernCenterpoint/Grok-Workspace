import { useEffect, useRef, useState } from "react";
import { createT, type Locale } from "@/i18n";
import * as api from "@/lib/api";
import {
  DISCORD_CLIENT_ID_CHANGE_EVENT,
  buildDiscordPresence,
  classifyPresenceProgress,
  loadDiscordClientId,
  presenceEffortLabel,
  presenceSessionLabel,
  resolvePresenceStartSec,
  type DiscordPresenceProgress,
} from "@/lib/discordPresence";

const DEBOUNCE_MS = 400;
const MIN_INTERVAL_MS = 12_000;

export function useDiscordPresence(opts: {
  enabled: boolean;
  /** Main window only — secondary chats must not clear the live activity. */
  active: boolean;
  sessionState: string;
  sessionId: string;
  sessionTitle: string;
  sessionIsPlaceholder: boolean;
  quotaLabel: string | null;
  packageLabel: string;
  modelLabel: string;
  effortId: string;
  locale: Locale | string;
}): void {
  const startedAtRef = useRef(Math.floor(Date.now() / 1000));
  const sessionStartRef = useRef(startedAtRef.current);
  const turnStartRef = useRef<number | null>(null);
  const prevSessionIdRef = useRef<string | null>(null);
  const prevProgressRef = useRef<DiscordPresenceProgress | null>(null);
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
      prevSessionIdRef.current = null;
      prevProgressRef.current = null;
      void api.discordPresenceClear();
      return;
    }

    const tr = createT(opts.locale as Locale);
    const progress = classifyPresenceProgress(opts.sessionState);
    const nowSec = Math.floor(Date.now() / 1000);
    const clock = resolvePresenceStartSec({
      nowSec,
      sessionId: opts.sessionId,
      prevSessionId: prevSessionIdRef.current,
      prevProgress: prevProgressRef.current,
      progress,
      sessionStartSec: sessionStartRef.current,
      turnStartSec: turnStartRef.current,
    });
    sessionStartRef.current = clock.sessionStartSec;
    turnStartRef.current = clock.turnStartSec;
    prevSessionIdRef.current = opts.sessionId;
    prevProgressRef.current = progress;

    const payload = buildDiscordPresence({
      packageLabel: opts.packageLabel,
      quotaLabel: opts.quotaLabel,
      modelLabel: opts.modelLabel,
      effortLabel: presenceEffortLabel(opts.effortId, null, {
        high: tr("effort.high"),
        medium: tr("effort.medium"),
        low: tr("effort.low"),
        xhigh: tr("effort.xhigh"),
        max: tr("effort.max"),
      }),
      sessionLabel: presenceSessionLabel({
        title: opts.sessionTitle,
        sessionId: opts.sessionId,
        isPlaceholder: opts.sessionIsPlaceholder,
        untitledLabel: tr("session.untitled"),
      }),
      startSec: clock.startSec,
    });
    const key = `${payload.details}\n${payload.state}\n${payload.startSec}\n${clientId}`;
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
    opts.effortId,
    opts.locale,
    opts.modelLabel,
    opts.packageLabel,
    opts.quotaLabel,
    opts.sessionId,
    opts.sessionIsPlaceholder,
    opts.sessionState,
    opts.sessionTitle,
    clientId,
  ]);
}
