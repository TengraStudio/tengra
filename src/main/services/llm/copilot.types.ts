import { Message, ToolDefinition } from '@shared/types/chat';
import { JsonObject, JsonValue } from '@shared/types/common';

// Version constants
export const COPILOT_USER_AGENT = 'GithubCopilot/1.250.0';
export const COPILOT_API_VERSION = '2023-07-07';
export const COPILOT_EDITOR_PLUGIN_VERSION = 'copilot/1.250.0';
export const COPILOT_FALLBACK_VSCODE_VERSION = '1.107';

// Default LLM parameter constants
export const COPILOT_DEFAULT_MAX_TOKENS = 4096;
export const COPILOT_DEFAULT_TEMPERATURE = 0.7;

// GitHub Copilot API URL constants
export const GITHUB_API_BASE_URL = 'https://api.github.com';
export const GITHUB_RATE_LIMIT_URL = `${GITHUB_API_BASE_URL}/rate_limit`;
export const GITHUB_COPILOT_USER_URL = `${GITHUB_API_BASE_URL}/copilot_internal/user`;
export const GITHUB_COPILOT_V2_TOKEN_URL = `${GITHUB_API_BASE_URL}/copilot_internal/v2/token`;
export const GITHUB_COPILOT_V1_TOKEN_URL = `${GITHUB_API_BASE_URL}/copilot_internal/token`;
export const COPILOT_GATEWAY_INDIVIDUAL = 'https://api.individual.githubcopilot.com';
export const COPILOT_GATEWAY_DEFAULT = 'https://api.githubcopilot.com';
export const COPILOT_GATEWAY_BUSINESS = 'https://api.business.githubcopilot.com';

export interface CopilotTokenResponse {
    token: string;
    expires_at?: number;
}

export interface CopilotUsageData {
    copilot_plan?: 'individual' | 'business' | 'enterprise';
}

export interface CopilotToolFunction {
    name: string;
    description?: string;
    parameters: JsonObject;
}

export interface CopilotTool {
    type: 'function';
    function: CopilotToolFunction;
}

export interface CopilotPayload {
    model: string;
    messages?: Message[];
    prompt?: string;
    input?: string;
    stream: boolean;
    temperature?: number;
    max_tokens?: number;
    stop?: string[];
    tools?: CopilotTool[];
    tool_choice?: 'auto' | 'none' | 'required';
    stream_options?: {
        include_usage: boolean;
    };
}

export interface CopilotChatResponse {
    choices: Array<{
        message: Message;
        text?: string;
    }>;
    type?: string;
    content?: string | Array<{ type: string; text?: string }>;
    output_text?: string;
}

export interface DiagnosticOutputItem {
    type?: string;
    id?: string;
    name?: string;
    arguments?: string;
    text?: string;
    content?: string;
}

export interface DiagnosticResponseData {
    output?: (string | DiagnosticOutputItem)[];
    output_text?: string;
    text?: string;
}

export interface DiagnosticResponse {
    response?: DiagnosticResponseData;
    output?: (string | DiagnosticOutputItem)[];
    output_text?: string;
    text?: string;
}

export type CopilotAccountType = 'individual' | 'business' | 'enterprise';

/** Notification service interface used by Copilot modules */
export interface CopilotNotificationService {
    showNotification: (t: string, b: string, silent?: boolean) => void;
}

/** Shared mutable state for the Copilot service modules */
export interface CopilotState {
    githubToken: string | null;
    copilotAuthToken: string | null;
    copilotSessionToken: string | null;
    tokenExpiresAt: number;
    vsCodeVersion: string;
    accountType: CopilotAccountType;
    tokenPromise: Promise<string> | null;
    rateLimitInterval: NodeJS.Timeout | null;
    hasNotifiedExhaustion: boolean;
    hasNotifiedLowRemaining: boolean;
    remainingCalls: number;
    requestQueue: Promise<void>;
    pendingQueueSize: number;
    modelsCache: { data: JsonValue[] } | null;
    modelsCacheExpiry: number;
    lastApiCall: number;
}

/** Gateway request options */
export interface GatewayRequestOptions {
    gateway: string;
    endpoint: string;
    finalModel: string;
    prompt: string;
    headers: Record<string, string>;
    chatPayload: CopilotPayload;
    completionPayload: CopilotPayload;
    stream: boolean;
    tools?: ToolDefinition[];
}
