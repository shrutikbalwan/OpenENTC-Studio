export interface ComplexValue { real: number; imaginary: number; }
export interface SParameterPoint { frequency: number; values: readonly ComplexValue[]; }
export interface SParameterResult { kind: 's-parameters'; ports: number; frequencyUnit: string; format: 'RI' | 'MA' | 'DB'; referenceImpedance: number; points: readonly SParameterPoint[]; }
export declare function parseTouchstone(text: string, options?: { ports?: number }): SParameterResult;
export interface MatrixParameterPoint { frequency: number; values: readonly ComplexValue[]; }
export interface MatrixParameterResult { kind: 'z-parameters' | 'y-parameters' | 'abcd-parameters'; ports: 2; referenceImpedance: number; points: readonly MatrixParameterPoint[]; }
export declare function convertSParameters(result: SParameterResult, mode: 'Z' | 'Y' | 'ABCD'): MatrixParameterResult;
export declare function cascadeAbcd(first: MatrixParameterResult, second: MatrixParameterResult): MatrixParameterResult;
export declare function reflectionCoefficient(impedance: ComplexValue, referenceImpedance?: number): ComplexValue;
