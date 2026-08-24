//! Pack Grok Office OOXML (docx / pptx) or raw xlsx bytes under a trusted project.

use std::fs;
use std::io::{Cursor, Write};
use std::path::Path;

use serde::Deserialize;
use zip::write::SimpleFileOptions;
use zip::CompressionMethod;
use zip::ZipWriter;

use crate::fs_browser::{
    file_mtime_ms, lexical_join, normalize_rel, require_project_root, FsWriteResult,
};

const MAX_ENTRY_BYTES: usize = 4 * 1024 * 1024;
const MAX_ENTRIES: usize = 80;
const MAX_PACK_BYTES: usize = 16 * 1024 * 1024;

#[derive(Debug, Deserialize)]
pub struct OfficeZipEntry {
    pub path: String,
    pub text: String,
}

fn dest_ext_ok(relative: &str) -> bool {
    let lower = relative.to_ascii_lowercase();
    lower.ends_with(".docx") || lower.ends_with(".xlsx") || lower.ends_with(".pptx")
}

fn sanitize_entry_path(raw: &str) -> Result<String, String> {
    let n = raw
        .replace('\\', "/")
        .trim()
        .trim_start_matches('/')
        .to_string();
    if n.is_empty() {
        return Err("empty zip entry path".into());
    }
    if n.contains("..") || n.starts_with('/') {
        return Err("zip entry path not allowed".into());
    }
    Ok(n)
}

fn write_dest(path: &Path, bytes: &[u8], relative: String) -> Result<FsWriteResult, String> {
    if bytes.len() > MAX_PACK_BYTES {
        return Err(format!(
            "office export too large (max {MAX_PACK_BYTES} bytes)"
        ));
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create parent: {e}"))?;
    }
    crate::store_lock::write_bytes_atomic(path, bytes)?;
    crate::path_scope::grant_path(path);
    Ok(FsWriteResult {
        relative_path: relative,
        absolute_path: path.to_string_lossy().to_string(),
        size: bytes.len() as u64,
        mtime_ms: file_mtime_ms(path),
    })
}

pub fn office_export(
    project_root: &str,
    relative: &str,
    entries: Option<&[OfficeZipEntry]>,
    bytes_base64: Option<&str>,
) -> Result<FsWriteResult, String> {
    let root = require_project_root(project_root)?;
    let rel = normalize_rel(relative);
    if rel.is_empty() {
        return Err("empty relative path".into());
    }
    if !dest_ext_ok(&rel) {
        return Err("office export must be .docx, .xlsx, or .pptx".into());
    }
    let path = lexical_join(&root, &rel)?;

    if let Some(raw) = bytes_base64.map(str::trim).filter(|s| !s.is_empty()) {
        use base64::Engine;
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(raw)
            .map_err(|e| format!("invalid base64: {e}"))?;
        return write_dest(&path, &bytes, rel);
    }

    let parts = entries.unwrap_or(&[]);
    if parts.is_empty() {
        return Err("office export needs entries or bytes".into());
    }
    if parts.len() > MAX_ENTRIES {
        return Err(format!("too many zip entries (max {MAX_ENTRIES})"));
    }

    let mut buf = Cursor::new(Vec::new());
    {
        let mut zip = ZipWriter::new(&mut buf);
        let opts = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
        for ent in parts {
            let name = sanitize_entry_path(&ent.path)?;
            if ent.text.len() > MAX_ENTRY_BYTES {
                return Err(format!("zip entry too large: {name}"));
            }
            zip.start_file(&name, opts)
                .map_err(|e| format!("zip start {name}: {e}"))?;
            zip.write_all(ent.text.as_bytes())
                .map_err(|e| format!("zip write {name}: {e}"))?;
        }
        zip.finish().map_err(|e| format!("zip finish: {e}"))?;
    }
    write_dest(&path, &buf.into_inner(), rel)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;

    fn tmp_project() -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("grok-office-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        crate::path_scope::grant_path(&dir);
        dir
    }

    #[test]
    fn packs_docx_and_reads_entry() {
        let dir = tmp_project();
        let root = dir.to_str().unwrap();
        let entries = vec![OfficeZipEntry {
            path: "word/document.xml".into(),
            text: "<w:document>hello-office</w:document>".into(),
        }];
        let r = office_export(root, "docs/q3.docx", Some(&entries), None).unwrap();
        assert!(r.absolute_path.ends_with("q3.docx"));
        let file = fs::File::open(&r.absolute_path).unwrap();
        let mut zip = zip::ZipArchive::new(file).unwrap();
        let mut xml = String::new();
        zip.by_name("word/document.xml")
            .unwrap()
            .read_to_string(&mut xml)
            .unwrap();
        assert!(xml.contains("hello-office"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn rejects_escape_and_bad_ext() {
        let dir = tmp_project();
        let root = dir.to_str().unwrap();
        let entries = vec![OfficeZipEntry {
            path: "a.xml".into(),
            text: "x".into(),
        }];
        assert!(office_export(root, "../x.docx", Some(&entries), None).is_err());
        assert!(office_export(root, "notes.md", Some(&entries), None).is_err());
        let _ = fs::remove_dir_all(&dir);
    }
}
