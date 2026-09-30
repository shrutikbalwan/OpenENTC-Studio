use std::io::Read;
use std::collections::BTreeMap;
use std::path::{Component, Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex, atomic::{AtomicBool, AtomicUsize, Ordering}};
use std::thread;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use crate::permissions::{Permission, ProjectGrant};
use crate::platform::{owned_termination, TerminationPlan};

#[cfg(windows)]
struct OwnedProcessGroup {
    job: windows_sys::Win32::Foundation::HANDLE,
}

#[cfg(windows)]
impl OwnedProcessGroup {
    fn attach(child: &std::process::Child) -> Option<Self> {
        use std::os::windows::io::AsRawHandle;
        use windows_sys::Win32::System::JobObjects::{AssignProcessToJobObject, CreateJobObjectW};

        // SAFETY: both pointers passed to CreateJobObjectW are null by contract,
        // and the child process handle remains owned by `child` for this call.
        unsafe {
            let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
            if job.is_null() { return None; }
            if AssignProcessToJobObject(job, child.as_raw_handle()) == 0 {
                let _ = windows_sys::Win32::Foundation::CloseHandle(job);
                return None;
            }
            Some(Self { job })
        }
    }

    fn terminate(&self) -> bool {
        // SAFETY: `job` is a live handle owned by this wrapper until Drop.
        unsafe { windows_sys::Win32::System::JobObjects::TerminateJobObject(self.job, 1) != 0 }
    }
}

#[cfg(windows)]
impl Drop for OwnedProcessGroup {
    fn drop(&mut self) {
        // SAFETY: this wrapper owns the handle and closes it exactly once.
        unsafe { let _ = windows_sys::Win32::Foundation::CloseHandle(self.job); }
    }
}

#[cfg(not(windows))]
struct OwnedProcessGroup;

#[cfg(not(windows))]
impl OwnedProcessGroup {
    fn attach(_child: &std::process::Child) -> Option<Self> { None }
    fn terminate(&self) -> bool { false }
}

#[derive(Clone, Debug, Deserialize)]
pub struct ProcessRequest {
    pub executable: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub cwd: Option<String>,
    #[serde(default = "default_timeout")]
    pub timeout_ms: u64,
    #[serde(default = "default_output_limit")]
    pub max_output_bytes: usize,
}

#[derive(Clone, Debug, Serialize)]
pub struct ProcessResult {
    pub ok: bool,
    pub code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub error: Option<String>,
}

fn default_timeout() -> u64 { 120_000 }
fn default_output_limit() -> usize { 2 * 1024 * 1024 }

// These limits apply before spawning anything. They protect the native
// boundary from oversized IPC requests and keep the process contract aligned
// with the browser-side runner.
const MAX_EXECUTABLE_BYTES: usize = 4 * 1024;
const MAX_CWD_BYTES: usize = 32 * 1024;
const MAX_ARGS: usize = 256;
const MAX_ARG_BYTES: usize = 64 * 1024;
const MAX_TIMEOUT_MS: u64 = 24 * 60 * 60 * 1000;
const MAX_OUTPUT_BYTES: usize = 16 * 1024 * 1024;

pub fn validate_request(request: &ProcessRequest) -> Result<(), String> {
    if request.executable.is_empty() || !Path::new(&request.executable).is_absolute() {
        return Err("executable must be an absolute path".into());
    }
    if request.executable.len() > MAX_EXECUTABLE_BYTES {
        return Err("executable path exceeds the native request limit".into());
    }
    let executable_name = Path::new(&request.executable).file_name().and_then(|value| value.to_str()).unwrap_or_default().to_ascii_lowercase();
    if ["sh", "bash", "zsh", "dash", "fish", "cmd.exe", "powershell.exe", "pwsh.exe", "wsl.exe", "python", "python3", "python.exe", "node", "node.exe", "perl", "ruby"].contains(&executable_name.as_str()) {
        return Err("shell and interpreter executables are not allowed by the generic process runner".into());
    }
    let has_control = |value: &str| value.chars().any(|character| character.is_control());
    if has_control(&request.executable) || request.args.iter().any(|arg| has_control(arg)) {
        return Err("executable and arguments cannot contain control characters".into());
    }
    if let Some(cwd) = &request.cwd {
        if !Path::new(cwd).is_absolute() { return Err("working directory must be absolute".into()); }
        if cwd.len() > MAX_CWD_BYTES { return Err("working directory exceeds the native request limit".into()); }
        if has_control(cwd) { return Err("working directory cannot contain control characters".into()); }
    }
    if request.timeout_ms == 0 || request.max_output_bytes == 0 {
        return Err("timeout and output limits must be positive".into());
    }
    if request.timeout_ms > MAX_TIMEOUT_MS {
        return Err("timeout exceeds the native request limit".into());
    }
    if request.max_output_bytes > MAX_OUTPUT_BYTES {
        return Err("output limit exceeds the native request limit".into());
    }
    if request.args.len() > MAX_ARGS {
        return Err("argument count exceeds the native request limit".into());
    }
    if request.args.iter().any(|arg| arg.len() > MAX_ARG_BYTES) {
        return Err("argument exceeds the native request limit".into());
    }
    Ok(())
}

pub fn validate_request_in_project(request: &ProcessRequest, project_root: &Path) -> Result<(), String> {
    validate_request(request)?;
    let root = std::fs::canonicalize(project_root).map_err(|_| "project root is unavailable".to_string())?;
    let executable = std::fs::canonicalize(&request.executable).map_err(|_| "executable is unavailable".to_string())?;
    if !executable.is_file() || (!executable.starts_with(&root) && !approved_tool_path(&executable)) {
        return Err("executable is outside approved project or tool directories".into());
    }
    let cwd = request.cwd.as_deref().ok_or_else(|| "working directory must be project-scoped".to_string())?;
    let canonical_cwd = std::fs::canonicalize(cwd).map_err(|_| "working directory is unavailable".to_string())?;
    if !canonical_cwd.starts_with(&root) { return Err("working directory escapes the project root".into()); }
    for argument in &request.args { validate_project_argument(argument, &root, &canonical_cwd)?; }
    Ok(())
}

fn nearest_existing_ancestor(path: &Path) -> Option<PathBuf> {
    let mut candidate = Some(path);
    while let Some(current) = candidate {
        if current.exists() { return std::fs::canonicalize(current).ok(); }
        candidate = current.parent();
    }
    None
}

fn contains_embedded_absolute_path(argument: &str) -> bool {
    if Path::new(argument).is_absolute() { return false; }
    if argument.split_whitespace().any(|token| Path::new(token.trim_matches(|character| matches!(character, '\'' | '"' | ',' | ';'))).is_absolute()) { return true; }
    let bytes = argument.as_bytes();
    bytes.windows(3).enumerate().any(|(index, value)| index > 0 && value[0].is_ascii_alphabetic() && value[1] == b':' && matches!(value[2], b'/' | b'\\'))
}

fn validate_project_argument(argument: &str, root: &Path, cwd: &Path) -> Result<(), String> {
    if contains_embedded_absolute_path(argument) { return Err("embedded absolute paths are not allowed in process arguments".into()); }
    let path = Path::new(argument);
    if path.components().any(|component| matches!(component, Component::ParentDir)) { return Err("process argument path traversal is not allowed".into()); }
    let path_shaped = path.is_absolute() || argument.contains('/') || argument.contains('\\');
    if !path_shaped { return Ok(()); }
    let candidate = if path.is_absolute() { path.to_path_buf() } else { cwd.join(path) };
    let ancestor = nearest_existing_ancestor(&candidate).ok_or_else(|| "process argument path is unavailable".to_string())?;
    if !ancestor.starts_with(root) { return Err("process argument path escapes the project root".into()); }
    Ok(())
}

fn approved_tool_path(path: &Path) -> bool {
    let value = path.to_string_lossy().replace('\\', "/").to_ascii_lowercase();
    if cfg!(windows) {
        let drive_root = value.len() >= 3 && value.as_bytes()[0].is_ascii_alphabetic() && value.as_bytes()[1] == b':' && value.as_bytes()[2] == b'/';
        drive_root && (value[3..].starts_with("program files/") || value[3..].starts_with("program files (x86)/") || value[3..].starts_with("users/public/"))
    } else {
        value.starts_with("/usr/bin/") || value.starts_with("/usr/local/bin/") || value.starts_with("/opt/")
    }
}

fn read_bounded<R: Read + Send + 'static>(mut stream: R, limit: usize, total: Arc<AtomicUsize>, overflow: Arc<AtomicBool>) -> thread::JoinHandle<Vec<u8>> {
    thread::spawn(move || {
        let mut output = Vec::new(); let mut chunk = [0u8; 8192];
        loop {
            match stream.read(&mut chunk) {
                Ok(0) => break,
                Ok(count) => {
                    let previous = total.fetch_add(count, Ordering::AcqRel);
                    if previous.saturating_add(count) > limit {
                        overflow.store(true, Ordering::Release);
                        let remaining = limit.saturating_sub(previous);
                        output.extend_from_slice(&chunk[..remaining.min(count)]);
                        break;
                    }
                    output.extend_from_slice(&chunk[..count]);
                }
                Err(_) => break,
            }
        }
        output
    })
}

fn terminate_owned(child: &mut std::process::Child, process_group: Option<&OwnedProcessGroup>) {
    if process_group.is_some_and(OwnedProcessGroup::terminate) {
        let _ = child.kill();
        return;
    }
    match owned_termination(child.id(), cfg!(windows)) {
        TerminationPlan::WindowsTaskkill { executable, args } => {
            let _ = Command::new(executable).args(args).status();
        }
        TerminationPlan::PosixProcessGroup { pid: process_group, .. } => {
            #[cfg(unix)]
            {
                let _ = Command::new("/bin/kill").args(["-TERM", &format!("-{process_group}")]).status();
            }
            #[cfg(not(unix))]
            {
                let _ = process_group;
                let _ = child.kill();
            }
        }
    }
    let _ = child.kill();
}

/// Runs one explicitly supplied executable without a shell. This module is not
/// exposed as a Tauri command until project-scoped authorization is added.
pub fn run(request: ProcessRequest, cancel: &AtomicBool) -> ProcessResult {
    if let Err(error) = validate_request(&request) { return ProcessResult { ok: false, code: None, stdout: String::new(), stderr: String::new(), error: Some(error) }; }
    let mut command = Command::new(&request.executable);
    command.args(&request.args).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    if let Some(cwd) = &request.cwd { command.current_dir(cwd); }
    #[cfg(unix)]
    std::os::unix::process::CommandExt::process_group(&mut command, 0);
    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(error) => return ProcessResult { ok: false, code: None, stdout: String::new(), stderr: String::new(), error: Some(error.to_string()) },
    };
    let process_group = OwnedProcessGroup::attach(&child);
    let overflow = Arc::new(AtomicBool::new(false));
    let total_output = Arc::new(AtomicUsize::new(0));
    let stdout_thread = read_bounded(child.stdout.take().expect("stdout was piped"), request.max_output_bytes, total_output.clone(), overflow.clone());
    let stderr_thread = read_bounded(child.stderr.take().expect("stderr was piped"), request.max_output_bytes, total_output, overflow.clone());
    let deadline = Instant::now() + Duration::from_millis(request.timeout_ms);
    let mut reason: Option<String> = None;
    loop {
        if cancel.load(Ordering::Acquire) { reason = Some("PROCESS_CANCELLED".into()); terminate_owned(&mut child, process_group.as_ref()); break; }
        if overflow.load(Ordering::Acquire) { reason = Some("PROCESS_OUTPUT_LIMIT".into()); terminate_owned(&mut child, process_group.as_ref()); break; }
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) if Instant::now() >= deadline => { reason = Some("PROCESS_TIMEOUT".into()); terminate_owned(&mut child, process_group.as_ref()); break; }
            Ok(None) => thread::sleep(Duration::from_millis(10)),
            Err(error) => { reason = Some(error.to_string()); terminate_owned(&mut child, process_group.as_ref()); break; }
        }
    }
    let status = child.wait().ok();
    let stdout = String::from_utf8_lossy(&stdout_thread.join().unwrap_or_default()).into_owned();
    let stderr = String::from_utf8_lossy(&stderr_thread.join().unwrap_or_default()).into_owned();
    let code = status.and_then(|value| value.code());
    ProcessResult { ok: reason.is_none() && code == Some(0), code, stdout, stderr, error: reason }
}

/// Authorization-bearing entry point for future Tauri job execution. The
/// grant is checked before request validation or spawning, so an invalid or
/// malicious request cannot be used to probe the host when execution is not
/// explicitly granted for the selected project.
pub fn run_authorized(request: ProcessRequest, grant: &ProjectGrant, project_id: &str, cancel: &AtomicBool) -> ProcessResult {
    if let Err(error) = grant.require(project_id, Permission::ProcessExecute) {
        return ProcessResult { ok: false, code: None, stdout: String::new(), stderr: String::new(), error: Some(error) };
    }
    run(request, cancel)
}

#[derive(Clone)]
pub struct ProcessRegistry {
    runs: Arc<Mutex<BTreeMap<String, ProcessHandle>>>,
}

#[derive(Clone)]
struct ProcessHandle {
    project_id: String,
    cancel: Arc<AtomicBool>,
    result: Arc<Mutex<Option<ProcessResult>>>,
    output_reservation: usize,
}

const MAX_PROCESS_RUNS: usize = 128;
const MAX_RETAINED_OUTPUT_BYTES: usize = 128 * 1024 * 1024;

fn registry_key(project_id: &str, id: &str) -> String {
    format!("{project_id}\0{id}")
}

impl ProcessRegistry {
    pub fn new() -> Self { Self { runs: Arc::new(Mutex::new(BTreeMap::new())) } }

    pub fn start(&self, project_id: String, id: String, request: ProcessRequest) -> Result<(), String> {
        if project_id.is_empty() || project_id.len() > 200 || project_id.chars().any(|character| character.is_control()) { return Err("project id is invalid".into()); }
        if id.is_empty() || id.len() > 200 || id.chars().any(|character| character.is_control()) { return Err("process run id is invalid".into()); }
        validate_request(&request)?;
        let cancel = Arc::new(AtomicBool::new(false));
        let result = Arc::new(Mutex::new(None));
        let key = registry_key(&project_id, &id);
        let output_reservation = request.max_output_bytes;
        let handle = ProcessHandle { project_id, cancel: cancel.clone(), result: result.clone(), output_reservation };
        let mut runs = self.runs.lock().map_err(|_| "process registry is poisoned".to_string())?;
        if runs.len() >= MAX_PROCESS_RUNS { return Err("too many process runs are retained".into()); }
        let reserved = runs.values().map(|run| run.output_reservation).sum::<usize>();
        if reserved.saturating_add(output_reservation) > MAX_RETAINED_OUTPUT_BYTES {
            return Err("retained process output budget is exhausted".into());
        }
        if runs.contains_key(&key) { return Err("process run id already exists for this project".into()); }
        runs.insert(key, handle);
        drop(runs);
        thread::spawn(move || {
            let outcome = run(request, &cancel);
            if let Ok(mut slot) = result.lock() { *slot = Some(outcome); }
        });
        Ok(())
    }

    pub fn start_in_project(&self, project_id: String, id: String, mut request: ProcessRequest, project_root: &Path) -> Result<(), String> {
        if request.cwd.is_none() { request.cwd = Some(project_root.to_string_lossy().into_owned()); }
        validate_request_in_project(&request, project_root)?;
        self.start(project_id, id, request)
    }

    pub fn cancel(&self, project_id: &str, id: &str) -> Result<(), String> {
        let runs = self.runs.lock().map_err(|_| "process registry is poisoned".to_string())?;
        let handle = runs.get(&registry_key(project_id, id)).ok_or_else(|| "process run was not found for this project".to_string())?;
        if handle.project_id != project_id { return Err("process run does not belong to the requested project".into()); }
        handle.cancel.store(true, Ordering::Release);
        Ok(())
    }

    pub fn cancel_project(&self, project_id: &str) -> Result<usize, String> {
        let runs = self.runs.lock().map_err(|_| "process registry is poisoned".to_string())?;
        let mut count = 0;
        for handle in runs.values() {
            if handle.project_id == project_id {
                handle.cancel.store(true, Ordering::Release);
                count += 1;
            }
        }
        Ok(count)
    }

    /// Cancel and forget all handles owned by a closing session. The worker
    /// thread retains its own cancellation/result Arcs, so removing the
    /// registry entries cannot orphan a child process, while preventing stale
    /// handles from consuming the global retention limit.
    pub fn cancel_and_remove_project(&self, project_id: &str) -> Result<usize, String> {
        let mut runs = self.runs.lock().map_err(|_| "process registry is poisoned".to_string())?;
        let keys: Vec<String> = runs.iter().filter(|(_, handle)| handle.project_id == project_id).map(|(key, _)| key.clone()).collect();
        let removed = keys.len();
        for key in keys {
            if let Some(handle) = runs.remove(&key) { handle.cancel.store(true, Ordering::Release); }
        }
        Ok(removed)
    }

    pub fn cancel_all(&self) -> Result<usize, String> {
        let runs = self.runs.lock().map_err(|_| "process registry is poisoned".to_string())?;
        for handle in runs.values() { handle.cancel.store(true, Ordering::Release); }
        Ok(runs.len())
    }

    pub fn poll(&self, project_id: &str, id: &str) -> Result<Option<ProcessResult>, String> {
        let result = self.peek(project_id, id)?;
        if result.is_some() { self.remove(project_id, id)?; }
        Ok(result)
    }

    pub fn peek(&self, project_id: &str, id: &str) -> Result<Option<ProcessResult>, String> {
        let runs = self.runs.lock().map_err(|_| "process registry is poisoned".to_string())?;
        let handle = runs.get(&registry_key(project_id, id)).ok_or_else(|| "process run was not found for this project".to_string())?;
        if handle.project_id != project_id { return Err("process run does not belong to the requested project".into()); }
        handle.result.lock().map_err(|_| "process result is poisoned".to_string()).map(|result| result.clone())
    }

    pub fn remove(&self, project_id: &str, id: &str) -> Result<(), String> {
        let mut runs = self.runs.lock().map_err(|_| "process registry is poisoned".to_string())?;
        let handle = runs.get(&registry_key(project_id, id)).ok_or_else(|| "process run was not found for this project".to_string())?;
        if handle.project_id != project_id { return Err("process run does not belong to the requested project".into()); }
        runs.remove(&registry_key(project_id, id));
        Ok(())
    }
}

impl Default for ProcessRegistry {
    fn default() -> Self { Self::new() }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn current_test_request(test_name: &str, cwd: &Path, timeout_ms: u64) -> ProcessRequest {
        ProcessRequest {
            executable: std::env::current_exe().unwrap().into_os_string().into_string().unwrap(),
            args: vec!["--ignored".into(), "--exact".into(), test_name.into(), "--nocapture".into()],
            cwd: Some(cwd.to_string_lossy().into_owned()),
            timeout_ms,
            max_output_bytes: 64 * 1024,
        }
    }

    #[test]
    #[ignore]
    fn process_child_helper_outputs() {
        println!("OPENENTC_CHILD_STDOUT");
        eprintln!("OPENENTC_CHILD_STDERR");
    }

    #[test]
    #[ignore]
    fn process_child_helper_sleeps() {
        thread::sleep(Duration::from_secs(5));
    }

    #[test]
    #[ignore]
    fn process_child_helper_tree_leaf() {
        thread::sleep(Duration::from_millis(1_200));
        std::fs::write("openentc-grandchild-finished", b"unexpected").unwrap();
    }

    #[test]
    #[ignore]
    fn process_child_helper_tree_parent() {
        let executable = std::env::current_exe().unwrap();
        let mut child = Command::new(executable)
            .args(["--ignored", "--exact", "process_runner::tests::process_child_helper_tree_leaf", "--nocapture"])
            .spawn()
            .unwrap();
        println!("OPENENTC_GRANDCHILD_STARTED:{}", child.id());
        let _ = child.wait();
    }

    #[test]
    fn executes_a_real_owned_child_and_captures_bounded_streams() {
        let cwd = std::env::current_dir().unwrap();
        let result = run(current_test_request("process_runner::tests::process_child_helper_outputs", &cwd, 5_000), &AtomicBool::new(false));
        assert!(result.ok, "{result:?}");
        assert!(result.stdout.contains("OPENENTC_CHILD_STDOUT"));
        assert!(result.stderr.contains("OPENENTC_CHILD_STDERR"));
    }

    #[test]
    fn real_owned_child_honors_timeout() {
        let cwd = std::env::current_dir().unwrap();
        let result = run(current_test_request("process_runner::tests::process_child_helper_sleeps", &cwd, 50), &AtomicBool::new(false));
        assert!(!result.ok);
        assert_eq!(result.error.as_deref(), Some("PROCESS_TIMEOUT"));
    }

    /// Opt-in native-engine evidence. The normal Rust suite remains
    /// dependency-free; setting OPENENTC_NGSPICE to an absolute executable
    /// path exercises the same bounded process runner used by the desktop
    /// command boundary with a real ngspice calculation.
    #[test]
    fn opt_in_real_ngspice_runs_through_native_process_runner() {
        let Some(executable) = std::env::var_os("OPENENTC_NGSPICE") else { return; };
        let executable = PathBuf::from(executable);
        if !executable.is_absolute() || !executable.is_file() { panic!("OPENENTC_NGSPICE must name an absolute executable file"); }
        let root = std::env::temp_dir().join(format!("openentc-native-ngspice-{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        let input = root.join("divider.cir");
        let output = root.join("divider.out");
        std::fs::write(&input, "* native process boundary divider\nV1 in 0 9\nR1 in out 1k\nR2 out 0 1k\n.op\n.control\nrun\nprint v(out)\n.endc\n.end\n").unwrap();
        let result = run(ProcessRequest {
            executable: executable.to_string_lossy().into_owned(),
            args: vec!["-b".into(), "-o".into(), output.to_string_lossy().into_owned(), input.to_string_lossy().into_owned()],
            cwd: Some(root.to_string_lossy().into_owned()),
            timeout_ms: 20_000,
            max_output_bytes: 2 * 1024 * 1024,
        }, &AtomicBool::new(false));
        let report = std::fs::read_to_string(&output).unwrap_or_default();
        assert!(result.ok, "native ngspice process failed: {result:?}\n{report}");
        assert!(report.to_ascii_lowercase().contains("v(out)"), "ngspice report did not contain v(out): {report}");
        assert!(report.contains("4.500") || report.contains("4.5"), "ngspice report did not contain the expected divider result: {report}");
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn cancellation_terminates_the_real_owned_process_tree() {
        let cwd = std::env::temp_dir().join(format!("openentc-process-tree-{}", std::process::id()));
        std::fs::create_dir_all(&cwd).unwrap();
        let marker = cwd.join("openentc-grandchild-finished");
        let cancel = Arc::new(AtomicBool::new(false));
        let request = current_test_request("process_runner::tests::process_child_helper_tree_parent", &cwd, 10_000);
        let worker_cancel = cancel.clone();
        let worker = thread::spawn(move || run(request, &worker_cancel));
        thread::sleep(Duration::from_millis(300));
        cancel.store(true, Ordering::Release);
        let result = worker.join().unwrap();
        assert_eq!(result.error.as_deref(), Some("PROCESS_CANCELLED"));
        assert!(result.stdout.contains("OPENENTC_GRANDCHILD_STARTED"));
        thread::sleep(Duration::from_millis(1_500));
        assert!(!marker.exists(), "owned grandchild survived process-tree cancellation");
        std::fs::remove_dir_all(&cwd).unwrap();
    }

    #[test]
    fn rejects_relative_executables_and_zero_limits() {
        let mut request = ProcessRequest { executable: "tool".into(), args: vec![], cwd: None, timeout_ms: 1, max_output_bytes: 1 };
        assert!(validate_request(&request).is_err());
        request.executable = if cfg!(windows) { "C:\\tool.exe".into() } else { "/tool".into() };
        request.timeout_ms = 0;
        assert!(validate_request(&request).is_err());
    }

    #[test]
    fn rejects_oversized_native_requests_before_spawn() {
        let executable = if cfg!(windows) { "C:\\tool.exe" } else { "/tool" };
        let mut request = ProcessRequest {
            executable: executable.into(), args: vec![], cwd: None,
            timeout_ms: MAX_TIMEOUT_MS + 1, max_output_bytes: 1,
        };
        assert!(validate_request(&request).is_err());
        request.timeout_ms = 1;
        request.max_output_bytes = MAX_OUTPUT_BYTES + 1;
        assert!(validate_request(&request).is_err());
        request.max_output_bytes = 1;
        request.args = vec!["x".repeat(MAX_ARG_BYTES + 1)];
        assert!(validate_request(&request).is_err());
        request.args = vec!["x".into(); MAX_ARGS + 1];
        assert!(validate_request(&request).is_err());
        request.args = vec!["bad\narg".into()];
        assert!(validate_request(&request).is_err());
    }

    #[test]
    fn project_runner_confines_path_shaped_arguments() {
        let fixture = std::env::temp_dir().join(format!("openentc-argument-boundary-{}", std::process::id()));
        let root = fixture.join("project");
        let outside = fixture.join("outside.txt");
        std::fs::create_dir_all(root.join("runs")).unwrap();
        std::fs::write(&outside, b"private").unwrap();
        let executable = root.join(if cfg!(windows) { "tool.exe" } else { "tool" });
        std::fs::write(&executable, b"fixture").unwrap();
        let request = |args: Vec<String>| ProcessRequest {
            executable: executable.to_string_lossy().into_owned(), args,
            cwd: Some(root.to_string_lossy().into_owned()), timeout_ms: 1, max_output_bytes: 1,
        };
        assert!(validate_request_in_project(&request(vec!["runs/output.log".into(), root.join("future.txt").to_string_lossy().into_owned()]), &root).is_ok());
        assert!(validate_request_in_project(&request(vec![outside.to_string_lossy().into_owned()]), &root).is_err());
        assert!(validate_request_in_project(&request(vec!["../outside.txt".into()]), &root).is_err());
        assert!(validate_request_in_project(&request(vec![format!("--script={}", outside.to_string_lossy())]), &root).is_err());
        std::fs::remove_dir_all(&fixture).unwrap();
    }

    #[test]
    fn authorization_denies_process_execution_before_validation_or_spawn() {
        let grant = ProjectGrant::new("project".into(), [Permission::ProjectRead]).unwrap();
        let request = ProcessRequest { executable: "relative-tool".into(), args: vec![], cwd: None, timeout_ms: 1, max_output_bytes: 1 };
        let result = run_authorized(request, &grant, "project", &AtomicBool::new(false));
        assert!(!result.ok);
        assert!(result.error.unwrap().contains("ProcessExecute"));
    }

    #[test]
    fn process_registry_rejects_duplicate_and_cross_project_runs() {
        let registry = ProcessRegistry::new();
        let request = ProcessRequest { executable: if cfg!(windows) { "C:\\missing.exe".into() } else { "/missing".into() }, args: vec![], cwd: None, timeout_ms: 1, max_output_bytes: 1 };
        registry.start("project-a".into(), "run-1".into(), request.clone()).unwrap();
        assert!(registry.start("project-a".into(), "run-1".into(), request.clone()).is_err());
        assert!(registry.start("project-b".into(), "run-1".into(), request).is_ok());
        assert!(registry.cancel("project-c", "run-1").is_err());
        let _ = registry.cancel("project-a", "run-1");
        let _ = registry.cancel("project-b", "run-1");
        let cleanup_request = ProcessRequest { executable: if cfg!(windows) { "C:\\missing-cleanup.exe".into() } else { "/missing-cleanup".into() }, args: vec![], cwd: None, timeout_ms: 1, max_output_bytes: 1 };
        registry.start("project-a".into(), "run-2".into(), cleanup_request).unwrap();
        assert_eq!(registry.cancel_and_remove_project("project-a").unwrap(), 2);
        assert!(registry.peek("project-a", "run-2").is_err());
    }

    #[test]
    fn process_registry_bounds_reserved_output_memory() {
        let registry = ProcessRegistry::new();
        let executable = if cfg!(windows) { "C:\\missing-output-budget.exe" } else { "/missing-output-budget" };
        for index in 0..8 {
            registry.start("budget-project".into(), format!("run-{index}"), ProcessRequest {
                executable: executable.into(), args: vec![], cwd: None, timeout_ms: 1,
                max_output_bytes: MAX_OUTPUT_BYTES,
            }).unwrap();
        }
        assert!(registry.start("budget-project".into(), "overflow".into(), ProcessRequest {
            executable: executable.into(), args: vec![], cwd: None, timeout_ms: 1,
            max_output_bytes: 1,
        }).is_err());
        assert_eq!(registry.cancel_and_remove_project("budget-project").unwrap(), 8);
        registry.start("budget-project".into(), "reclaimed".into(), ProcessRequest {
            executable: executable.into(), args: vec![], cwd: None, timeout_ms: 1,
            max_output_bytes: MAX_OUTPUT_BYTES,
        }).unwrap();
        let _ = registry.cancel_and_remove_project("budget-project");
    }
}
