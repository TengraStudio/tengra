import { JsonValue } from '@/types/common';

export type AppSettings = {
    ollama: {
        url: string;
        numCtx?: number;
        orchestrationPolicy?: 'auto' | 'fifo' | 'parallel';
    };
    embeddings: {
        provider: 'ollama' | 'openai' | 'llama' | 'none';
        model?: string;
    };
    autoUpdate?: {
        enabled: boolean;
        checkOnStartup: boolean;
        downloadAutomatically: boolean;
        notifyOnly: boolean;
    };
    images?: {
        provider:
            | 'antigravity'
            | 'ollama'
            | 'sd-webui'
            | 'comfyui'
            | 'pollinations'
            | 'sd-cpp';
        ollamaModel?: string;
        sdWebUIUrl?: string;
        comfyUIUrl?: string;
        sdCppBinaryPath?: string;
        sdCppModelPath?: string;
        sdCppExtraArgs?: string;
    };
    activeAccountId?: string;
    crashReporting?: {
        enabled: boolean;
    };
    general: {
        language: 'tr' | 'en' | 'de' | 'fr' | 'es' | 'ja' | 'zh' | 'ar';
        theme: string;
        resolution: string;
        fontSize: number;
        fontFamily?: string;
        highContrast?: boolean;
        reduceMotion?: boolean;
        onboardingCompleted: boolean;
        defaultModel?: string;
        defaultTerminalBackend?: string;
        lastModel?: string;
        lastProvider?: string;
        responseStyle?: 'concise' | 'balanced' | 'detailed';
        responseTone?: 'neutral' | 'friendly' | 'professional';
        responseFormat?: 'auto' | 'structured' | 'steps';
        customInstructions?: string;
        contextMessageLimit?: number;
        agentMode?: 'adaptive' | 'speed' | 'accuracy';
        agentSoftDeadlineMs?: number;
        agentHardDeadlineMs?: number;
        agentRequireLocalForActions?: boolean;
        agentAllowLateSuggestions?: boolean;
        favoriteModels?: string[];
        recentModels?: string[];
        hiddenModels?: string[];
    };
    github?: {
        username?: string;
        token?: string;
    };
    openai?: {
        apiKey: string;
        accessToken?: string; // For web session auth
        email?: string;
        model: string;
    };
    claude?: {
        apiKey: string;
        model: string;
    };
    anthropic?: {
        apiKey: string;
        model: string;
    };

    groq?: {
        apiKey: string;
        model: string;
    };
    nvidia?: {
        apiKey: string;
        model: string;
    };
    huggingface?: {
        apiKey: string;
    };
    antigravity?: {
        connected: boolean;
        token?: string;
    };
    codex?: {
        connected: boolean;
    };
    copilot?: {
        connected: boolean;
        token?: string;
    };
    userAvatar?: string;
    aiAvatar?: string;
    proxy?: {
        enabled: boolean;
        url: string;
        key: string;
        authStoreKey?: string;
    };
    speech?: {
        voiceURI?: string;
        rate?: number;
        audioInputDeviceId?: string;
        audioOutputDeviceId?: string;
    };
    personas?: {
        id: string;
        name: string;
        description: string;
        prompt: string;
    }[];
    window?: {
        width: number;
        height: number;
        x: number;
        y: number;
        fullscreen?: boolean;
        startOnStartup?: boolean;
        workAtBackground?: boolean; // Minimize to tray instead of closing
    };
    modelSettings?: Record<
        string,
        {
            systemPrompt?: string;
            presetId?: string;
            reasoningLevel?: string;
        }
    >;
    presets?: Array<{
        id: string;
        name: string;
        temperature: number;
        topP: number;
        frequencyPenalty: number;
        presencePenalty: number;
        maxTokens: number;
    }>;
    mcpDisabledServers?: string[];
    mcpUserServers?: MCPServerConfig[];
    mcpSecurityAllowedHosts?: string[];
    mcpReviewPolicy?: 'elevated' | 'trusted';
    mcpAutoExecuteSafe?: boolean;
    modelUsageLimits?: {
        copilot?: {
            hourly?: {
                enabled: boolean;
                type: 'requests' | 'percentage';
                value: number; // requests count or percentage (0-100)
            };
            daily?: {
                enabled: boolean;
                type: 'requests' | 'percentage';
                value: number;
            };
            weekly?: {
                enabled: boolean;
                type: 'requests' | 'percentage';
                value: number;
            };
        };
        antigravity?: Record<
            string,
            {
                // modelId -> limit config
                enabled: boolean;
                percentage: number; // percentage of model's remaining quota (0-100)
            }
        >;
        codex?: {
            daily?: {
                enabled: boolean;
                percentage: number; // percentage of daily remaining (0-100)
            };
            weekly?: {
                enabled: boolean;
                percentage: number; // percentage of weekly remaining (0-100)
            };
        };
    };
    ai?: {
        modelUpdateInterval?: number; // ms, default 1 hour
        tokenRefreshInterval?: number; // ms, default 5 minutes
        copilotRefreshInterval?: number; // ms, default 15 minutes
    };
    extensionWarningDismissed?: boolean; // Browser extension warning dismissed
    [key: string]: JsonValue | undefined;
};

export type MCPServerConfig = {
    id: string; // Unique identifier (e.g., 'github', 'postgres')
    name: string;
    command: string;
    args: string[];
    description?: string;
    env?: Record<string, string>;
    enabled?: boolean; // Default: false (user must explicitly enable)
    tools?: { name: string; description: string }[];
    category?: string;
    publisher?: string;
    version?: string;
    isOfficial?: boolean;
};

export type AccountQuotaInfo = {
    authExpired?: boolean;
    files?: Array<{ provider: string; type?: string; name?: string }>;
    [key: string]: JsonValue | undefined;
};
