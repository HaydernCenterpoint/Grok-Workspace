import { describe, expect, it } from "vitest";
import {
  canWriteConfigKind,
  classifyDiscoveredSkillStatus,
  classifyMcpStatus,
  classifyProviderStatus,
  defaultSelectedIds,
  isCompatVisibleSkillPath,
  isSecretSkillFileName,
  isSelectableImportItem,
  mapCodexWireApi,
  mergePermissionRules,
  normalizeImportPath,
  shouldCopySkillFileName,
  skillDedupeKey,
  summarizeImportCounts,
} from "./externalConfigImport";

describe("externalConfigImport policy", () => {
  it("normalizes Windows and POSIX paths for dedupe", () => {
    expect(normalizeImportPath("C:\\Users\\me\\.codex\\skills\\pdf\\")).toBe(
      "c:/users/me/.codex/skills/pdf",
    );
    expect(skillDedupeKey({ path: "C:\\Users\\me\\.codex\\skills\\pdf" })).toBe(
      skillDedupeKey({ path: "C:/Users/me/.codex/skills/pdf/" }),
    );
  });

  it("never copies secret-looking skill sidecar files", () => {
    expect(isSecretSkillFileName("SKILL.md")).toBe(false);
    expect(shouldCopySkillFileName("SKILL.md")).toBe(true);
    expect(shouldCopySkillFileName(".env")).toBe(false);
    expect(shouldCopySkillFileName(".env.local")).toBe(false);
    expect(shouldCopySkillFileName("auth.json")).toBe(false);
    expect(shouldCopySkillFileName("id_rsa")).toBe(false);
    expect(shouldCopySkillFileName("gateway.pem")).toBe(false);
    expect(shouldCopySkillFileName("node_modules")).toBe(false);
    expect(shouldCopySkillFileName("scripts/run.sh")).toBe(true);
  });

  it("classifies Claude/Cursor skills as already visible and Grok roots as exists", () => {
    expect(
      classifyDiscoveredSkillStatus({
        path: "/Users/me/.claude/skills/pdf/SKILL.md",
        hasSkillMd: true,
      }),
    ).toBe("already_visible");
    expect(
      classifyDiscoveredSkillStatus({
        path: String.raw`C:\Users\me\.grok\skills\help\SKILL.md`,
        hasSkillMd: true,
      }),
    ).toBe("exists");
    expect(
      classifyDiscoveredSkillStatus({
        path: "/Users/me/.codex/skills/review/SKILL.md",
        hasSkillMd: true,
      }),
    ).toBe("importable");
    expect(
      classifyDiscoveredSkillStatus({
        path: "/tmp/broken",
        hasSkillMd: false,
      }),
    ).toBe("broken");
    expect(isCompatVisibleSkillPath("/Users/me/.cursor/skills/web/SKILL.md")).toBe(
      true,
    );
  });

  it("dedupes a discovered skill against known Grok ids/paths", () => {
    const known = new Set([
      skillDedupeKey({ path: "/Users/me/.grok/skills/pdf/SKILL.md" }),
    ]);
    expect(
      classifyDiscoveredSkillStatus({
        path: "/Users/me/.codex/skills/pdf/SKILL.md",
        name: "pdf",
        hasSkillMd: true,
        knownKeys: known,
      }),
    ).toBe("importable");
    expect(
      classifyDiscoveredSkillStatus({
        path: "/Users/me/.grok/skills/pdf/SKILL.md",
        name: "pdf",
        hasSkillMd: true,
        knownKeys: known,
      }),
    ).toBe("exists");
  });

  it("refuses provider import without copying a key", () => {
    expect(classifyProviderStatus({ baseUrl: "https://api.example.com/v1" })).toEqual({
      status: "missing_key",
      reason: "no_api_key",
    });
    expect(classifyProviderStatus({ baseUrl: "" }).reason).toBe("missing_base_url");
    expect(isSelectableImportItem({
      id: "provider:codex:acme",
      kind: "provider",
      status: "missing_key",
    })).toBe(false);
  });

  it("allows MCP import when command or url is present", () => {
    expect(
      classifyMcpStatus({ name: "playwright", command: "npx" }).status,
    ).toBe("importable");
    expect(
      classifyMcpStatus({
        name: "chatcut",
        url: "https://api.chatcut.io/mcp",
        existing: true,
      }).status,
    ).toBe("exists");
    expect(classifyMcpStatus({ name: "bad name", command: "npx" }).reason).toBe(
      "invalid_name",
    );
    expect(classifyMcpStatus({ name: "empty" }).status).toBe("broken");
  });

  it("maps Codex wire_api honestly and does not invent backends", () => {
    expect(mapCodexWireApi("responses")).toBe("responses");
    expect(mapCodexWireApi("chat")).toBe("chat_completions");
    expect(mapCodexWireApi("messages")).toBeNull();
    expect(mapCodexWireApi("")).toBeNull();
  });

  it("writes MCP/permissions only in independent mode unless the user switches", () => {
    expect(canWriteConfigKind("mcp", "shared", false)).toBe(false);
    expect(canWriteConfigKind("mcp", "shared", true)).toBe(true);
    expect(canWriteConfigKind("permission", "independent", false)).toBe(true);
    expect(canWriteConfigKind("skill", "shared", false)).toBe(true);
    expect(canWriteConfigKind("provider", "independent", true)).toBe(false);
  });

  it("selects only reviewable importable/exists rows and merges permission rules", () => {
    const ids = defaultSelectedIds([
      { id: "skill:codex:pdf", kind: "skill", status: "importable" },
      { id: "skill:claude:web", kind: "skill", status: "already_visible" },
      { id: "mcp:claude:pw", kind: "mcp", status: "exists" },
      { id: "provider:codex:oa", kind: "provider", status: "missing_key" },
    ]);
    expect(ids).toEqual(["skill:codex:pdf", "mcp:claude:pw"]);
    expect(
      mergePermissionRules(
        { allow: ["Read"], deny: ["Bash(rm *)"] },
        { allow: ["Read", "Bash(git *)"], ask: ["Edit"] },
      ),
    ).toEqual({
      allow: ["Read", "Bash(git *)"],
      deny: ["Bash(rm *)"],
      ask: ["Edit"],
    });
    expect(summarizeImportCounts({ imported: 2, skipped: 1, failed: 0 })).toBe("ok");
    expect(summarizeImportCounts({ imported: 1, skipped: 0, failed: 1 })).toBe(
      "partial",
    );
  });
});
