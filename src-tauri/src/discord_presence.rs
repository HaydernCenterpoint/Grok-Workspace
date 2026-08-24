//! Discord Rich Presence over local IPC.
//! Soft-fail when Discord is not running. Client ID is public (not a secret).

use std::io::{Read, Write};
use std::sync::mpsc;
use std::time::Duration;

use parking_lot::Mutex;
use serde::Serialize;
use uuid::Uuid;

/// Public Discord Application ID. Override at runtime with `GROK_DISCORD_CLIENT_ID`.
/// Register the app as **Grok App** at https://discord.com/developers/applications
pub const DISCORD_CLIENT_ID: &str = match option_env!("GROK_DISCORD_CLIENT_ID") {
    Some(id) if !id.is_empty() => id,
    _ => "1425847201832636416",
};

const OP_HANDSHAKE: u32 = 0;
const OP_FRAME: u32 = 1;
const LINE_MAX: usize = 128;
const ACK_TIMEOUT: Duration = Duration::from_millis(1500);

#[cfg(windows)]
type IpcStream = std::fs::File;
#[cfg(unix)]
type IpcStream = std::os::unix::net::UnixStream;

static IPC: Mutex<Option<IpcStream>> = Mutex::new(None);
static LAST_ERROR: Mutex<Option<String>> = Mutex::new(None);
static OVERRIDE_CLIENT_ID: Mutex<Option<String>> = Mutex::new(None);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscordPresencePayload {
    pub details: String,
    pub state: String,
    pub start_sec: u64,
    pub large_text: Option<String>,
    pub small_text: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscordPresenceStatus {
    pub ok: bool,
    pub error: Option<String>,
}

fn remember_client_id(id: Option<String>) {
    let Some(raw) = id else {
        return;
    };
    let cleaned = raw.trim().to_string();
    let next = if cleaned.chars().all(|c| c.is_ascii_digit()) && cleaned.len() >= 17 {
        Some(cleaned)
    } else if cleaned.is_empty() {
        None
    } else {
        return;
    };
    let mut cur = OVERRIDE_CLIENT_ID.lock();
    if *cur != next {
        *cur = next;
        *IPC.lock() = None;
    }
}

fn client_id() -> String {
    if let Some(id) = OVERRIDE_CLIENT_ID.lock().clone() {
        return id;
    }
    std::env::var("GROK_DISCORD_CLIENT_ID")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| DISCORD_CLIENT_ID.to_string())
}

fn truncate_line(text: &str) -> String {
    let t = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if t.chars().count() <= LINE_MAX {
        return t;
    }
    let mut out = String::new();
    for ch in t.chars() {
        if out.chars().count() + 1 >= LINE_MAX {
            break;
        }
        out.push(ch);
    }
    out.push('…');
    out
}

fn encode_frame(opcode: u32, payload: &[u8]) -> Vec<u8> {
    let mut buf = Vec::with_capacity(8 + payload.len());
    buf.extend_from_slice(&opcode.to_le_bytes());
    buf.extend_from_slice(&(payload.len() as u32).to_le_bytes());
    buf.extend_from_slice(payload);
    buf
}

fn write_frame(stream: &mut IpcStream, opcode: u32, json: &str) -> Result<(), String> {
    stream
        .write_all(&encode_frame(opcode, json.as_bytes()))
        .and_then(|_| stream.flush())
        .map_err(|e| e.to_string())
}

fn read_frame(stream: &mut IpcStream) -> Result<String, String> {
    let mut hdr = [0u8; 8];
    stream.read_exact(&mut hdr).map_err(|e| e.to_string())?;
    let len = u32::from_le_bytes([hdr[4], hdr[5], hdr[6], hdr[7]]) as usize;
    if len > 1_000_000 {
        return Err("discord ipc frame too large".into());
    }
    let mut body = vec![0u8; len];
    stream.read_exact(&mut body).map_err(|e| e.to_string())?;
    Ok(String::from_utf8_lossy(&body).into_owned())
}

fn read_frame_timed(stream: &mut IpcStream) -> Result<String, String> {
    let mut clone = stream.try_clone().map_err(|e| e.to_string())?;
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let _ = tx.send(read_frame(&mut clone));
    });
    match rx.recv_timeout(ACK_TIMEOUT) {
        Ok(r) => r,
        Err(_) => Err("discord ipc timeout".into()),
    }
}

fn reject_if_error_frame(body: &str) -> Result<(), String> {
    let lower = body.to_ascii_lowercase();
    if lower.contains("invalid client")
        || lower.contains("unknown application")
        || lower.contains("\"code\":4000")
    {
        return Err("invalid_client_id".into());
    }
    if let Ok(v) = serde_json::from_str::<serde_json::Value>(body) {
        if v.get("evt").and_then(|e| e.as_str()) == Some("ERROR") {
            let msg = v
                .pointer("/data/message")
                .and_then(|m| m.as_str())
                .unwrap_or("discord error");
            return Err(msg.to_string());
        }
    }
    Ok(())
}

#[cfg(windows)]
fn try_connect_path(i: u8) -> Result<IpcStream, String> {
    let paths = [
        format!(r"\\?\pipe\discord-ipc-{i}"),
        format!(r"\\.\pipe\discord-ipc-{i}"),
    ];
    let mut last = "discord ipc not found".to_string();
    for path in paths {
        match std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .open(&path)
        {
            Ok(f) => return Ok(f),
            Err(e) => last = e.to_string(),
        }
    }
    Err(last)
}

#[cfg(unix)]
fn try_connect_path(i: u8) -> Result<IpcStream, String> {
    let mut dirs = Vec::new();
    if let Ok(runtime) = std::env::var("XDG_RUNTIME_DIR") {
        dirs.push(runtime);
    }
    if let Ok(tmp) = std::env::var("TMPDIR") {
        dirs.push(tmp);
    }
    dirs.push("/tmp".into());
    let mut last = "discord ipc not found".to_string();
    for dir in dirs {
        let path = format!("{dir}/discord-ipc-{i}");
        match std::os::unix::net::UnixStream::connect(&path) {
            Ok(s) => {
                let _ = s.set_read_timeout(Some(ACK_TIMEOUT));
                let _ = s.set_write_timeout(Some(ACK_TIMEOUT));
                return Ok(s);
            }
            Err(e) => last = e.to_string(),
        }
        let snap = format!("{dir}/snap.discord/discord-ipc-{i}");
        if let Ok(s) = std::os::unix::net::UnixStream::connect(&snap) {
            let _ = s.set_read_timeout(Some(ACK_TIMEOUT));
            let _ = s.set_write_timeout(Some(ACK_TIMEOUT));
            return Ok(s);
        }
    }
    Err(last)
}

fn handshake(stream: &mut IpcStream) -> Result<(), String> {
    let body = serde_json::json!({
        "v": 1,
        "client_id": client_id(),
    });
    write_frame(stream, OP_HANDSHAKE, &body.to_string())?;
    let ack = read_frame_timed(stream)?;
    reject_if_error_frame(&ack)
}

fn connect() -> Result<IpcStream, String> {
    let mut last = "discord ipc not found".to_string();
    for i in 0u8..=9 {
        match try_connect_path(i) {
            Ok(mut stream) => match handshake(&mut stream) {
                Ok(()) => return Ok(stream),
                Err(e) => last = e,
            },
            Err(e) => last = e,
        }
    }
    Err(last)
}

fn with_stream<F>(mut write: F) -> Result<(), String>
where
    F: FnMut(&mut IpcStream) -> Result<(), String>,
{
    let mut guard = IPC.lock();
    if guard.is_none() {
        *guard = Some(connect()?);
    }
    match write(guard.as_mut().expect("connected")) {
        Ok(()) => Ok(()),
        Err(_) => {
            *guard = None;
            let mut stream = connect()?;
            let out = write(&mut stream);
            if out.is_ok() {
                *guard = Some(stream);
            }
            out
        }
    }
}

fn activity_object(p: &DiscordPresencePayload) -> serde_json::Value {
    let mut activity = serde_json::json!({
        "type": 0,
        "name": "Grok App",
        "details": truncate_line(&p.details),
        "state": truncate_line(&p.state),
        "timestamps": { "start": p.start_sec },
        "instance": false,
    });
    let large = p
        .large_text
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let small = p
        .small_text
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());
    if large.is_some() || small.is_some() {
        let mut assets = serde_json::Map::new();
        if let Some(t) = large {
            assets.insert("large_text".into(), serde_json::json!(truncate_line(t)));
        }
        if let Some(t) = small {
            assets.insert("small_text".into(), serde_json::json!(truncate_line(t)));
        }
        activity["assets"] = serde_json::Value::Object(assets);
    }
    activity
}

fn set_activity(payload: Option<&DiscordPresencePayload>) -> Result<(), String> {
    let nonce = Uuid::new_v4().to_string();
    let pid = std::process::id();
    let activity = payload.map(activity_object);
    let body = serde_json::json!({
        "cmd": "SET_ACTIVITY",
        "nonce": nonce,
        "args": {
            "pid": pid,
            "activity": activity,
        },
    });
    with_stream(|stream| {
        write_frame(stream, OP_FRAME, &body.to_string())?;
        if let Ok(ack) = read_frame_timed(stream) {
            reject_if_error_frame(&ack)?;
        }
        Ok(())
    })
}

fn remember(result: Result<(), String>) -> Result<(), String> {
    match &result {
        Ok(()) => *LAST_ERROR.lock() = None,
        Err(e) => *LAST_ERROR.lock() = Some(e.clone()),
    }
    result
}

fn apply_update(payload: DiscordPresencePayload) -> Result<(), String> {
    remember(set_activity(Some(&payload)))
}

fn apply_clear() -> Result<(), String> {
    let r = remember(set_activity(None));
    *IPC.lock() = None;
    r
}

fn probe_inner() -> DiscordPresenceStatus {
    match connect() {
        Ok(stream) => {
            *IPC.lock() = Some(stream);
            *LAST_ERROR.lock() = None;
            DiscordPresenceStatus {
                ok: true,
                error: None,
            }
        }
        Err(error) => {
            *LAST_ERROR.lock() = Some(error.clone());
            DiscordPresenceStatus {
                ok: false,
                error: Some(error),
            }
        }
    }
}

#[tauri::command]
pub async fn discord_presence_update(
    details: String,
    state: String,
    start_sec: u64,
    client_id: Option<String>,
    large_text: Option<String>,
    small_text: Option<String>,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        remember_client_id(client_id);
        apply_update(DiscordPresencePayload {
            details,
            state,
            start_sec,
            large_text,
            small_text,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn discord_presence_clear() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(apply_clear)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn discord_presence_probe(client_id: Option<String>) -> DiscordPresenceStatus {
    match tauri::async_runtime::spawn_blocking(move || {
        remember_client_id(client_id);
        probe_inner()
    })
    .await
    {
        Ok(status) => status,
        Err(e) => DiscordPresenceStatus {
            ok: false,
            error: Some(e.to_string()),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frame_header_is_little_endian() {
        let frame = encode_frame(1, b"{}");
        assert_eq!(&frame[0..4], &1u32.to_le_bytes());
        assert_eq!(&frame[4..8], &2u32.to_le_bytes());
        assert_eq!(&frame[8..], b"{}");
    }

    #[test]
    fn truncates_long_presence_lines() {
        let line = truncate_line(&"x".repeat(200));
        assert!(line.chars().count() <= LINE_MAX);
        assert!(line.ends_with('…'));
    }

    #[test]
    fn client_id_is_numeric() {
        assert!(client_id().chars().all(|c| c.is_ascii_digit()));
        assert!(client_id().len() >= 17);
    }

    #[test]
    fn detects_invalid_client_frames() {
        assert!(reject_if_error_frame(r#"{"code":4000,"message":"Invalid Client ID"}"#).is_err());
        assert!(reject_if_error_frame(r#"{"evt":"READY"}"#).is_ok());
    }

    #[test]
    fn activity_includes_hover_assets() {
        let activity = activity_object(&DiscordPresencePayload {
            details: "SuperGrok Heavy · 99%".into(),
            state: "Grok 4.6 · Extra high · Fix login".into(),
            start_sec: 1_700_000_000,
            large_text: Some("Fix login".into()),
            small_text: Some("Grok 4.6 · Extra high".into()),
        });
        assert_eq!(activity["details"], "SuperGrok Heavy · 99%");
        assert_eq!(activity["state"], "Grok 4.6 · Extra high · Fix login");
        assert_eq!(activity["timestamps"]["start"], 1_700_000_000);
        assert_eq!(activity["assets"]["large_text"], "Fix login");
        assert_eq!(activity["assets"]["small_text"], "Grok 4.6 · Extra high");
        assert!(activity.get("assets").unwrap().get("large_image").is_none());
    }
}
