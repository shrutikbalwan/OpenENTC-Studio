use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

const MAX_FILE_BYTES: u64 = 16 * 1024 * 1024;
static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

#[cfg(unix)]
fn sync_directory(path: &Path) -> io::Result<()> {
    File::open(path)?.sync_all()
}

#[cfg(not(unix))]
fn sync_directory(_: &Path) -> io::Result<()> {
    // Windows does not expose the same directory-handle durability contract;
    // the temporary file is still flushed and atomically renamed below.
    Ok(())
}

fn inside(root: &Path, candidate: &Path) -> bool {
    candidate == root || candidate.strip_prefix(root).is_ok()
}

fn unsafe_relative(value: &str) -> bool {
    let bytes = value.as_bytes();
    value.is_empty()
        || value.contains('\0')
        || value.starts_with('/')
        || value.starts_with('\\')
        || (bytes.len() >= 3 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' && (bytes[2] == b'/' || bytes[2] == b'\\'))
        || value.split(&['/', '\\'][..]).any(|part| part.is_empty() || part == "." || part == "..")
}

pub fn approved_path(root: &Path, relative: &str) -> Result<PathBuf, String> {
    if unsafe_relative(relative) || Path::new(relative).is_absolute() { return Err("project path must be relative".into()); }
    let requested = Path::new(relative);
    if requested.components().any(|component| matches!(component, Component::ParentDir | Component::RootDir | Component::Prefix(_))) {
        return Err("project path contains an escape component".into());
    }
    let root = fs::canonicalize(root).map_err(|error| format!("project root is unavailable: {error}"))?;
    let candidate = root.join(requested);
    let existing = if candidate.exists() { fs::canonicalize(&candidate) } else {
        let parent = candidate.parent().ok_or_else(|| "project path has no parent".to_string())?;
        fs::canonicalize(parent).map(|path| path.join(candidate.file_name().unwrap_or_default()))
    }.map_err(|error| format!("project path cannot be resolved: {error}"))?;
    if !inside(&root, &existing) { return Err("project path escapes the approved root".into()); }
    Ok(candidate)
}

pub fn read_bounded(root: &Path, relative: &str) -> Result<Vec<u8>, String> {
    read_bounded_limit(root, relative, MAX_FILE_BYTES)
}

pub fn read_bounded_limit(root: &Path, relative: &str, max_bytes: u64) -> Result<Vec<u8>, String> {
    let path = approved_path(root, relative)?;
    let metadata = fs::metadata(&path).map_err(|error| error.to_string())?;
    if !metadata.is_file() || metadata.len() > max_bytes { return Err("project file is missing or exceeds the size limit".into()); }
    let mut file = File::open(path).map_err(|error| error.to_string())?; let mut bytes = Vec::with_capacity(metadata.len() as usize);
    file.read_to_end(&mut bytes).map_err(|error| error.to_string())?; Ok(bytes)
}

pub fn write_atomic(root: &Path, relative: &str, contents: &[u8]) -> Result<(), String> {
    if contents.len() as u64 > MAX_FILE_BYTES { return Err("project file exceeds the size limit".into()); }
    let path = approved_path(root, relative)?;
    let parent = path.parent().ok_or_else(|| "project file has no parent".to_string())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let canonical_root = fs::canonicalize(root).map_err(|error| format!("project root is unavailable: {error}"))?;
    let canonical_parent = fs::canonicalize(parent).map_err(|error| format!("project parent is unavailable: {error}"))?;
    if !inside(&canonical_root, &canonical_parent) { return Err("project parent escapes the approved root".into()); }
    let nonce = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
    let filename = path.file_name().and_then(|name| name.to_str()).unwrap_or("project");
    let temporary = parent.join(format!(".{filename}-{}-{nonce}.tmp", std::process::id()));
    if !inside(&canonical_root, &temporary) { return Err("temporary project path escapes the approved root".into()); }
    let mut file = OpenOptions::new().write(true).create_new(true).open(&temporary).map_err(|error| error.to_string())?;
    if let Err(error) = file.write_all(contents).and_then(|_| file.sync_all()) { let _ = fs::remove_file(&temporary); return Err(error.to_string()); }
    fs::rename(&temporary, &path).map_err(|error| { let _ = fs::remove_file(&temporary); error.to_string() })?;
    sync_directory(parent).map_err(|error| error.to_string())
}

#[allow(dead_code)]
fn _io(_: io::Error) {}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_escape_components() {
        let root = std::env::temp_dir();
        assert!(approved_path(&root, "../outside").is_err());
        assert!(approved_path(&root, "C:\\outside").is_err());
    }
}
