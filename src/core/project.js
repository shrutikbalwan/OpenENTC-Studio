// @ts-check

// Browser-safe facade over the canonical project-model package.
// Filesystem persistence remains in packages/project-model/src/index.mjs.
import {
  PROJECT_FORMAT,
  PROJECT_VERSION,
  MAX_PROJECT_BYTES,
  createProject,
  validateProject,
  migrateProject as migrateProjectRaw,
  serializeProject,
  exportProject,
  importProject,
  registerArtifactManifest,
  MAX_EXPERIMENT_DEFINITION_BYTES,
  MAX_EXPERIMENT_DEFINITIONS,
  upsertExperiment
} from '../../packages/project-model/src/browser.mjs';

export { PROJECT_FORMAT, PROJECT_VERSION, MAX_PROJECT_BYTES, createProject, validateProject, serializeProject, exportProject, importProject, registerArtifactManifest, MAX_EXPERIMENT_DEFINITION_BYTES, MAX_EXPERIMENT_DEFINITIONS, upsertExperiment };

/**
 * Browser callers receive the same registry defaults as the validated model,
 * including projects imported from pre-registry manifests.
 */
/** @param {unknown} input */
export function migrateProject(input) {
  const value = migrateProjectRaw(input);
  for (const field of ['documents', 'targets', 'toolchainConstraints', 'experiments']) {
    if (value[field] === undefined) value[field] = [];
  }
  return value;
}
