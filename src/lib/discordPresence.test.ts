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
  presenceProgressKey,
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

  it("builds details / state with package, progress, and percent", () => {
    const payload = buildDiscordPresence({
      projectName: "acme-api",
      workspaceLabel: "Grok Studio",
      packageLabel: "SuperGrok Heavy",
      progressLabel: "Working",
      percent: 42.4,
      startSec: 1_700_000_000,
    });
    expect(payload.details).toBe("acme-api · Grok Studio");
    expect(payload.state).toBe("SuperGrok Heavy · Working · 42%");
    expect(payload.startSec).toBe(1_700_000_000);
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
