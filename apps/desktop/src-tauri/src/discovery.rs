use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

const MAX_CANDIDATE_PATH_BYTES: usize = 32 * 1024;

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum DetectionState {
    Detected,
    Missing,
    Invalid,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct EngineProbe {
    pub id: String,
    pub candidates: Vec<PathBuf>,
    #[serde(skip, default = "default_valid_probe")]
    valid: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct DetectionResult {
    pub id: String,
    pub state: DetectionState,
    pub path: Option<PathBuf>,
}

fn default_valid_probe() -> bool {
    true
}

fn valid_candidate_shape(candidate: &Path) -> bool {
    !candidate.as_os_str().is_empty()
        && candidate.to_string_lossy().len() <= MAX_CANDIDATE_PATH_BYTES
        && !candidate
            .to_string_lossy()
            .chars()
            .any(|character| character.is_control())
        && candidate.is_absolute()
}

impl EngineProbe {
    pub fn new(id: String, candidates: Vec<PathBuf>) -> Result<Self, String> {
        if id.trim().is_empty()
            || id.len() > 100
            || id.chars().any(|character| character.is_control())
        {
            return Err("engine id is invalid".into());
        }
        if candidates.len() > 32 {
            return Err("too many engine candidates".into());
        }
        let valid = candidates.iter().all(|candidate| {
            valid_candidate_shape(candidate) && approved_candidate_path(candidate)
        });
        Ok(Self {
            id,
            candidates,
            valid,
        })
    }

    /// Filesystem metadata only: no executable is started and no installation occurs.
    pub fn detect(&self) -> DetectionResult {
        if !self.valid {
            return DetectionResult {
                id: self.id.clone(),
                state: DetectionState::Invalid,
                path: None,
            };
        }
        let path = self
            .candidates
            .iter()
            .find(|candidate| approved_candidate_path(candidate) && candidate.is_file())
            .cloned();
        DetectionResult {
            id: self.id.clone(),
            state: if path.is_some() {
                DetectionState::Detected
            } else {
                DetectionState::Missing
            },
            path,
        }
    }
}

fn approved_candidate_directory(path: &Path) -> bool {
    let mut value = path
        .to_string_lossy()
        .replace('\\', "/")
        .to_ascii_lowercase();
    if cfg!(windows) {
        if let Some(stripped) = value.strip_prefix("//?/") {
            value = stripped.to_string();
        }
        let drive_root = value.len() >= 3
            && value.as_bytes()[0].is_ascii_alphabetic()
            && value.as_bytes()[1] == b':'
            && value.as_bytes()[2] == b'/';
        let relative = &value[3..];
        drive_root
            && ["program files", "program files (x86)", "users/public"]
                .iter()
                .any(|root| relative == *root || relative.starts_with(&format!("{root}/")))
    } else {
        ["/usr/bin", "/usr/local/bin", "/opt"]
            .iter()
            .any(|root| value == *root || value.starts_with(&format!("{root}/")))
    }
}

fn approved_candidate_path(path: &Path) -> bool {
    if path
        .components()
        .any(|component| matches!(component, std::path::Component::ParentDir))
        || !approved_candidate_directory(path)
    {
        return false;
    }
    match std::fs::canonicalize(path) {
        Ok(canonical) => approved_candidate_directory(&canonical),
        Err(_) => {
            // A missing executable is still a valid discovery candidate, but
            // its existing parent must be canonicalized. Otherwise a
            // symlinked directory under an approved-looking prefix could
            // redirect the probe outside the allow-list.
            let mut ancestor = path.parent();
            while let Some(candidate) = ancestor {
                if candidate.exists() {
                    return std::fs::canonicalize(candidate)
                        .map_or(false, |canonical| approved_candidate_directory(&canonical));
                }
                ancestor = candidate.parent();
            }
            false
        }
    }
}

#[allow(dead_code)]
pub fn fixed_candidate(path: &Path) -> Result<PathBuf, String> {
    if !path.is_absolute() {
        return Err("candidate path must be absolute".into());
    }
    Ok(path.to_path_buf())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn detection_is_read_only_and_does_not_execute() {
        let probe = EngineProbe::new(
            "fake".into(),
            vec![PathBuf::from(if cfg!(windows) {
                "C:\\Program Files\\OpenENTC\\does-not-exist.exe"
            } else {
                "/usr/local/bin/openentc-does-not-exist"
            })],
        )
        .unwrap();
        assert_eq!(probe.detect().state, DetectionState::Missing);
    }

    #[test]
    fn discovery_rejects_arbitrary_absolute_probe_paths() {
        let path = if cfg!(windows) {
            "C:\\Users\\someone\\secret.exe"
        } else {
            "/home/someone/secret"
        };
        assert_eq!(
            EngineProbe::new("fake".into(), vec![PathBuf::from(path)])
                .unwrap()
                .detect()
                .state,
            DetectionState::Invalid
        );
    }

    #[test]
    fn discovery_rejects_parent_escape_candidates() {
        let path = if cfg!(windows) {
            "C:\\Program Files\\..\\Users\\secret.exe"
        } else {
            "/usr/bin/../home/secret"
        };
        assert_eq!(
            EngineProbe::new("fake".into(), vec![PathBuf::from(path)])
                .unwrap()
                .detect()
                .state,
            DetectionState::Invalid
        );
    }

    #[test]
    fn discovery_rejects_unbounded_and_control_character_candidates() {
        let prefix = if cfg!(windows) {
            "C:\\Program Files\\OpenENTC\\"
        } else {
            "/usr/local/bin/"
        };
        assert_eq!(
            EngineProbe::new(
                "fake".into(),
                vec![PathBuf::from(format!(
                    "{prefix}{}",
                    "x".repeat(MAX_CANDIDATE_PATH_BYTES)
                ))]
            )
            .unwrap()
            .detect()
            .state,
            DetectionState::Invalid
        );
        assert_eq!(
            EngineProbe::new(
                "fake".into(),
                vec![PathBuf::from(format!("{prefix}bad\npath"))]
            )
            .unwrap()
            .detect()
            .state,
            DetectionState::Invalid
        );
    }
}
