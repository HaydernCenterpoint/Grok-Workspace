/**
 * Discord Rich Presence payload + local pref.
 * Host IPC (`discord_presence_*`) is optional — fail closed if Discord is off.
 */

import { productTitleKey, type WorkMode } from "@/lib/grokOffice";
import { tierLabel } from "@/lib/accountUi";
import type { BillingSnapshot } from "@/lib/api";
import type { MessageKey } from "@/i18n";
import {
  effortDisplayLabel,
  spawnIdToEffortUiSlot,
  type EffortOption,
} from "@/lib/grokCatalog";

export const DISCORD_PRESENCE_STORAGE_KEY = "grok.discordPresence";
export const DISCORD_PRESENCE_CHANGE_EVENT = "grok-discord-presence-change";
export const DISCORD_CLIENT_ID_STORAGE_KEY = "grok.discordPresence.clientId";
export const DISCORD_CLIENT_ID_CHANGE_EVENT =
  "grok-discord-presence-client-id-change";
/** Built-in: show presence unless the user turns it off. */
export const DEFAULT_DISCORD_PRESENCE = true;

export const DISCORD_PRESENCE_LINE_MAX = 128;

export type DiscordPresenceProgress =
  | "idle"
  | "working"
  | "waiting"
  | "connecting";

export type DiscordPresencePayload = {
  details: string;
  state: string;
  startSec: number;
  /** Hover on the large asset (session). Shown when Discord has app art. */
  largeText: string;
  /** Hover on the small asset (model · effort). */
  smallText: string;
};

export type DiscordPresenceStorage = {
  getItem(key: string): string | null;
  setItem?(key: string, value: string): void;
};

export function parseDiscordPresencePref(raw: unknown): boolean {
  if (raw === "0" || raw === "false" || raw === false) return false;
  if (raw === "1" || raw === "true" || raw === true) return true;
  return DEFAULT_DISCORD_PRESENCE;
}

export function loadDiscordPresencePref(
  storage: DiscordPresenceStorage = typeof localStorage !== "undefined"
    ? localStorage
    : { getItem: () => null },
): boolean {
  try {
    return parseDiscordPresencePref(storage.getItem(DISCORD_PRESENCE_STORAGE_KEY));
  } catch {
    return DEFAULT_DISCORD_PRESENCE;
  }
}

export function saveDiscordPresencePref(
  enabled: boolean,
  storage: DiscordPresenceStorage = typeof localStorage !== "undefined"
    ? localStorage
    : { getItem: () => null },
): void {
  try {
    storage.setItem?.(DISCORD_PRESENCE_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* private mode / quota */
  }
  if (
    typeof window !== "undefined" &&
    typeof window.dispatchEvent === "function"
  ) {
    try {
      window.dispatchEvent(
        new CustomEvent(DISCORD_PRESENCE_CHANGE_EVENT, { detail: enabled }),
      );
    } catch {
      /* ignore */
    }
  }
}

export function classifyPresenceProgress(
  sessionState: string,
): DiscordPresenceProgress {
  switch (sessionState) {
    case "streaming":
      return "working";
    case "awaiting_permission":
      return "waiting";
    case "connecting":
      return "connecting";
    default:
      return "idle";
  }
}

export function presenceProgressKey(
  progress: DiscordPresenceProgress,
): MessageKey {
  switch (progress) {
    case "working":
      return "discord.presence.progress.working";
    case "waiting":
      return "discord.presence.progress.waiting";
    case "connecting":
      return "discord.presence.progress.connecting";
    case "idle":
      return "discord.presence.progress.idle";
    default: {
      const _never: never = progress;
      return _never;
    }
  }
}

export function truncatePresenceLine(
  text: string,
  max = DISCORD_PRESENCE_LINE_MAX,
): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  if (max <= 1) return "…";
  return `${t.slice(0, max - 1)}…`;
}

export function packagePresenceLabel(opts: {
  signedIn: boolean;
  billing: BillingSnapshot | null | undefined;
  channel: string;
  noneLabel: string;
}): string {
  if (!opts.signedIn || !opts.billing) return opts.noneLabel;
  const label = tierLabel(opts.billing, opts.channel).trim();
  if (!label || label === "—") return opts.noneLabel;
  return label;
}

/** Honest remaining-% chip, same rounding as the sidebar footer. Never invents. */
export function presenceQuotaLabel(
  remaining: number | null | undefined,
): string | null {
  if (remaining == null || !Number.isFinite(remaining)) return null;
  return `${Math.max(0, Math.min(100, Math.round(remaining)))}%`;
}

/**
 * Quota line for presence: official remaining % (sidebar 99%), or the
 * custom-route balance chip when that is what the footer shows.
 */
export function presenceQuotaLine(opts: {
  signedIn: boolean;
  remainingPercent: number | null;
  customRoute: boolean;
  customBalanceLine?: string | null;
}): string | null {
  if (opts.customRoute) {
    const line = opts.customBalanceLine?.trim();
    return line || null;
  }
  if (!opts.signedIn) return null;
  return presenceQuotaLabel(opts.remainingPercent);
}

export function presenceModelLabel(opts: {
  modelId: string;
  officialLabel?: string | null;
  customModelName?: string | null;
}): string {
  const custom = opts.customModelName?.trim();
  if (custom) return custom;
  const official = opts.officialLabel?.trim();
  if (official) return official;
  return opts.modelId.trim() || "Grok";
}

export function presenceEffortLabel(
  effortId: string,
  catalogEfforts: EffortOption[] | null | undefined,
  i18n: {
    high?: string;
    medium?: string;
    low?: string;
    xhigh?: string;
    max?: string;
  },
): string {
  const slot = spawnIdToEffortUiSlot(effortId, catalogEfforts);
  return effortDisplayLabel(slot ?? effortId, i18n);
}

export function presenceSessionLabel(opts: {
  title?: string | null;
  sessionId?: string | null;
  isPlaceholder: boolean;
  untitledLabel: string;
}): string {
  const title = (opts.title ?? "").trim();
  if (title && !opts.isPlaceholder) return title;
  const id = (opts.sessionId ?? "").trim();
  if (id) {
    const compact = id.replace(/-/g, "");
    return (compact || id).slice(0, 8);
  }
  return opts.untitledLabel.trim() || "session";
}

/**
 * Elapsed clock: session open time while idle; current turn while working.
 * Resets when the session id changes or a new turn starts.
 */
export function resolvePresenceStartSec(opts: {
  nowSec: number;
  sessionId: string;
  prevSessionId: string | null;
  prevProgress: DiscordPresenceProgress | null;
  progress: DiscordPresenceProgress;
  sessionStartSec: number;
  turnStartSec: number | null;
}): {
  startSec: number;
  sessionStartSec: number;
  turnStartSec: number | null;
} {
  const now =
    Number.isFinite(opts.nowSec) && opts.nowSec > 0
      ? Math.floor(opts.nowSec)
      : Math.floor(Date.now() / 1000);
  let sessionStartSec = opts.sessionStartSec;
  let turnStartSec = opts.turnStartSec;

  if (opts.prevSessionId == null || opts.sessionId !== opts.prevSessionId) {
    sessionStartSec = now;
    turnStartSec = opts.progress === "working" ? now : null;
  } else if (opts.progress === "working" && opts.prevProgress !== "working") {
    turnStartSec = now;
  } else if (opts.progress !== "working") {
    turnStartSec = null;
  }

  const startSec =
    opts.progress === "working" && turnStartSec != null
      ? turnStartSec
      : sessionStartSec;
  return { startSec, sessionStartSec, turnStartSec };
}

export function buildDiscordPresence(opts: {
  packageLabel: string;
  quotaLabel: string | null;
  modelLabel: string;
  effortLabel: string;
  sessionLabel: string;
  startSec: number;
}): DiscordPresencePayload {
  const details = truncatePresenceLine(
    [opts.packageLabel.trim(), opts.quotaLabel?.trim()]
      .filter(Boolean)
      .join(" · "),
  );
  const model = opts.modelLabel.trim();
  const effort = opts.effortLabel.trim();
  const session = opts.sessionLabel.trim();
  const state = truncatePresenceLine(
    [model, effort, session].filter(Boolean).join(" · "),
  );
  const startSec =
    Number.isFinite(opts.startSec) && opts.startSec > 0
      ? Math.floor(opts.startSec)
      : Math.floor(Date.now() / 1000);
  return {
    details,
    state,
    startSec,
    largeText: truncatePresenceLine(session),
    smallText: truncatePresenceLine([model, effort].filter(Boolean).join(" · ")),
  };
}

export function workspacePresenceKey(mode: WorkMode): MessageKey {
  return productTitleKey(mode);
}

export function parseDiscordClientId(raw: unknown): string {
  const s = String(raw ?? "").replace(/\D/g, "");
  if (s.length < 17 || s.length > 20) return "";
  return s;
}

export function loadDiscordClientId(
  storage: DiscordPresenceStorage = typeof localStorage !== "undefined"
    ? localStorage
    : { getItem: () => null },
): string {
  try {
    return parseDiscordClientId(storage.getItem(DISCORD_CLIENT_ID_STORAGE_KEY));
  } catch {
    return "";
  }
}

export function saveDiscordClientId(
  clientId: string,
  storage: DiscordPresenceStorage = typeof localStorage !== "undefined"
    ? localStorage
    : { getItem: () => null },
): string {
  const id = parseDiscordClientId(clientId);
  try {
    if (id) storage.setItem?.(DISCORD_CLIENT_ID_STORAGE_KEY, id);
    else storage.setItem?.(DISCORD_CLIENT_ID_STORAGE_KEY, "");
  } catch {
    /* private mode / quota */
  }
  if (
    typeof window !== "undefined" &&
    typeof window.dispatchEvent === "function"
  ) {
    try {
      window.dispatchEvent(
        new CustomEvent(DISCORD_CLIENT_ID_CHANGE_EVENT, { detail: id }),
      );
    } catch {
      /* ignore */
    }
  }
  return id;
}

export function discordPresenceStatusKey(
  enabled: boolean,
  error: string | null | undefined,
): MessageKey {
  if (!enabled) return "settings.discordPresence.status.off";
  if (!error) return "settings.discordPresence.status.live";
  const e = error.toLowerCase();
  if (
    e.includes("not allowed") ||
    e.includes("unknown command") ||
    (e.includes("command") && e.includes("not found"))
  ) {
    return "settings.discordPresence.status.needRebuild";
  }
  if (
    e.includes("discord ipc not found") ||
    e.includes("cannot find") ||
    e.includes("os error 2") ||
    e.includes("no such file") ||
    e.includes("the system cannot find")
  ) {
    return "settings.discordPresence.status.noDiscord";
  }
  if (
    e.includes("invalid_client") ||
    e.includes("invalid client") ||
    e.includes("unknown application")
  ) {
    return "settings.discordPresence.status.needApp";
  }
  return "settings.discordPresence.status.failed";
}
