import { ProjectFormatError } from '../../errors/src/index.mjs';

// Project-format failures. ProjectError keeps its historical name, `code` values and `details`
// object, and is a ProjectFormatError, so it also carries a recovery hint and redacted context.
export class ProjectError extends ProjectFormatError {
  constructor(code, message, details = {}) {
    super(message, { code, context: details });
    this.name = 'ProjectError';
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
