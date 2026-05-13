/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { IpcContractVersionInfo } from '@shared/constants/ipc-contract';
import type {
    InlineSuggestionRequest,
    InlineSuggestionResponse,
    InlineSuggestionUsageStats,
} from '@shared/schemas/inline-suggestions.schema';
import type { IpcRendererEvent } from 'electron';

import {
    AgentDefinition,
    AntigravityAiCreditsInfo,
    AppSettings,
    Chat,
    ClaudeQuota,
    CopilotQuota,
    CursorQuota,
    EntityKnowledge,
    EpisodicMemory,
    FileSearchResult,
    Folder,
    IpcValue,
    Message,
    QuotaResponse,
    SemanticFragment,
    ServiceResponse,
    SSHConfig,
    SSHConnection,
    SSHDevContainer,
    SSHFile,
    SSHKnownHostEntry,
    SSHManagedKey,
    SSHPackageInfo,
    SSHPortForward,
    SSHProfileTemplate,
    SSHRemoteSearchResult,
    SSHSearchHistoryEntry,
    SSHSessionRecording,
    SSHSystemStats,
    SSHTransferTask,
    SSHTunnelPreset,
    TodoFile,
    ToolDefinition,
    ToolResult,
    Workspace,
    WorkspaceAnalysis,
} from '@/shared/types';
import {
    AdvancedSemanticFragment,
    MemoryCategory,
    MemoryImportResult,
    MemorySearchAnalytics,
    MemorySearchHistoryEntry,
    MemoryStatistics,
    PendingMemory,
    RecallContext,
} from '@/shared/types/advanced-memory';
import type { MarketplaceSkill } from '@/shared/types/marketplace';
import type { RuntimeBootstrapExecutionResult } from '@/shared/types/runtime-manifest';
import type { ProxySkill, ProxySkillUpsertInput } from '@/shared/types/skill';
import {
    VoiceCommand,
    VoiceInfo,
    VoiceRecognitionResult,
    VoiceSettings,
    VoiceSynthesisOptions,
} from '@/shared/types/voice';

import { OllamaBridge } from './main/preload/domains/ollama.preload';

export interface FileEntry {
    name: string;
    isDirectory: boolean;
    size: number;
    mtime: number;
    path: string;
}

export interface ProcessInfo {
    pid: number;
    name?: string;
    cmd?: string;
    command?: string;
    cpu?: number;
    memory?: number;
    id?: string;
    cwd?: string;
    status?: string;
    startTime?: number;
}

export interface ModelDefinition {
    id: string;
    name: string;
    provider: string;
    providerCategory?: string;
    sourceProvider?: string;
    quotaInfo?: {
        remainingQuota?: number;
        totalQuota?: number;
        resetTime?: string;
        remainingFraction?: number;
        aiCredits?: AntigravityAiCreditsInfo;
    };
    percentage?: number;
    reset?: string;
    capabilities?: {
        image_generation?: boolean;
        text_generation?: boolean;
        embedding?: boolean;
    };
    [key: string]: IpcValue | undefined;
}

/**
 * Linked account info returned from auth service.
 */
export interface LinkedAccountInfo {
    id: string;
    provider: string;
    email?: string;
    displayName?: string;
    avatarUrl?: string;
    isActive: boolean;
    createdAt: number;
}

/**
 * Token data for linking accounts.
 */
export interface TokenData {
    accessToken?: string;
    refreshToken?: string;
    sessionToken?: string;
    email?: string;
    displayName?: string;
    avatarUrl?: string;
    expiresAt?: number;
    scope?: string;
    metadata?: Record<string, IpcValue>;
}

/**
 * Main Electron API interface exposed to the renderer process.
 * Provides access to all IPC handlers and window controls.
 *
 * @example
 * ```typescript
 * // Get settings
 * const settings = await window.electron.getSettings()
 *
 * // Send a chat message
 * await window.electron.session.conversation.stream({ messages, model, tools, provider, options, chatId })
 * ```
 */
import type { ElectronApiIntegrationsDomain } from '@/electron-api/electron-api-integrations';
import type { ElectronApiModelsMemoryDomain } from '@/electron-api/electron-api-models-memory';
import type { ElectronApiWorkspaceSystemDomain } from '@/electron-api/electron-api-workspace-system';


export interface ElectronAPI {
    invoke: <T = IpcValue>(channel: string, ...args: IpcValue[]) => Promise<T>;
    /**
     * Minimizes the application window.
     */
    minimize: () => void;

    /**
     * Maximizes or restores the application window.
     */
    maximize: () => void;

    /**
     * Closes the application window.
     */
    close: () => void;

    getZoomFactor: () => Promise<{ zoomFactor: number }>;
    getSettings: () => Promise<AppSettings | ServiceResponse<AppSettings>>;
    saveSettings: (settings: AppSettings) => Promise<AppSettings | ServiceResponse<AppSettings>>;

    isOllamaRunning: () => Promise<boolean>;
    startOllama: () => Promise<{
        success: boolean;
        message: string;
        messageKey?: string;
        messageParams?: Record<string, string | number>;
    }>;
    getOllamaHealthStatus: () => Promise<{ status: 'ok' | 'error' }>;
    forceOllamaHealthCheck: () => Promise<{ status: 'ok' | 'error' }>;
    onOllamaStatusChange: (callback: (status: { status: string }) => void) => () => void;

    /**
     * Resizes the window to a specific resolution.
     * @param resolution - Resolution string in format "WIDTHxHEIGHT" (e.g., "1920x1080")
     */
    resizeWindow: (resolution: string) => void;
    resetZoomFactor: () => Promise<{ zoomFactor: number }>;
    setZoomFactor: (zoomFactor: number) => Promise<{ zoomFactor: number }>;
    stepZoomFactor: (direction: -1 | 1) => Promise<{ zoomFactor: number }>;

    /**
     * Toggles compact mode for the window.
     * @param enabled - Whether to enable compact mode
     */
    toggleCompact: (enabled: boolean) => void;

    /**
     * Initiates GitHub OAuth login flow.
     * @param appId - Optional app identifier ('copilot')
     * @returns Promise resolving to OAuth device code information
     */
    auth: {
        copilotLogin: () => Promise<{
            device_code: string;
            user_code: string;
            verification_uri: string;
            expires_in: number;
            interval: number;
        }>;
        pollToken: (
            deviceCode: string,
            interval: number,
            appId?: 'copilot'
        ) => Promise<{
            success: boolean;
            account?: LinkedAccountInfo;
            error?: string;
        }>;
        antigravityLogin: (accountId?: string) => Promise<{ url: string; state: string; accountId: string }>;
        ollamaLogin: (accountId?: string) => Promise<{ url: string; state: string; accountId: string }>;
        ollamaSignout?: (accountId?: string) => Promise<{ success: boolean; alreadySignedOut?: boolean; error?: string }>;
        claudeLogin: (accountId?: string) => Promise<{ url: string; state: string; accountId: string }>;
        cursorSeamlessLogin: () => Promise<{ success: boolean; accountId?: string; error?: string }>;
        completeCursorAuth: (session: string) => Promise<{ success: boolean; error?: string }>;
        claudeBrowserLogin: () => Promise<{ sessionKey?: string; status?: string; error?: string }>;
        anthropicLogin: (accountId?: string) => Promise<{ url: string; state: string; accountId: string }>;
        codexLogin: (accountId?: string) => Promise<{ url: string; state: string; accountId: string }>;
        cancelAuth: (provider: 'antigravity' | 'claude' | 'codex' | 'ollama' | 'cursor', state: string, accountId: string) => Promise<boolean>;
        getBrowserAuthStatus: (provider: string, state: string, accountId: string) => Promise<{
            status: string;
            error?: string;
            provider?: string;
            state?: string;
            accountId?: string;
            account_id?: string;
            account?: Record<string, IpcValue>;
        }>;
        verifyAuthBridge: (provider?: 'antigravity' | 'claude' | 'codex' | 'ollama' | 'cursor') => Promise<{
            status: string;
            provider: string;
            readiness?: IpcValue;
            callback?: IpcValue;
            error?: string;
        }>;
        getQuota: (provider?: string) => Promise<{
            accounts: Array<QuotaResponse & { accountId?: string; email?: string }>;
        } | null>;
        getCopilotQuota: () => Promise<{
            accounts: Array<CopilotQuota & { accountId?: string; email?: string }>;
        }>;
        getCodexUsage: () => Promise<{
            accounts: Array<{ usage: CodexUsage; accountId?: string; email?: string }>;
        }>;
        getClaudeQuota: () => Promise<{ accounts: Array<ClaudeQuota> }>;
        getCursorQuota: () => Promise<{ accounts: Array<CursorQuota> }>;
        forceRefreshQuota: () => Promise<boolean>;
        saveClaudeSession: (
            sessionKey: string,
            accountId?: string
        ) => Promise<{ success: boolean; error?: string }>;
        saveCursorSession: (
            session: string,
            accountId?: string
        ) => Promise<{ success: boolean; error?: string }>;
        triggerClaudeSessionCapture: () => Promise<{ success: boolean; error?: string }>;

        // --- Linked Accounts ---
        getLinkedAccounts: (provider?: string) => Promise<LinkedAccountInfo[]>;
        getActiveLinkedAccount: (provider: string) => Promise<LinkedAccountInfo | null>;
        setActiveLinkedAccount: (
            provider: string,
            accountId: string
        ) => Promise<{ success: boolean; error?: string }>;
        linkAccount: (
            provider: string,
            tokenData: TokenData
        ) => Promise<{ success: boolean; account?: LinkedAccountInfo; error?: string }>;
        unlinkAccount: (accountId: string) => Promise<{ success: boolean; error?: string }>;
        unlinkProvider: (provider: string) => Promise<{ success: boolean; error?: string }>;
        hasLinkedAccount: (provider: string) => Promise<boolean>;
        getAccountsByProvider: (provider: string) => Promise<LinkedAccountInfo[]>;
        getAuthProviderHealth: (provider?: string) => Promise<Array<{
            provider: string;
            checkedAt: number;
            totalAccounts: number;
            activeAccountId?: string;
            hasActiveToken: boolean;
            hasRefreshToken: boolean;
            expiringSoonCount: number;
            expiredCount: number;
            healthy: boolean;
        }>>;
        getAuthProviderAnalytics: () => Promise<Array<{
            provider: string;
            totalAccounts: number;
            activeAccounts: number;
            lastUpdatedAt?: number;
            oldestAccountAt?: number;
            withRefreshToken: number;
            withSessionToken: number;
        }>>;
        getTokenAnalytics: (provider?: string) => Promise<{
            totalAccounts: number;
            withAccessToken: number;
            withRefreshToken: number;
            withSessionToken: number;
            expiringWithin30m: number;
            expired: number;
            revoked: number;
        }>;
        exportCredentials: (options: {
            provider?: string;
            password: string;
            expiresInHours?: number;
        }) => Promise<{ success: boolean; payload?: string; checksum?: string; expiresAt?: number; error?: string }>;
        importCredentials: (
            payload: string,
            password: string
        ) => Promise<{ success: boolean; imported?: number; skipped?: number; expiresAt?: number; error?: string }>;
        createMasterKeyBackup: (
            passphrase: string
        ) => Promise<{ success: boolean; backup?: string; error?: string }>;
        restoreMasterKeyBackup: (
            backupPayload: string,
            passphrase: string
        ) => Promise<{ success: boolean; error?: string }>;
        startAuthSession: (
            provider: string,
            accountId?: string,
            source?: string
        ) => Promise<{ sessionId: string }>;
        touchAuthSession: (sessionId: string) => Promise<{ success: boolean }>;
        endAuthSession: (sessionId: string) => Promise<{ success: boolean }>;
        setAuthSessionLimit: (provider: string, limit: number) => Promise<{ limit: number }>;
        getAuthSessionAnalytics: (provider?: string) => Promise<{
            totalActiveSessions: number;
            byProvider: Record<string, number>;
            oldestSessionAt?: number;
        }>;
        setAuthSessionTimeout: (timeoutMs: number) => Promise<{ timeoutMs: number }>;
        getAuthSessionTimeout: () => Promise<{ timeoutMs: number }>;

        // Skills / Proxy
        listSkills: () => Promise<import('@shared/types/skill').ProxySkill[]>;
        toggleSkill: (id: string, enabled: boolean) => Promise<{ success: boolean }>;
        deleteSkill: (id: string) => Promise<{ success: boolean }>;
        checkUsageLimit: (provider: string, modelId: string) => Promise<{ allowed: boolean; reason?: string }>;
        getProxyModels: () => Promise<IpcValue>;

        // Legacy/Core Auth
        createAccount: (name: string) => Promise<{ success: boolean; error?: string }>;
        switchAccount: (id: string) => Promise<{ success: boolean; error?: string }>;
        onAccountChanged: (callback: () => void) => () => void;
        onQuotaUpdate: (callback: (payload: unknown) => void) => () => void;
    };

    dialog: {
        showOpenDialog: (options: unknown) => Promise<{ canceled: boolean; filePaths: string[] }>;
        showSaveDialog: (options: unknown) => Promise<{ canceled: boolean; filePath?: string }>;
        showMessageBox: (options: unknown) => Promise<{ response: number; checkboxChecked: boolean }>;
        showErrorBox: (title: string, content: string) => void;
        selectDirectory: () => Promise<{ success: boolean; path?: string; error?: string }>;
    };

    power: {
        getLowPowerStatus: () => Promise<{ lowPower: boolean }>;
        onLowPowerStatusChange: (callback: (status: { lowPower: boolean }) => void) => () => void;
        onStateChanged: (callback: (state: { lowPowerMode: boolean }) => void) => () => void;
    };

    code: ElectronApiWorkspaceSystemDomain['code'];
    workspace: ElectronApiWorkspaceSystemDomain['workspace'];
    process: ElectronApiWorkspaceSystemDomain['process'];
    files: ElectronApiWorkspaceSystemDomain['files'];
    runCommand: (
        command: string,
        args: string[],
        cwd?: string
    ) => Promise<{ stdout: string; stderr: string; code: number }>;
    git: ElectronApiWorkspaceSystemDomain['git'];
    codeLanguages: ElectronApiIntegrationsDomain['codeLanguages'];
    getModels: () => Promise<ModelDefinition[] | { antigravityError?: string }>;

    onAgentEvent: (callback: (payload: IpcValue) => void) => () => void;
    onSdCppStatus: (callback: (data: IpcValue) => void) => () => void;
    onSdCppProgress: (callback: (data: IpcValue) => void) => () => void;
    modelDownloader: ElectronApiModelsMemoryDomain['modelDownloader'];
    llama: ElectronApiModelsMemoryDomain['llama'];
    sdCpp: ElectronApiModelsMemoryDomain['sdCpp'];
    imageStudio: ElectronApiModelsMemoryDomain['imageStudio'];
    clipboard: ElectronApiWorkspaceSystemDomain['clipboard'];
    db: ElectronApiIntegrationsDomain['db'];
    terminal: ElectronApiIntegrationsDomain['terminal'];
    agent: ElectronApiIntegrationsDomain['agent'];
    modelRegistry: ElectronApiIntegrationsDomain['modelRegistry'];
    session: ElectronApiIntegrationsDomain['session'];
    ssh: ElectronApiIntegrationsDomain['ssh'];
    huggingface: ElectronApiModelsMemoryDomain['huggingface'];
    ollama: {
        getModels: () => Promise<import('@shared/types').ModelDefinition[] | { antigravityError?: string }>;
        chat: (messages: import('@shared/types').Message[], model: string) => Promise<{ content: string; done: boolean }>;
        chatOpenAI: (request: Record<string, import('@shared/types').RuntimeValue>) => Promise<{
            content: string;
            toolCalls?: import('@shared/types').ToolCall[];
            reasoning?: string;
            images?: string[];
            sources?: string[];
        }>;
        chatStream: (request: Record<string, import('@shared/types').RuntimeValue>) => Promise<{ success: boolean; queued?: boolean }>;
        abortChat: () => void;
        onStreamChunk: (
            callback: (chunk: { content?: string; toolCalls?: import('@shared/types').ToolCall[]; reasoning?: string }) => void
        ) => () => void;

        removeStreamChunkListener: () => void;

        // Management
        isOllamaRunning: () => Promise<boolean>;
        startOllama: () => Promise<{
            success: boolean;
            message: string;
            messageKey?: string;
            messageParams?: Record<string, string | number>;
        }>;
        pullModel: (modelName: string) => Promise<{ success: boolean; error?: string }>;
        deleteModel: (modelName: string) => Promise<{ success: boolean; error?: string }>;
        getLibraryModels: () => Promise<import('@shared/types').OllamaLibraryModel[]>;
        onPullProgress: (
            callback: (progress: {
                status: string;
                digest?: string;
                total?: number;
                completed?: number;
                modelName?: string;
            }) => void
        ) => () => void;
        removePullProgressListener: () => void;

        // Health and GPU checks
        getHealthStatus: () => Promise<import('@shared/types').IpcValue>;
        forceHealthCheck: () => Promise<void>;
        checkCuda: () => Promise<{ hasCuda: boolean; detail?: string }>;
        onStatusChange: (callback: (status: 'ok' | 'error' | 'stopped') => void) => void;

        // Model Health & Recommendations
        checkModelHealth: (modelName: string) => Promise<import('@shared/types').IpcValue>;
        checkAllModelsHealth: () => Promise<import('@shared/types').IpcValue[]>;
        getRecommendations: (category?: 'coding' | 'creative' | 'reasoning' | 'general' | 'multimodal') => Promise<import('@shared/types').IpcValue[]>;
        getRecommendedModelForTask: (task: string) => Promise<import('@shared/types').IpcValue | null>;

        // Connection Handling
        getConnectionStatus: () => Promise<import('@shared/types').IpcValue>;
        testConnection: () => Promise<import('@shared/types').IpcValue>;
        reconnect: () => Promise<boolean>;

        // GPU Monitoring
        getGPUInfo: () => Promise<import('@shared/types').IpcValue>;
        startGPUMonitoring: (intervalMs?: number) => Promise<{ success: boolean; intervalMs: number }>;
        stopGPUMonitoring: () => Promise<{ success: boolean }>;
        setGPUAlertThresholds: (thresholds: { highMemoryPercent?: number; highTemperatureC?: number; lowMemoryMB?: number }) => Promise<{ success: boolean }>;
        getGPUAlertThresholds: () => Promise<{ highMemoryPercent: number; highTemperatureC: number; lowMemoryMB: number }>;
        onGPUAlert: (callback: (alert: import('@shared/types').IpcValue) => void) => () => void;
        onGPUStatus: (callback: (status: import('@shared/types').IpcValue) => void) => () => void;

        // Cloud Account Authentication
        initiateConnect: () => Promise<import('@shared/types').IpcValue>;
        pollConnectStatus: (code: string, privateKeyB64: string, publicKeyB64: string) => Promise<import('@shared/types').IpcValue>;
        getOllamaAccounts: () => Promise<import('@shared/types').IpcValue[]>;
    };
    executeTools: (
        toolName: string,
        args: Record<string, IpcValue>,
        toolCallId?: string,
        workspaceAgentSessionId?: string
    ) => Promise<ToolResult>;
    killTool: (toolCallId: string) => Promise<boolean>;
    getToolDefinitions: () => Promise<ToolDefinition[]>;

    // MCP
    mcp: ElectronApiIntegrationsDomain['mcp'];
    marketplace: ElectronApiIntegrationsDomain['marketplace'];
    locale: ElectronApiIntegrationsDomain['locale'];
    proxyEmbed: ElectronApiIntegrationsDomain['proxyEmbed'];
    captureScreenshot: () => Promise<{ success: boolean; image?: string; error?: string }>;

    // Shell / External
    openExternal: (url: string) => void;
    captureCookies: (url: string, timeoutMs?: number) => Promise<{ success: boolean }>;
    openTerminal: (command: string) => Promise<boolean>;

    // Files
    readPdf: (path: string) => Promise<{ success: boolean; text?: string; error?: string }>;
    selectDirectory: () => Promise<{ success: boolean; path?: string }>;
    listDirectory: (
        path: string
    ) => Promise<{ success: boolean; files?: FileEntry[]; error?: string }>;
    readFile: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>;
    writeFile: (
        path: string,
        content: string,
        context?: { aiSystem?: string; chatSessionId?: string; changeReason?: string }
    ) => Promise<{ success: boolean; error?: string }>;


    createDirectory: (path: string) => Promise<{ success: boolean; error?: string }>;
    deleteFile: (path: string) => Promise<{ success: boolean; error?: string }>;
    deleteDirectory: (path: string) => Promise<{ success: boolean; error?: string }>;
    copyPath: (
        sourcePath: string,
        destinationPath: string
    ) => Promise<{ success: boolean; error?: string }>;
    renamePath: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>;
    searchFiles: (
        rootPath: string,
        pattern: string
    ) => Promise<{ success: boolean; matches?: string[]; error?: string }>;
    saveFile: (
        content: string,
        filename: string
    ) => Promise<{ success: boolean; path?: string; error?: string }>;
    exportChatToPdf: (
        chatId: string,
        title: string
    ) => Promise<{ success: boolean; path?: string; error?: string }>;

    // Export
    exportMarkdown: (
        content: string,
        filePath: string
    ) => Promise<{ success: boolean; error?: string }>;
    exportPDF: (
        htmlContent: string,
        filePath: string
    ) => Promise<{ success: boolean; error?: string }>;

    huggingface: ElectronApiModelsMemoryDomain['huggingface'];
    log: ElectronApiIntegrationsDomain['log'];
    theme: ElectronApiIntegrationsDomain['theme'];
    gallery: ElectronApiModelsMemoryDomain['gallery'];
    getUserDataPath: () => Promise<string>;

    update: ElectronApiIntegrationsDomain['update'];
    collaboration: ElectronApiIntegrationsDomain['collaboration'];
    modelCollaboration: ElectronApiIntegrationsDomain['modelCollaboration'];
    audit: ElectronApiIntegrationsDomain['audit'];
    memory: ElectronApiModelsMemoryDomain['memory'];
    advancedMemory: ElectronApiModelsMemoryDomain['advancedMemory'];
    batch: ElectronApiIntegrationsDomain['batch'];
    lazyServices: ElectronApiIntegrationsDomain['lazyServices'];
    ipcContract: ElectronApiIntegrationsDomain['ipcContract'];
    ipcRenderer: ElectronApiIntegrationsDomain['ipcRenderer'];
    on: (
        channel: string,
        listener: (event: IpcRendererEvent, ...args: IpcValue[]) => void
    ) => () => void;

    metrics: ElectronApiIntegrationsDomain['metrics'];
    usage: ElectronApiIntegrationsDomain['usage'];
    voice: ElectronApiIntegrationsDomain['voice'];
    extension: ElectronApiIntegrationsDomain['extension'];
    codeSandbox: ElectronApiIntegrationsDomain['codeSandbox'];
    promptTemplates: ElectronApiIntegrationsDomain['promptTemplates'];
    sharedPrompts: ElectronApiIntegrationsDomain['sharedPrompts'];
    runtime: {
        getStatus: () => Promise<RuntimeBootstrapExecutionResult | null>;
        refreshStatus: () => Promise<RuntimeBootstrapExecutionResult | null>;
        repair: (manifestUrl?: string) => Promise<RuntimeBootstrapExecutionResult | null>;
        runComponentAction: (componentId: string) => Promise<{ success: boolean; message: string }>;
    };
    userCollaboration: ElectronApiIntegrationsDomain['userCollaboration'];
    ollama: OllamaBridge;
    liveCollaboration: ElectronApiIntegrationsDomain['liveCollaboration'];
}

declare global {
    interface Window {
        electron: ElectronAPI;
        TengraSpeak: (text: string) => void;
        Tengra: {
            registerExtensionComponent: (viewId: string, Component: React.ComponentType<Record<string, unknown>>) => void;
        };
    }
}

