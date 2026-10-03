import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile as readFileRaw } from 'node:fs/promises';
import { createDesktopBridge, DESKTOP_UNAVAILABLE_CODE } from '../src/core/desktop-bridge.js';

// rustfmt may wrap a call or method chain over several lines and add trailing commas. The source
// assertions below check token sequences, so Rust files are read with that layout folded away:
// whitespace runs become one space, padding inside brackets and before "." goes, and a trailing
// comma before a closing bracket is dropped. The tokens each assertion requires are unchanged.
const normalizeRust = (text) => text.replace(/\s+/g, ' ').replace(/([([]) /g, '$1').replace(/ ([)\].])/g, '$1').replace(/,([)\]])/g, '$1');
async function readFile(url, encoding) {
  const text = await readFileRaw(url, encoding);
  return String(url).endsWith('.rs') ? normalizeRust(text) : text;
}

test('Tauri shell starts with a least-privilege core-only capability', async () => {
  const capability = JSON.parse(await readFile(new URL('../apps/desktop/src-tauri/capabilities/default.json', import.meta.url), 'utf8'));
  const config = JSON.parse(await readFile(new URL('../apps/desktop/src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
  assert.deepEqual(capability.permissions, ['core:default']);
  assert.deepEqual(config.app.security.capabilities, ['main-capability']);
  assert.equal(config.bundle.active, true);
  assert.deepEqual(config.bundle.targets, ['nsis']);
  assert.ok(config.bundle.icon.includes('icons/128x128.png'));
  assert.ok(config.bundle.icon.includes('icons/128x128@2x.png'));
});

test('Tauri shell does not grant process, filesystem, network, or device plugins by default', async () => {
  const source = await readFile(new URL('../apps/desktop/src-tauri/src/lib.rs', import.meta.url), 'utf8');
  const capability = JSON.parse(await readFile(new URL('../apps/desktop/src-tauri/capabilities/default.json', import.meta.url), 'utf8'));
  assert.doesNotMatch(source, /tauri_plugin_(shell|fs|process|serial|usb|capture)/i);
  assert.deepEqual(capability.permissions, ['core:default']);
});

test('desktop project opening uses a native folder picker without browser filesystem privileges', async () => {
  const source = await readFile(new URL('../apps/desktop/src-tauri/src/lib.rs', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(source, /async fn pick_project_directory/);
  assert.match(source, /blocking_pick_folder/);
  assert.match(source, /tauri_plugin_dialog::init/);
  assert.match(source, /pick_project_directory,/);
  assert.match(app, /desktopBridge\.pickProjectDirectory\(\)/);
  const openBody = app.match(/async function openDesktopProject\(\)[\s\S]*?\n}/)[0];
  assert.doesNotMatch(openBody, /window\.prompt/);
});

test('desktop bridge exposes the folder picker and preserves browser denial', async () => {
  const calls = [];
  const bridge = createDesktopBridge((command, args) => { calls.push({ command, args }); return Promise.resolve('C:\\project'); });
  assert.equal(await bridge.pickProjectDirectory(), 'C:\\project');
  assert.deepEqual(calls, [{ command: 'pick_project_directory', args: undefined }]);
  const unavailable = createDesktopBridge();
  await assert.rejects(unavailable.pickProjectDirectory(), (error) => error.code === DESKTOP_UNAVAILABLE_CODE);
});

test('native process runner keeps executable and arguments separate and bounded', async () => {
  const source = await readFile(new URL('../apps/desktop/src-tauri/src/process_runner.rs', import.meta.url), 'utf8');
  assert.match(source, /Command::new\(&request\.executable\)/);
  assert.match(source, /command\.args\(&request\.args\)/);
  assert.match(source, /max_output_bytes/);
  assert.match(source, /AtomicUsize/);
  assert.match(source, /total_output/);
  assert.match(source, /PROCESS_TIMEOUT/);
  assert.match(source, /PROCESS_CANCELLED/);
  assert.match(source, /MAX_ARGS/);
  assert.match(source, /MAX_ARG_BYTES/);
  assert.match(source, /MAX_TIMEOUT_MS/);
  assert.match(source, /MAX_OUTPUT_BYTES/);
  assert.match(source, /oversized_native_requests_before_spawn/);
  assert.match(source, /cannot contain control characters/);
  assert.match(source, /has_control/);
  assert.match(source, /run_authorized/);
  assert.match(source, /Permission::ProcessExecute/);
  assert.match(source, /grant\.require\(project_id/);
  assert.match(source, /before request validation or spawning/);
  assert.match(source, /terminate_owned/);
  assert.match(source, /owned_termination/);
  assert.match(source, /process_group/);
  assert.match(source, /taskkill|\/bin\/kill/);
  assert.match(source, /pub struct ProcessRegistry/);
  assert.match(source, /MAX_PROCESS_RUNS/);
  assert.match(source, /pub fn start/);
  assert.match(source, /pub fn cancel/);
  assert.match(source, /pub fn poll/);
  assert.doesNotMatch(source, /shell\s*\(/i);
});

test('native discovery validates the nearest existing parent for missing candidates', async () => {
  const discovery = await readFile(new URL('../apps/desktop/src-tauri/src/discovery.rs', import.meta.url), 'utf8');
  assert.match(discovery, /let mut ancestor = path\.parent\(\)/);
  assert.match(discovery, /canonicalize\(candidate\)/);
  assert.match(discovery, /symlinked directory/);
  assert.match(discovery, /MAX_CANDIDATE_PATH_BYTES/);
  assert.match(discovery, /discovery_rejects_unbounded_and_control_character_candidates/);
  assert.match(discovery, /DetectionState::Invalid/);
  assert.match(discovery, /if !self\.valid/);
});

test('native core includes explicit job lifecycle and project-root confinement services', async () => {
  const job = await readFile(new URL('../apps/desktop/src-tauri/src/job.rs', import.meta.url), 'utf8');
  const projectFs = await readFile(new URL('../apps/desktop/src-tauri/src/project_fs.rs', import.meta.url), 'utf8');
  assert.match(job, /Queued.*Preparing.*Running.*Cancelling.*Succeeded.*Failed.*Cancelled/s);
  assert.match(job, /invalid job transition/);
  assert.match(job, /Queued, JobState::Cancelling/);
  assert.match(job, /Preparing, JobState::Cancelled/);
  assert.match(job, /Preparing, JobState::Failed/);
  assert.match(job, /Cancelling, JobState::Failed/);
  assert.match(job, /Cancelling, JobState::Succeeded/);
  assert.match(job, /cancellation_race_can_finish_successfully_without_sticking/);
  assert.match(job, /lifecycle_allows_cancellation_before_process_start/);
  assert.match(job, /pub struct JobRegistry/);
  assert.match(job, /pub project_id: String/);
  assert.match(job, /JobStateChanged/);
  assert.match(projectFs, /ParentDir/);
  assert.match(projectFs, /unsafe_relative/);
  assert.match(projectFs, /is_ascii_alphabetic/);
  assert.match(projectFs, /canonicalize/);
  assert.match(projectFs, /write_atomic/);
  assert.match(projectFs, /MAX_FILE_BYTES/);
  assert.match(projectFs, /canonical_parent/);
  assert.match(projectFs, /project parent escapes the approved root/);
});

test('Tauri exposes bounded job lifecycle commands while retaining the event receiver', async () => {
  const job = await readFile(new URL('../apps/desktop/src-tauri/src/job.rs', import.meta.url), 'utf8');
  const lib = await readFile(new URL('../apps/desktop/src-tauri/src/lib.rs', import.meta.url), 'utf8');
  assert.match(job, /MAX_JOB_TEXT_BYTES/);
  assert.match(job, /MAX_JOBS: usize = 1_024/);
  assert.match(job, /too many retained jobs/);
  assert.match(job, /control characters/);
  assert.match(job, /validate_job_text\(&id/);
  assert.match(lib, /struct NativeRuntime/);
  assert.match(lib, /_events/);
  assert.match(lib, /fn enqueue_job/);
  assert.match(lib, /require_project_permission/);
  assert.match(lib, /project_id: String/);
  assert.match(lib, /fn get_job/);
  assert.match(job, /pub fn list\(&self, project_id: &str\)/);
  assert.match(lib, /fn list_jobs/);
  assert.match(lib, /list_jobs,/);
  assert.match(lib, /fn transition_job/);
  assert.match(lib, /enqueue_job,/);
  assert.match(lib, /get_job,/);
  assert.match(lib, /transition_job,/);
  assert.match(lib, /fn drain_events/);
  assert.match(lib, /MAX_DRAIN_EVENTS/);
  assert.match(lib, /try_recv/);
  assert.match(lib, /fn start_process/);
  assert.match(lib, /fn cancel_process/);
  assert.match(lib, /fn poll_process/);
  assert.match(lib, /ProcessRegistry::new/);
  assert.match(lib, /JobState::Preparing/);
  assert.match(lib, /JobState::Running/);
  assert.match(lib, /JobState::Cancelling/);
  assert.match(lib, /JobState::Succeeded/);
  assert.match(lib, /JobState::Cancelled/);
  assert.match(lib, /JobRegistry::new\(event_bus(?:\.clone\(\))?\)/);
});

test('native core includes content-addressed artifacts and structured application events', async () => {
  const artifacts = await readFile(new URL('../apps/desktop/src-tauri/src/artifact_store.rs', import.meta.url), 'utf8');
  const events = await readFile(new URL('../apps/desktop/src-tauri/src/events.rs', import.meta.url), 'utf8');
  assert.match(artifacts, /Sha256/);
  assert.match(artifacts, /MAX_ARTIFACT_BYTES/);
  assert.match(artifacts, /integrity check failed/);
  assert.match(artifacts, /safe_relative/);
  assert.match(artifacts, /fn approved_path/);
  assert.match(artifacts, /let target = approved_path/);
  assert.match(artifacts, /artifact reference metadata is invalid/);
  assert.match(artifacts, /sha256 != reference\.sha256\.to_ascii_lowercase\(\)/);
  assert.match(events, /JobQueued/);
  assert.match(events, /Diagnostic/);
  assert.match(events, /ArtifactCreated/);
  assert.match(events, /sync_channel/);
  assert.match(events, /try_send/);
  assert.match(events, /EVENT_QUEUE_LIMIT/);
});

test('native command authorization is project-bound and scope-specific', async () => {
  const source = await readFile(new URL('../apps/desktop/src-tauri/src/permissions.rs', import.meta.url), 'utf8');
  assert.match(source, /ProjectRead/);
  assert.match(source, /ProcessExecute/);
  assert.match(source, /ArtifactWrite/);
  assert.match(source, /project grant does not match/);
  assert.match(source, /permission .* was not granted/);
  assert.match(source, /project_id/);
  assert.match(source, /character\.is_control\(\)/);
});

test('native platform termination uses fixed, owned process-tree plans', async () => {
  const source = await readFile(new URL('../apps/desktop/src-tauri/src/platform.rs', import.meta.url), 'utf8');
  assert.match(source, /taskkill\.exe/);
  assert.match(source, /ProcessGroup/);
  assert.match(source, /\"\/T\"/);
  assert.match(source, /\"\/F\"/);
  assert.doesNotMatch(source, /Command::new|shell/);
});

test('closing a native project cancels all processes owned by its session', async () => {
  const runner = await readFile(new URL('../apps/desktop/src-tauri/src/process_runner.rs', import.meta.url), 'utf8');
  const lib = await readFile(new URL('../apps/desktop/src-tauri/src/lib.rs', import.meta.url), 'utf8');
  const project = await readFile(new URL('../apps/desktop/src-tauri/src/native_project.rs', import.meta.url), 'utf8');
  assert.match(runner, /pub fn cancel_project\(&self, project_id: &str\)/);
  assert.match(runner, /pub fn cancel_and_remove_project\(&self, project_id: &str\)/);
  assert.match(lib, /fn close_project\(/);
  assert.match(lib, /runtime\.processes\.cancel_and_remove_project\(&project_id\)/);
  assert.match(lib, /runtime\.jobs\.remove_project\(&project_id\)/);
  assert.match(lib, /fn discard_project_events\(/);
  assert.match(lib, /pending\.retain\(\|event\| event\.project_id\(\) != project_id\)/);
  assert.match(project, /pub fn current_project_id\(/);
  assert.match(lib, /fn open_project\(/);
  assert.match(lib, /native_project::open_project\(root, project\)/);
});

test('native process start cleans up if the running-state transition fails', async () => {
  const lib = await readFile(new URL('../apps/desktop/src-tauri/src/lib.rs', import.meta.url), 'utf8');
  assert.match(lib, /if let Err\(error\) = runtime\.jobs\.transition\(&project_id, &id, job::JobState::Running, None\)/);
  assert.match(lib, /runtime\.processes\.cancel\(&project_id, &id\)/);
  assert.match(lib, /job::JobState::Failed/);
});

test('native process start validates the project-scoped request before enqueueing a job', async () => {
  const lib = await readFile(new URL('../apps/desktop/src-tauri/src/lib.rs', import.meta.url), 'utf8');
  const start = lib.indexOf('fn start_authorized_process(');
  const end = lib.indexOf('\n#[tauri::command]', start + 1);
  const body = lib.slice(start, end);
  assert.ok(body.indexOf('validate_request_in_project') < body.indexOf('runtime.jobs.enqueue'));
  assert.match(body, /runtime\.jobs\.remove\(&project_id, &id\)/);
  assert.match(lib, /fn start_device_process[\s\S]*require_device_target[\s\S]*start_authorized_process/);
});

test('native process runner confines absolute, relative, and embedded argument paths to the project', async () => {
  const source = await readFile(new URL('../apps/desktop/src-tauri/src/process_runner.rs', import.meta.url), 'utf8');
  assert.match(source, /fn validate_project_argument/);
  assert.match(source, /Component::ParentDir/);
  assert.match(source, /embedded absolute paths are not allowed/);
  assert.match(source, /process argument path escapes the project root/);
  const validation = source.indexOf('validate_project_argument(argument');
  const spawn = source.indexOf('command.spawn()');
  assert.ok(validation >= 0 && spawn >= 0 && validation < spawn);
});

test('native process registry scopes run IDs by project', async () => {
  const runner = await readFile(new URL('../apps/desktop/src-tauri/src/process_runner.rs', import.meta.url), 'utf8');
  assert.match(runner, /fn registry_key\(project_id: &str, id: &str\)/);
  assert.match(runner, /run id already exists for this project/);
  assert.match(runner, /process_registry_rejects_duplicate_and_cross_project_runs/);
  assert.match(runner, /MAX_RETAINED_OUTPUT_BYTES/);
  assert.match(runner, /process_registry_bounds_reserved_output_memory/);
});

test('native process polling commits the job transition before consuming results', async () => {
  const runner = await readFile(new URL('../apps/desktop/src-tauri/src/process_runner.rs', import.meta.url), 'utf8');
  const lib = await readFile(new URL('../apps/desktop/src-tauri/src/lib.rs', import.meta.url), 'utf8');
  assert.match(runner, /pub fn peek\(&self, project_id: &str, id: &str\)/);
  assert.match(runner, /pub fn remove\(&self, project_id: &str, id: &str\)/);
  assert.match(lib, /runtime\.processes\.peek\(&project_id, &id\)/);
  assert.match(lib, /runtime\.jobs\.transition\(&project_id, &id, next, outcome\.error\.clone\(\)\)\?/);
  assert.match(lib, /runtime\.processes\.remove\(&project_id, &id\)\?/);
});

test('project switching validates the target before revoking the current session', async () => {
  const project = await readFile(new URL('../apps/desktop/src-tauri/src/native_project.rs', import.meta.url), 'utf8');
  const lib = await readFile(new URL('../apps/desktop/src-tauri/src/lib.rs', import.meta.url), 'utf8');
  assert.match(project, /pub fn validate_project\(root: &str\)/);
  assert.match(lib, /native_project::validate_project\(&root\)\?/);
  const openBody = lib.match(/fn open_project\([\s\S]*?\} pub fn run/)[0];
  assert.ok(openBody.indexOf('native_project::validate_project(&root)?') < openBody.indexOf('runtime.processes.cancel_and_remove_project(&project_id)?'));
});

test('native process execution requires a project-scoped working directory', async () => {
  const runner = await readFile(new URL('../apps/desktop/src-tauri/src/process_runner.rs', import.meta.url), 'utf8');
  const lib = await readFile(new URL('../apps/desktop/src-tauri/src/lib.rs', import.meta.url), 'utf8');
  assert.match(runner, /pub fn validate_request_in_project\(/);
  assert.match(runner, /working directory must be project-scoped/);
  assert.match(runner, /working directory escapes the project root/);
  assert.match(runner, /pub fn start_in_project\(/);
  assert.match(lib, /current_project_root/);
  assert.match(lib, /start_in_project\(/);
  assert.match(runner, /executable is outside approved project or tool directories/);
  assert.match(runner, /executable is unavailable/);
  assert.match(runner, /drive_root/);
});

test('generic native process runner rejects shell and interpreter executables', async () => {
  const runner = await readFile(new URL('../apps/desktop/src-tauri/src/process_runner.rs', import.meta.url), 'utf8');
  assert.match(runner, /shell and interpreter executables are not allowed/);
  assert.match(runner, /cmd\.exe/);
  assert.match(runner, /powershell\.exe/);
  assert.match(runner, /python3/);
});

test('native process request keeps cwd optional at the IPC boundary', async () => {
  const runner = await readFile(new URL('../apps/desktop/src-tauri/src/process_runner.rs', import.meta.url), 'utf8');
  assert.match(runner, /#\[serde\(default\)\]\s+pub cwd: Option<String>/);
  assert.match(runner, /#\[serde\(default = "default_timeout"\)\]/);
});

test('desktop job declarations preserve native project ownership metadata', async () => {
  const declarations = await readFile(new URL('../src/core/desktop-bridge.d.ts', import.meta.url), 'utf8');
  assert.match(declarations, /DesktopJobRecord = \{ project_id: string;/);
});

test('native project open constructs its grant before mutating session state', async () => {
  const source = await readFile(new URL('../apps/desktop/src-tauri/src/native_project.rs', import.meta.url), 'utf8');
  const openBody = source.match(/fn open_project_session\([\s\S]*?\} pub fn open_project/)[0];
  assert.match(openBody, /let grant = ProjectGrant::new/);
  assert.ok(openBody.indexOf('let grant = ProjectGrant::new') < openBody.indexOf('state.root.lock'));
  assert.match(openBody, /state\.grant\.lock[\s\S]*Some\(grant\)/);
});

test('native process jobs retain bounded arguments and timestamps', async () => {
  const job = await readFile(new URL('../apps/desktop/src-tauri/src/job.rs', import.meta.url), 'utf8');
  const lib = await readFile(new URL('../apps/desktop/src-tauri/src/lib.rs', import.meta.url), 'utf8');
  const declarations = await readFile(new URL('../src/core/desktop-bridge.d.ts', import.meta.url), 'utf8');
  assert.match(job, /pub arguments: Vec<String>/);
  assert.match(job, /pub created_at_ms: u64/);
  assert.match(job, /pub fn set_arguments/);
  assert.match(job, /pub inputs: Vec<String>/);
  assert.match(job, /pub outputs: Vec<String>/);
  assert.match(job, /pub resource_policy: JobResourcePolicy/);
  assert.match(job, /pub reproducibility: JobReproducibility/);
  assert.match(job, /pub fn record_process_result/);
  assert.match(lib, /runtime\.jobs\.set_arguments\(&project_id, &id, request\.args\.clone\(\)\)/);
  assert.match(lib, /runtime\.jobs\.set_resource_policy\(&project_id, &id/);
  assert.match(lib, /runtime\.jobs\.record_process_result\(&project_id, &id/);
  assert.match(job, /fn registry_key\(project_id: &str, id: &str\)/);
  assert.match(declarations, /arguments: string\[\]/);
  assert.match(declarations, /resource_policy:/);
});

test('native artifact storage is exposed only through project-scoped commands', async () => {
  const lib = await readFile(new URL('../apps/desktop/src-tauri/src/lib.rs', import.meta.url), 'utf8');
  const bridge = await readFile(new URL('../src/core/desktop-bridge.js', import.meta.url), 'utf8');
  const declarations = await readFile(new URL('../src/core/desktop-bridge.d.ts', import.meta.url), 'utf8');
  assert.match(lib, /fn store_artifact\(/);
  assert.match(lib, /Permission::ArtifactWrite/);
  assert.match(lib, /fn verify_artifact\(/);
  assert.match(lib, /Permission::ProjectRead/);
  assert.match(lib, /ArtifactCreated/);
  assert.match(bridge, /store_artifact/);
  assert.match(bridge, /verify_artifact/);
  assert.match(lib, /fn register_artifact\(/);
  assert.match(bridge, /register_artifact/);
  assert.match(lib, /fn register_generated_artifact\(/);
  assert.match(lib, /artifact_store::reference_existing/);
  assert.match(bridge, /register_generated_artifact/);
  assert.match(lib, /fn read_artifact\(/);
  assert.match(lib, /artifact_store::verify\(&root, &reference\)/);
  assert.match(bridge, /read_artifact/);
  assert.match(declarations, /DesktopArtifactReference/);
});

test('native generated artifacts are confined and idempotent', async () => {
  const artifacts = await readFile(new URL('../apps/desktop/src-tauri/src/artifact_store.rs', import.meta.url), 'utf8');
  const lib = await readFile(new URL('../apps/desktop/src-tauri/src/lib.rs', import.meta.url), 'utf8');
  assert.match(artifacts, /artifact path already contains different content/);
  assert.match(artifacts, /generated artifacts must be stored under runs\/ or build\//);
  assert.match(artifacts, /if target\.exists\(\)/);
  assert.match(lib, /generated artifacts must be stored under runs\/ or build\//);
  assert.match(lib, /normalized\.starts_with\("runs\/"\)/);
  assert.match(lib, /normalized\.starts_with\("build\/"\)/);
  assert.match(artifacts, /OpenOptions::new\(\)/);
  assert.match(artifacts, /create_new\(true\)/);
  assert.match(artifacts, /file\.sync_all\(\)/);
  assert.match(artifacts, /TEMP_COUNTER/);
  assert.match(artifacts, /fn sync_directory\(/);
});

test('native job registry rolls back mutations when event publication fails', async () => {
  const job = await readFile(new URL('../apps/desktop/src-tauri/src/job.rs', import.meta.url), 'utf8');
  assert.match(job, /jobs\.remove\(&key\)/);
  assert.match(job, /let previous = job\.clone\(\)/);
  assert.match(job, /\*job = previous/);
  assert.match(job, /fn pre_run_remove_is_project_scoped/);
});

test('native events carry project identity and drains require a matching read grant', async () => {
  const events = await readFile(new URL('../apps/desktop/src-tauri/src/events.rs', import.meta.url), 'utf8');
  const lib = await readFile(new URL('../apps/desktop/src-tauri/src/lib.rs', import.meta.url), 'utf8');
  const bridge = await readFile(new URL('../src/core/desktop-bridge.js', import.meta.url), 'utf8');
  assert.match(events, /JobQueued \{ project_id: String/);
  assert.match(events, /pub fn project_id\(&self\)/);
  assert.match(events, /pub fn validate\(&self\)/);
  assert.match(events, /MAX_EVENT_TEXT_BYTES/);
  assert.match(events, /event_publication_rejects_oversized_and_noncanonical_payloads/);
  assert.match(events, /pub fn take_project_events/);
  assert.match(events, /project_drain_retains_unmatched_events/);
  assert.match(lib, /fn drain_events\(project: tauri::State/);
  assert.match(lib, /Permission::ProjectRead/);
  assert.match(lib, /event\.project_id\(\) == project_id/);
  assert.match(lib, /pending_events/);
  assert.match(lib, /pending\.push_back\(event\)/);
  assert.match(bridge, /drain_events', \{ project_id \}/);
});

test('native runtime shutdown requests cancellation for all owned processes', async () => {
  const runner = await readFile(new URL('../apps/desktop/src-tauri/src/process_runner.rs', import.meta.url), 'utf8');
  const lib = await readFile(new URL('../apps/desktop/src-tauri/src/lib.rs', import.meta.url), 'utf8');
  assert.match(runner, /pub fn cancel_all\(&self\)/);
  assert.match(lib, /impl Drop for NativeRuntime/);
  assert.match(lib, /self\.processes\.cancel_all\(\)/);
});

test('desktop artifact bridge normalizes typed binary payloads for JSON IPC', async () => {
  const bridge = await readFile(new URL('../src/core/desktop-bridge.js', import.meta.url), 'utf8');
  assert.match(bridge, /bytes instanceof Uint8Array \? \[\.\.\.bytes\] : bytes/);
});

test('native artifact references use the published camelCase schema', async () => {
  const artifacts = await readFile(new URL('../apps/desktop/src-tauri/src/artifact_store.rs', import.meta.url), 'utf8');
  const declarations = await readFile(new URL('../src/core/desktop-bridge.d.ts', import.meta.url), 'utf8');
  assert.match(artifacts, /serde\(rename_all = "camelCase"\)/);
  assert.match(declarations, /DesktopArtifactReference = \{ path: string; sha256: string; size: number; mediaType: string/);
});

test('native engine discovery is read-only and absolute-path constrained', async () => {
  const source = await readFile(new URL('../apps/desktop/src-tauri/src/discovery.rs', import.meta.url), 'utf8');
  assert.match(source, /candidate\.is_file\(\)/);
  assert.match(source, /must be absolute/);
  assert.match(source, /approved_candidate_directory/);
  assert.match(source, /approved_candidate_path/);
  assert.match(source, /ParentDir/);
  assert.match(source, /canonicalize/);
  assert.match(source, /DetectionState::Invalid/);
  assert.match(source, /valid_candidate_shape/);
  assert.match(source, /drive_root/);
  assert.match(source, /program files \(x86\)/);
  assert.doesNotMatch(source, /Command::new|spawn\(|\binstall\b|\bdownload\b/i);
});

test('desktop workspace publishes explicit Tauri development and build commands', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../apps/desktop/package.json', import.meta.url), 'utf8'));
  const config = JSON.parse(await readFile(new URL('../apps/desktop/src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
  assert.equal(packageJson.scripts.dev, 'tauri dev');
  assert.equal(packageJson.scripts.build, 'tauri build');
  assert.equal(packageJson.scripts['build:unbundled'], 'tauri build --no-bundle --ci');
  assert.equal(packageJson.scripts['build:linux-bundles'], 'tauri build --bundles deb,appimage --ci');
  assert.equal(config.app.windows[0].dataDirectory, 'webview-data');
});

test('desktop check reports missing native prerequisites instead of claiming a build', async () => {
  const rootPackage = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const source = await readFile(new URL('../scripts/desktop-check.mjs', import.meta.url), 'utf8');
  assert.equal(rootPackage.scripts['desktop:check'], 'node scripts/desktop-check.mjs');
  assert.equal(rootPackage.scripts['desktop:installer'], 'node scripts/desktop-check.mjs --installer');
  assert.match(source, /cargo/);
  assert.match(source, /rustc/);
  assert.match(source, /NOT VERIFIED/);
  assert.match(source, /build:unbundled/);
  assert.match(source, /build:installer/);
  assert.doesNotMatch(source, /shell:\s*true/);
});

test('native project commands expose a project-bound validated manifest session', async () => {
  const source = await readFile(new URL('../apps/desktop/src-tauri/src/native_project.rs', import.meta.url), 'utf8');
  const lib = await readFile(new URL('../apps/desktop/src-tauri/src/lib.rs', import.meta.url), 'utf8');
  const discovery = await readFile(new URL('../apps/desktop/src-tauri/src/discovery.rs', import.meta.url), 'utf8');
  assert.match(source, /canonical_project_root/);
  assert.match(source, /read_bounded/);
  assert.match(source, /write_atomic/);
  assert.match(source, /validate_manifest/);
  assert.match(source, /project circuit signal is invalid/);
  assert.match(source, /project embedded source is invalid/);
  assert.match(source, /project circuit \{field\} are invalid/);
  assert.match(source, /ProjectRead/);
  assert.match(source, /ProjectWrite/);
  assert.match(source, /require_session\(state, Permission::ProjectRead\)/);
  assert.match(source, /require_session\(state, Permission::ProjectWrite\)/);
  assert.match(source, /native_project_session_round_trips_on_the_real_filesystem/);
  assert.match(source, /no project is open/);
  assert.match(source, /open_project/);
  assert.match(source, /save_open_project/);
  assert.match(source, /close_project/);
  assert.match(source, /grant_process_execution/);
  assert.match(source, /grant_artifact_write/);
  assert.match(source, /acknowledge/);
  assert.match(lib, /manage\(native_project::ProjectSession::default\(\)\)/);
  assert.match(lib, /native_project::open_project/);
  assert.match(lib, /fn detect_engines/);
  assert.match(lib, /detect_engines/);
  assert.match(lib, /fn enqueue_job/);
  assert.match(lib, /fn get_job/);
  assert.match(lib, /fn transition_job/);
  assert.match(lib, /enqueue_job,/);
  assert.match(lib, /get_job,/);
  assert.match(lib, /transition_job,/);
  assert.match(lib, /native_project::grant_process_execution/);
  assert.match(lib, /revoke_process_execution/);
  assert.match(lib, /fn revoke_process_execution\([\s\S]*?Permission::ProjectRead\)[\s\S]*?cancel_project/);
  assert.match(lib, /fn revoke_artifact_write\([\s\S]*?Permission::ProjectRead\)[\s\S]*?revoke_project_permission/);
  assert.match(discovery, /too many engine candidates/);
});

test('native manifest reads and writes use the published 10 MiB project limit', async () => {
  const project = await readFile(new URL('../apps/desktop/src-tauri/src/native_project.rs', import.meta.url), 'utf8');
  const fsSource = await readFile(new URL('../apps/desktop/src-tauri/src/project_fs.rs', import.meta.url), 'utf8');
  assert.match(project, /MAX_MANIFEST_BYTES: u64 = 10 \* 1024 \* 1024/);
  assert.match(project, /read_bounded_limit\(&root, MANIFEST_PATH, MAX_MANIFEST_BYTES\)/);
  assert.match(project, /bytes\.len\(\) as u64 > MAX_MANIFEST_BYTES/);
  assert.match(fsSource, /pub fn read_bounded_limit/);
  assert.match(fsSource, /OpenOptions::new\(\)/);
  assert.match(fsSource, /create_new\(true\)/);
  assert.match(fsSource, /file\.sync_all\(\)/);
  assert.match(fsSource, /TEMP_COUNTER/);
  assert.match(fsSource, /fn sync_directory\(/);
});

test('frontend desktop bridge fails honestly when Tauri is absent and maps only approved commands', async () => {
  const source = await readFile(new URL('../src/core/desktop-bridge.js', import.meta.url), 'utf8');
  assert.match(source, /DESKTOP_UNAVAILABLE/);
  assert.match(source, /globalThis\.__TAURI__\?\.core\?\.invoke/);
  assert.match(source, /open_project/);
  assert.match(source, /read_open_project/);
  assert.match(source, /save_open_project/);
  assert.match(source, /close_project/);
  assert.match(source, /enqueue_job/);
  assert.match(source, /get_job/);
  assert.match(source, /list_jobs/);
  assert.match(source, /transition_job/);
  assert.match(source, /drain_events/);
  assert.match(source, /grant_process_execution/);
  assert.match(source, /grant_artifact_write/);
  assert.match(source, /revoke_process_execution/);
  assert.match(source, /revoke_artifact_write/);
  assert.match(source, /start_process/);
  assert.match(source, /cancel_process/);
  assert.match(source, /poll_process/);
  assert.doesNotMatch(source, /eval\(|new Function|shell\s*\(/i);
});

test('desktop bridge preserves unavailable state and forwards explicit argument objects', async () => {
  const preview = createDesktopBridge(undefined);
  assert.equal(preview.available, false);
  await assert.rejects(preview.readOpenProject(), (error) => error.code === DESKTOP_UNAVAILABLE_CODE);
  const calls = [];
  const desktop = createDesktopBridge(async (command, args) => { calls.push({ command, args }); return { name: 'demo', version: 1, root: 'C:/demo' }; });
  assert.equal(desktop.available, true);
  await desktop.openProject('C:/demo');
  await desktop.detectEngines([{ id: 'ngspice', candidates: ['C:/tools/ngspice.exe'] }]);
  await desktop.saveOpenProject({ format: 'openentc-project' });
  await desktop.enqueueJob({ project_id: 'project-1', id: 'j1', operation: 'check', adapter: 'fake' });
  await desktop.getJob('project-1', 'j1');
  await desktop.listJobs('project-1');
  await desktop.transitionJob('project-1', 'j1', 'preparing');
  await desktop.drainEvents('project-1');
  await desktop.storeArtifact('project-1', 'runs/result.bin', new Uint8Array([1, 2]), 'application/octet-stream');
  await desktop.verifyArtifact('project-1', { path: 'runs/result.bin', sha256: 'a'.repeat(64), size: 2, mediaType: 'application/octet-stream' });
  await desktop.registerArtifact('project-1', { path: 'runs/result.bin', sha256: 'a'.repeat(64), size: 2, mediaType: 'application/octet-stream' });
  await desktop.registerGeneratedArtifact('project-1', 'runs/netlist.json', 'application/json');
  await desktop.readArtifact('project-1', { path: 'runs/result.bin', sha256: 'a'.repeat(64), size: 2, mediaType: 'application/octet-stream' }, 1024);
  await desktop.grantProcessExecution('project-1', true);
  await desktop.grantArtifactWrite('project-1', true);
  await desktop.grantDeviceTarget('project-1', 'device-programmer', 'COM4', true);
  await desktop.revokeDeviceTarget('project-1', 'device-programmer', 'COM4');
  await desktop.revokeProcessExecution('project-1');
  await desktop.revokeArtifactWrite('project-1');
  await desktop.startProcess('project-1', 'run-1', { executable: 'C:/tool.exe', args: [] });
  await desktop.startDeviceProcess('project-1', 'upload-1', 'device-programmer', 'COM4', { executable: 'C:/tool.exe', args: ['upload'] });
  await desktop.cancelProcess('project-1', 'run-1');
  await desktop.pollProcess('project-1', 'run-1');
  await desktop.startSerial('project-1', 'serial-1', 'COM4', 115200, 65536);
  await desktop.pollSerial('project-1', 'serial-1', 8192);
  await desktop.writeSerial('project-1', 'serial-1', new Uint8Array([65, 10]));
  await desktop.closeSerial('project-1', 'serial-1');
  assert.deepEqual(calls, [
    { command: 'open_project', args: { root: 'C:/demo' } },
    { command: 'detect_engines', args: { probes: [{ id: 'ngspice', candidates: ['C:/tools/ngspice.exe'] }] } },
    { command: 'save_open_project', args: { manifest: { format: 'openentc-project' } } },
    { command: 'enqueue_job', args: { request: { project_id: 'project-1', id: 'j1', operation: 'check', adapter: 'fake' } } },
    { command: 'get_job', args: { project_id: 'project-1', id: 'j1' } },
    { command: 'list_jobs', args: { project_id: 'project-1' } },
    { command: 'transition_job', args: { project_id: 'project-1', id: 'j1', next: 'preparing', error: undefined } },
    { command: 'drain_events', args: { project_id: 'project-1' } },
    { command: 'store_artifact', args: { project_id: 'project-1', path: 'runs/result.bin', bytes: [1, 2], media_type: 'application/octet-stream' } },
    { command: 'verify_artifact', args: { project_id: 'project-1', reference: { path: 'runs/result.bin', sha256: 'a'.repeat(64), size: 2, mediaType: 'application/octet-stream' } } },
    { command: 'register_artifact', args: { project_id: 'project-1', reference: { path: 'runs/result.bin', sha256: 'a'.repeat(64), size: 2, mediaType: 'application/octet-stream' } } },
    { command: 'register_generated_artifact', args: { project_id: 'project-1', path: 'runs/netlist.json', media_type: 'application/json' } },
    { command: 'read_artifact', args: { project_id: 'project-1', reference: { path: 'runs/result.bin', sha256: 'a'.repeat(64), size: 2, mediaType: 'application/octet-stream' }, max_bytes: 1024 } },
    { command: 'grant_process_execution', args: { requested_project_id: 'project-1', acknowledge: true } },
    { command: 'grant_artifact_write', args: { requested_project_id: 'project-1', acknowledge: true } },
    { command: 'grant_device_target', args: { requested_project_id: 'project-1', permission: 'device-programmer', target: 'COM4', acknowledge: true } },
    { command: 'revoke_device_target', args: { requested_project_id: 'project-1', permission: 'device-programmer', target: 'COM4' } },
    { command: 'revoke_process_execution', args: { project_id: 'project-1' } },
    { command: 'revoke_artifact_write', args: { project_id: 'project-1' } },
    { command: 'start_process', args: { project_id: 'project-1', id: 'run-1', request: { executable: 'C:/tool.exe', args: [] } } },
    { command: 'start_device_process', args: { project_id: 'project-1', id: 'upload-1', permission: 'device-programmer', target: 'COM4', request: { executable: 'C:/tool.exe', args: ['upload'] } } },
    { command: 'cancel_process', args: { project_id: 'project-1', id: 'run-1' } },
    { command: 'poll_process', args: { project_id: 'project-1', id: 'run-1' } },
    { command: 'start_serial', args: { project_id: 'project-1', id: 'serial-1', target: 'COM4', baud: 115200, max_buffer_bytes: 65536 } },
    { command: 'poll_serial', args: { project_id: 'project-1', id: 'serial-1', max_bytes: 8192 } },
    { command: 'write_serial', args: { project_id: 'project-1', id: 'serial-1', bytes: [65, 10] } },
    { command: 'close_serial', args: { project_id: 'project-1', id: 'serial-1' } }
  ]);
});

test('native serial transport is target-authorized, bounded and closed with project lifecycle', async () => {
  const lib = await readFile(new URL('../apps/desktop/src-tauri/src/lib.rs', import.meta.url), 'utf8');
  const transport = await readFile(new URL('../apps/desktop/src-tauri/src/serial_transport.rs', import.meta.url), 'utf8');
  assert.match(lib, /fn start_serial[\s\S]*Permission::DeviceSerial/);
  assert.match(lib, /fn write_serial[\s\S]*require_device_target/);
  assert.match(lib, /runtime\.serials\.close_project\(&project_id\)/);
  assert.match(lib, /Permission::DeviceSerial[\s\S]*close_target/);
  assert.doesNotMatch(transport, /available_ports/);
  assert.match(transport, /MAX_BUFFER_BYTES: usize = 1024 \* 1024/);
  assert.match(transport, /MAX_WRITE_BYTES: usize = 16 \* 1024/);
  assert.match(transport, /Duration::from_millis\(25\)/);
});

test('top-level project actions use the optional desktop bridge and preserve browser denial', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(source, /data-action="desktop-open"/);
  assert.match(source, /data-action="desktop-save"/);
  assert.match(source, /desktopBridge\.available/);
  assert.match(source, /desktopBridge\.openProject/);
  assert.match(source, /desktopBridge\.saveOpenProject/);
  assert.match(source, /Desktop project access is unavailable in the browser preview/);
});

test('toolchain workspace refreshes only through the read-only desktop detection bridge', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  const registry = await readFile(new URL('../src/core/engine-registry.js', import.meta.url), 'utf8');
  assert.match(source, /data-action="refresh-detection"/);
  assert.match(source, /refreshEngineDetection/);
  assert.match(source, /desktopBridge\.detectEngines/);
  assert.match(source, /toolchainDetection/);
  assert.match(registry, /candidates:/);
});

test('project job monitor drains scoped events before rendering lifecycle records', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  const store = await readFile(new URL('../src/core/store.js', import.meta.url), 'utf8');
  assert.match(source, /desktopBridge\.drainEvents\(project\.project_id\)/);
  assert.match(source, /desktopEvents/);
  assert.match(source, /RECENT NATIVE EVENTS/);
  assert.match(source, /event\.data \|\| \{\}/);
  assert.ok(source.indexOf('desktopBridge.listJobs(project.project_id)') < source.indexOf('desktopBridge.drainEvents(project.project_id)'));
  assert.match(source, /data-action="cancel-job"/);
  assert.match(source, /desktopBridge\.cancelProcess\(project\.project_id, id\)/);
  assert.match(source, /desktopBridge\.pollProcess\(project\.project_id, id\)/);
  assert.match(source, /attempt < 20/);
  assert.match(source, /operation === 'process'/);
  assert.match(source, /job\.error/);
  assert.match(source, /job-table" role="list" aria-label="Native lifecycle jobs/);
  assert.match(source, /native-events-heading/);
  assert.match(source, /role="listitem"/);
  assert.match(store, /desktopEvents: \[\]/);
});
