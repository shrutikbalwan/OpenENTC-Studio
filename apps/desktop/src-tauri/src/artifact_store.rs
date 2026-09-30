use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, OpenOptions};
#[cfg(unix)]
use std::fs::File;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

const MAX_ARTIFACT_BYTES: usize = 256 * 1024 * 1024;
const MAX_ARTIFACT_PATH_BYTES: usize = 4096;
const MAX_MEDIA_TYPE_BYTES: usize = 200;
static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

#[cfg(unix)]
fn sync_directory(path: &Path) -> std::io::Result<()> {
    File::open(path)?.sync_all()
}

#[cfg(not(unix))]
fn sync_directory(_: &Path) -> std::io::Result<()> {
    Ok(())
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactReference {
    pub path: String,
    pub sha256: String,
    pub size: usize,
    pub media_type: String,
}

fn safe_relative(path: &str) -> Result<(), String> {
    let bytes = path.as_bytes();
    let value = Path::new(path);
    if path.is_empty() || path.len() > MAX_ARTIFACT_PATH_BYTES || path.contains('\0') || path.chars().any(|character| character.is_control()) || path.starts_with('/') || path.starts_with('\\') || (bytes.len() >= 3 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' && (bytes[2] == b'/' || bytes[2] == b'\\')) || path.split(&['/', '\\'][..]).any(|part| part.is_empty() || part == "." || part == "..") || value.is_absolute() || value.components().any(|component| matches!(component, std::path::Component::ParentDir | std::path::Component::RootDir | std::path::Component::Prefix(_))) {
        return Err("artifact path must be a safe relative path".into());
    }
    Ok(())
}

fn approved_path(root: &Path, relative: &str) -> Result<PathBuf, String> {
    safe_relative(relative)?;
    let canonical_root = fs::canonicalize(root).map_err(|error| error.to_string())?;
    let requested = canonical_root.join(relative);
    let resolved = if requested.exists() { fs::canonicalize(&requested).map_err(|error| error.to_string())? } else {
        let mut cursor = requested.parent().ok_or_else(|| "artifact path has no parent".to_string())?;
        let mut missing = vec![requested.file_name().ok_or_else(|| "artifact path has no file name".to_string())?.to_os_string()];
        while !cursor.exists() {
            missing.push(cursor.file_name().ok_or_else(|| "artifact path has no parent".to_string())?.to_os_string());
            cursor = cursor.parent().ok_or_else(|| "artifact path has no existing ancestor".to_string())?;
        }
        let mut resolved = fs::canonicalize(cursor).map_err(|error| error.to_string())?;
        for component in missing.iter().rev() { resolved.push(component); }
        resolved
    };
    if !resolved.starts_with(&canonical_root) { return Err("artifact path escapes the approved root".into()); }
    Ok(requested)
}

pub fn hash_bytes(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

pub fn reference_existing(root: &Path, relative: &str, media_type: String) -> Result<ArtifactReference, String> {
    let normalized = relative.replace('\\', "/");
    if !(normalized.starts_with("runs/") || normalized.starts_with("build/")) { return Err("generated artifacts must be stored under runs/ or build/".into()); }
    if media_type.trim().is_empty() || media_type.len() > MAX_MEDIA_TYPE_BYTES || media_type.chars().any(|character| character.is_control()) { return Err("artifact media type is invalid or exceeds the size limit".into()); }
    let target = approved_path(root, &normalized)?;
    let metadata = fs::metadata(&target).map_err(|error| error.to_string())?;
    if !metadata.is_file() { return Err("generated artifact is not a regular file".into()); }
    if metadata.len() > MAX_ARTIFACT_BYTES as u64 { return Err("artifact exceeds the size limit".into()); }
    let bytes = fs::read(&target).map_err(|error| error.to_string())?;
    Ok(ArtifactReference { path: normalized, sha256: hash_bytes(&bytes), size: bytes.len(), media_type })
}

pub fn store(root: &Path, relative: &str, bytes: &[u8], media_type: String) -> Result<ArtifactReference, String> {
    let normalized = relative.replace('\\', "/");
    if !(normalized.starts_with("runs/") || normalized.starts_with("build/")) { return Err("generated artifacts must be stored under runs/ or build/".into()); }
    let target = approved_path(root, &normalized)?;
    if media_type.trim().is_empty() || media_type.len() > MAX_MEDIA_TYPE_BYTES || media_type.chars().any(|character| character.is_control()) { return Err("artifact media type is invalid or exceeds the size limit".into()); }
    if bytes.len() > MAX_ARTIFACT_BYTES { return Err("artifact exceeds the size limit".into()); }
    let root = fs::canonicalize(root).map_err(|error| error.to_string())?;
    let parent = target.parent().ok_or_else(|| "artifact path has no parent".to_string())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let canonical_parent = fs::canonicalize(parent).map_err(|error| error.to_string())?;
    if !canonical_parent.starts_with(&root) { return Err("artifact path escapes the approved root".into()); }
    if target.exists() {
        let existing = fs::read(&target).map_err(|error| error.to_string())?;
        if existing != bytes { return Err("artifact path already contains different content".into()); }
        return Ok(ArtifactReference { path: normalized, sha256: hash_bytes(bytes), size: bytes.len(), media_type });
    }
    let nonce = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
    let temporary = canonical_parent.join(format!(".artifact-{}-{}-{}.tmp", hash_bytes(bytes), std::process::id(), nonce));
    let mut file = OpenOptions::new().write(true).create_new(true).open(&temporary).map_err(|error| error.to_string())?;
    if let Err(error) = file.write_all(bytes).and_then(|_| file.sync_all()) {
        let _ = fs::remove_file(&temporary);
        return Err(error.to_string());
    }
    if let Err(error) = fs::rename(&temporary, &target) { let _ = fs::remove_file(&temporary); return Err(error.to_string()); }
    sync_directory(parent).map_err(|error| error.to_string())?;
    Ok(ArtifactReference { path: normalized, sha256: hash_bytes(bytes), size: bytes.len(), media_type })
}

#[allow(dead_code)]
pub fn verify(root: &Path, reference: &ArtifactReference) -> Result<(), String> {
    let target = approved_path(root, &reference.path)?;
    if reference.sha256.len() != 64 || reference.sha256 != reference.sha256.to_ascii_lowercase() || reference.sha256.chars().any(|character| !character.is_ascii_hexdigit()) || reference.size > MAX_ARTIFACT_BYTES || reference.media_type.trim().is_empty() || reference.media_type.len() > MAX_MEDIA_TYPE_BYTES || reference.media_type.chars().any(|character| character.is_control()) { return Err("artifact reference metadata is invalid".into()); }
    let bytes = fs::read(target).map_err(|error| error.to_string())?;
    if bytes.len() != reference.size || hash_bytes(&bytes) != reference.sha256 { return Err("artifact integrity check failed".into()); }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn hash_is_stable_and_paths_are_bounded() {
        assert_eq!(hash_bytes(b"openentc"), hash_bytes(b"openentc"));
        assert!(safe_relative("../escape").is_err());
        assert!(safe_relative("runs/result.bin").is_ok());
        assert!(safe_relative(&"x".repeat(MAX_ARTIFACT_PATH_BYTES + 1)).is_err());
        assert!(verify(std::env::temp_dir().as_path(), &ArtifactReference { path: "../escape".into(), sha256: "0".repeat(64), size: 0, media_type: "application/octet-stream".into() }).is_err());
        assert!(verify(std::env::temp_dir().as_path(), &ArtifactReference { path: "runs/result.bin".into(), sha256: "A".repeat(64), size: 0, media_type: "application/octet-stream".into() }).is_err());
    }
    #[test]
    fn existing_generated_files_become_bounded_content_addressed_references() {
        let root = std::env::temp_dir().join(format!("openentc-artifact-existing-{}", std::process::id()));
        let target = root.join("runs").join("synth").join("netlist.json");
        fs::create_dir_all(target.parent().unwrap()).unwrap();
        fs::write(&target, b"{\"modules\":{}}").unwrap();
        let reference = reference_existing(&root, "runs/synth/netlist.json", "application/json".into()).unwrap();
        assert_eq!(reference.size, 14);
        assert_eq!(reference.sha256, hash_bytes(b"{\"modules\":{}}"));
        assert!(reference_existing(&root, "../escape", "application/json".into()).is_err());
        let _ = fs::remove_dir_all(root);
    }
}
