use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::mpsc::{self, Receiver, SyncSender};

const EVENT_QUEUE_LIMIT: usize = 1024;
const MAX_EVENT_TEXT_BYTES: usize = 4 * 1024;
const MAX_EVENT_ID_BYTES: usize = 200;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(tag = "kind", content = "data")]
pub enum ApplicationEvent {
    JobQueued {
        project_id: String,
        id: String,
    },
    JobStateChanged {
        project_id: String,
        id: String,
        state: String,
    },
    Diagnostic {
        project_id: String,
        code: String,
        message: String,
    },
    ArtifactCreated {
        project_id: String,
        path: String,
        sha256: String,
    },
}

impl ApplicationEvent {
    pub fn project_id(&self) -> &str {
        match self {
            Self::JobQueued { project_id, .. }
            | Self::JobStateChanged { project_id, .. }
            | Self::Diagnostic { project_id, .. }
            | Self::ArtifactCreated { project_id, .. } => project_id,
        }
    }

    pub fn validate(&self) -> Result<(), String> {
        let valid = |value: &str, limit: usize, field: &str| {
            if value.is_empty()
                || value.len() > limit
                || value.chars().any(|character| character.is_control())
            {
                Err(format!(
                    "event {field} is empty, oversized, or contains control characters"
                ))
            } else {
                Ok(())
            }
        };
        valid(self.project_id(), MAX_EVENT_ID_BYTES, "project id")?;
        match self {
            Self::JobQueued { id, .. } | Self::JobStateChanged { id, .. } => {
                valid(id, MAX_EVENT_ID_BYTES, "job id")
            }
            Self::Diagnostic { code, message, .. } => {
                valid(code, MAX_EVENT_ID_BYTES, "diagnostic code")?;
                valid(message, MAX_EVENT_TEXT_BYTES, "diagnostic message")
            }
            Self::ArtifactCreated { path, sha256, .. } => {
                valid(path, MAX_EVENT_TEXT_BYTES, "artifact path")?;
                if sha256.len() != 64
                    || sha256 != &sha256.to_ascii_lowercase()
                    || sha256
                        .chars()
                        .any(|character| !character.is_ascii_hexdigit())
                {
                    Err("event artifact hash is invalid".into())
                } else {
                    Ok(())
                }
            }
        }
    }
}

/// Remove at most `limit` events for one project while retaining all other
/// project events in their original order.
pub fn take_project_events(
    queue: &mut VecDeque<ApplicationEvent>,
    project_id: &str,
    limit: usize,
) -> Vec<ApplicationEvent> {
    let mut selected = Vec::new();
    let mut retained = VecDeque::with_capacity(queue.len());
    while let Some(event) = queue.pop_front() {
        if selected.len() < limit && event.project_id() == project_id {
            selected.push(event);
        } else {
            retained.push_back(event);
        }
    }
    *queue = retained;
    selected
}

#[derive(Clone)]
pub struct EventBus {
    sender: SyncSender<ApplicationEvent>,
}

impl EventBus {
    pub fn new() -> (Self, Receiver<ApplicationEvent>) {
        let (sender, receiver) = mpsc::sync_channel(EVENT_QUEUE_LIMIT);
        (Self { sender }, receiver)
    }

    pub fn publish(&self, event: ApplicationEvent) -> Result<(), String> {
        event.validate()?;
        self.sender
            .try_send(event)
            .map_err(|error| error.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn events_are_structured_and_ordered() {
        let (bus, receiver) = EventBus::new();
        bus.publish(ApplicationEvent::JobQueued {
            project_id: "p1".into(),
            id: "j1".into(),
        })
        .unwrap();
        bus.publish(ApplicationEvent::JobStateChanged {
            project_id: "p1".into(),
            id: "j1".into(),
            state: "running".into(),
        })
        .unwrap();
        assert!(matches!(
            receiver.recv().unwrap(),
            ApplicationEvent::JobQueued { .. }
        ));
        assert!(matches!(
            receiver.recv().unwrap(),
            ApplicationEvent::JobStateChanged { .. }
        ));
    }

    #[test]
    fn project_drain_retains_unmatched_events() {
        let mut queue = VecDeque::from([
            ApplicationEvent::JobQueued {
                project_id: "other".into(),
                id: "j0".into(),
            },
            ApplicationEvent::JobQueued {
                project_id: "current".into(),
                id: "j1".into(),
            },
            ApplicationEvent::JobStateChanged {
                project_id: "other".into(),
                id: "j0".into(),
                state: "running".into(),
            },
        ]);
        let selected = take_project_events(&mut queue, "current", 256);
        assert_eq!(selected.len(), 1);
        assert_eq!(queue.len(), 2);
        assert_eq!(queue.front().unwrap().project_id(), "other");
    }

    #[test]
    fn event_publication_rejects_oversized_and_noncanonical_payloads() {
        let (bus, _receiver) = EventBus::new();
        assert!(bus
            .publish(ApplicationEvent::Diagnostic {
                project_id: "project".into(),
                code: "CODE".into(),
                message: "x".repeat(MAX_EVENT_TEXT_BYTES + 1)
            })
            .is_err());
        assert!(bus
            .publish(ApplicationEvent::ArtifactCreated {
                project_id: "project".into(),
                path: "runs/out".into(),
                sha256: "A".repeat(64)
            })
            .is_err());
        assert!(bus
            .publish(ApplicationEvent::JobQueued {
                project_id: "project\n".into(),
                id: "job".into()
            })
            .is_err());
    }
}
