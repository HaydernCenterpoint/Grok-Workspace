import { beforeAll, describe, expect, it } from "vitest";
import { createT, loadAllLocaleCatalogs } from "@/i18n";
import {
  SETTINGS_ENTRIES,
  SETTINGS_NAV,
  SETTINGS_SECTION_IDS,
  buildSettingsHash,
  catalogInvariants,
  defaultTabFor,
  isSettingsSectionId,
  keywordKeysForSection,
  parseSettingsHash,
  resolveTab,
  searchSettingsEntries,
} from "./settingsCatalog";

describe("settingsCatalog", () => {
  beforeAll(async () => {
    await loadAllLocaleCatalogs();
  });

  it("has no structural invariants broken", () => {
    expect(catalogInvariants()).toEqual([]);
  });

  it("registers About auto-download updates", () => {
    const entry = SETTINGS_ENTRIES.find((e) => e.id === "about.autoDownloadUpdates");
    expect(entry?.section).toBe("about");
    expect(entry?.anchorId).toBe("settings-anchor-autoDownloadUpdates");
    expect(entry?.labelKey).toBe("settings.autoDownloadUpdates");
  });

  it("registers three distinct static skin-share anchors", () => {
    const presets = SETTINGS_ENTRIES.find((e) => e.id === "appearance.skinPresets");
    const catalog = SETTINGS_ENTRIES.find((e) => e.id === "appearance.skinCatalog");
    const sources = SETTINGS_ENTRIES.find((e) => e.id === "appearance.skinSources");
    expect(presets?.anchorId).toBe("settings-anchor-skin-presets");
    expect(catalog?.anchorId).toBe("settings-anchor-skin-catalog");
    expect(sources?.anchorId).toBe("settings-anchor-skin-sources");
    expect(new Set([presets?.anchorId, catalog?.anchorId, sources?.anchorId]).size).toBe(3);
  });

  it("lists each section exactly once in NAV", () => {
    const ids = SETTINGS_NAV.map((n) => n.id);
    expect(ids).toEqual([...SETTINGS_SECTION_IDS]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("registers at least one entry per section", () => {
    for (const id of SETTINGS_SECTION_IDS) {
      expect(
        SETTINGS_ENTRIES.some((e) => e.section === id),
        `missing entries for ${id}`,
      ).toBe(true);
    }
  });

  it("parseSettingsHash handles section and tab", () => {
    expect(parseSettingsHash("settings")).toEqual({
      section: "general",
      tab: "composer",
    });
    expect(parseSettingsHash("#/settings/extensions")).toEqual({
      section: "extensions",
      tab: "plugins",
    });
    expect(parseSettingsHash("settings/extensions/mcp")).toEqual({
      section: "extensions",
      tab: "mcp",
    });
    expect(parseSettingsHash("settings/runtime/tools")).toEqual({
      section: "runtime",
      tab: "tools",
    });
    // Query (PR hub deep link) must not break section/tab parse.
    expect(parseSettingsHash("#/settings/runtime/tools?pr=42")).toEqual({
      section: "runtime",
      tab: "tools",
    });
    expect(parseSettingsHash("settings/bogus/x")).toEqual({
      section: "general",
      tab: "composer",
    });
    expect(parseSettingsHash("settings/appearance")).toEqual({
      section: "appearance",
      tab: "theme",
    });
    expect(parseSettingsHash("settings/appearance/interface")).toEqual({
      section: "appearance",
      tab: "interface",
    });
    expect(parseSettingsHash("settings/extensions/not-a-tab")).toEqual({
      section: "extensions",
      tab: "plugins",
    });
  });

  it("buildSettingsHash is stable and round-trips", () => {
    expect(buildSettingsHash({ section: "general" })).toBe(
      "#/settings/general/composer",
    );
    expect(buildSettingsHash({ section: "extensions", tab: "mcp" })).toBe(
      "#/settings/extensions/mcp",
    );
    expect(buildSettingsHash({ section: "about" })).toBe("#/settings/about");
    const h = buildSettingsHash({ section: "runtime", tab: "pool" });
    expect(parseSettingsHash(h)).toEqual({ section: "runtime", tab: "pool" });
  });

  it("resolveTab falls back to default", () => {
    expect(defaultTabFor("extensions")).toBe("plugins");
    expect(resolveTab("extensions", "mcp")).toBe("mcp");
    expect(resolveTab("extensions", "nope")).toBe("plugins");
    expect(resolveTab("about", "x")).toBeNull();
  });

  it("extensions has no market tab; market deep-link → plugins catalog", () => {
    const extNav = SETTINGS_NAV.find((n) => n.id === "extensions");
    expect(extNav?.tabs.map((t) => t.id)).toEqual([
      "plugins",
      "mcp",
      "skills",
      "agents",
      "hooks",
    ]);
    expect(extNav?.tabs.some((t) => t.id === "market")).toBe(false);
    expect(resolveTab("extensions", "market")).toBe("plugins");
    expect(parseSettingsHash("#/settings/extensions/market")).toEqual({
      section: "extensions",
      tab: "plugins",
    });
    expect(parseSettingsHash("settings/extensions/market")).toEqual({
      section: "extensions",
      tab: "plugins",
    });
    const marketEntry = SETTINGS_ENTRIES.find((e) => e.id === "ext.market");
    expect(marketEntry?.tab).toBe("plugins");
    expect(marketEntry?.anchorId).toBe("settings-anchor-ext-plugins-catalog");
    const tEn = createT("en");
    const hits = searchSettingsEntries("marketplace", tEn, tEn);
    expect(hits.some((h) => h.entry.id === "ext.market")).toBe(true);
    expect(hits.every((h) => h.entry.tab === "plugins" || h.entry.tab == null)).toBe(
      true,
    );
    expect(
      hits.some(
        (h) =>
          h.entry.id === "ext.market" &&
          h.entry.tab === "plugins" &&
          h.entry.anchorId === "settings-anchor-ext-plugins-catalog",
      ),
    ).toBe(true);
  });

  it("isSettingsSectionId", () => {
    expect(isSettingsSectionId("runtime")).toBe(true);
    expect(isSettingsSectionId("pet")).toBe(true);
    expect(isSettingsSectionId("nope")).toBe(false);
  });

  it("pet is a first-class nav section with look · bubbles tabs", () => {
    expect(SETTINGS_NAV.some((n) => n.id === "pet")).toBe(true);
    expect(SETTINGS_ENTRIES.some((e) => e.section === "pet")).toBe(true);
    expect(defaultTabFor("pet")).toBe("look");
    expect(resolveTab("pet", "bubbles")).toBe("bubbles");
    expect(resolveTab("pet", "nope")).toBe("look");
    expect(buildSettingsHash({ section: "pet" })).toBe("#/settings/pet/look");
    expect(buildSettingsHash({ section: "pet", tab: "bubbles" })).toBe(
      "#/settings/pet/bubbles",
    );
    expect(parseSettingsHash("#/settings/pet")).toEqual({
      section: "pet",
      tab: "look",
    });
    expect(parseSettingsHash("settings/pet")).toEqual({
      section: "pet",
      tab: "look",
    });
    expect(parseSettingsHash("settings/pet/bubbles")).toEqual({
      section: "pet",
      tab: "bubbles",
    });
    const loc = parseSettingsHash(buildSettingsHash({ section: "pet" }));
    expect(loc).toEqual({ section: "pet", tab: "look" });
    expect(SETTINGS_ENTRIES.find((e) => e.id === "pet.identity")?.tab).toBe("look");
    expect(SETTINGS_ENTRIES.find((e) => e.id === "pet.bubbles")?.tab).toBe(
      "bubbles",
    );
  });

  it("search finds pet menu", () => {
    const tEn = createT("en");
    const enHits = searchSettingsEntries("pet", tEn, tEn);
    expect(enHits.some((h) => h.entry.section === "pet")).toBe(true);
    expect(enHits.some((h) => h.entry.id === "pet.companion")).toBe(true);
    const eyeEn = searchSettingsEntries("eye color", tEn, tEn);
    expect(eyeEn.some((h) => h.entry.section === "pet")).toBe(true);
    expect(eyeEn.some((h) => h.entry.id === "pet.eyeColor")).toBe(true);
    const bubbleHits = searchSettingsEntries("bubbles", tEn, tEn);
    expect(bubbleHits.some((h) => h.entry.id === "pet.bubbles")).toBe(true);
  });

  it("keywordKeysForSection includes appearance prefs and remote control", () => {
    const appearance = keywordKeysForSection("appearance");
    expect(appearance).toContain("settings.skin");
    expect(appearance).toContain("settings.themeSchedule");
    expect(appearance).toContain("settings.wallpaper");
    expect(appearance).toContain("settings.thinkingExpand");
    expect(appearance).toContain("settings.toolStepsAutoCollapse");
    expect(appearance).toContain("settings.transcriptFilter");
    expect(appearance).toContain("settings.chatFontScale");
    expect(appearance).toContain("settings.codeFontScale");
    expect(appearance).toContain("settings.workbenchChrome");
    expect(appearance).toContain("settings.chatDensity");
    expect(appearance).toContain("settings.chatWidth");
    expect(appearance).toContain("settings.sidebarDensity");
    expect(appearance).toContain("settings.zenMode");
    expect(appearance).toContain("settings.messageActions");
    expect(appearance).toContain("settings.messageTimestamps");
    expect(appearance).toContain("settings.showReplyLength");
    expect(appearance).toContain("settings.messageTimeFormat");
    expect(appearance).toContain("settings.sidebarShowRelativeTime");
    expect(appearance).toContain("settings.sessionMuteSummary");
    expect(appearance).toContain("settings.sessionUnreadSummary");
    expect(appearance).toContain("settings.backBottomAlways");
    const rim = keywordKeysForSection("remote_im");
    expect(rim).toContain("settings.nav.remoteIm");
    expect(rim).toContain("settings.tab.remoteIm");
    expect(rim).toContain("settings.tab.phoneMirror");
  });

  it("remote_im has im + mirror tabs", () => {
    expect(defaultTabFor("remote_im")).toBe("im");
    expect(resolveTab("remote_im", "mirror")).toBe("mirror");
    expect(resolveTab("remote_im", "feishu")).toBe("im");
    expect(parseSettingsHash("settings/remote_im")).toEqual({
      section: "remote_im",
      tab: "im",
    });
    expect(parseSettingsHash("settings/remote_im/mirror")).toEqual({
      section: "remote_im",
      tab: "mirror",
    });
    // Legacy channel deep-link: unknown tab segment falls back to IM tab.
    expect(parseSettingsHash("settings/remote_im/feishu")).toEqual({
      section: "remote_im",
      tab: "im",
    });
    expect(buildSettingsHash({ section: "remote_im", tab: "mirror" })).toBe(
      "#/settings/remote_im/mirror",
    );
  });

  it("account has official · providers · extras tabs", () => {
    expect(defaultTabFor("account")).toBe("official");
    expect(resolveTab("account", "providers")).toBe("providers");
    expect(resolveTab("account", "extras")).toBe("extras");
    expect(resolveTab("account", "nope")).toBe("official");
    expect(parseSettingsHash("settings/account/extras")).toEqual({
      section: "account",
      tab: "extras",
    });
    expect(buildSettingsHash({ section: "account", tab: "extras" })).toBe(
      "#/settings/account/extras",
    );
    const aux = SETTINGS_ENTRIES.find((e) => e.id === "account.officialAuxInject");
    expect(aux?.tab).toBe("extras");
  });

  it("search finds mcp / wallpaper / thinking / chat font / actions / cli path", () => {
    const tEn = createT("en");
    const inject = searchSettingsEntries("official tools", tEn, tEn);
    expect(
      inject.some(
        (h) =>
          h.entry.id === "account.officialAuxInject" &&
          h.entry.tab === "extras",
      ),
    ).toBe(true);
    const mcp = searchSettingsEntries("mcp", tEn, tEn);
    expect(mcp.some((h) => h.entry.id === "ext.mcp")).toBe(true);
    const claudeSkills = searchSettingsEntries("claude", tEn, tEn);
    expect(
      claudeSkills.some((h) => h.entry.id === "ext.skills.discoverExternal"),
    ).toBe(true);
    expect(
      searchSettingsEntries("import from Codex", tEn, tEn).some(
        (h) => h.entry.id === "ext.import",
      ),
    ).toBe(true);
    expect(
      searchSettingsEntries("wallpaper", tEn, tEn).some(
        (h) => h.entry.id === "appearance.wallpaper",
      ),
    ).toBe(true);
    expect(
      searchSettingsEntries("schedule", tEn, tEn).some(
        (h) => h.entry.id === "appearance.themeSchedule",
      ),
    ).toBe(true);
    expect(
      searchSettingsEntries("thinking", tEn, tEn).some(
        (h) => h.entry.id === "appearance.thinkingExpand",
      ),
    ).toBe(true);
    expect(
      searchSettingsEntries("text size", tEn, tEn).some(
        (h) => h.entry.id === "appearance.chatFontScale",
      ),
    ).toBe(true);
    expect(
      searchSettingsEntries("zen", tEn, tEn).some(
        (h) => h.entry.id === "appearance.zenMode",
      ),
    ).toBe(true);
    expect(
      searchSettingsEntries("codex", tEn, tEn).some(
        (h) => h.entry.id === "appearance.workbenchChrome",
      ),
    ).toBe(true);
    const densityEn = searchSettingsEntries("compact", tEn, tEn);
    expect(densityEn.some((h) => h.entry.id === "appearance.chatDensity")).toBe(
      true,
    );
    expect(
      densityEn.some((h) => h.entry.id === "appearance.sidebarDensity"),
    ).toBe(true);
    expect(
      searchSettingsEntries("narrow", tEn, tEn).some(
        (h) => h.entry.id === "appearance.chatWidth",
      ),
    ).toBe(true);
    expect(
      searchSettingsEntries("copy buttons", tEn, tEn).some(
        (h) => h.entry.id === "appearance.messageActions",
      ),
    ).toBe(true);
    expect(
      searchSettingsEntries("timestamp", tEn, tEn).some(
        (h) => h.entry.id === "appearance.messageTimestamps",
      ),
    ).toBe(true);
    const relativeTime = searchSettingsEntries("relative time", tEn, tEn);
    expect(
      relativeTime.some((h) => h.entry.id === "appearance.messageTimeFormat"),
    ).toBe(true);
    expect(
      relativeTime.some(
        (h) => h.entry.id === "appearance.sidebarShowRelativeTime",
      ),
    ).toBe(true);
    expect(
      searchSettingsEntries("back to bottom", tEn, tEn).some(
        (h) => h.entry.id === "appearance.backBottomAlways",
      ),
    ).toBe(true);
    expect(
      searchSettingsEntries("tool steps", tEn, tEn).some(
        (h) => h.entry.id === "appearance.toolStepsAutoCollapse",
      ),
    ).toBe(true);
    expect(
      searchSettingsEntries("transcript filter", tEn, tEn).some(
        (h) => h.entry.id === "appearance.transcriptFilter",
      ),
    ).toBe(true);
    expect(
      searchSettingsEntries("hide tools", tEn, tEn).some(
        (h) => h.entry.id === "appearance.transcriptFilter",
      ),
    ).toBe(true);
    expect(
      searchSettingsEntries("CLI", tEn, tEn).some(
        (h) => h.entry.section === "runtime",
      ),
    ).toBe(true);
    expect(
      searchSettingsEntries("session api", tEn, tEn).some(
        (h) => h.entry.id === "runtime.sessionApi",
      ),
    ).toBe(true);
  });
});
