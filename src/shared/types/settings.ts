import { InlineSuggestionSource } from '@shared/schemas/inline-suggestions.schema';

import { JsonValue } from '@/types/common';

export type McpPermissionProfile = 'read-only' | 'workspace-only' | 'network-enabled' | 'destructive' | 'full-access';

export type ModelGovernanceSettings = {
    mode: 'allowlist' | 'blocklist';
    allowedModels: string[];
    blockedModels: string[];
    [key: string]: JsonValue | undefined;
};

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
        | 'sd-cpp';
        ollamaModel?: string;
        sdWebUIUrl?: string;
        comfyUIUrl?: string;
        sdCppBinaryPath?: string;
        sdCppModelPath?: string;
        sdCppExtraArgs?: string;
    };
    activeAccountId?: string;

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
        workspacesBasePath?: string;
        agentMode?: 'adaptive' | 'speed' | 'accuracy';
        agentSoftDeadlineMs?: number;
        agentHardDeadlineMs?: number;
        agentRequireLocalForActions?: boolean;
        agentAllowLateSuggestions?: boolean;
        inlineSuggestionsEnabled?: boolean;
        inlineSuggestionsSource?: InlineSuggestionSource;
        inlineSuggestionsProvider?: string;
        inlineSuggestionsModel?: string;
        inlineSuggestionsCopilotAccountId?: string;
        favoriteModels?: string[];
        recentModels?: string[];
        hiddenModels?: string[];
    };
    modelGovernance?: ModelGovernanceSettings;
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
    security?: {
        session?: {
            enabled?: boolean;
            timeoutMinutes?: number;
            requireBiometricOnUnlock?: boolean;
        };
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
        lowPowerMode?: boolean; // Use lower resources in background
        autoHibernation?: boolean; // Hibernate heavy services after inactivity
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
    mcpActionPermissions?: Record<string, 'allow' | 'deny' | 'ask'>;
    mcpPermissionProfile?: McpPermissionProfile; // Global default profile
    mcpPermissionRequests?: Array<{
        id: string;
        service: string;
        action: string;
        createdAt: number;
        argsPreview?: string;
        status: 'pending' | 'approved' | 'denied';
    }>;
    mcpServerVersionHistory?: Record<string, string[]>;
    mcpTrustedPublishers?: string[];
    mcpRevokedSignatures?: string[];
    mcpSecurityScans?: Record<string, {
        score: number;
        flags: string[];
        status: 'clean' | 'suspicious' | 'blocked';
        scannedAt: number;
    }>;
    mcpExtensionReviews?: Record<string, Array<{
        id: string;
        userHash: string;
        rating: number;
        comment: string;
        createdAt: number;
        helpfulVotes: number;
        verified: boolean;
        status: 'published' | 'flagged' | 'hidden';
    }>>;
    mcpTelemetry?: {
        enabled: boolean;
        anonymize: boolean;
        crashReporting: boolean;
        events?: Array<{
            serverId: string;
            event: string;
            timestamp: number;
            metadata?: Record<string, JsonValue>;
        }>;
        crashes?: Array<{
            serverId: string;
            timestamp: number;
            reason: string;
            stack?: string;
            metadata?: Record<string, JsonValue>;
        }>;
    };
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
        preferredMemoryModels?: string[];
        agentProviderRotation?: {
            defaultWorkspaceId?: string;
            byWorkspace?: Record<string, {
                chain: {
                    cloud: string[];
                    local: string[];
                };
                strategy?: 'provider_priority' | 'balanced' | 'local_first';
                updatedAt?: number;
            }>;
        };
    };
    terminal?: {
        fontSize?: number;
        fontFamily?: string;
        lineHeight?: number;
        letterSpacing?: number;
        cursorStyle?: 'bar' | 'block' | 'underline';
        cursorBlink?: boolean;
        scrollback?: number;
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
    permissionProfile?: McpPermissionProfile;
    tools?: { name: string; description: string }[];
    category?: string;
    publisher?: string;
    version?: string;
    extensionType?:
    | 'mcp_server'
    | 'theme'
    | 'command'
    | 'language'
    | 'agent_template'
    | 'widget'
    | 'integration';
    isOfficial?: boolean;
    capabilities?: string[];
    dependencies?: string[];
    conflictsWith?: string[];
    sandbox?: {
        enabled?: boolean;
        maxMemoryMb?: number;
        maxCpuPercent?: number;
    };
    storage?: {
        dataPath?: string;
        quotaMb?: number;
        migrationVersion?: number;
    };
    updatePolicy?: {
        channel?: 'stable' | 'beta' | 'alpha';
        autoUpdate?: boolean;
        scheduleCron?: string;
        signatureSha256?: string;
        signatureTimestamp?: number;
        lastCheckedAt?: number;
        lastUpdatedAt?: number;
    };
    settingsSchema?: Record<string, JsonValue>;
    settingsValues?: Record<string, JsonValue>;
    settingsVersion?: number;
    integrityHash?: string;
    oauth?: {
        enabled?: boolean;
        authUrl?: string;
        tokenUrl?: string;
        scopes?: string[];
        clientId?: string;
    };
    credentials?: {
        provider?: string;
        keyRef?: string;
        lastRotatedAt?: number;
    };
    security?: {
        reviewStatus?: 'pending' | 'approved' | 'rejected';
        securityScore?: number;
        malwareFlags?: string[];
        lastScannedAt?: number;
    };
    telemetry?: {
        enabled?: boolean;
        anonymize?: boolean;
        crashReporting?: boolean;
        usageCount?: number;
        crashCount?: number;
        lastCrashAt?: number;
    };
    installedAt?: number;
    updatedAt?: number;
    previousVersion?: string;
};

export type AccountQuotaInfo = {
    authExpired?: boolean;
    files?: Array<{ provider: string; type?: string; name?: string }>;
    [key: string]: JsonValue | undefined;
};
