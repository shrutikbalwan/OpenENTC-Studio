// @ts-check

import { createProject, validateProject } from './project.js';
import { discardBackup, inspectBackups, loadStoredProject, readBackup, restoreBackup, saveStoredProject } from './project-storage.js';
import { createHistory } from '../../packages/project-model/src/history.mjs';
import { upsertExperiment } from '../../packages/project-model/src/experiments.mjs';
import { loadLearningProgress, recordLessonAttempt, saveLearningProgress } from './learning-progress.js';

/** @typedef {import('./store.d.ts').AppState} AppState */
/** @typedef {import('./store.d.ts').StatePatch} StatePatch */
/** @typedef {import('../../packages/project-model/src/types.d.ts').OpenEntcProject} OpenEntcProject */

const storageKey = 'openentc-studio-project-v1';
/** @type {Set<(state: AppState) => void>} */
const listeners = new Set();
let initialStoragePresent = false;
try { initialStoragePresent = Boolean(localStorage.getItem(storageKey)); } catch { /* loadStoredProject reports the visible persistence error */ }
const initialLoad = loadStoredProject(localStorage, storageKey);
const initialProject = loadProject();
let projectHistory = createHistory(initialProject);
/** @type {AppState} */
let state = {
  activeModule: 'home', selectedComponentId: null, selectedComponentIds: [], canvasView: { x: 0, y: 0, scale: 1 }, bottomPanel: 'console',
  project: initialProject, simulation: null, ngspiceView: null, digitalView: null, arduinoInventory: null, arduinoDeviceGrant: null, arduinoSerialGrant: null, arduinoSerial: null, arduinoUpload: null, hdlJob: null, hdlResults: null, lessonEvaluation: null, learningProgress: loadLearningProgress(localStorage), desktopProject: null, desktopJobs: [], desktopEvents: [], processPermissionGranted: false, artifactPermissionGranted: false, toast: null,
  persistence: { status: initialLoad.error ? 'error' : initialLoad.migrated || initialLoad.recovered ? 'recovered' : initialStoragePresent ? 'saved' : 'unsaved', error: initialLoad.error || null }
};

function loadProject() {
  return initialLoad.project?.name === 'Untitled ENTC project' && !initialStoragePresent ? createProject('My first ENTC lab') : initialLoad.project;
}

export function getState() { return state; }
export function canUndoProject() { return projectHistory.canUndo; }
export function canRedoProject() { return projectHistory.canRedo; }

/** @param {StatePatch} patch */
export function setState(patch) {
  const nextPatch = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...nextPatch };
  try {
    saveStoredProject(localStorage, storageKey, state.project);
    state = { ...state, persistence: { status: 'saved', error: null } };
  } catch (error) {
    state = { ...state, persistence: { status: 'error', error: error instanceof Error && error.message ? error.message : 'Project could not be saved.' } };
  }
  if (Object.prototype.hasOwnProperty.call(nextPatch, 'learningProgress')) { try { saveLearningProgress(localStorage, state.learningProgress); } catch { /* progress corruption must not crash the editor */ } }
  listeners.forEach((listener) => listener(state));
}

/** @param {(project: OpenEntcProject) => void} updater */
export function updateProject(updater) {
  const project = structuredClone(state.project);
  updater(project);
  project.updatedAt = new Date().toISOString();
  projectHistory.commit(project);
  setState({ project });
}

/** @param {OpenEntcProject} [project] */
export function saveProject(project = state.project) {
  const validated = validateProject(project);
  try {
    const saved = saveStoredProject(localStorage, storageKey, validated);
    state = { ...state, project: saved, persistence: { status: 'saved', error: null } };
    listeners.forEach((listener) => listener(state));
    return saved;
  } catch (error) {
    state = { ...state, persistence: { status: 'error', error: error instanceof Error && error.message ? error.message : 'Project could not be saved.' } };
    listeners.forEach((listener) => listener(state));
    throw error;
  }
}

/** Persist authored experiment configuration without copying generated run data into the manifest. */
/** @param {Record<string, unknown>} definition */
export function recordExperiment(definition) {
  updateProject((project) => {
    project.experiments = upsertExperiment(project.experiments, definition);
  });
}

export function undoProject() {
  if (!projectHistory.canUndo) return false;
  projectHistory.undo();
  setState({ project: projectHistory.value, simulation: null, selectedComponentId: null, selectedComponentIds: [] });
  return true;
}

export function redoProject() {
  if (!projectHistory.canRedo) return false;
  projectHistory.redo();
  setState({ project: projectHistory.value, simulation: null, selectedComponentId: null, selectedComponentIds: [] });
  return true;
}

/** @param {(state: AppState) => void} listener */
export function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }

/**
 * @param {string} message
 * @param {string} [tone]
 */
export function notify(message, tone = 'info') {
  setState({ toast: { message, tone, id: Date.now() } });
  setTimeout(() => { if (state.toast?.message === message) setState({ toast: null }); }, 2600);
}

/**
 * @param {string} id
 * @param {boolean} passed
 */
export function recordLearningAttempt(id, passed) {
  const learningProgress = recordLessonAttempt(state.learningProgress, id, passed);
  setState({ learningProgress });
  return learningProgress;
}

/** @param {OpenEntcProject} project */
export function replaceProject(project) {
  const validated = validateProject(project);
  projectHistory.commit(validated);
  setState({ project: validated, simulation: null, ngspiceView: null, digitalView: null, arduinoInventory: null, arduinoDeviceGrant: null, arduinoSerialGrant: null, arduinoSerial: null, arduinoUpload: null, hdlJob: null, hdlResults: null, selectedComponentId: null, selectedComponentIds: [], desktopProject: null, desktopJobs: [], desktopEvents: [], processPermissionGranted: false, artifactPermissionGranted: false });
}

/** Refresh the currently open desktop manifest without closing its native session. */
/** @param {OpenEntcProject} project */
export function synchronizeOpenProject(project) {
  const validated = validateProject(project);
  projectHistory.commit(validated);
  setState({ project: validated });
  return validated;
}

/** Backups of the browser project (migration, corrupt and interrupted-write copies). */
export function projectBackups() {
  try { return inspectBackups(localStorage, storageKey); } catch { return []; }
}
/** @param {'migration' | 'corrupt' | 'interrupted-write'} kind */
export function readProjectBackup(kind) { return readBackup(localStorage, storageKey, kind); }
/**
 * Open a backup as the current project. The project it replaces stays in undo history.
 * @param {'migration' | 'corrupt' | 'interrupted-write'} kind
 */
export function restoreProjectBackup(kind) {
  const project = restoreBackup(localStorage, storageKey, kind);
  replaceProject(project);
  return project;
}
/** @param {'migration' | 'corrupt' | 'interrupted-write'} kind */
export function discardProjectBackup(kind) { discardBackup(localStorage, storageKey, kind); }
