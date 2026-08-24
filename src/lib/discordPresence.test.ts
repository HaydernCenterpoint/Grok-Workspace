import { describe, expect, it } from "vitest";
import {
  DEFAULT_DISCORD_PRESENCE,
  DISCORD_CLIENT_ID_STORAGE_KEY,
  DISCORD_PRESENCE_STORAGE_KEY,
  buildDiscordPresence,
  classifyPresenceProgress,
  loadDiscordPresencePref,
  packagePresenceLabel,
  parseDiscordPresencePref,
  presenceEffortLabel,
  presenceModelLabel,
  presenceProgressKey,
  presenceQuotaLabel,
  presenceQuotaLine,
  presenceSessionLabel,
  resolvePresenceStartSec,
  saveDiscordPresencePref,
  truncatePresenceLine,
  workspacePresenceKey,
  discordPresenceStatusKey,
  parseDiscordClientId,
  saveDiscordClientId,
  type DiscordPresenceStorage,
} from "./discordPresence";

function memoryStorage(
  initial: Record<string, string> = {},
): DiscordPresenceStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem(key) {
      return key in data ? data[key]! : null;
    },
    setItem(key, value) {
      data[key] = value;
    },
  };
}

describe("discordPresence", () => {
  it("defaults on and parses stored pref", () => {
    expect(DEFAULT_DISCORD_PRESENCE).toBe(true);
    expect(parseDiscordPresencePref(null)).toBe(true);
    expect(parseDiscordPresencePref("0")).toBe(false);
    const storage = memoryStorage();
    expect(loadDiscordPresencePref(storage)).toBe(true);
    saveDiscordPresencePref(false, storage);
    expect(storage.data[DISCORD_PRESENCE_STORAGE_KEY]).toBe("0");
    expect(loadDiscordPresencePref(storage)).toBe(false);
  });

  it("maps session state to progress", () => {
    expect(classifyPresenceProgress("streaming")).toBe("working");
    expect(classifyPresenceProgress("awaiting_permission")).toBe("waiting");
    expect(classifyPresenceProgress("connecting")).toBe("connecting");
    expect(classifyPresenceProgress("ready")).toBe("idle");
    expect(presenceProgressKey("working")).toBe(
      "discord.presence.progress.working",
    );
  });

  it("titles workspace from the product surface", () => {
    expect(workspacePresenceKey("code")).toBe("sidebar.build");
    expect(workspacePresenceKey("office")).toBe("sidebar.office");
    expect(workspacePresenceKey("studio")).toBe("sidebar.studio");
  });

  it("builds details / state / assets with plan, quota, model, effort, session", () => {
    const payload = buildDiscordPresence({
      packageLabel: "SuperGrok Heavy",
      quotaLabel: "99%",
      modelLabel: "Grok 4.6",
      effortLabel: "Extra high",
      sessionLabel: "Fix login",
      startSec: 1_700_000_000,
    });
    expect(payload.details).toBe("SuperGrok Heavy · 99%");
    expect(payload.state).toBe("Grok 4.6 · Extra high · Fix login");
    expect(payload.largeText).toBe("Fix login");
    expect(payload.smallText).toBe("Grok 4.6 · Extra high");
    expect(payload.startSec).toBe(1_700_000_000);
  });

  it("omits unknown quota and maps session / effort / model helpers", () => {
    expect(presenceQuotaLabel(null)).toBeNull();
    expect(presenceQuotaLabel(99.4)).toBe("99%");
    expect(
      presenceQuotaLine({
        signedIn: true,
        remainingPercent: 42,
        customRoute: false,
      }),
    ).toBe("42%");
    expect(
      presenceQuotaLine({
        signedIn: true,
        remainingPercent: 42,
        customRoute: true,
        customBalanceLine: "110.00 CNY",
      }),
    ).toBe("110.00 CNY");
    expect(
      presenceSessionLabel({
        title: "New chat",
        sessionId: "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
        isPlaceholder: true,
        untitledLabel: "Untitled",
      }),
    ).toBe("a1b2c3d4");
    expect(
      presenceSessionLabel({
        title: "Fix login",
        sessionId: "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
        isPlaceholder: false,
        untitledLabel: "Untitled",
      }),
    ).toBe("Fix login");
    expect(
      presenceModelLabel({
        modelId: "grok-4.6",
        officialLabel: "Grok 4.6",
      }),
    ).toBe("Grok 4.6");
    expect(
      presenceEffortLabel("xhigh", null, {
        high: "High",
        medium: "Medium",
        low: "Low",
        xhigh: "Extra high",
      }),
    ).toBe("Extra high");
  });

  it("resets elapsed on session change and turn start", () => {
    const session = resolvePresenceStartSec({
      nowSec: 100,
      sessionId: "a",
      prevSessionId: null,
      prevProgress: null,
      progress: "idle",
      sessionStartSec: 1,
      turnStartSec: null,
    });
    expect(session.startSec).toBe(100);
    const turn = resolvePresenceStartSec({
      nowSec: 140,
      sessionId: "a",
      prevSessionId: "a",
      prevProgress: "idle",
      progress: "working",
      sessionStartSec: session.sessionStartSec,
      turnStartSec: session.turnStartSec,
    });
    expect(turn.startSec).toBe(140);
    const idle = resolvePresenceStartSec({
      nowSec: 200,
      sessionId: "a",
      prevSessionId: "a",
      prevProgress: "working",
      progress: "idle",
      sessionStartSec: turn.sessionStartSec,
      turnStartSec: turn.turnStartSec,
    });
    expect(idle.startSec).toBe(100);
  });

  it("uses Free when signed out and truncates long lines", () => {
    expect(
      packagePresenceLabel({
        signedIn: false,
        billing: null,
        channel: "none",
        noneLabel: "Free",
      }),
    ).toBe("Free");
    expect(truncatePresenceLine("a".repeat(200)).length).toBe(128);
    expect(truncatePresenceLine("a".repeat(200)).endsWith("…")).toBe(true);
  });

  it("maps Host errors to settings status keys", () => {
    expect(discordPresenceStatusKey(false, null)).toBe(
      "settings.discordPresence.status.off",
    );
    expect(discordPresenceStatusKey(true, null)).toBe(
      "settings.discordPresence.status.live",
    );
    expect(
      discordPresenceStatusKey(true, "Command discord_presence_probe not found"),
    ).toBe("settings.discordPresence.status.needRebuild");
    expect(discordPresenceStatusKey(true, "discord ipc not found")).toBe(
      "settings.discordPresence.status.noDiscord",
    );
    expect(discordPresenceStatusKey(true, "invalid_client_id")).toBe(
      "settings.discordPresence.status.needApp",
    );
  });

  it("accepts a Discord Application ID snowflake", () => {
    expect(parseDiscordClientId(" 1425847201832636416 ")).toBe(
      "1425847201832636416",
    );
    expect(parseDiscordClientId("abc")).toBe("");
    const storage = memoryStorage();
    expect(saveDiscordClientId("123456789012345678", storage)).toBe(
      "123456789012345678",
    );
    expect(storage.data[DISCORD_CLIENT_ID_STORAGE_KEY]).toBe(
      "123456789012345678",
    );
  });
});
