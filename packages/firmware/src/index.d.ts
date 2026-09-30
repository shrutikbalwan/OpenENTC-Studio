export interface FirmwareDiagnostic { severity: 'error' | 'warning'; code: string; message: string; line: number; column: number; }
export interface FirmwareStructureReport { kind: 'firmware-structure-report'; diagnostics: readonly FirmwareDiagnostic[]; }
export declare function analyzeSketchSource(source: string): FirmwareStructureReport;
