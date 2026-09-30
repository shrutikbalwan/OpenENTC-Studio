#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod process_runner;
mod job;
mod project_fs;
mod artifact_store;
mod events;
mod permissions;
mod platform;
mod discovery;
mod native_project;
mod serial_transport;

use tauri_plugin_dialog::DialogExt;

#[derive(Clone)]
struct NativeRuntime {
    jobs: job::JobRegistry,
    processes: process_runner::ProcessRegistry,
    events: events::EventBus,
    // Keep the receiver alive so queued application events remain observable
    // by a future event-stream command instead of failing as disconnected.
    _events: std::sync::Arc<std::sync::Mutex<std::sync::mpsc::Receiver<events::ApplicationEvent>>>,
    // Events for other projects are retained instead of being consumed and
    // discarded by a caller draining this project. The bound mirrors the
    // native event channel's fixed capacity.
    pending_events: std::sync::Arc<std::sync::Mutex<std::collections::VecDeque<events::ApplicationEvent>>>,
    serials: serial_transport::SerialRegistry,
}

impl Drop for NativeRuntime {
    fn drop(&mut self) {
        let _ = self.processes.cancel_all();
        let _ = self.serials.close_all();
    }
}

#[derive(Debug, serde::Deserialize)]
struct EnqueueJobRequest { project_id: String, id: String, operation: String, adapter: String }
const MAX_DRAIN_EVENTS: usize = 256;

fn discard_project_events(runtime: &NativeRuntime, project_id: &str) -> Result<(), String> {
    let receiver = runtime._events.lock().map_err(|_| "event receiver is poisoned".to_string())?;
    let mut pending = runtime.pending_events.lock().map_err(|_| "pending event queue is poisoned".to_string())?;
    pending.retain(|event| event.project_id() != project_id);
    while pending.len() < 1024 {
        match receiver.try_recv() {
            Ok(event) if event.project_id() != project_id => pending.push_back(event),
            Ok(_) => {}
            Err(std::sync::mpsc::TryRecvError::Empty | std::sync::mpsc::TryRecvError::Disconnected) => break,
        }
    }
    Ok(())
}

#[tauri::command]
fn desktop_capability_state() -> &'static str {
    "native-shell"
}

#[tauri::command]
fn detect_engines(probes: Vec<discovery::EngineProbe>) -> Result<Vec<discovery::DetectionResult>, String> {
    if probes.len() > 100 { return Err("too many engine probes".into()); }
    probes.into_iter().map(|probe| discovery::EngineProbe::new(probe.id, probe.candidates).map(|validated| validated.detect())).collect()
}

#[tauri::command]
fn enqueue_job(project: tauri::State<'_, native_project::ProjectSession>, runtime: tauri::State<'_, NativeRuntime>, request: EnqueueJobRequest) -> Result<job::JobRecord, String> {
    native_project::require_project_permission(&project, &request.project_id, permissions::Permission::ProjectRead)?;
    runtime.jobs.enqueue(request.project_id, request.id, request.operation, request.adapter)
}

#[tauri::command]
fn get_job(project: tauri::State<'_, native_project::ProjectSession>, runtime: tauri::State<'_, NativeRuntime>, project_id: String, id: String) -> Result<job::JobRecord, String> {
    native_project::require_project_permission(&project, &project_id, permissions::Permission::ProjectRead)?;
    job::validate_job_text(&id, "job id")?;
    let job = runtime.jobs.snapshot(&project_id, &id)?;
    if job.project_id != project_id { return Err("job does not belong to the requested project".into()); }
    Ok(job)
}

#[tauri::command]
fn list_jobs(project: tauri::State<'_, native_project::ProjectSession>, runtime: tauri::State<'_, NativeRuntime>, project_id: String) -> Result<Vec<job::JobRecord>, String> {
    native_project::require_project_permission(&project, &project_id, permissions::Permission::ProjectRead)?;
    runtime.jobs.list(&project_id)
}

#[tauri::command]
fn transition_job(project: tauri::State<'_, native_project::ProjectSession>, runtime: tauri::State<'_, NativeRuntime>, project_id: String, id: String, next: job::JobState, error: Option<String>) -> Result<job::JobRecord, String> {
    native_project::require_project_permission(&project, &project_id, permissions::Permission::ProjectRead)?;
    job::validate_job_text(&id, "job id")?;
    let job = runtime.jobs.snapshot(&project_id, &id)?;
    if job.project_id != project_id { return Err("job does not belong to the requested project".into()); }
    runtime.jobs.transition(&project_id, &id, next, error)
}

#[tauri::command]
fn drain_events(project: tauri::State<'_, native_project::ProjectSession>, runtime: tauri::State<'_, NativeRuntime>, project_id: String) -> Result<Vec<events::ApplicationEvent>, String> {
    native_project::require_project_permission(&project, &project_id, permissions::Permission::ProjectRead)?;
    let receiver = runtime._events.lock().map_err(|_| "event receiver is poisoned".to_string())?;
    let mut pending = runtime.pending_events.lock().map_err(|_| "pending event queue is poisoned".to_string())?;
    let mut drained = events::take_project_events(&mut pending, &project_id, MAX_DRAIN_EVENTS);
    for _ in 0..MAX_DRAIN_EVENTS {
        if pending.len() >= 1024 { break; }
        match receiver.try_recv() {
            Ok(event) if event.project_id() == project_id => drained.push(event),
            Ok(event) => pending.push_back(event),
            Err(std::sync::mpsc::TryRecvError::Empty | std::sync::mpsc::TryRecvError::Disconnected) => break,
        }
        if drained.len() >= MAX_DRAIN_EVENTS { break; }
    }
    Ok(drained)
}

#[tauri::command]
fn store_artifact(project: tauri::State<'_, native_project::ProjectSession>, runtime: tauri::State<'_, NativeRuntime>, project_id: String, path: String, bytes: Vec<u8>, media_type: String) -> Result<artifact_store::ArtifactReference, String> {
    native_project::require_project_permission(&project, &project_id, permissions::Permission::ArtifactWrite)?;
    let normalized = path.replace('\\', "/");
    if !(normalized.starts_with("runs/") || normalized.starts_with("build/")) { return Err("generated artifacts must be stored under runs/ or build/".into()); }
    let root = native_project::current_project_root(&project)?;
    let reference = artifact_store::store(&root, &normalized, &bytes, media_type)?;
    runtime.events.publish(events::ApplicationEvent::ArtifactCreated { project_id, path: reference.path.clone(), sha256: reference.sha256.clone() })?;
    Ok(reference)
}

#[tauri::command]
fn verify_artifact(project: tauri::State<'_, native_project::ProjectSession>, project_id: String, reference: artifact_store::ArtifactReference) -> Result<(), String> {
    native_project::require_project_permission(&project, &project_id, permissions::Permission::ProjectRead)?;
    let root = native_project::current_project_root(&project)?;
    artifact_store::verify(&root, &reference)
}

/// Verify a generated artifact and register its immutable reference in the
/// authored project manifest. Registration is idempotent for the same path
/// and rejects a different reference at an existing path rather than
/// silently changing provenance.
#[tauri::command]
fn register_artifact(project: tauri::State<'_, native_project::ProjectSession>, project_id: String, reference: artifact_store::ArtifactReference) -> Result<native_project::ProjectSummary, String> {
    native_project::require_project_permission(&project, &project_id, permissions::Permission::ArtifactWrite)?;
    let root = native_project::current_project_root(&project)?;
    artifact_store::verify(&root, &reference)?;
    let bytes = project_fs::read_bounded_limit(&root, "openentc.project.json", 10 * 1024 * 1024)?;
    let mut manifest: serde_json::Value = serde_json::from_slice(&bytes).map_err(|error| format!("project manifest is invalid JSON: {error}"))?;
    native_project::merge_artifact_reference(&mut manifest, &reference)?;
    native_project::save_open_project(manifest, project)
}

#[tauri::command]
fn register_generated_artifact(project: tauri::State<'_, native_project::ProjectSession>, runtime: tauri::State<'_, NativeRuntime>, project_id: String, path: String, media_type: String) -> Result<artifact_store::ArtifactReference, String> {
    native_project::require_project_permission(&project, &project_id, permissions::Permission::ArtifactWrite)?;
    let root = native_project::current_project_root(&project)?;
    let reference = artifact_store::reference_existing(&root, &path, media_type)?;
    let bytes = project_fs::read_bounded_limit(&root, "openentc.project.json", 10 * 1024 * 1024)?;
    let mut manifest: serde_json::Value = serde_json::from_slice(&bytes).map_err(|error| format!("project manifest is invalid JSON: {error}"))?;
    native_project::merge_artifact_reference(&mut manifest, &reference)?;
    native_project::save_open_project(manifest, project)?;
    runtime.events.publish(events::ApplicationEvent::ArtifactCreated { project_id, path: reference.path.clone(), sha256: reference.sha256.clone() })?;
    Ok(reference)
}

#[tauri::command]
fn read_artifact(project: tauri::State<'_, native_project::ProjectSession>, project_id: String, reference: artifact_store::ArtifactReference, max_bytes: u64) -> Result<Vec<u8>, String> {
    native_project::require_project_permission(&project, &project_id, permissions::Permission::ProjectRead)?;
    if max_bytes == 0 || max_bytes > 16 * 1024 * 1024 || reference.size as u64 > max_bytes { return Err("artifact read limit is invalid or smaller than the referenced artifact".into()); }
    let root = native_project::current_project_root(&project)?;
    artifact_store::verify(&root, &reference)?;
    project_fs::read_bounded_limit(&root, &reference.path, max_bytes)
}

#[tauri::command]
fn start_process(project: tauri::State<'_, native_project::ProjectSession>, runtime: tauri::State<'_, NativeRuntime>, project_id: String, id: String, request: process_runner::ProcessRequest) -> Result<(), String> {
    native_project::require_project_permission(&project, &project_id, permissions::Permission::ProcessExecute)?;
    start_authorized_process(&project, &runtime, project_id, id, request)
}

#[tauri::command]
fn start_device_process(project: tauri::State<'_, native_project::ProjectSession>, runtime: tauri::State<'_, NativeRuntime>, project_id: String, id: String, permission: permissions::Permission, target: String, request: process_runner::ProcessRequest) -> Result<(), String> {
    native_project::require_project_permission(&project, &project_id, permissions::Permission::ProcessExecute)?;
    native_project::require_device_target(&project, &project_id, permission, &target)?;
    start_authorized_process(&project, &runtime, project_id, id, request)
}

fn start_authorized_process(project: &tauri::State<'_, native_project::ProjectSession>, runtime: &tauri::State<'_, NativeRuntime>, project_id: String, id: String, request: process_runner::ProcessRequest) -> Result<(), String> {
    let project_root = native_project::current_project_root(&project)?;
    // Validate the complete project-scoped request before creating any
    // runtime job record. Invalid paths, arguments, or limits must not leave
    // a queued ghost job behind.
    process_runner::validate_request_in_project(&request, &project_root)?;
    runtime.jobs.enqueue(project_id.clone(), id.clone(), "process".into(), "process-runner".into())?;
    if let Err(error) = runtime.jobs.set_arguments(&project_id, &id, request.args.clone()) {
        let _ = runtime.jobs.remove(&project_id, &id);
        return Err(error);
    }
    if let Err(error) = runtime.jobs.set_resource_policy(&project_id, &id, Some(request.timeout_ms), Some(request.max_output_bytes)) {
        let _ = runtime.jobs.remove(&project_id, &id);
        return Err(error);
    }
    if let Err(error) = runtime.jobs.transition(&project_id, &id, job::JobState::Preparing, None) {
        let _ = runtime.jobs.remove(&project_id, &id);
        return Err(error);
    }
    if let Err(error) = runtime.processes.start_in_project(project_id.clone(), id.clone(), request, &project_root) {
        let _ = runtime.jobs.transition(&project_id, &id, job::JobState::Failed, Some(error.clone()));
        return Err(error);
    }
    if let Err(error) = runtime.jobs.transition(&project_id, &id, job::JobState::Running, None) {
        // A process must never outlive a failed lifecycle transition. The
        // registry cancellation flag is owned by the process worker and will
        // terminate the child through the same bounded cleanup path.
        let _ = runtime.processes.cancel(&project_id, &id);
        let _ = runtime.jobs.transition(&project_id, &id, job::JobState::Failed, Some(error.clone()));
        return Err(error);
    }
    Ok(())
}

#[tauri::command]
fn cancel_process(project: tauri::State<'_, native_project::ProjectSession>, runtime: tauri::State<'_, NativeRuntime>, project_id: String, id: String) -> Result<(), String> {
    native_project::require_project_permission(&project, &project_id, permissions::Permission::ProcessExecute)?;
    runtime.processes.cancel(&project_id, &id)?;
    runtime.jobs.transition(&project_id, &id, job::JobState::Cancelling, None)?;
    Ok(())
}

#[tauri::command]
fn revoke_process_execution(project: tauri::State<'_, native_project::ProjectSession>, runtime: tauri::State<'_, NativeRuntime>, project_id: String) -> Result<(), String> {
    native_project::require_project_permission(&project, &project_id, permissions::Permission::ProjectRead)?;
    runtime.processes.cancel_project(&project_id)?;
    native_project::revoke_project_permission(&project_id, permissions::Permission::ProcessExecute, &project)
}

#[tauri::command]
fn revoke_artifact_write(project: tauri::State<'_, native_project::ProjectSession>, project_id: String) -> Result<(), String> {
    native_project::require_project_permission(&project, &project_id, permissions::Permission::ProjectRead)?;
    native_project::revoke_project_permission(&project_id, permissions::Permission::ArtifactWrite, &project)
}

#[tauri::command]
fn poll_process(project: tauri::State<'_, native_project::ProjectSession>, runtime: tauri::State<'_, NativeRuntime>, project_id: String, id: String) -> Result<Option<process_runner::ProcessResult>, String> {
    native_project::require_project_permission(&project, &project_id, permissions::Permission::ProjectRead)?;
    let result = runtime.processes.peek(&project_id, &id)?;
    if let Some(outcome) = &result {
        runtime.jobs.record_process_result(&project_id, &id, &outcome.stdout, &outcome.stderr, outcome.error.as_deref())?;
        let next = if outcome.ok { job::JobState::Succeeded } else if outcome.error.as_deref() == Some("PROCESS_CANCELLED") { job::JobState::Cancelled } else { job::JobState::Failed };
        runtime.jobs.transition(&project_id, &id, next, outcome.error.clone())?;
        runtime.processes.remove(&project_id, &id)?;
    }
    Ok(result)
}

#[tauri::command]
fn start_serial(project: tauri::State<'_, native_project::ProjectSession>, runtime: tauri::State<'_, NativeRuntime>, project_id: String, id: String, target: String, baud: u32, max_buffer_bytes: usize) -> Result<(), String> {
    native_project::require_device_target(&project, &project_id, permissions::Permission::DeviceSerial, &target)?;
    runtime.serials.start(project_id, id, target, baud, max_buffer_bytes)
}

#[tauri::command]
fn poll_serial(project: tauri::State<'_, native_project::ProjectSession>, runtime: tauri::State<'_, NativeRuntime>, project_id: String, id: String, max_bytes: usize) -> Result<serial_transport::SerialPollResult, String> {
    native_project::require_project_permission(&project, &project_id, permissions::Permission::ProjectRead)?;
    runtime.serials.poll(&project_id, &id, max_bytes)
}

#[tauri::command]
fn write_serial(project: tauri::State<'_, native_project::ProjectSession>, runtime: tauri::State<'_, NativeRuntime>, project_id: String, id: String, bytes: Vec<u8>) -> Result<(), String> {
    let target = runtime.serials.target(&project_id, &id)?;
    native_project::require_device_target(&project, &project_id, permissions::Permission::DeviceSerial, &target)?;
    runtime.serials.write(&project_id, &id, &bytes)
}

#[tauri::command]
fn close_serial(project: tauri::State<'_, native_project::ProjectSession>, runtime: tauri::State<'_, NativeRuntime>, project_id: String, id: String) -> Result<(), String> {
    native_project::require_project_permission(&project, &project_id, permissions::Permission::ProjectRead)?;
    runtime.serials.close(&project_id, &id)
}

#[tauri::command]
fn revoke_device_target(project: tauri::State<'_, native_project::ProjectSession>, runtime: tauri::State<'_, NativeRuntime>, requested_project_id: String, permission: permissions::Permission, target: String) -> Result<(), String> {
    if permission == permissions::Permission::DeviceSerial { runtime.serials.close_target(&requested_project_id, &target)?; }
    native_project::revoke_device_target(requested_project_id, permission, target, project)
}

#[tauri::command]
fn close_project(project: tauri::State<'_, native_project::ProjectSession>, runtime: tauri::State<'_, NativeRuntime>) -> Result<(), String> {
    if let Ok(project_id) = native_project::current_project_id(&project) {
        runtime.serials.close_project(&project_id)?;
        runtime.processes.cancel_and_remove_project(&project_id)?;
        runtime.jobs.remove_project(&project_id)?;
        discard_project_events(&runtime, &project_id)?;
    }
    native_project::close_project(project)
}

#[tauri::command]
fn open_project(root: String, project: tauri::State<'_, native_project::ProjectSession>, runtime: tauri::State<'_, NativeRuntime>) -> Result<native_project::ProjectSummary, String> {
    native_project::validate_project(&root)?;
    if let Ok(project_id) = native_project::current_project_id(&project) {
        runtime.serials.close_project(&project_id)?;
        runtime.processes.cancel_and_remove_project(&project_id)?;
        runtime.jobs.remove_project(&project_id)?;
        discard_project_events(&runtime, &project_id)?;
    }
    native_project::open_project(root, project)
}

#[tauri::command]
async fn pick_project_directory(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let Some(selected) = app.dialog().file().blocking_pick_folder() else {
        return Ok(None);
    };
    let path = selected.into_path().map_err(|error| format!("selected project directory is invalid: {error}"))?;
    path.into_os_string()
        .into_string()
        .map(Some)
        .map_err(|_| "selected project directory is not valid UTF-8".to_string())
}

pub fn run() {
    let (event_bus, receiver) = events::EventBus::new();
    let runtime = NativeRuntime { jobs: job::JobRegistry::new(event_bus.clone()), processes: process_runner::ProcessRegistry::new(), events: event_bus, _events: std::sync::Arc::new(std::sync::Mutex::new(receiver)), pending_events: std::sync::Arc::new(std::sync::Mutex::new(std::collections::VecDeque::new())), serials: serial_transport::SerialRegistry::default() };
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(native_project::ProjectSession::default())
        .manage(runtime)
        .invoke_handler(tauri::generate_handler![
            desktop_capability_state,
            detect_engines,
            enqueue_job,
            get_job,
            list_jobs,
            transition_job,
            drain_events,
            store_artifact,
            verify_artifact,
            register_artifact,
            register_generated_artifact,
            read_artifact,
            start_process,
            start_device_process,
            cancel_process,
            poll_process,
            start_serial,
            poll_serial,
            write_serial,
            close_serial,
            native_project::grant_process_execution,
            native_project::grant_artifact_write,
            native_project::grant_device_target,
            revoke_device_target,
            revoke_process_execution,
            revoke_artifact_write,
            pick_project_directory,
            open_project,
            native_project::read_open_project,
            native_project::save_open_project,
            close_project
        ])
        .run(tauri::generate_context!())
        .expect("error while running OpenENTC Studio");
}
