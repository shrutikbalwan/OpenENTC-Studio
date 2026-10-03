export interface ErrorLocation { file?: string; line?: number; column?: number; component?: string }
export interface ErrorOptions { location?: ErrorLocation; recovery?: string; context?: Record<string, unknown>; cause?: unknown }
export interface ErrorFields { readonly code: string; readonly location?: ErrorLocation; readonly recovery?: string; readonly context?: Record<string, unknown> }

export declare function redactText(text: unknown, secrets?: string[]): string;
export declare function redactDiagnostic(value: unknown, options?: { secrets?: string[]; depth?: number; maxString?: number }): unknown;

export declare class OpenEntcError extends Error implements ErrorFields {
  constructor(code: string, message: string, options?: ErrorOptions);
  readonly code: string;
  readonly location?: ErrorLocation;
  readonly recovery?: string;
  readonly context?: Record<string, unknown>;
}

type KindConstructor<Base extends Error> = new (message: string, options?: ErrorOptions & { code?: string }) => Base & ErrorFields;
export declare const ValidationError: KindConstructor<RangeError>;
export declare const ProjectFormatError: KindConstructor<Error>;
export declare const NumericalError: KindConstructor<Error>;
export declare const ConvergenceError: KindConstructor<Error>;
export declare const PermissionError: KindConstructor<Error>;
export declare const NativeToolError: KindConstructor<Error>;
export declare const TimeoutError: KindConstructor<RangeError>;
export declare const StorageError: KindConstructor<Error>;

export interface UserFacingError { code: string; message: string; recovery?: string; location?: ErrorLocation }
export declare function toUserFacing(error: unknown, options?: { secrets?: string[]; fallback?: string }): UserFacingError;
