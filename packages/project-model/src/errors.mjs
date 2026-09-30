export class ProjectError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProjectError';
    this.code = code;
    this.details = details;
  }
}

export const PROJECT_ERROR_CODES = Object.freeze({
  INVALID_JSON: 'PROJECT_INVALID_JSON',
  INVALID_SHAPE: 'PROJECT_INVALID_SHAPE',
  UNSUPPORTED_VERSION: 'PROJECT_UNSUPPORTED_VERSION',
  TOO_LARGE: 'PROJECT_TOO_LARGE',
  PATH_ESCAPE: 'PROJECT_PATH_ESCAPE',
  MIGRATION_FAILED: 'PROJECT_MIGRATION_FAILED'
});
