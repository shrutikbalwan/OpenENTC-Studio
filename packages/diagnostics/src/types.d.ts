export type DiagnosticSeverity = 'info' | 'warning' | 'error';
export interface Diagnostic {
  readonly severity: DiagnosticSeverity;
  readonly code: string;
  readonly message: string;
  readonly source: string | null;
  readonly line: number | null;
  readonly column: number | null;
  readonly fix: string | null;
}
export declare const MAX_DIAGNOSTIC_CODE_LENGTH: number;
export declare const MAX_DIAGNOSTIC_MESSAGE_LENGTH: number;
export declare const MAX_DIAGNOSTIC_LOCATION_LENGTH: number;
export declare function createDiagnostic(input: Partial<Diagnostic> & Pick<Diagnostic, 'code' | 'message'>): Diagnostic;
export declare function diagnosticFromError(error: unknown, fallbackCode?: string): Diagnostic;
