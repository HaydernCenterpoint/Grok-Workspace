/**
 * Codex / Claude / Cursor config + skill import policy (pure).
 *
 * Host walks the disk; this module decides what can be selected, what is
 * already visible, and what must be skipped (secrets, missing keys, shared
 * mode). It does not invent API keys or claim a full clone.
 */

export type ExternalImportKind = "skill" | "mcp" | "provider" | "permission";

export type ExternalImportSource =
  | "codex"
  | "claude"
  | "claude_desktop"
  | "cursor"
  | "agents"
  | "grok"
  | "project";

export type ExternalImportStatus =
  | "importable"
  | "exists"
  | "already_visible"
  | "missing_key"
  | "skip"
  | "broken";

export type ExternalImportSkipReason =
  | "secret"
  | "env_redacted"
  | "headers_redacted"
  | "no_api_key"
  | "missing_base_url"
  | "missing_command"
  | "missing_url"
  | "invalid_name"
  | "already_exists"
  | "already_visible"
  | "unreadable"
  | "broken"
  | "shared_readonly"
  | "not_mapped"
  | "official_only";

export type ExternalImportItemLike = {
  id: string;
  kind: ExternalImportKind | string;
  status: ExternalImportStatus | string;
  reason?: string | null;
};

const SECRET_EXACT = new Set([
  ".env",
  ".netrc",
  "auth.json",
  "credentials.json",
  "secrets.json",
  "token",
]);

const SECRET_SUFFIXES = [".pem", ".key", ".p12", ".pfx", ".token"];

/** Normalize a filesystem path for id / dedupe (Windows + POSIX). */
export function normalizeImportPath(path: string | null | undefined): string {
  return (path ?? "").trim().replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

export function skillDedupeKey(opts: {
  name?: string | null;
  path?: string | null;
}): string {
  const path = normalizeImportPath(opts.path);
  if (path) return `path:${path}`;
  const name = (opts.name ?? "").trim().toLowerCase();
  return name ? `name:${name}` : "";
}

/** True when a file name looks like a secret and must not be copied. */
export function isSecretSkillFileName(name: string | null | undefined): boolean {
  const raw = (name ?? "").trim();
  if (!raw) return false;
  const n = raw.toLowerCase();
  if (n === "skill.md") return false;
  if (SECRET_EXACT.has(n)) return true;
  if (n.startsWith(".env.")) return true;
  if (n.startsWith("id_rsa") || n.startsWith("id_ed25519")) return true;
  if (SECRET_SUFFIXES.some((s) => n.endsWith(s))) return true;
  if (n.includes("credential") || n.includes("secret")) return true;
  return false;
}

export function shouldCopySkillFileName(name: string | null | undefined): boolean {
  const raw = (name ?? "").trim();
  if (!raw || raw === "." || raw === "..") return false;
  if (raw === "node_modules" || raw === ".git") return false;
  return !isSecretSkillFileName(raw);
}

export function isCompatVisibleSkillPath(path: string | null | undefined): boolean {
  const p = normalizeImportPath(path);
  if (!p) return false;
  return (
    p.includes("/.claude/skills/") ||
    p.includes("/.claude/commands/") ||
    p.endsWith("/.claude/skills") ||
    p.includes("/.cursor/skills/") ||
    p.includes("/.cursor/commands/") ||
    p.endsWith("/.cursor/skills")
  );
}

export function isNativeGrokSkillPath(path: string | null | undefined): boolean {
  const p = normalizeImportPath(path);
  if (!p) return false;
  return (
    p.includes("/.grok/skills/") ||
    p.endsWith("/.grok/skills") ||
    p.includes("/agent-home/skills/") ||
    p.endsWith("/agent-home/skills")
  );
}

export function classifyDiscoveredSkillStatus(opts: {
  path?: string | null;
  name?: string | null;
  readable?: boolean;
  hasSkillMd?: boolean;
  knownKeys?: ReadonlySet<string>;
}): ExternalImportStatus {
  if (opts.readable === false) return "broken";
  if (opts.hasSkillMd === false) return "broken";
  const key = skillDedupeKey(opts);
  if (key && opts.knownKeys?.has(key)) return "exists";
  if (isNativeGrokSkillPath(opts.path)) return "exists";
  if (isCompatVisibleSkillPath(opts.path)) return "already_visible";
  return "importable";
}

/**
 * Providers from Codex/Claude cannot be written without an API key.
 * We never copy env files, auth.json, or env_key values.
 */
export function classifyProviderStatus(opts: {
  baseUrl?: string | null;
  existing?: boolean;
}): { status: ExternalImportStatus; reason: ExternalImportSkipReason } {
  const url = (opts.baseUrl ?? "").trim();
  if (!url) {
    return { status: "skip", reason: "missing_base_url" };
  }
  if (opts.existing) {
    return { status: "exists", reason: "no_api_key" };
  }
  return { status: "missing_key", reason: "no_api_key" };
}

export function classifyMcpStatus(opts: {
  name?: string | null;
  command?: string | null;
  url?: string | null;
  existing?: boolean;
}): { status: ExternalImportStatus; reason?: ExternalImportSkipReason } {
  const name = (opts.name ?? "").trim();
  if (!name) return { status: "broken", reason: "invalid_name" };
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(name)) {
    return { status: "broken", reason: "invalid_name" };
  }
  const command = (opts.command ?? "").trim();
  const url = (opts.url ?? "").trim();
  if (!command && !url) {
    return { status: "broken", reason: command ? "missing_url" : "missing_command" };
  }
  if (opts.existing) return { status: "exists" };
  return { status: "importable" };
}

/** Codex `wire_api` → Grok `api_backend`. Unknown values are not invented. */
export function mapCodexWireApi(
  wire: string | null | undefined,
): "responses" | "chat_completions" | null {
  switch ((wire ?? "").trim().toLowerCase()) {
    case "responses":
      return "responses";
    case "chat":
    case "chat_completions":
      return "chat_completions";
    default:
      return null;
  }
}

export function canWriteConfigKind(
  kind: ExternalImportKind | string,
  sessionDataMode: string | null | undefined,
  switchToIndependent: boolean,
): boolean {
  if (kind === "skill") return true;
  if (kind === "provider") return false;
  const mode = (sessionDataMode ?? "").trim().toLowerCase();
  if (mode === "independent" || switchToIndependent) return true;
  return false;
}

export function isSelectableImportItem(item: ExternalImportItemLike): boolean {
  if (item.kind === "provider") return false;
  if (item.kind === "skill" && item.status === "exists") return false;
  return item.status === "importable" || item.status === "exists";
}

export function defaultSelectedIds(
  items: readonly ExternalImportItemLike[],
): string[] {
  return items.filter(isSelectableImportItem).map((i) => i.id);
}

export function mergePermissionRules(
  current: { allow?: string[]; deny?: string[]; ask?: string[] },
  incoming: { allow?: string[]; deny?: string[]; ask?: string[] },
): { allow: string[]; deny: string[]; ask: string[] } {
  const add = (bucket: string[] | undefined, extra: string[] | undefined) => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const raw of [...(bucket ?? []), ...(extra ?? [])]) {
      const s = raw.trim();
      if (!s || seen.has(s)) continue;
      seen.add(s);
      out.push(s);
    }
    return out;
  };
  return {
    allow: add(current.allow, incoming.allow),
    deny: add(current.deny, incoming.deny),
    ask: add(current.ask, incoming.ask),
  };
}

export function summarizeImportCounts(opts: {
  imported: number;
  skipped: number;
  failed: number;
}): "ok" | "partial" | "empty" {
  if (opts.imported > 0 && opts.failed === 0) return "ok";
  if (opts.imported > 0) return "partial";
  return "empty";
}

const REASON_KEYS = [
  "secret",
  "env_redacted",
  "headers_redacted",
  "no_api_key",
  "missing_base_url",
  "missing_command",
  "missing_url",
  "invalid_name",
  "already_exists",
  "already_visible",
  "unreadable",
  "broken",
  "shared_readonly",
  "not_mapped",
  "official_only",
] as const;

export function isImportSkipReason(v: string | null | undefined): v is ExternalImportSkipReason {
  return !!v && (REASON_KEYS as readonly string[]).includes(v);
}
