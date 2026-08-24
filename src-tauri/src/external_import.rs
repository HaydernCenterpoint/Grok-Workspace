//! Opt-in import of Codex / Claude config and already-installed skill files.
//!
//! Host-only filesystem walk. Never copies API keys, `auth.json`, `.env`, or
//! MCP headers/env values. Shared session mode never rewrites `~/.grok`
//! `config.toml` unless the user explicitly switches to independent.

use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::agent_home_config::normalize_mode;
use crate::extensions::{
    invalidate_mcp_cache, parse_mcp_servers_from_toml, set_mcp_enabled, upsert_mcp_http_in_toml,
    upsert_mcp_stdio_in_toml, validate_mcp_server_name, McpServerDef,
};
use crate::paths::{agent_config_toml, ensure_app_dirs, resolve_agent_grok_home};
use crate::permission_rules::{
    add_rule, load_permission_rules, save_permission_rules, PermissionRules,
};
use crate::process_util::user_home;
use crate::skill_edit::sanitize_skill_folder_name;
use crate::store;

const MAX_CONFIG_BYTES: u64 = 1024 * 1024;
const MAX_SKILL_MD_BYTES: u64 = 2 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalHome {
    pub source: String,
    pub path: String,
    pub present: bool,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalImportItem {
    pub id: String,
    pub kind: String,
    pub source: String,
    pub name: String,
    pub detail: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transport: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub args: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub skill_dir: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub allow: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub deny: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ask: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalImportScanResult {
    pub session_data_mode: String,
    pub writable: bool,
    pub dest_skills: String,
    pub dest_config: String,
    pub homes: Vec<ExternalHome>,
    pub items: Vec<ExternalImportItem>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalImportRequest {
    #[serde(default)]
    pub ids: Vec<String>,
    #[serde(default)]
    pub project_path: Option<String>,
    #[serde(default)]
    pub switch_to_independent: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalImportFailure {
    pub id: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExternalImportApplyResult {
    pub imported: u32,
    pub skipped: u32,
    pub failed: Vec<ExternalImportFailure>,
    pub switched_to_independent: bool,
    pub dest_skills: String,
    pub dest_config: String,
}

#[derive(Debug, Clone)]
pub struct ScanCtx {
    pub home: PathBuf,
    pub appdata: Option<PathBuf>,
    pub xdg_config: Option<PathBuf>,
    pub grok_home: PathBuf,
    pub agent_home: PathBuf,
    pub project: Option<PathBuf>,
    pub session_mode: String,
    pub existing_mcp: HashSet<String>,
    pub existing_skill_keys: HashSet<String>,
    pub dest_skills: PathBuf,
    pub dest_config: PathBuf,
    /// Override `~/.codex` (tests inject a temp dir; live scan may use CODEX_HOME).
    pub codex_home: Option<PathBuf>,
    /// Override `~/.claude` (tests inject a temp dir; live scan may use CLAUDE_CONFIG_DIR).
    pub claude_dir: Option<PathBuf>,
}

fn normalize_fs_path(path: &str) -> String {
    path.trim()
        .replace('\\', "/")
        .trim_end_matches('/')
        .to_ascii_lowercase()
}

fn skill_key(name: &str, path: Option<&str>) -> String {
    if let Some(p) = path.map(str::trim).filter(|s| !s.is_empty()) {
        return format!("path:{}", normalize_fs_path(p));
    }
    let n = name.trim().to_ascii_lowercase();
    if n.is_empty() {
        String::new()
    } else {
        format!("name:{n}")
    }
}

pub fn is_secret_skill_file_name(name: &str) -> bool {
    let n = name.trim().to_ascii_lowercase();
    if n.is_empty() || n == "skill.md" {
        return false;
    }
    matches!(
        n.as_str(),
        ".env" | ".netrc" | "auth.json" | "credentials.json" | "secrets.json" | "token"
    ) || n.starts_with(".env.")
        || n.starts_with("id_rsa")
        || n.starts_with("id_ed25519")
        || n.ends_with(".pem")
        || n.ends_with(".key")
        || n.ends_with(".p12")
        || n.ends_with(".pfx")
        || n.ends_with(".token")
        || n.contains("credential")
        || n.contains("secret")
}

pub fn should_copy_skill_file_name(name: &str) -> bool {
    let n = name.trim();
    if n.is_empty() || n == "." || n == ".." {
        return false;
    }
    if n.eq_ignore_ascii_case("node_modules") || n.eq_ignore_ascii_case(".git") {
        return false;
    }
    !is_secret_skill_file_name(n)
}

fn is_compat_visible_path(path: &str) -> bool {
    let p = normalize_fs_path(path);
    p.contains("/.claude/skills/")
        || p.contains("/.claude/commands/")
        || p.ends_with("/.claude/skills")
        || p.contains("/.cursor/skills/")
        || p.contains("/.cursor/commands/")
        || p.ends_with("/.cursor/skills")
}

fn is_native_grok_skill_path(path: &str) -> bool {
    let p = normalize_fs_path(path);
    p.contains("/.grok/skills/")
        || p.ends_with("/.grok/skills")
        || p.contains("/agent-home/skills/")
        || p.ends_with("/agent-home/skills")
}

pub fn map_codex_wire_api(wire: &str) -> Option<&'static str> {
    match wire.trim().to_ascii_lowercase().as_str() {
        "responses" => Some("responses"),
        "chat" | "chat_completions" => Some("chat_completions"),
        _ => None,
    }
}

fn read_limited(path: &Path, max: u64) -> Result<String, String> {
    let meta = fs::metadata(path).map_err(|e| format!("stat: {e}"))?;
    if !meta.is_file() {
        return Err("not a file".into());
    }
    if meta.len() > max {
        return Err("file too large".into());
    }
    fs::read_to_string(path).map_err(|e| format!("read: {e}"))
}

fn home_row(source: &str, path: &Path, label: &str) -> ExternalHome {
    ExternalHome {
        source: source.to_string(),
        path: path.to_string_lossy().to_string(),
        present: path.exists(),
        label: label.to_string(),
    }
}

fn item_id(kind: &str, source: &str, name: &str) -> String {
    format!("{kind}:{source}:{name}")
}

fn classify_skill_status(
    path: &str,
    name: &str,
    known: &HashSet<String>,
    readable: bool,
    has_skill_md: bool,
) -> (&'static str, Option<&'static str>) {
    if !readable {
        return ("broken", Some("unreadable"));
    }
    if !has_skill_md {
        return ("broken", Some("broken"));
    }
    let key = skill_key(name, Some(path));
    if !key.is_empty() && known.contains(&key) {
        return ("exists", Some("already_exists"));
    }
    if is_native_grok_skill_path(path) {
        return ("exists", Some("already_exists"));
    }
    if is_compat_visible_path(path) {
        return ("already_visible", Some("already_visible"));
    }
    ("importable", None)
}

fn parse_skill_frontmatter_name(text: &str) -> Option<String> {
    let src = text.replace("\r\n", "\n");
    let rest = src.trim_start();
    if !rest.starts_with("---") {
        return None;
    }
    let after = rest.get(3..)?;
    let after = after.strip_prefix('\n').unwrap_or(after);
    let close = after.find("\n---")?;
    let block = &after[..close];
    for line in block.lines() {
        let t = line.trim();
        if t.is_empty() || t.starts_with('#') {
            continue;
        }
        let Some((k, v)) = t.split_once(':') else {
            continue;
        };
        if k.trim().eq_ignore_ascii_case("name") {
            let mut val = v.trim().to_string();
            if (val.starts_with('"') && val.ends_with('"') && val.len() >= 2)
                || (val.starts_with('\'') && val.ends_with('\'') && val.len() >= 2)
            {
                val = val[1..val.len() - 1].to_string();
            }
            if !val.is_empty() {
                return Some(val);
            }
        }
    }
    None
}

fn parse_skill_frontmatter_description(text: &str) -> Option<String> {
    let src = text.replace("\r\n", "\n");
    let rest = src.trim_start();
    if !rest.starts_with("---") {
        return None;
    }
    let after = rest.get(3..)?;
    let after = after.strip_prefix('\n').unwrap_or(after);
    let close = after.find("\n---")?;
    let block = &after[..close];
    for line in block.lines() {
        let t = line.trim();
        let Some((k, v)) = t.split_once(':') else {
            continue;
        };
        if k.trim().eq_ignore_ascii_case("description") {
            let mut val = v.trim().to_string();
            if (val.starts_with('"') && val.ends_with('"') && val.len() >= 2)
                || (val.starts_with('\'') && val.ends_with('\'') && val.len() >= 2)
            {
                val = val[1..val.len() - 1].to_string();
            }
            if !val.is_empty() {
                return Some(val);
            }
        }
    }
    None
}

fn scan_skills_dir(dir: &Path, source: &str, known: &HashSet<String>) -> Vec<ExternalImportItem> {
    let mut out = Vec::new();
    let Ok(entries) = fs::read_dir(dir) else {
        return out;
    };
    let mut names: Vec<PathBuf> = entries.filter_map(|e| e.ok().map(|e| e.path())).collect();
    names.sort();
    for child in names {
        if !child.is_dir() {
            continue;
        }
        let folder = child
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();
        if folder.is_empty() || folder.starts_with('.') {
            continue;
        }
        let skill_md = if child.join("SKILL.md").is_file() {
            child.join("SKILL.md")
        } else if child.join("skill.md").is_file() {
            child.join("skill.md")
        } else {
            let path = child.to_string_lossy().to_string();
            let id = item_id("skill", source, &folder);
            out.push(ExternalImportItem {
                id,
                kind: "skill".into(),
                source: source.into(),
                name: folder,
                detail: path.clone(),
                path: Some(path),
                status: "broken".into(),
                reason: Some("broken".into()),
                transport: None,
                command: None,
                args: None,
                url: None,
                base_url: None,
                skill_dir: Some(child.to_string_lossy().to_string()),
                allow: None,
                deny: None,
                ask: None,
            });
            continue;
        };
        let text = match read_limited(&skill_md, MAX_SKILL_MD_BYTES) {
            Ok(t) => t,
            Err(_) => {
                let path = skill_md.to_string_lossy().to_string();
                out.push(ExternalImportItem {
                    id: item_id("skill", source, &folder),
                    kind: "skill".into(),
                    source: source.into(),
                    name: folder,
                    detail: path.clone(),
                    path: Some(path),
                    status: "broken".into(),
                    reason: Some("unreadable".into()),
                    transport: None,
                    command: None,
                    args: None,
                    url: None,
                    base_url: None,
                    skill_dir: Some(child.to_string_lossy().to_string()),
                    allow: None,
                    deny: None,
                    ask: None,
                });
                continue;
            }
        };
        let parsed_name = parse_skill_frontmatter_name(&text).unwrap_or_else(|| folder.clone());
        let safe = sanitize_skill_folder_name(&parsed_name).unwrap_or_else(|_| folder.clone());
        let desc = parse_skill_frontmatter_description(&text).unwrap_or_default();
        let path = skill_md.to_string_lossy().to_string();
        let (status, reason) = classify_skill_status(&path, &safe, known, true, true);
        out.push(ExternalImportItem {
            id: item_id("skill", source, &safe),
            kind: "skill".into(),
            source: source.into(),
            name: safe,
            detail: if desc.is_empty() { path.clone() } else { desc },
            path: Some(path),
            status: status.into(),
            reason: reason.map(|s| s.to_string()),
            transport: None,
            command: None,
            args: None,
            url: None,
            base_url: None,
            skill_dir: Some(child.to_string_lossy().to_string()),
            allow: None,
            deny: None,
            ask: None,
        });
    }
    out
}

fn collect_skill_keys(root: &Path, into: &mut HashSet<String>) {
    let Ok(entries) = fs::read_dir(root) else {
        return;
    };
    for entry in entries.flatten() {
        let child = entry.path();
        if !child.is_dir() {
            continue;
        }
        let md = if child.join("SKILL.md").is_file() {
            child.join("SKILL.md")
        } else if child.join("skill.md").is_file() {
            child.join("skill.md")
        } else {
            continue;
        };
        let folder = child
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if !folder.is_empty() {
            into.insert(format!("name:{folder}"));
        }
        into.insert(skill_key(&folder, Some(&md.to_string_lossy())));
    }
}

fn mcp_item_from_def(
    source: &str,
    def: &McpServerDef,
    existing: &HashSet<String>,
    path: Option<&str>,
) -> ExternalImportItem {
    let name = def.name.trim().to_string();
    let command = def.command.clone().filter(|s| !s.trim().is_empty());
    let url = def.url.clone().filter(|s| !s.trim().is_empty());
    let args = def.args.clone();
    let transport = if url.is_some() {
        def.transport.clone().unwrap_or_else(|| "http".into())
    } else {
        def.transport.clone().unwrap_or_else(|| "stdio".into())
    };
    let mut reason: Option<String> = None;
    if def.env.as_ref().is_some_and(|m| !m.is_empty()) {
        reason = Some("env_redacted".into());
    }
    if def.headers.as_ref().is_some_and(|m| !m.is_empty()) {
        reason = Some("headers_redacted".into());
    }
    let valid = validate_mcp_server_name(&name).is_ok();
    let (status, status_reason) = if !valid {
        ("broken", Some("invalid_name"))
    } else if command.is_none() && url.is_none() {
        (
            "broken",
            Some(if command.is_none() {
                "missing_command"
            } else {
                "missing_url"
            }),
        )
    } else if existing.contains(&name) {
        ("exists", Some("already_exists"))
    } else {
        ("importable", None)
    };
    if status_reason.is_some() && reason.is_none() {
        reason = status_reason.map(|s| s.to_string());
    }
    let detail = url
        .clone()
        .or_else(|| {
            command.as_ref().map(|c| {
                let extra = args.as_ref().map(|a| a.join(" ")).unwrap_or_default();
                if extra.is_empty() {
                    c.clone()
                } else {
                    format!("{c} {extra}")
                }
            })
        })
        .unwrap_or_default();
    ExternalImportItem {
        id: item_id("mcp", source, &name),
        kind: "mcp".into(),
        source: source.into(),
        name,
        detail,
        path: path.map(|s| s.to_string()),
        status: status.into(),
        reason,
        transport: Some(transport),
        command,
        args,
        url,
        base_url: None,
        skill_dir: None,
        allow: None,
        deny: None,
        ask: None,
    }
}

fn parse_json_mcp_servers(value: &Value) -> Vec<McpServerDef> {
    let Some(obj) = value
        .get("mcpServers")
        .or_else(|| value.get("mcp_servers"))
        .and_then(|v| v.as_object())
    else {
        return Vec::new();
    };
    let mut out = Vec::new();
    for (name, spec) in obj {
        let name = name.trim();
        if name.is_empty() {
            continue;
        }
        let command = spec
            .get("command")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string());
        let url = spec
            .get("url")
            .or_else(|| spec.get("serverUrl"))
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string());
        let args = spec.get("args").and_then(|v| v.as_array()).map(|arr| {
            arr.iter()
                .filter_map(|x| x.as_str().map(|s| s.to_string()))
                .collect::<Vec<_>>()
        });
        let env = spec.get("env").and_then(|v| v.as_object()).map(|m| {
            m.iter()
                .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                .collect::<HashMap<_, _>>()
        });
        let headers = spec.get("headers").and_then(|v| v.as_object()).map(|m| {
            m.iter()
                .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                .collect::<HashMap<_, _>>()
        });
        let transport = if url.is_some() {
            Some("http".into())
        } else {
            Some("stdio".into())
        };
        out.push(McpServerDef {
            name: name.to_string(),
            command,
            args,
            env,
            url,
            headers,
            transport,
            enabled: None,
            scope: None,
        });
    }
    out
}

fn parse_json_permissions(value: &Value) -> Option<PermissionRules> {
    let p = value.get("permissions")?;
    let arr = |key: &str| -> Vec<String> {
        p.get(key)
            .and_then(|v| v.as_array())
            .map(|a| {
                a.iter()
                    .filter_map(|x| {
                        x.as_str()
                            .map(str::trim)
                            .filter(|s| !s.is_empty())
                            .map(|s| s.to_string())
                    })
                    .collect()
            })
            .unwrap_or_default()
    };
    let rules = PermissionRules {
        allow: arr("allow"),
        deny: arr("deny"),
        ask: arr("ask"),
    };
    if rules.allow.is_empty() && rules.deny.is_empty() && rules.ask.is_empty() {
        None
    } else {
        Some(rules)
    }
}

#[derive(Debug, Clone)]
pub(crate) struct CodexProviderPreview {
    id: String,
    name: String,
    base_url: String,
    wire_api: Option<String>,
}

/// Parse Codex `[model_providers.<id>]` tables (name / base_url / wire_api only).
pub fn parse_codex_model_providers(text: &str) -> Vec<CodexProviderPreview> {
    let mut by_id: HashMap<String, CodexProviderPreview> = HashMap::new();
    let mut current: Option<String> = None;
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            let inner = trimmed[1..trimmed.len() - 1].trim();
            if let Some(id) = inner.strip_prefix("model_providers.") {
                let id = id.trim();
                if id.is_empty() || id.contains('.') {
                    current = None;
                    continue;
                }
                by_id
                    .entry(id.to_string())
                    .or_insert_with(|| CodexProviderPreview {
                        id: id.to_string(),
                        name: id.to_string(),
                        base_url: String::new(),
                        wire_api: None,
                    });
                current = Some(id.to_string());
            } else {
                current = None;
            }
            continue;
        }
        let Some(id) = current.as_ref() else {
            continue;
        };
        let Some((k, v)) = trimmed.split_once('=') else {
            continue;
        };
        let key = k.trim();
        let mut val = v.trim().to_string();
        if (val.starts_with('"') && val.ends_with('"') && val.len() >= 2)
            || (val.starts_with('\'') && val.ends_with('\'') && val.len() >= 2)
        {
            val = val[1..val.len() - 1].to_string();
        }
        if let Some(row) = by_id.get_mut(id) {
            match key {
                "name" => {
                    if !val.is_empty() {
                        row.name = val;
                    }
                }
                "base_url" => row.base_url = val,
                "wire_api" => row.wire_api = Some(val),
                _ => {}
            }
        }
    }
    let mut out: Vec<_> = by_id.into_values().collect();
    out.sort_by(|a, b| a.id.cmp(&b.id));
    out
}

fn json_from_file(path: &Path) -> Option<Value> {
    let text = read_limited(path, MAX_CONFIG_BYTES).ok()?;
    serde_json::from_str(&text).ok()
}

fn toml_from_file(path: &Path) -> Option<String> {
    read_limited(path, MAX_CONFIG_BYTES).ok()
}

fn push_unique_items(out: &mut Vec<ExternalImportItem>, extra: Vec<ExternalImportItem>) {
    let mut seen: HashSet<String> = out.iter().map(|i| i.id.clone()).collect();
    for item in extra {
        if seen.insert(item.id.clone()) {
            out.push(item);
        }
    }
}

pub fn scan_with_ctx(ctx: &ScanCtx) -> ExternalImportScanResult {
    let writable = normalize_mode(&ctx.session_mode) == "independent";
    let mut homes = Vec::new();
    let mut items: Vec<ExternalImportItem> = Vec::new();

    let codex_home = ctx
        .codex_home
        .clone()
        .unwrap_or_else(|| ctx.home.join(".codex"));
    let claude_dir = ctx
        .claude_dir
        .clone()
        .unwrap_or_else(|| ctx.home.join(".claude"));

    let codex_cfg = codex_home.join("config.toml");
    let claude_json = ctx.home.join(".claude.json");
    let claude_settings = claude_dir.join("settings.json");
    let claude_settings_local = claude_dir.join("settings.local.json");
    let claude_desktop = if let Some(appdata) = &ctx.appdata {
        appdata.join("Claude").join("claude_desktop_config.json")
    } else if cfg!(target_os = "macos") {
        ctx.home
            .join("Library")
            .join("Application Support")
            .join("Claude")
            .join("claude_desktop_config.json")
    } else if let Some(xdg) = &ctx.xdg_config {
        xdg.join("Claude").join("claude_desktop_config.json")
    } else {
        ctx.home
            .join(".config")
            .join("Claude")
            .join("claude_desktop_config.json")
    };

    homes.push(home_row("codex", &codex_home, "~/.codex"));
    homes.push(home_row("codex", &codex_cfg, "config.toml"));
    homes.push(home_row("codex", &codex_home.join("skills"), "skills"));
    homes.push(home_row("claude", &claude_dir, "~/.claude"));
    homes.push(home_row("claude", &claude_json, "~/.claude.json"));
    homes.push(home_row("claude", &claude_settings, "settings.json"));
    homes.push(home_row("claude", &claude_dir.join("skills"), "skills"));
    homes.push(home_row(
        "claude_desktop",
        &claude_desktop,
        "claude_desktop_config.json",
    ));
    homes.push(home_row(
        "cursor",
        &ctx.home.join(".cursor").join("skills"),
        "skills",
    ));
    homes.push(home_row(
        "agents",
        &ctx.home.join(".agents").join("skills"),
        "skills",
    ));
    homes.push(home_row("grok", &ctx.grok_home.join("skills"), "skills"));
    if ctx.agent_home != ctx.grok_home {
        homes.push(home_row(
            "grok",
            &ctx.agent_home.join("skills"),
            "agent-home/skills",
        ));
    }
    if let Some(project) = &ctx.project {
        homes.push(home_row(
            "project",
            &project.join(".grok").join("skills"),
            "project .grok/skills",
        ));
        homes.push(home_row(
            "project",
            &project.join(".claude").join("skills"),
            "project .claude/skills",
        ));
        homes.push(home_row(
            "project",
            &project.join(".codex").join("skills"),
            "project .codex/skills",
        ));
    }

    if let Some(text) = toml_from_file(&codex_cfg) {
        let defs = parse_mcp_servers_from_toml(&text);
        let extra = defs
            .iter()
            .map(|d| {
                mcp_item_from_def(
                    "codex",
                    d,
                    &ctx.existing_mcp,
                    Some(&codex_cfg.to_string_lossy()),
                )
            })
            .collect();
        push_unique_items(&mut items, extra);
        for p in parse_codex_model_providers(&text) {
            let (status, reason) = if p.base_url.trim().is_empty() {
                ("skip", Some("missing_base_url"))
            } else {
                ("missing_key", Some("no_api_key"))
            };
            let backend = map_codex_wire_api(p.wire_api.as_deref().unwrap_or(""));
            let detail = match backend {
                Some(b) if !p.base_url.is_empty() => format!("{} · {}", p.base_url, b),
                _ => p.base_url.clone(),
            };
            items.push(ExternalImportItem {
                id: item_id("provider", "codex", &p.id),
                kind: "provider".into(),
                source: "codex".into(),
                name: p.name,
                detail,
                path: Some(codex_cfg.to_string_lossy().to_string()),
                status: status.into(),
                reason: reason.map(|s| s.to_string()),
                transport: None,
                command: None,
                args: None,
                url: None,
                base_url: Some(p.base_url),
                skill_dir: None,
                allow: None,
                deny: None,
                ask: None,
            });
        }
    }

    let mut claude_perm: Option<PermissionRules> = None;
    for (source, path) in [
        ("claude", claude_json.as_path()),
        ("claude", claude_settings.as_path()),
        ("claude", claude_settings_local.as_path()),
        ("claude_desktop", claude_desktop.as_path()),
    ] {
        let Some(v) = json_from_file(path) else {
            continue;
        };
        let defs = parse_json_mcp_servers(&v);
        let extra = defs
            .iter()
            .map(|d| mcp_item_from_def(source, d, &ctx.existing_mcp, Some(&path.to_string_lossy())))
            .collect();
        push_unique_items(&mut items, extra);
        if source == "claude" {
            if let Some(rules) = parse_json_permissions(&v) {
                claude_perm = Some(match claude_perm.take() {
                    Some(cur) => merge_perm(cur, rules),
                    None => rules,
                });
            }
        }
    }
    if let Some(rules) = claude_perm {
        items.push(ExternalImportItem {
            id: item_id("permission", "claude", "rules"),
            kind: "permission".into(),
            source: "claude".into(),
            name: "permissions".into(),
            detail: format!(
                "{} allow · {} deny · {} ask",
                rules.allow.len(),
                rules.deny.len(),
                rules.ask.len()
            ),
            path: Some(claude_settings.to_string_lossy().to_string()),
            status: "importable".into(),
            reason: None,
            transport: None,
            command: None,
            args: None,
            url: None,
            base_url: None,
            skill_dir: None,
            allow: Some(rules.allow),
            deny: Some(rules.deny),
            ask: Some(rules.ask),
        });
    }

    let skill_roots: Vec<(String, PathBuf)> = {
        let mut v = vec![
            ("codex".into(), codex_home.join("skills")),
            ("claude".into(), claude_dir.join("skills")),
            ("cursor".into(), ctx.home.join(".cursor").join("skills")),
            ("agents".into(), ctx.home.join(".agents").join("skills")),
            ("grok".into(), ctx.grok_home.join("skills")),
        ];
        if ctx.agent_home != ctx.grok_home {
            v.push(("grok".into(), ctx.agent_home.join("skills")));
        }
        if let Some(project) = &ctx.project {
            v.push(("project".into(), project.join(".grok").join("skills")));
            v.push(("project".into(), project.join(".claude").join("skills")));
            v.push(("project".into(), project.join(".codex").join("skills")));
            v.push(("project".into(), project.join(".agents").join("skills")));
        }
        v
    };
    for (source, root) in skill_roots {
        if root.is_dir() {
            push_unique_items(
                &mut items,
                scan_skills_dir(&root, &source, &ctx.existing_skill_keys),
            );
        }
    }

    items.sort_by(|a, b| {
        a.kind
            .cmp(&b.kind)
            .then(a.source.cmp(&b.source))
            .then(a.name.cmp(&b.name))
    });

    ExternalImportScanResult {
        session_data_mode: normalize_mode(&ctx.session_mode).to_string(),
        writable,
        dest_skills: ctx.dest_skills.to_string_lossy().to_string(),
        dest_config: ctx.dest_config.to_string_lossy().to_string(),
        homes,
        items,
    }
}

fn merge_perm(mut a: PermissionRules, b: PermissionRules) -> PermissionRules {
    for (bucket, extra) in [
        (&mut a.allow, b.allow),
        (&mut a.deny, b.deny),
        (&mut a.ask, b.ask),
    ] {
        for r in extra {
            if !bucket.iter().any(|x| x == &r) {
                bucket.push(r);
            }
        }
    }
    a
}

fn existing_mcp_names(config_path: &Path) -> HashSet<String> {
    let text = fs::read_to_string(config_path).unwrap_or_default();
    parse_mcp_servers_from_toml(&text)
        .into_iter()
        .map(|d| d.name)
        .collect()
}

fn live_scan_ctx(project_path: Option<&str>) -> ScanCtx {
    let settings = store::load_settings();
    let mode = normalize_mode(&settings.session_data_mode).to_string();
    let home = user_home();
    let grok_home = home.join(".grok");
    let agent_home = resolve_agent_grok_home(&mode);
    let dest_skills = agent_home.join("skills");
    let dest_config = if mode == "shared" {
        grok_home.join("config.toml")
    } else {
        let _ = ensure_app_dirs();
        agent_config_toml()
    };
    let mut existing_skill_keys = HashSet::new();
    collect_skill_keys(&dest_skills, &mut existing_skill_keys);
    collect_skill_keys(&grok_home.join("skills"), &mut existing_skill_keys);
    collect_skill_keys(&agent_home.join("skills"), &mut existing_skill_keys);
    if let Some(p) = project_path.map(str::trim).filter(|s| !s.is_empty()) {
        collect_skill_keys(
            &PathBuf::from(p).join(".grok").join("skills"),
            &mut existing_skill_keys,
        );
    }
    let appdata = std::env::var("APPDATA")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .map(PathBuf::from);
    let xdg_config = std::env::var("XDG_CONFIG_HOME")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .map(PathBuf::from);
    let codex_home = std::env::var("CODEX_HOME")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .map(PathBuf::from);
    let claude_dir = std::env::var("CLAUDE_CONFIG_DIR")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .map(PathBuf::from);
    ScanCtx {
        home,
        appdata,
        xdg_config,
        grok_home,
        agent_home,
        project: project_path
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(PathBuf::from),
        session_mode: mode,
        existing_mcp: existing_mcp_names(&dest_config),
        existing_skill_keys,
        dest_skills,
        dest_config,
        codex_home,
        claude_dir,
    }
}

pub fn scan_external_import(project_path: Option<&str>) -> ExternalImportScanResult {
    scan_with_ctx(&live_scan_ctx(project_path))
}

fn switch_to_independent() -> Result<bool, String> {
    let mut settings = store::load_settings();
    if normalize_mode(&settings.session_data_mode) == "independent" {
        return Ok(false);
    }
    settings.session_data_mode = "independent".into();
    store::save_settings(&settings)?;
    Ok(true)
}

fn copy_skill_dir(src: &Path, dest: &Path) -> Result<(), String> {
    fs::create_dir_all(dest).map_err(|e| format!("create skill dir: {e}"))?;
    copy_skill_dir_inner(src, dest, src)
}

fn copy_skill_dir_inner(src: &Path, dest: &Path, root: &Path) -> Result<(), String> {
    let entries = fs::read_dir(src).map_err(|e| format!("read skill dir: {e}"))?;
    for entry in entries.flatten() {
        let name = entry.file_name();
        let name_s = name.to_string_lossy();
        if !should_copy_skill_file_name(&name_s) {
            continue;
        }
        let from = entry.path();
        // Refuse symlink escape.
        if from
            .symlink_metadata()
            .map(|m| m.file_type().is_symlink())
            .unwrap_or(false)
        {
            continue;
        }
        let canon = from.canonicalize().unwrap_or_else(|_| from.clone());
        if !canon.starts_with(root.canonicalize().unwrap_or_else(|_| root.to_path_buf()))
            && !from.starts_with(root)
        {
            continue;
        }
        let to = dest.join(&name);
        if from.is_dir() {
            copy_skill_dir_inner(&from, &to, root)?;
        } else if from.is_file() {
            if let Ok(meta) = from.metadata() {
                if meta.len() > MAX_SKILL_MD_BYTES {
                    continue;
                }
            }
            if let Some(parent) = to.parent() {
                fs::create_dir_all(parent).map_err(|e| format!("create: {e}"))?;
            }
            fs::copy(&from, &to).map_err(|e| format!("copy: {e}"))?;
        }
    }
    Ok(())
}

fn apply_skill(item: &ExternalImportItem, dest_root: &Path) -> Result<(), String> {
    let src = item
        .skill_dir
        .as_deref()
        .map(PathBuf::from)
        .ok_or_else(|| "broken".to_string())?;
    if !src.is_dir() {
        return Err("broken".into());
    }
    let name = sanitize_skill_folder_name(&item.name)?;
    let dest = dest_root.join(&name);
    if dest.join("SKILL.md").is_file() || dest.join("skill.md").is_file() {
        return Err("already_exists".into());
    }
    copy_skill_dir(&src, &dest)?;
    if !dest.join("SKILL.md").is_file() && !dest.join("skill.md").is_file() {
        let _ = fs::remove_dir_all(&dest);
        return Err("broken".into());
    }
    Ok(())
}

fn apply_mcp(item: &ExternalImportItem, dest_config: &Path) -> Result<(), String> {
    let name = validate_mcp_server_name(&item.name)?.to_string();
    if let Some(parent) = dest_config.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let existing = fs::read_to_string(dest_config).unwrap_or_default();
    let next = if let Some(url) = item.url.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        upsert_mcp_http_in_toml(&existing, &name, url, None, item.transport.as_deref())
    } else if let Some(command) = item
        .command
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let args = item.args.clone().unwrap_or_default();
        upsert_mcp_stdio_in_toml(&existing, &name, command, &args, None)
    } else {
        return Err("missing_command".into());
    };
    fs::write(dest_config, next).map_err(|e| e.to_string())?;
    invalidate_mcp_cache();
    let _ = set_mcp_enabled(&name, true);
    Ok(())
}

fn apply_permissions(item: &ExternalImportItem) -> Result<(), String> {
    let current = load_permission_rules()?;
    let mut rules = PermissionRules {
        allow: current.allow,
        deny: current.deny,
        ask: current.ask,
    };
    for (action, extra) in [
        ("allow", item.allow.as_deref().unwrap_or(&[])),
        ("deny", item.deny.as_deref().unwrap_or(&[])),
        ("ask", item.ask.as_deref().unwrap_or(&[])),
    ] {
        for rule in extra {
            rules = add_rule(&rules, action, rule)?;
        }
    }
    save_permission_rules(&rules)?;
    Ok(())
}

pub fn apply_external_import_with(
    req: &ExternalImportRequest,
    ctx: &ScanCtx,
    allow_config_write: bool,
) -> ExternalImportApplyResult {
    let scan = scan_with_ctx(ctx);
    let wanted: HashSet<String> = req
        .ids
        .iter()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    let mut imported = 0u32;
    let mut skipped = 0u32;
    let mut failed = Vec::new();
    for item in scan.items {
        if !wanted.contains(&item.id) {
            continue;
        }
        match item.kind.as_str() {
            "skill" => {
                if item.status != "importable" && item.status != "exists" {
                    skipped += 1;
                    continue;
                }
                if item.status == "exists" && item.reason.as_deref() == Some("already_exists") {
                    // Re-copy only when the destination file is missing; exists = skip.
                    skipped += 1;
                    continue;
                }
                match apply_skill(&item, &ctx.dest_skills) {
                    Ok(()) => imported += 1,
                    Err(reason) if reason == "already_exists" => skipped += 1,
                    Err(reason) => failed.push(ExternalImportFailure {
                        id: item.id,
                        reason,
                    }),
                }
            }
            "mcp" => {
                if item.status != "importable" && item.status != "exists" {
                    skipped += 1;
                    continue;
                }
                if !allow_config_write {
                    failed.push(ExternalImportFailure {
                        id: item.id,
                        reason: "shared_readonly".into(),
                    });
                    continue;
                }
                match apply_mcp(&item, &ctx.dest_config) {
                    Ok(()) => imported += 1,
                    Err(reason) => failed.push(ExternalImportFailure {
                        id: item.id,
                        reason,
                    }),
                }
            }
            "permission" => {
                if item.status != "importable" {
                    skipped += 1;
                    continue;
                }
                if !allow_config_write {
                    failed.push(ExternalImportFailure {
                        id: item.id,
                        reason: "shared_readonly".into(),
                    });
                    continue;
                }
                match apply_permissions(&item) {
                    Ok(()) => imported += 1,
                    Err(reason) => failed.push(ExternalImportFailure {
                        id: item.id,
                        reason,
                    }),
                }
            }
            "provider" => {
                skipped += 1;
            }
            _ => {
                failed.push(ExternalImportFailure {
                    id: item.id,
                    reason: "not_mapped".into(),
                });
            }
        }
    }
    ExternalImportApplyResult {
        imported,
        skipped,
        failed,
        switched_to_independent: false,
        dest_skills: ctx.dest_skills.to_string_lossy().to_string(),
        dest_config: ctx.dest_config.to_string_lossy().to_string(),
    }
}

pub fn apply_external_import(
    req: ExternalImportRequest,
) -> Result<ExternalImportApplyResult, String> {
    let mut switched = false;
    if req.switch_to_independent {
        switched = switch_to_independent()?;
    }
    let project = req.project_path.clone();
    let ctx = live_scan_ctx(project.as_deref());
    let allow = normalize_mode(&ctx.session_mode) == "independent";
    let mut result = apply_external_import_with(&req, &ctx, allow);
    result.switched_to_independent = switched;
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn temp_ctx(tag: &str) -> (PathBuf, ScanCtx) {
        let root =
            std::env::temp_dir().join(format!("grok-ext-import-{}-{}", tag, std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let home = root.join("home");
        let grok = home.join(".grok");
        let agent = root.join("agent-home");
        fs::create_dir_all(home.join(".codex").join("skills")).unwrap();
        fs::create_dir_all(home.join(".claude").join("skills")).unwrap();
        fs::create_dir_all(grok.join("skills")).unwrap();
        fs::create_dir_all(agent.join("skills")).unwrap();
        let dest_config = agent.join("config.toml");
        let ctx = ScanCtx {
            home: home.clone(),
            appdata: Some(root.join("appdata")),
            xdg_config: Some(root.join("xdg")),
            grok_home: grok,
            agent_home: agent.clone(),
            project: Some(root.join("proj")),
            session_mode: "independent".into(),
            existing_mcp: HashSet::new(),
            existing_skill_keys: HashSet::new(),
            dest_skills: agent.join("skills"),
            dest_config,
            codex_home: None,
            claude_dir: None,
        };
        (root, ctx)
    }

    fn write(path: &Path, body: &str) {
        if let Some(p) = path.parent() {
            fs::create_dir_all(p).unwrap();
        }
        let mut f = fs::File::create(path).unwrap();
        f.write_all(body.as_bytes()).unwrap();
    }

    #[test]
    fn parses_codex_providers_and_maps_wire_api() {
        let text = r#"
[model_providers.acme]
name = "Acme"
base_url = "https://api.acme.test/v1"
wire_api = "chat"

[model_providers.broken]
name = "No url"
"#;
        let rows = parse_codex_model_providers(text);
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].id, "acme");
        assert_eq!(rows[0].base_url, "https://api.acme.test/v1");
        assert_eq!(map_codex_wire_api("chat"), Some("chat_completions"));
        assert_eq!(map_codex_wire_api("responses"), Some("responses"));
        assert_eq!(map_codex_wire_api("other"), None);
    }

    #[test]
    fn scan_finds_codex_mcp_and_skips_provider_keys() {
        let (root, mut ctx) = temp_ctx("scan-mcp");
        write(
            &ctx.home.join(".codex").join("config.toml"),
            r#"
[mcp_servers.docs]
command = "npx"
args = ["-y", "docs-mcp"]

[mcp_servers.docs.env]
TOKEN = "should-not-appear"

[model_providers.acme]
name = "Acme"
base_url = "https://api.acme.test/v1"
"#,
        );
        write(
            &ctx.home.join(".claude.json"),
            r#"{
              "mcpServers": {
                "playwright": { "command": "npx", "args": ["-y", "@playwright/mcp"] }
              },
              "permissions": { "allow": ["Bash(git *)"], "deny": ["Read(.env)"] }
            }"#,
        );
        let skill_dir = ctx.home.join(".codex").join("skills").join("review");
        write(
            &skill_dir.join("SKILL.md"),
            "---\nname: review\ndescription: Review diffs\n---\n\n# Review\n",
        );
        write(&skill_dir.join(".env"), "SECRET=1\n");
        let scan = scan_with_ctx(&ctx);
        assert!(scan
            .items
            .iter()
            .any(|i| i.id == "mcp:codex:docs" && i.status == "importable"));
        assert!(scan
            .items
            .iter()
            .any(|i| i.id == "mcp:codex:docs" && i.reason.as_deref() == Some("env_redacted")));
        assert!(scan
            .items
            .iter()
            .any(|i| i.id == "mcp:claude:playwright" && i.status == "importable"));
        let prov = scan
            .items
            .iter()
            .find(|i| i.kind == "provider")
            .expect("provider preview");
        assert_eq!(prov.status, "missing_key");
        assert_eq!(prov.reason.as_deref(), Some("no_api_key"));
        assert!(scan.items.iter().any(|i| i.id == "skill:codex:review"));
        assert!(scan.items.iter().any(|i| i.kind == "permission"));
        ctx.session_mode = "shared".into();
        let shared = scan_with_ctx(&ctx);
        assert!(!shared.writable);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn skill_copy_skips_secrets_and_shared_mode_blocks_mcp() {
        let (root, mut ctx) = temp_ctx("apply");
        let skill_dir = ctx.home.join(".codex").join("skills").join("review");
        write(
            &skill_dir.join("SKILL.md"),
            "---\nname: review\ndescription: Review diffs\n---\n\n# Review\n",
        );
        write(&skill_dir.join(".env"), "SECRET=1\n");
        write(&skill_dir.join("notes.md"), "ok\n");
        write(
            &ctx.home.join(".codex").join("config.toml"),
            "[mcp_servers.docs]\ncommand = \"npx\"\nargs = [\"-y\", \"docs\"]\n",
        );
        let scan = scan_with_ctx(&ctx);
        let skill = scan
            .items
            .iter()
            .find(|i| i.id == "skill:codex:review")
            .unwrap()
            .clone();
        let mcp = scan
            .items
            .iter()
            .find(|i| i.id == "mcp:codex:docs")
            .unwrap()
            .clone();

        let ok = apply_external_import_with(
            &ExternalImportRequest {
                ids: vec![skill.id.clone()],
                project_path: None,
                switch_to_independent: false,
            },
            &ctx,
            true,
        );
        assert_eq!(ok.imported, 1);
        let dest = ctx.dest_skills.join("review");
        assert!(dest.join("SKILL.md").is_file());
        assert!(dest.join("notes.md").is_file());
        assert!(!dest.join(".env").exists());

        ctx.session_mode = "shared".into();
        let blocked = apply_external_import_with(
            &ExternalImportRequest {
                ids: vec![mcp.id.clone()],
                project_path: None,
                switch_to_independent: false,
            },
            &ctx,
            false,
        );
        assert_eq!(blocked.imported, 0);
        assert!(blocked.failed.iter().any(|f| f.reason == "shared_readonly"));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn secret_file_helpers_match_policy() {
        assert!(!is_secret_skill_file_name("SKILL.md"));
        assert!(is_secret_skill_file_name(".env"));
        assert!(is_secret_skill_file_name("auth.json"));
        assert!(should_copy_skill_file_name("scripts"));
        assert!(!should_copy_skill_file_name("node_modules"));
    }

    #[test]
    fn claude_skills_are_already_visible() {
        let (root, ctx) = temp_ctx("claude-vis");
        write(
            &ctx.home
                .join(".claude")
                .join("skills")
                .join("pdf")
                .join("SKILL.md"),
            "---\nname: pdf\ndescription: PDF\n---\n\n# PDF\n",
        );
        let scan = scan_with_ctx(&ctx);
        let row = scan
            .items
            .iter()
            .find(|i| i.id == "skill:claude:pdf")
            .expect("claude skill");
        assert_eq!(row.status, "already_visible");
        let _ = fs::remove_dir_all(&root);
    }
}
