export interface AssistantSettings { provider: string; baseUrl: string; model: string; mode: string; language: string; shareLab: boolean; consented: boolean; rememberKey: boolean }
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export declare const SETTINGS_KEY: string;
export declare const SESSION_KEY: string;
export declare const ASSISTANT_DEFAULTS: Readonly<AssistantSettings>;
export declare function loadAssistantSettings(local: StorageLike, session?: StorageLike | null): { settings: AssistantSettings; apiKey: string; removedLegacyKey: boolean };
export declare function saveAssistantSettings(local: StorageLike, session: StorageLike | null, patch: Partial<AssistantSettings> & { apiKey?: string }): { settings: AssistantSettings; apiKey: string };
export declare function forgetApiKey(session?: StorageLike | null): void;
export declare function redactSecrets(text: string, secrets?: string[]): string;
export declare function resetCredentialMemory(): void;
