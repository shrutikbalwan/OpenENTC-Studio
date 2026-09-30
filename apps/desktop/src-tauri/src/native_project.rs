use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::State;

use crate::permissions::{Permission, ProjectGrant};
use crate::project_fs;

const MANIFEST_PATH: &str = "openentc.project.json";
const MAX_MANIFEST_BYTES: u64 = 10 * 1024 * 1024;
const MAX_EXPERIMENT_DEFINITION_BYTES: usize = 64 * 1024;

fn digits(value: &[u8]) -> Option<u32> {
    if value.is_empty() || value.iter().any(|byte| !byte.is_ascii_digit()) { return None; }
    value.iter().try_fold(0u32, |total, byte| total.checked_mul(10)?.checked_add(u32::from(byte - b'0')))
}

fn valid_timestamp(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() < 20 || bytes.len() > 64 || bytes[4] != b'-' || bytes[7] != b'-' || bytes[10] != b'T' || bytes[13] != b':' || bytes[16] != b':' { return false; }
    let year = digits(&bytes[0..4]); let month = digits(&bytes[5..7]); let day = digits(&bytes[8..10]);
    let hour = digits(&bytes[11..13]); let minute = digits(&bytes[14..16]); let second = digits(&bytes[17..19]);
    if year.is_none() || month.map_or(true, |value| !(1..=12).contains(&value)) || day.map_or(true, |value| !(1..=31).contains(&value)) || hour.map_or(true, |value| value > 23) || minute.map_or(true, |value| value > 59) || second.map_or(true, |value| value > 59) { return false; }
    let mut index = 19;
    if bytes.get(index) == Some(&b'.') {
        index += 1;
        let start = index;
        while bytes.get(index).is_some_and(u8::is_ascii_digit) { index += 1; }
        if index == start { return false; }
    }
    let suffix = &bytes[index..];
    if suffix == b"Z" { return true; }
    if suffix.len() != 6 || (suffix[0] != b'+' && suffix[0] != b'-') || suffix[3] != b':' { return false; }
    let hour = digits(&suffix[1..3]); let minute = digits(&suffix[4..6]);
    hour.map_or(false, |value| value <= 23) && minute.map_or(false, |value| value <= 59)
}

fn bounded_text(value: Option<&Value>, max: usize, required: bool) -> bool {
    value.and_then(Value::as_str).map_or(!required, |text| !text.is_empty() && text.len() <= max && !text.chars().any(|character| character.is_control()))
}

fn finite_number(value: Option<&Value>) -> bool {
    value.and_then(Value::as_f64).is_some_and(|number| number.is_finite())
}

fn valid_wire_route(value: &Value) -> bool {
    let Some(route) = value.as_object() else { return false; };
    if let Some(points) = route.get("points").and_then(Value::as_array) {
        return route.len() == 1 && !points.is_empty() && points.len() <= 64 && points.iter().all(|point| {
            let Some(point) = point.as_object() else { return false; };
            point.len() == 2
                && point.get("x").and_then(Value::as_f64).map_or(false, |coordinate| coordinate.is_finite() && coordinate.abs() <= 1_000_000.0)
                && point.get("y").and_then(Value::as_f64).map_or(false, |coordinate| coordinate.is_finite() && coordinate.abs() <= 1_000_000.0)
        });
    }
    route.len() == 2
        && matches!(route.get("axis").and_then(Value::as_str), Some("x") | Some("y"))
        && route.get("coordinate").and_then(Value::as_f64).map_or(false, |coordinate| coordinate.is_finite() && coordinate.abs() <= 1_000_000.0)
}

fn valid_component_id(value: Option<&Value>) -> bool {
    let Some(id) = value.and_then(Value::as_str) else { return false; };
    let mut chars = id.chars();
    id.len() <= 64 && chars.next().is_some_and(|character| character.is_ascii_alphabetic()) && chars.all(|character| character.is_ascii_alphanumeric() || character == '_' || character == '-')
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ProjectSummary {
    pub name: String,
    pub version: u64,
    pub root: String,
    pub project_id: String,
}

#[derive(Default)]
pub struct ProjectSession {
    root: Mutex<Option<PathBuf>>,
    grant: Mutex<Option<ProjectGrant>>,
}

fn project_id(root: &Path) -> String {
    use sha2::{Digest, Sha256};
    Sha256::digest(root.to_string_lossy().as_bytes()).iter().map(|byte| format!("{byte:02x}")).collect()
}

fn validate_manifest(value: &Value) -> Result<ProjectSummary, String> {
    let object = value.as_object().ok_or_else(|| "project manifest must be an object".to_string())?;
    if object.get("format").and_then(Value::as_str) != Some("openentc-project") {
        return Err("project manifest format is invalid".into());
    }
    let version = object.get("version").and_then(Value::as_u64).ok_or_else(|| "project manifest version is invalid".to_string())?;
    if version == 0 || version > 1 { return Err("project manifest version is unsupported".into()); }
    let name = object.get("name").and_then(Value::as_str).ok_or_else(|| "project manifest name is invalid".to_string())?;
    if name.trim().is_empty() || name.len() > 200 || name.chars().any(|character| character.is_control()) {
        return Err("project manifest name is invalid".into());
    }
    for field in ["circuit", "embedded", "settings"] {
        if !object.get(field).is_some_and(Value::is_object) { return Err(format!("project manifest {field} is invalid")); }
    }
    for field in ["createdAt", "updatedAt"] {
        if object.get(field).and_then(Value::as_str).map_or(true, |timestamp| !valid_timestamp(timestamp)) { return Err(format!("project manifest {field} is invalid")); }
    }
    let units = object.get("units").and_then(Value::as_object).ok_or_else(|| "project units are invalid".to_string())?;
    if units.len() > 1_000 || units.iter().any(|(key, value)| key.is_empty() || key.len() > 200 || key.chars().any(|character| character.is_control()) || value.as_str().map_or(true, |unit| unit.trim().is_empty() || unit.len() > 200 || unit.chars().any(|character| character.is_control()))) {
        return Err("project units are invalid".into());
    }
    let provenance = object.get("provenance").and_then(Value::as_object).ok_or_else(|| "project provenance is invalid".to_string())?;
    let created_by = provenance.get("createdBy").and_then(Value::as_str);
    let versions = provenance.get("engineVersions").and_then(Value::as_object);
    if created_by.map_or(true, |value| value.trim().is_empty() || value.len() > 200 || value.chars().any(|character| character.is_control())) || versions.map_or(true, |entries| entries.len() > 1_000 || entries.iter().any(|(key, value)| key.is_empty() || key.len() > 200 || key.chars().any(|character| character.is_control()) || value.as_str().map_or(true, |version| version.trim().is_empty() || version.len() > 200 || version.chars().any(|character| character.is_control())))) {
        return Err("project provenance is invalid".into());
    }
    if object.get("notes").and_then(Value::as_array).map_or(true, |notes| notes.len() > 1_000) { return Err("project manifest notes are invalid".into()); }
    for (field, limit) in [("documents", 1_000usize), ("targets", 1_000), ("toolchainConstraints", 1_000), ("experiments", 10_000)] {
        let entries = object.get(field).and_then(Value::as_array).ok_or_else(|| format!("project manifest {field} are invalid"))?;
        if entries.len() > limit || entries.iter().any(|entry| !entry.is_object()) { return Err(format!("project manifest {field} are invalid")); }
        for entry in entries {
            let entry_object = entry.as_object().expect("object checked above");
            if entry_object.get("id").is_some_and(|id| id.as_str().map_or(true, |value| value.len() > 200 || value.chars().any(|character| character.is_control()))) { return Err(format!("project manifest {field} contains an invalid id")); }
            if field == "experiments" && serde_json::to_vec(entry).map_or(true, |bytes| bytes.len() > MAX_EXPERIMENT_DEFINITION_BYTES) { return Err("project experiment definition is oversized".into()); }
        }
    }
    if let Some(artifacts) = object.get("artifacts") {
        let artifacts = artifacts.as_array().ok_or_else(|| "project artifacts are invalid".to_string())?;
        if artifacts.len() > 100_000 || artifacts.iter().any(|artifact| {
            let Some(artifact) = artifact.as_object() else { return true; };
            let Some(path) = artifact.get("path").and_then(Value::as_str) else { return true; };
            let Some(hash) = artifact.get("sha256").and_then(Value::as_str) else { return true; };
            let Some(size) = artifact.get("size").and_then(Value::as_u64) else { return true; };
            let Some(media_type) = artifact.get("mediaType").and_then(Value::as_str) else { return true; };
            path.is_empty() || path.len() > 4096 || path.starts_with('/') || path.starts_with('\\') || (path.len() >= 3 && path.as_bytes()[0].is_ascii_alphabetic() && path.as_bytes()[1] == b':' && (path.as_bytes()[2] == b'/' || path.as_bytes()[2] == b'\\')) || path.chars().any(|character| character.is_control()) || path.split(&['/', '\\'][..]).any(|part| part.is_empty() || part == "." || part == "..") || hash.len() != 64 || hash.chars().any(|character| !character.is_ascii_hexdigit() || character.is_ascii_uppercase()) || size > 256 * 1024 * 1024 || media_type.trim().is_empty() || media_type.len() > 200 || media_type.chars().any(|character| character.is_control())
        }) { return Err("project artifacts are invalid".into()); }
    }
    let circuit = object.get("circuit").and_then(Value::as_object).expect("circuit checked above");
    let components = circuit.get("components").and_then(Value::as_array).ok_or_else(|| "project circuit components are invalid".to_string())?;
    if components.len() > 10_000 || components.iter().any(|component| {
        let Some(component) = component.as_object() else { return true; };
        !valid_component_id(component.get("id"))
            || !bounded_text(component.get("type"), 50, true)
            || !bounded_text(component.get("label"), 100, true)
            || !bounded_text(component.get("unit"), 20, true)
            || !bounded_text(component.get("n1"), 100, true)
            || !bounded_text(component.get("n2"), 100, true)
            || !finite_number(component.get("value"))
            || !finite_number(component.get("x"))
            || !finite_number(component.get("y"))
            || (component.contains_key("rotation") && !finite_number(component.get("rotation")))
    }) { return Err("project circuit components are invalid".into()); }
    for (field, limit) in [("wires", 100_000usize), ("junctions", 10_000), ("netLabels", 10_000)] {
        let entries = circuit.get(field).and_then(Value::as_array).ok_or_else(|| format!("project circuit {field} are invalid"))?;
        if entries.len() > limit { return Err(format!("project circuit {field} are invalid")); }
        for entry in entries {
            let object = entry.as_object().ok_or_else(|| format!("project circuit {field} are invalid"))?;
            let valid = match field {
                "wires" => bounded_text(object.get("from"), 100, true)
                    && bounded_text(object.get("to"), 100, true)
                    && object.get("route").map_or(true, valid_wire_route),
                "junctions" => bounded_text(object.get("id"), 100, true) && bounded_text(object.get("node"), 100, true) && finite_number(object.get("x")) && finite_number(object.get("y")),
                "netLabels" => bounded_text(object.get("id"), 100, true) && bounded_text(object.get("text"), 100, true) && bounded_text(object.get("node"), 100, true) && finite_number(object.get("x")) && finite_number(object.get("y")),
                _ => false,
            };
            if !valid { return Err(format!("project circuit {field} are invalid")); }
        }
    }
    let signal = circuit.get("signal").and_then(Value::as_object).ok_or_else(|| "project circuit signal is invalid".to_string())?;
    if !matches!(signal.get("shape").and_then(Value::as_str), Some("sine") | Some("square") | Some("triangle"))
        || signal.get("frequency").and_then(Value::as_f64).map_or(true, |frequency| !frequency.is_finite() || frequency <= 0.0)
        || signal.get("amplitude").and_then(Value::as_f64).map_or(true, |amplitude| !amplitude.is_finite())
        || signal.get("offset").and_then(Value::as_f64).map_or(true, |offset| !offset.is_finite()) {
        return Err("project circuit signal is invalid".into());
    }
    let embedded = object.get("embedded").and_then(Value::as_object).expect("embedded checked above");
    if embedded.get("board").and_then(Value::as_str).map_or(true, |board| board.len() > 200)
        || embedded.get("language").and_then(Value::as_str).map_or(true, |language| language.len() > 50)
        || embedded.get("code").and_then(Value::as_str).map_or(true, |code| code.len() > 1_000_000) { return Err("project embedded source is invalid".into()); }
    let settings = object.get("settings").and_then(Value::as_object).expect("settings checked above");
    if settings.get("gridSize").and_then(Value::as_u64).map_or(true, |grid| !(1..=200).contains(&grid)) { return Err("project settings are invalid".into()); }
    Ok(ProjectSummary { name: name.to_string(), version, root: String::new(), project_id: String::new() })
}

fn canonical_project_root(input: &str) -> Result<PathBuf, String> {
    let path = Path::new(input);
    if !path.is_absolute() { return Err("project root must be an absolute path".into()); }
    let root = std::fs::canonicalize(path).map_err(|error| format!("project root is unavailable: {error}"))?;
    if !root.is_dir() { return Err("project root must be a directory".into()); }
    Ok(root)
}

/// Validates a candidate project without mutating the current session. The
/// desktop shell uses this before revoking the currently open project's
/// process scope during a project switch.
pub fn validate_project(root: &str) -> Result<(), String> {
    let root = canonical_project_root(root)?;
    let bytes = project_fs::read_bounded_limit(&root, MANIFEST_PATH, MAX_MANIFEST_BYTES)?;
    let value: Value = serde_json::from_slice(&bytes).map_err(|error| format!("project manifest is invalid JSON: {error}"))?;
    validate_manifest(&value).map(|_| ())
}

fn current_root_session(state: &ProjectSession) -> Result<PathBuf, String> {
    state.root.lock().map_err(|_| "project session is poisoned".to_string())?
        .clone().ok_or_else(|| "no project is open".to_string())
}

fn current_root(state: &State<'_, ProjectSession>) -> Result<PathBuf, String> {
    current_root_session(state)
}

fn require_session(state: &ProjectSession, permission: Permission) -> Result<PathBuf, String> {
    let root = current_root_session(state)?;
    let grant = state.grant.lock().map_err(|_| "project session is poisoned".to_string())?;
    grant.as_ref().ok_or_else(|| "no project is open".to_string())?.require(&project_id(&root), permission)?;
    Ok(root)
}

fn require(state: &State<'_, ProjectSession>, permission: Permission) -> Result<PathBuf, String> {
    require_session(state, permission)
}

/// Checks that the open session has the requested permission for the exact
/// canonical project identity supplied by the caller. Job and process
/// commands use this before touching native state.
pub fn require_project_permission(state: &State<'_, ProjectSession>, requested_project_id: &str, permission: Permission) -> Result<(), String> {
    let root = require(state, permission)?;
    if project_id(&root) != requested_project_id { return Err("project grant does not match the requested project".into()); }
    Ok(())
}

pub fn current_project_id(state: &State<'_, ProjectSession>) -> Result<String, String> {
    Ok(project_id(&current_root(state)?))
}

pub fn current_project_root(state: &State<'_, ProjectSession>) -> Result<PathBuf, String> {
    current_root(state)
}

/// Merge a verified generated-artifact reference into a manifest without
/// discarding unknown fields. The operation is deterministic and idempotent;
/// a path may never silently point at a different hash or size.
pub fn merge_artifact_reference(manifest: &mut Value, reference: &crate::artifact_store::ArtifactReference) -> Result<(), String> {
    let object = manifest.as_object_mut().ok_or_else(|| "project manifest must be an object".to_string())?;
    let artifacts = object.entry("artifacts").or_insert_with(|| Value::Array(Vec::new()));
    let entries = artifacts.as_array_mut().ok_or_else(|| "project artifacts are invalid".to_string())?;
    let serialized = serde_json::to_value(reference).map_err(|error| format!("artifact reference cannot be serialized: {error}"))?;
    if let Some(existing) = entries.iter().find(|entry| entry.get("path") == serialized.get("path")) {
        if existing != &serialized { return Err("project already contains a different artifact reference at this path".into()); }
    } else {
        entries.push(serialized);
        entries.sort_by(|left, right| left.get("path").and_then(Value::as_str).cmp(&right.get("path").and_then(Value::as_str)));
    }
    Ok(())
}

#[tauri::command]
pub fn grant_process_execution(requested_project_id: String, acknowledge: bool, state: State<'_, ProjectSession>) -> Result<(), String> {
    if !acknowledge { return Err("explicit process permission acknowledgement is required".into()); }
    let root = current_root(&state)?;
    let expected = project_id(&root);
    if expected != requested_project_id { return Err("project grant does not match the requested project".into()); }
    let mut grant = state.grant.lock().map_err(|_| "project session is poisoned".to_string())?;
    grant.as_mut().ok_or_else(|| "no project is open".to_string())?.grant(&requested_project_id, Permission::ProcessExecute)
}

#[tauri::command]
pub fn grant_artifact_write(requested_project_id: String, acknowledge: bool, state: State<'_, ProjectSession>) -> Result<(), String> {
    if !acknowledge { return Err("explicit artifact-write permission acknowledgement is required".into()); }
    let root = current_root(&state)?;
    let expected = project_id(&root);
    if expected != requested_project_id { return Err("project grant does not match the requested project".into()); }
    let mut grant = state.grant.lock().map_err(|_| "project session is poisoned".to_string())?;
    grant.as_mut().ok_or_else(|| "no project is open".to_string())?.grant(&requested_project_id, Permission::ArtifactWrite)
}

pub fn revoke_project_permission(requested_project_id: &str, permission: Permission, state: &State<'_, ProjectSession>) -> Result<(), String> {
    let root = current_root(state)?;
    if project_id(&root) != requested_project_id { return Err("project grant does not match the requested project".into()); }
    let mut grant = state.grant.lock().map_err(|_| "project session is poisoned".to_string())?;
    grant.as_mut().ok_or_else(|| "no project is open".to_string())?.revoke(requested_project_id, permission)
}

#[tauri::command]
pub fn grant_device_target(requested_project_id: String, permission: Permission, target: String, acknowledge: bool, state: State<'_, ProjectSession>) -> Result<(), String> {
    if !acknowledge { return Err("explicit device-target permission acknowledgement is required".into()); }
    let root = current_root(&state)?;
    if project_id(&root) != requested_project_id { return Err("project grant does not match the requested project".into()); }
    let mut grant = state.grant.lock().map_err(|_| "project session is poisoned".to_string())?;
    grant.as_mut().ok_or_else(|| "no project is open".to_string())?.grant_target(&requested_project_id, permission, &target)
}

pub fn revoke_device_target(requested_project_id: String, permission: Permission, target: String, state: State<'_, ProjectSession>) -> Result<(), String> {
    let root = current_root(&state)?;
    if project_id(&root) != requested_project_id { return Err("project grant does not match the requested project".into()); }
    let mut grant = state.grant.lock().map_err(|_| "project session is poisoned".to_string())?;
    grant.as_mut().ok_or_else(|| "no project is open".to_string())?.revoke_target(&requested_project_id, permission, &target)
}

pub fn require_device_target(state: &State<'_, ProjectSession>, requested_project_id: &str, permission: Permission, target: &str) -> Result<(), String> {
    let root = current_root(state)?;
    if project_id(&root) != requested_project_id { return Err("project grant does not match the requested project".into()); }
    let grant = state.grant.lock().map_err(|_| "project session is poisoned".to_string())?;
    grant.as_ref().ok_or_else(|| "no project is open".to_string())?.require_target(requested_project_id, permission, target)
}

fn open_project_session(root: String, state: &ProjectSession) -> Result<ProjectSummary, String> {
    let root = canonical_project_root(&root)?;
    let bytes = project_fs::read_bounded_limit(&root, MANIFEST_PATH, MAX_MANIFEST_BYTES)?;
    let value: Value = serde_json::from_slice(&bytes).map_err(|error| format!("project manifest is invalid JSON: {error}"))?;
    let mut summary = validate_manifest(&value)?;
    summary.root = root.to_string_lossy().into_owned();
    summary.project_id = project_id(&root);
    let grant = ProjectGrant::new(summary.project_id.clone(), [Permission::ProjectRead, Permission::ProjectWrite])?;
    *state.root.lock().map_err(|_| "project session is poisoned".to_string())? = Some(root);
    *state.grant.lock().map_err(|_| "project session is poisoned".to_string())? = Some(grant);
    Ok(summary)
}

pub fn open_project(root: String, state: State<'_, ProjectSession>) -> Result<ProjectSummary, String> {
    open_project_session(root, &state)
}

fn read_project_session(state: &ProjectSession) -> Result<Value, String> {
    let root = require_session(state, Permission::ProjectRead)?;
    let bytes = project_fs::read_bounded_limit(&root, MANIFEST_PATH, MAX_MANIFEST_BYTES)?;
    let value: Value = serde_json::from_slice(&bytes).map_err(|error| format!("project manifest is invalid JSON: {error}"))?;
    validate_manifest(&value)?;
    Ok(value)
}

#[tauri::command]
pub fn read_open_project(state: State<'_, ProjectSession>) -> Result<Value, String> {
    read_project_session(&state)
}

fn save_project_session(manifest: Value, state: &ProjectSession) -> Result<ProjectSummary, String> {
    let root = require_session(state, Permission::ProjectWrite)?;
    let mut summary = validate_manifest(&manifest)?;
    let bytes = serde_json::to_vec_pretty(&manifest).map_err(|error| format!("project manifest cannot be serialized: {error}"))?;
    if bytes.len() as u64 > MAX_MANIFEST_BYTES { return Err("project manifest exceeds the size limit".into()); }
    project_fs::write_atomic(&root, MANIFEST_PATH, &bytes)?;
    summary.root = root.to_string_lossy().into_owned();
    summary.project_id = project_id(&root);
    Ok(summary)
}

#[tauri::command]
pub fn save_open_project(manifest: Value, state: State<'_, ProjectSession>) -> Result<ProjectSummary, String> {
    save_project_session(manifest, &state)
}

fn close_project_session(state: &ProjectSession) -> Result<(), String> {
    *state.root.lock().map_err(|_| "project session is poisoned".to_string())? = None;
    *state.grant.lock().map_err(|_| "project session is poisoned".to_string())? = None;
    Ok(())
}

pub fn close_project(state: State<'_, ProjectSession>) -> Result<(), String> {
    close_project_session(&state)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn manifest() -> Value {
        serde_json::json!({
            "format": "openentc-project", "version": 1, "name": "demo",
            "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z",
            "circuit": { "components": [], "wires": [], "junctions": [], "netLabels": [], "signal": { "shape": "sine", "frequency": 1000.0, "amplitude": 1.0, "offset": 0.0 } }, "embedded": { "board": "Arduino Uno", "language": "C++", "code": "" },
            "units": { "voltage": "V" }, "provenance": { "createdBy": "OpenENTC Studio", "engineVersions": {} },
            "documents": [], "targets": [], "toolchainConstraints": [], "experiments": [], "notes": [],
            "settings": { "gridSize": 20 }
        })
    }

    #[test]
    fn validates_only_supported_manifest_identity_and_core_sections() {
        assert!(validate_manifest(&manifest()).is_ok());
        let mut invalid = manifest(); invalid["format"] = Value::String("other".into());
        assert!(validate_manifest(&invalid).is_err());
        let mut invalid = manifest(); invalid["settings"]["gridSize"] = Value::from(0);
        assert!(validate_manifest(&invalid).is_err());
        let mut invalid = manifest(); invalid["units"]["voltage"] = Value::String("\n".into());
        assert!(validate_manifest(&invalid).is_err());
        let mut invalid = manifest(); invalid["provenance"]["createdBy"] = Value::String("".into());
        assert!(validate_manifest(&invalid).is_err());
        let mut invalid = manifest(); invalid["circuit"]["components"] = serde_json::json!([{ "id": "1bad", "type": "resistor", "label": "R1", "value": 1.0, "unit": "Ω", "n1": "a", "n2": "0", "x": 0.0, "y": 0.0 }]);
        assert!(validate_manifest(&invalid).is_err());
        let mut invalid = manifest(); invalid["circuit"]["wires"] = serde_json::json!([{ "from": "", "to": "b" }]);
        assert!(validate_manifest(&invalid).is_err());
        let mut invalid = manifest(); invalid["circuit"]["wires"] = serde_json::json!([{ "from": "a", "to": "b", "route": { "axis": "diagonal", "coordinate": 20.0 } }]);
        assert!(validate_manifest(&invalid).is_err());
        let mut routed = manifest(); routed["circuit"]["wires"] = serde_json::json!([{ "from": "a", "to": "b", "route": { "points": [{ "x": 20.0, "y": 30.0 }, { "x": 50.0, "y": 60.0 }] } }]);
        assert!(validate_manifest(&routed).is_ok());
        let mut invalid = manifest(); invalid["circuit"]["wires"] = serde_json::json!([{ "from": "a", "to": "b", "route": { "points": [] } }]);
        assert!(validate_manifest(&invalid).is_err());
        let mut invalid = manifest(); invalid["circuit"]["wires"] = serde_json::json!([{ "from": "a", "to": "b", "route": { "points": [{ "x": 1_000_001.0, "y": 0.0 }] } }]);
        assert!(validate_manifest(&invalid).is_err());
        let mut invalid = manifest(); invalid["circuit"]["wires"] = serde_json::json!([{ "from": "a", "to": "b", "route": { "points": (0..65).map(|x| serde_json::json!({ "x": x, "y": 0 })).collect::<Vec<_>>() } }]);
        assert!(validate_manifest(&invalid).is_err());
        let mut invalid = manifest(); invalid["documents"] = serde_json::json!([{ "id": "bad\nidentifier" }]);
        assert!(validate_manifest(&invalid).is_err());
        let mut invalid = manifest(); invalid["experiments"] = serde_json::json!([{ "id": "large", "definition": "x".repeat(MAX_EXPERIMENT_DEFINITION_BYTES) }]);
        assert!(validate_manifest(&invalid).is_err());
    }

    #[test]
    fn artifact_manifest_merge_is_idempotent_sorted_and_conflict_safe() {
        let mut value = manifest();
        value["unknown"] = serde_json::json!({"keep": true});
        let first = crate::artifact_store::ArtifactReference { path: "runs/z.bin".into(), sha256: "a".repeat(64), size: 1, media_type: "application/octet-stream".into() };
        let second = crate::artifact_store::ArtifactReference { path: "runs/a.bin".into(), sha256: "b".repeat(64), size: 2, media_type: "application/octet-stream".into() };
        merge_artifact_reference(&mut value, &first).unwrap();
        merge_artifact_reference(&mut value, &first).unwrap();
        merge_artifact_reference(&mut value, &second).unwrap();
        assert_eq!(value["artifacts"].as_array().unwrap().len(), 2);
        assert_eq!(value["artifacts"][0]["path"], "runs/a.bin");
        assert_eq!(value["unknown"]["keep"], true);
        let mut conflict = first.clone(); conflict.sha256 = "c".repeat(64);
        assert!(merge_artifact_reference(&mut value, &conflict).is_err());
    }

    #[test]
    fn timestamps_require_rfc3339_shape_and_bounded_offsets() {
        assert!(valid_timestamp("2026-09-28T12:34:56.123Z"));
        assert!(valid_timestamp("2026-09-28T12:34:56+05:30"));
        assert!(!valid_timestamp("not-a-date"));
        assert!(!valid_timestamp("2026-09-28 12:34:56Z"));
        assert!(!valid_timestamp("2026-09-28T25:34:56Z"));
        assert!(!valid_timestamp("2026-09-28T12:34:56+99:00"));
    }

    #[test]
    fn native_project_session_round_trips_on_the_real_filesystem() {
        let root = std::env::temp_dir().join(format!("openentc-native-project-{}-unicode-Δ", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(root.join(MANIFEST_PATH), serde_json::to_vec_pretty(&manifest()).unwrap()).unwrap();
        let session = ProjectSession::default();
        let summary = open_project_session(root.to_string_lossy().into_owned(), &session).unwrap();
        assert_eq!(summary.name, "demo");
        assert_eq!(read_project_session(&session).unwrap()["name"], "demo");
        let mut updated = manifest();
        updated["name"] = Value::String("saved Δ project".into());
        updated["unknownSafeField"] = serde_json::json!({"preserved": true});
        let saved = save_project_session(updated, &session).unwrap();
        assert_eq!(saved.name, "saved Δ project");
        let persisted: Value = serde_json::from_slice(&std::fs::read(root.join(MANIFEST_PATH)).unwrap()).unwrap();
        assert_eq!(persisted["unknownSafeField"]["preserved"], true);
        close_project_session(&session).unwrap();
        assert!(read_project_session(&session).is_err());
        std::fs::remove_dir_all(root).unwrap();
    }
}
