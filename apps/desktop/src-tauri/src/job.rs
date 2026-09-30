use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};
use crate::events::{ApplicationEvent, EventBus};

const MAX_JOB_TEXT_BYTES: usize = 200;
const MAX_JOB_ARGUMENTS: usize = 256;
const MAX_JOB_ARGUMENT_BYTES: usize = 64 * 1024;
const MAX_JOB_ITEMS: usize = 1_024;
const MAX_JOB_ITEM_BYTES: usize = 4_096;
const MAX_JOB_LOG_BYTES: usize = 64 * 1024;
const MAX_JOBS: usize = 1_024;

fn bounded_log(value: &str) -> String {
    if value.len() <= MAX_JOB_LOG_BYTES { return value.to_string(); }
    let end = value.char_indices().map(|(index, _)| index).take_while(|index| *index <= MAX_JOB_LOG_BYTES).last().unwrap_or(0);
    value[..end].to_string()
}

pub fn validate_job_text(value: &str, field: &str) -> Result<(), String> {
    if value.is_empty() || value.len() > MAX_JOB_TEXT_BYTES || value.chars().any(|character| character.is_control()) {
        return Err(format!("{field} is empty, oversized, or contains control characters"));
    }
    Ok(())
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum JobState { Queued, Preparing, Running, Cancelling, Succeeded, Failed, Cancelled }

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct JobReproducibility {
    pub inputs: Vec<String>,
    pub arguments: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct JobResourcePolicy {
    pub timeout_ms: Option<u64>,
    pub max_output_bytes: Option<usize>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct JobRecord {
    pub project_id: String,
    pub id: String,
    pub operation: String,
    pub adapter: String,
    pub state: JobState,
    pub error: Option<String>,
    pub engine_version: Option<String>,
    pub inputs: Vec<String>,
    pub outputs: Vec<String>,
    pub arguments: Vec<String>,
    pub resource_policy: JobResourcePolicy,
    pub diagnostics: Vec<String>,
    pub logs: Vec<String>,
    pub artifacts: Vec<crate::artifact_store::ArtifactReference>,
    pub reproducibility: JobReproducibility,
    pub created_at_ms: u64,
    pub updated_at_ms: u64,
}

impl JobRecord {
    pub fn new(project_id: String, id: String, operation: String, adapter: String) -> Self {
        let now = now_ms();
        Self {
            project_id, id, operation, adapter, state: JobState::Queued, error: None,
            engine_version: None, inputs: Vec::new(), outputs: Vec::new(), arguments: Vec::new(),
            resource_policy: JobResourcePolicy { timeout_ms: None, max_output_bytes: None },
            diagnostics: Vec::new(), logs: Vec::new(), artifacts: Vec::new(),
            reproducibility: JobReproducibility { inputs: Vec::new(), arguments: Vec::new() },
            created_at_ms: now, updated_at_ms: now,
        }
    }

    pub fn transition(&mut self, next: JobState, error: Option<String>) -> Result<(), String> {
        if let Some(message) = &error { validate_job_text(message, "job error")?; }
        let allowed = matches!((&self.state, &next),
            (JobState::Queued, JobState::Preparing) |
            (JobState::Queued, JobState::Cancelling) |
            (JobState::Queued, JobState::Cancelled) |
            (JobState::Preparing, JobState::Running) |
            (JobState::Preparing, JobState::Failed) |
            (JobState::Preparing, JobState::Cancelling) |
            (JobState::Preparing, JobState::Cancelled) |
            (JobState::Running, JobState::Cancelling) |
            (JobState::Running, JobState::Succeeded) |
            (JobState::Running, JobState::Failed) |
            (JobState::Cancelling, JobState::Cancelled) |
            (JobState::Cancelling, JobState::Succeeded) |
            (JobState::Cancelling, JobState::Failed));
        if !allowed { return Err(format!("invalid job transition {:?} -> {:?}", self.state, next)); }
        self.state = next;
        self.error = error;
        self.updated_at_ms = now_ms();
        Ok(())
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|duration| duration.as_millis().min(u128::from(u64::MAX)) as u64).unwrap_or(0)
}

#[derive(Clone)]
pub struct JobRegistry {
    jobs: Arc<Mutex<BTreeMap<String, JobRecord>>>,
    events: EventBus,
}

fn registry_key(project_id: &str, id: &str) -> String {
    format!("{project_id}\0{id}")
}

impl JobRegistry {
    pub fn new(events: EventBus) -> Self { Self { jobs: Arc::new(Mutex::new(BTreeMap::new())), events } }

    pub fn enqueue(&self, project_id: String, id: String, operation: String, adapter: String) -> Result<JobRecord, String> {
        validate_job_text(&project_id, "project id")?;
        validate_job_text(&id, "job id")?;
        validate_job_text(&operation, "job operation")?;
        validate_job_text(&adapter, "job adapter")?;
        let job = JobRecord::new(project_id, id.clone(), operation, adapter);
        let key = registry_key(&job.project_id, &id);
        let mut jobs = self.jobs.lock().map_err(|_| "job registry is poisoned".to_string())?;
        if jobs.len() >= MAX_JOBS { return Err("too many retained jobs".into()); }
        if jobs.contains_key(&key) { return Err("job id already exists for this project".into()); }
        jobs.insert(key.clone(), job.clone());
        if let Err(error) = self.events.publish(ApplicationEvent::JobQueued { project_id: job.project_id.clone(), id: id.clone() }) {
            jobs.remove(&key);
            return Err(error);
        }
        Ok(job)
    }

    pub fn transition(&self, project_id: &str, id: &str, next: JobState, error: Option<String>) -> Result<JobRecord, String> {
        validate_job_text(project_id, "project id")?;
        validate_job_text(id, "job id")?;
        let mut jobs = self.jobs.lock().map_err(|_| "job registry is poisoned".to_string())?;
        let job = jobs.get_mut(&registry_key(project_id, id)).ok_or_else(|| "job id was not found for this project".to_string())?;
        let previous = job.clone();
        job.transition(next.clone(), error)?;
        if let Err(event_error) = self.events.publish(ApplicationEvent::JobStateChanged { project_id: previous.project_id.clone(), id: id.to_string(), state: format!("{next:?}").to_lowercase() }) {
            *job = previous;
            return Err(event_error);
        }
        Ok(job.clone())
    }

    pub fn set_arguments(&self, project_id: &str, id: &str, arguments: Vec<String>) -> Result<JobRecord, String> {
        if arguments.len() > MAX_JOB_ARGUMENTS || arguments.iter().any(|argument| argument.len() > MAX_JOB_ARGUMENT_BYTES || argument.chars().any(|character| character.is_control())) {
            return Err("job arguments are oversized or contain control characters".into());
        }
        let mut jobs = self.jobs.lock().map_err(|_| "job registry is poisoned".to_string())?;
        let job = jobs.get_mut(&registry_key(project_id, id)).ok_or_else(|| "job id was not found for this project".to_string())?;
        job.arguments = arguments.clone();
        job.reproducibility.arguments = arguments;
        job.updated_at_ms = now_ms();
        Ok(job.clone())
    }

    pub fn set_resource_policy(&self, project_id: &str, id: &str, timeout_ms: Option<u64>, max_output_bytes: Option<usize>) -> Result<JobRecord, String> {
        if timeout_ms.map_or(false, |value| value == 0 || value > 86_400_000) { return Err("job timeout policy is outside the bounded range".into()); }
        if max_output_bytes.map_or(false, |value| value == 0 || value > 16 * 1024 * 1024) { return Err("job output policy is outside the bounded range".into()); }
        let mut jobs = self.jobs.lock().map_err(|_| "job registry is poisoned".to_string())?;
        let job = jobs.get_mut(&registry_key(project_id, id)).ok_or_else(|| "job id was not found for this project".to_string())?;
        job.resource_policy = JobResourcePolicy { timeout_ms, max_output_bytes };
        job.updated_at_ms = now_ms();
        Ok(job.clone())
    }

    pub fn set_inputs(&self, project_id: &str, id: &str, inputs: Vec<String>) -> Result<JobRecord, String> {
        if inputs.len() > MAX_JOB_ITEMS || inputs.iter().any(|item| item.is_empty() || item.len() > MAX_JOB_ITEM_BYTES || item.chars().any(|character| character.is_control())) {
            return Err("job inputs are oversized or contain control characters".into());
        }
        let mut jobs = self.jobs.lock().map_err(|_| "job registry is poisoned".to_string())?;
        let job = jobs.get_mut(&registry_key(project_id, id)).ok_or_else(|| "job id was not found for this project".to_string())?;
        job.inputs = inputs.clone();
        job.reproducibility.inputs = inputs;
        job.updated_at_ms = now_ms();
        Ok(job.clone())
    }

    pub fn record_process_result(&self, project_id: &str, id: &str, stdout: &str, stderr: &str, error: Option<&str>) -> Result<JobRecord, String> {
        let mut jobs = self.jobs.lock().map_err(|_| "job registry is poisoned".to_string())?;
        let job = jobs.get_mut(&registry_key(project_id, id)).ok_or_else(|| "job id was not found for this project".to_string())?;
        job.logs = [stdout, stderr].into_iter().filter(|value| !value.is_empty()).map(bounded_log).collect();
        job.diagnostics = error.into_iter().map(bounded_log).collect();
        job.updated_at_ms = now_ms();
        Ok(job.clone())
    }

    pub fn snapshot(&self, project_id: &str, id: &str) -> Result<JobRecord, String> {
        let jobs = self.jobs.lock().map_err(|_| "job registry is poisoned".to_string())?;
        jobs.get(&registry_key(project_id, id)).cloned().ok_or_else(|| "job id was not found for this project".to_string())
    }

    pub fn list(&self, project_id: &str) -> Result<Vec<JobRecord>, String> {
        validate_job_text(project_id, "project id")?;
        let jobs = self.jobs.lock().map_err(|_| "job registry is poisoned".to_string())?;
        Ok(jobs.values().filter(|job| job.project_id == project_id).cloned().collect())
    }

    /// Remove a runtime record during a failed pre-run setup transaction.
    /// Terminal failures intentionally remain available for diagnostics; this
    /// operation is reserved for records that never reached execution.
    pub fn remove(&self, project_id: &str, id: &str) -> Result<(), String> {
        validate_job_text(project_id, "project id")?;
        validate_job_text(id, "job id")?;
        let mut jobs = self.jobs.lock().map_err(|_| "job registry is poisoned".to_string())?;
        jobs.remove(&registry_key(project_id, id)).map(|_| ()).ok_or_else(|| "job id was not found for this project".to_string())
    }

    /// Runtime job records belong to the open project session. Remove them
    /// when that session closes so a later session cannot observe stale job
    /// metadata or accidentally reuse an old job identity.
    pub fn remove_project(&self, project_id: &str) -> Result<usize, String> {
        validate_job_text(project_id, "project id")?;
        let mut jobs = self.jobs.lock().map_err(|_| "job registry is poisoned".to_string())?;
        // Registry keys include the project identity. Remove those complete
        // keys rather than bare job IDs so cleanup cannot leave stale records
        // behind or affect a same-named job in another project.
        let keys: Vec<String> = jobs.iter().filter(|(_, job)| job.project_id == project_id).map(|(key, _)| key.clone()).collect();
        let removed = keys.len();
        for key in keys { jobs.remove(&key); }
        Ok(removed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn lifecycle_rejects_skipping_preparation() {
        let mut job = JobRecord::new("project".into(), "j1".into(), "check".into(), "fake".into());
        assert!(job.transition(JobState::Succeeded, None).is_err());
        job.transition(JobState::Preparing, None).unwrap();
        job.transition(JobState::Running, None).unwrap();
        job.transition(JobState::Succeeded, None).unwrap();
        assert_eq!(job.state, JobState::Succeeded);
    }

    #[test]
    fn lifecycle_allows_cancellation_before_process_start() {
        let mut queued = JobRecord::new("project".into(), "queued".into(), "check".into(), "fake".into());
        queued.transition(JobState::Cancelled, Some("user cancelled".into())).unwrap();
        assert_eq!(queued.state, JobState::Cancelled);
        let mut preparing = JobRecord::new("project".into(), "preparing".into(), "check".into(), "fake".into());
        preparing.transition(JobState::Preparing, None).unwrap();
        preparing.transition(JobState::Cancelling, None).unwrap();
        preparing.transition(JobState::Failed, Some("cleanup failed".into())).unwrap();
        assert_eq!(preparing.state, JobState::Failed);
    }

    #[test]
    fn registry_emits_events_and_rejects_duplicate_ids() {
        let (bus, receiver) = crate::events::EventBus::new();
        let registry = JobRegistry::new(bus);
        registry.enqueue("project".into(), "j1".into(), "check".into(), "fake".into()).unwrap();
        assert!(registry.enqueue("project".into(), "j1".into(), "check".into(), "fake".into()).is_err());
        assert!(matches!(receiver.recv().unwrap(), ApplicationEvent::JobQueued { id, project_id } if id == "j1" && project_id == "project"));
        registry.transition("project", "j1", JobState::Preparing, None).unwrap();
        assert!(matches!(receiver.recv().unwrap(), ApplicationEvent::JobStateChanged { state, .. } if state == "preparing"));
        assert!(registry.enqueue("other-project".into(), "j1".into(), "check".into(), "fake".into()).is_ok());
    }

    #[test]
    fn registry_rejects_unsafe_job_metadata_before_storage() {
        let (bus, _receiver) = crate::events::EventBus::new();
        let registry = JobRegistry::new(bus);
        assert!(registry.enqueue("project".into(), "bad\njob".into(), "check".into(), "fake".into()).is_err());
        assert!(registry.enqueue("project".into(), "j1".into(), "check".into(), "fake".into()).is_ok());
        assert!(registry.transition("project", "j1", JobState::Failed, Some("x".repeat(MAX_JOB_TEXT_BYTES + 1))).is_err());
    }

    #[test]
    fn cancellation_race_can_finish_successfully_without_sticking() {
        let mut job = JobRecord::new("project".into(), "race".into(), "check".into(), "fake".into());
        job.transition(JobState::Preparing, None).unwrap();
        job.transition(JobState::Running, None).unwrap();
        job.transition(JobState::Cancelling, None).unwrap();
        job.transition(JobState::Succeeded, None).unwrap();
        assert_eq!(job.state, JobState::Succeeded);
    }

    #[test]
    fn process_results_are_retained_with_bounded_logs_and_diagnostics() {
        let (bus, _receiver) = crate::events::EventBus::new();
        let registry = JobRegistry::new(bus);
        registry.enqueue("project".into(), "result".into(), "process".into(), "runner".into()).unwrap();
        let record = registry.record_process_result("project", "result", &"x".repeat(MAX_JOB_LOG_BYTES + 10), "stderr", Some("failed" )).unwrap();
        assert_eq!(record.logs[0].len(), MAX_JOB_LOG_BYTES);
        assert_eq!(record.logs[1], "stderr");
        assert_eq!(record.diagnostics, vec!["failed"]);
    }

    #[test]
    fn project_cleanup_removes_only_owned_runtime_jobs() {
        let (bus, _receiver) = crate::events::EventBus::new();
        let registry = JobRegistry::new(bus);
        registry.enqueue("project-a".into(), "same".into(), "process".into(), "runner".into()).unwrap();
        registry.enqueue("project-b".into(), "same".into(), "process".into(), "runner".into()).unwrap();
        assert_eq!(registry.remove_project("project-a").unwrap(), 1);
        assert!(registry.snapshot("project-a", "same").is_err());
        assert_eq!(registry.snapshot("project-b", "same").unwrap().project_id, "project-b");
    }

    #[test]
    fn pre_run_remove_is_project_scoped() {
        let (bus, _receiver) = crate::events::EventBus::new();
        let registry = JobRegistry::new(bus);
        registry.enqueue("project-a".into(), "same".into(), "process".into(), "runner".into()).unwrap();
        registry.enqueue("project-b".into(), "same".into(), "process".into(), "runner".into()).unwrap();
        registry.remove("project-a", "same").unwrap();
        assert!(registry.snapshot("project-a", "same").is_err());
        assert!(registry.snapshot("project-b", "same").is_ok());
        assert!(registry.remove("project-a", "same").is_err());
    }

    #[test]
    fn registry_rejects_unbounded_job_growth() {
        let (bus, _receiver) = crate::events::EventBus::new();
        let registry = JobRegistry::new(bus);
        for index in 0..MAX_JOBS {
            registry.enqueue("bounded-project".into(), format!("job-{index}"), "check".into(), "fake".into()).unwrap();
        }
        assert!(registry.enqueue("bounded-project".into(), "overflow".into(), "check".into(), "fake".into()).is_err());
    }
}
