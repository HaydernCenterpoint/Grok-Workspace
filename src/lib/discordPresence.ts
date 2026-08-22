/**
 * Discord Rich Presence payload + local pref.
 * Host IPC (`discord_presence_*`) is optional — fail closed if Discord is off.
 */

import { productTitleKey, type WorkMode } from "@/lib/grokOffice";
import { tierLabel } from "@/lib/accountUi";
import type { BillingSnapshot } from "@/lib/api";
import type { MessageKey } from "@/i18n";

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

export function buildDiscordPresence(opts: {
  projectName: string;
  workspaceLabel: string;
  packageLabel: string;
  progressLabel: string;
  percent: number | null;
  startSec: number;
}): DiscordPresencePayload {
  const project = opts.projectName.trim() || opts.workspaceLabel;
  const details = truncatePresenceLine(`${project} · ${opts.workspaceLabel}`);
  const bits = [opts.packageLabel.trim(), opts.progressLabel.trim()].filter(
    Boolean,
  );
  if (opts.percent != null && Number.isFinite(opts.percent)) {
    bits.push(`${Math.max(0, Math.min(100, Math.round(opts.percent)))}%`);
  }
  const state = truncatePresenceLine(bits.join(" · "));
  const startSec =
    Number.isFinite(opts.startSec) && opts.startSec > 0
      ? Math.floor(opts.startSec)
      : Math.floor(Date.now() / 1000);
  return { details, state, startSec };
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
