export interface Provider { label: string; baseUrl: string; model: string; needsKey: boolean }
export declare const PROVIDERS: Readonly<Record<string, Provider>>;
export declare const MODES: Readonly<Record<string, string>>;
export declare const LANGUAGES: Readonly<Record<string, string>>;
export declare function validateBaseUrl(text: string): string;
export declare const TOOL_DEFINITIONS: readonly { name: string; description: string; parameters: Record<string, unknown> }[];
export interface ToolContext { lab?: () => unknown; labName?: string; lessons?: { title: string; summary: string[]; formulas: string[]; lab?: { label: string } }[]; viva?: [string, string][] }
export declare function executeTool(name: string, args: Record<string, any>, context?: ToolContext): string;
export declare function systemPrompt(options?: { mode?: string; language?: string; labName?: string }): string;
export interface Settings { provider: string; baseUrl?: string; model?: string; apiKey?: string; mode?: string; language?: string }
export interface ChatMessage { role: 'user' | 'assistant' | 'tool' | 'system'; content: string | null; tool_calls?: unknown[]; tool_call_id?: string }
export declare function chat(options: { settings: Settings; messages: ChatMessage[]; context?: ToolContext; fetchImpl?: typeof fetch; maxSteps?: number; timeoutMs?: number; signal?: AbortSignal | null }): Promise<{ reply: string; messages: ChatMessage[]; trace: { tool: string; args: Record<string, any>; output: string }[] }>;
