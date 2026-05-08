/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type {
    CollaborationResponse,
    CollaborationSyncUpdate,
    JoinCollaborationRoom,
} from '@shared/schemas/collaboration.schema';
import type {
    InlineSuggestionRequest,
    InlineSuggestionResponse,
    InlineSuggestionUsageStats,
} from '@shared/schemas/inline-suggestions.schema';
import type { IpcRendererEvent } from 'electron';

import {
    AdvancedSemanticFragment,
    MemoryImportResult,
    MemorySearchHistoryEntry,
    MemoryStatistics,
    PendingMemory,
    RecallContext,
    SharedMemoryAnalytics,
    SharedMemoryNamespace,
    SharedMemorySyncRequest,
    SharedMemorySyncResult,
} from './advanced-memory';
import {
    AgentDefinition,
    AgentStartOptions,
    AntigravityAiCreditsInfo,
    AppSettings,
    Chat,
    CodexUsage,
    CopilotQuota,
    FileEntry,
    FileSearchResult,
    IpcValue,
    MCPServerConfig,
    Message,
    OllamaLibraryModel,
    ProcessInfo,
    QuotaResponse,
    SessionCapabilityDescriptor,
    SessionEventEnvelope,
    SessionRecoverySnapshot,
    SessionState,
    SSHConfig,
    SSHDevContainer,
    SSHExecOptions,
    SSHFile,
    SSHKnownHostEntry,
    SSHManagedKey,
    SSHPortForward,
    SSHProfileTemplate,
    SSHRemoteSearchResult,
    SSHSearchHistoryEntry,
    SSHSessionRecording,
    SSHSystemStats,
    SSHTransferTask,
    SSHTunnelPreset,
    TodoItem,
    WorkspaceAnalysis,
    WorkspaceCodeMap,
    WorkspaceDefinitionLocation,
    WorkspaceDependencyGraph,
    WorkspaceIssue,
    WorkspaceStats,
} from './index';
import { RuntimeBootstrapExecutionResult } from './runtime-manifest';

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
    [key: string]: IpcValue | undefined;
}

export interface ProxyModelResponse {
    data: ModelDefinition[];
    antigravityError?: string;
    [key: string]: IpcValue | undefined;
}

export interface LlamaModel {
    name: string;
    path: string;
    size: number;
}

export interface LinkedAccountInfo {
    id: string;
    provider: string;
    email?: string;
    displayName?: string;
    avatarUrl?: string;
    isActive: boolean;
    createdAt: number;
    decryptionError?: boolean;
}

export interface TokenData {
    key?: string;
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

export interface IpcContractVersionInfo {
    version: string;
    minCompatibleVersion: string;
}

export interface ElectronAPI {
    // Window controls
    minimize: () => void;
    maximize: () => void;
    fullscreen: () => void;
    close: () => void;
    resizeWindow: (resolution: string) => void;
    updateWindow: (patch: Partial<AppSettings['window']>) => Promise<void>;
    toggleCompact: (enabled: boolean) => void;
    getZoomFactor: () => Promise<{ zoomFactor: number }>;
    setZoomFactor: (zoomFactor: number) => Promise<{ zoomFactor: number }>;
    stepZoomFactor: (direction: -1 | 1) => Promise<{ zoomFactor: number }>;
    resetZoomFactor: () => Promise<{ zoomFactor: number }>;

    getAllAccounts: () => Promise<LinkedAccountInfo[]>;
    security: {
        resetMasterKey: () => Promise<{ success: boolean; error?: string }>;
    };

    // Auth
    copilotLogin: (appId?: 'copilot') => Promise<{
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
        account?: {
            provider: string;
            email?: string;
            displayName?: string;
            avatarUrl?: string;
        };
        error?: string;
    }>;
    antigravityLogin: (accountId?: string) => Promise<{ url: string; state: string; accountId: string }>;
    ollamaLogin: (accountId?: string) => Promise<{ url: string; state: string; accountId: string }>;
    ollamaSignout?: (accountId?: string) => Promise<{ success: boolean; alreadySignedOut?: boolean; error?: string }>;
    codexLogin: (accountId?: string) => Promise<{ url: string; state: string; accountId: string }>;
    claudeLogin: (accountId?: string) => Promise<{ url: string; state: string; accountId: string }>;
    cancelAuth: (provider: 'antigravity' | 'claude' | 'codex' | 'ollama', state: string, accountId: string) => Promise<boolean>;

    saveClaudeSession: (
        sessionKey: string,
        accountId?: string
    ) => Promise<{ success: boolean; error?: string }>;

    code: {
        scanTodos: (rootPath: string) => Promise<TodoItem[]>;
        findSymbols: (rootPath: string, query: string) => Promise<FileSearchResult[]>;
        findDefinition: (rootPath: string, symbol: string) => Promise<FileSearchResult | null>;
        findReferences: (rootPath: string, symbol: string) => Promise<FileSearchResult[]>;
        findImplementations: (rootPath: string, symbol: string) => Promise<FileSearchResult[]>;
        getSymbolRelationships: (
            rootPath: string,
            symbol: string,
            maxItems?: number
        ) => Promise<FileSearchResult[]>;
        getFileOutline: (filePath: string) => Promise<FileSearchResult[]>;
        previewRenameSymbol: (
            rootPath: string,
            symbol: string,
            newSymbol: string,
            maxFiles?: number
        ) => Promise<{
            success: boolean;
            applied: boolean;
            symbol: string;
            newSymbol: string;
            totalFiles: number;
            totalOccurrences: number;
            changes: Array<{
                file: string;
                replacements: Array<{ line: number; occurrences: number; before: string; after: string }>;
            }>;
            updatedFiles: string[];
            errors: Array<{ file: string; error: string }>;
        }>;
        applyRenameSymbol: (
            rootPath: string,
            symbol: string,
            newSymbol: string,
            maxFiles?: number
        ) => Promise<{
            success: boolean;
            applied: boolean;
            symbol: string;
            newSymbol: string;
            totalFiles: number;
            totalOccurrences: number;
            changes: Array<{
                file: string;
                replacements: Array<{ line: number; occurrences: number; before: string; after: string }>;
            }>;
            updatedFiles: string[];
            errors: Array<{ file: string; error: string }>;
        }>;
        generateFileDocumentation: (
            filePath: string,
            format?: 'markdown' | 'jsdoc-comments'
        ) => Promise<{
            success: boolean;
            filePath: string;
            format: 'markdown' | 'jsdoc-comments';
            classSymbols: number;
            longLineCount: number;
            todoLikeCount: number;
            consoleUsageCount: number;
            averageComplexity: number;
            securityIssueCount: number;
            topSecurityFindings: Array<{ file: string; line: number; rule: string; snippet: string }>;
            highestComplexityFiles: Array<{ file: string; complexity: number }>;
            qualityScore: number;
            generatedAt: string;
        }>;
        generateWorkspaceDocumentation: (
            rootPath: string,
            maxFiles?: number
        ) => Promise<{
            success: boolean;
            filePath: string;
            format: 'markdown' | 'jsdoc-comments';
            content: string;
            symbolCount: number;
            generatedAt: string;
            error?: string;
        }>;
        analyzeQuality: (rootPath: string, maxFiles?: number) => Promise<{
            rootPath: string;
            filesScanned: number;
            totalLines: number;
            functionSymbols: number;
            classSymbols: number;
            longLineCount: number;
            todoLikeCount: number;
            consoleUsageCount: number;
            averageComplexity: number;
            securityIssueCount: number;
            topSecurityFindings: Array<{ file: string; line: number; rule: string; snippet: string }>;
            highestComplexityFiles: Array<{ file: string; complexity: number }>;
            qualityScore: number;
            generatedAt: string;
        }>;
        searchFiles: (
            rootPath: string,
            query: string,
            workspaceId?: string,
            isRegex?: boolean
        ) => Promise<FileSearchResult[]>;
        indexWorkspace: (rootPath: string, workspaceId: string) => Promise<void>;
        queryIndexedSymbols: (
            query: string
        ) => Promise<{ name: string; path: string; line: number }[]>;
        getSymbolAnalytics: (rootPath: string) => Promise<{
            totalSymbols: number;
            uniqueFiles: number;
            uniqueKinds: number;
            byKind: Record<string, number>;
            byExtension: Record<string, number>;
            topFiles: Array<{ path: string; count: number }>;
            topSymbols: Array<{ name: string; count: number }>;
            generatedAt: string;
        }>;
        getWorkspaceDependencyGraph: (rootPath: string) => Promise<WorkspaceDependencyGraph | null>;
        getWorkspaceCodeMap: (rootPath: string) => Promise<WorkspaceCodeMap | null>;
    };

    // Proxy
    getProxyModels: () => Promise<ProxyModelResponse>;
    getQuota: () => Promise<{
        accounts: Array<QuotaResponse & { accountId?: string; email?: string }>;
    } | null>;
    getCopilotQuota: () => Promise<{
        accounts: Array<CopilotQuota & { accountId?: string; email?: string }>;
    }>;
    getCodexUsage: () => Promise<{
        accounts: Array<{ usage: CodexUsage; accountId?: string; email?: string }>;
    }>;
    getClaudeQuota: () => Promise<{ accounts: Array<import('./quota').ClaudeQuota> }>;
    checkUsageLimit: (
        provider: string,
        model: string
    ) => Promise<{ allowed: boolean; reason?: string }>;
    getUsageCount: (
        period: 'hourly' | 'daily' | 'weekly',
        provider?: string,
        model?: string
    ) => Promise<number>;

    runCommand: (
        command: string,
        args: string[],
        cwd?: string
    ) => Promise<{ stdout: string; stderr: string; code: number }>;
    git: {
        getBranch: (cwd: string) => Promise<{ success: boolean; branch?: string; error?: string }>;
        getStatus: (cwd: string) => Promise<{
            success: boolean;
            isClean?: boolean;
            changes?: number;
            files?: Array<{ path: string; status: string }>;
            error?: string;
        }>;
        getLastCommit: (cwd: string) => Promise<{
            success: boolean;
            hash?: string;
            message?: string;
            author?: string;
            relativeTime?: string;
            date?: string;
            error?: string;
        }>;
        getRecentCommits: (
            cwd: string,
            count?: number
        ) => Promise<{
            success: boolean;
            commits?: Array<{ hash: string; message: string; author: string; date: string }>;
            error?: string;
        }>;
        getFileHistory: (
            cwd: string,
            filePath: string,
            count?: number
        ) => Promise<{
            success: boolean;
            commits?: Array<{
                hash: string;
                message: string;
                author: string;
                relativeTime: string;
                date: string;
            }>;
            error?: string;
        }>;
        getBranches: (
            cwd: string
        ) => Promise<{ success: boolean; branches?: string[]; error?: string }>;
        isRepository: (cwd: string) => Promise<{ success: boolean; isRepository?: boolean }>;
        getFileDiff: (
            cwd: string,
            filePath: string,
            staged?: boolean
        ) => Promise<{ original: string; modified: string; success: boolean; error?: string }>;
        getUnifiedDiff: (
            cwd: string,
            filePath: string,
            staged?: boolean
        ) => Promise<{ diff: string; success: boolean; error?: string }>;
        stageFile: (cwd: string, filePath: string) => Promise<{ success: boolean; error?: string }>;
        unstageFile: (
            cwd: string,
            filePath: string
        ) => Promise<{ success: boolean; error?: string }>;
        getDetailedStatus: (cwd: string) => Promise<{
            success: boolean;
            staged?: Array<{ path: string; status: string }>;
            unstaged?: Array<{ path: string; status: string }>;
            error?: string;
        }>;
        checkout: (cwd: string, branch: string) => Promise<{ success: boolean; error?: string }>;
        commit: (cwd: string, message: string) => Promise<{ success: boolean; error?: string }>;
        push: (
            cwd: string,
            remote?: string,
            branch?: string
        ) => Promise<{ success: boolean; error?: string; stdout?: string; stderr?: string }>;
        pull: (
            cwd: string
        ) => Promise<{ success: boolean; error?: string; stdout?: string; stderr?: string }>;
        getRemotes: (cwd: string) => Promise<{
            success: boolean;
            remotes?: Array<{ name: string; url: string; fetch: boolean; push: boolean }>;
            error?: string;
        }>;
        getTrackingInfo: (cwd: string) => Promise<{
            success: boolean;
            tracking?: string | null;
            ahead?: number;
            behind?: number;
        }>;
        getCommitStats: (
            cwd: string,
            days?: number
        ) => Promise<{ success: boolean; commitCounts?: Record<string, number>; error?: string }>;
        getDiffStats: (cwd: string) => Promise<{
            success: boolean;
            staged?: { added: number; deleted: number; files: number };
            unstaged?: { added: number; deleted: number; files: number };
            total?: { added: number; deleted: number; files: number };
            error?: string;
        }>;
    };

    getModels: () => Promise<ModelDefinition[] | { antigravityError?: string }>;

    // Ollama management
    isOllamaRunning: () => Promise<boolean>;
    startOllama: () => Promise<{
        success: boolean;
        message: string;
        messageKey?: string;
        messageParams?: Record<string, string | number>;
    }>;
    pullModel: (modelName: string) => Promise<{ success: boolean; error?: string }>;
    deleteOllamaModel: (modelName: string) => Promise<{ success: boolean; error?: string }>;
    getLibraryModels: () => Promise<OllamaLibraryModel[]>;
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

    // New health and GPU checks
    getOllamaHealthStatus: () => Promise<IpcValue>;
    forceOllamaHealthCheck: () => Promise<void>;
    checkCuda: () => Promise<{ hasCuda: boolean; detail?: string }>;
    onOllamaStatusChange: (callback: (status: 'ok' | 'error' | 'stopped') => void) => void;

    // OLLAMA-01: Model Health & Recommendations
    checkOllamaModelHealth: (modelName: string) => Promise<IpcValue>;
    checkAllOllamaModelsHealth: () => Promise<IpcValue[]>;
    getOllamaModelRecommendations: (category?: 'coding' | 'creative' | 'reasoning' | 'general' | 'multimodal') => Promise<IpcValue[]>;
    getRecommendedOllamaModelForTask: (task: string) => Promise<IpcValue | null>;

    // OLLAMA-02: Connection Handling
    getOllamaConnectionStatus: () => Promise<IpcValue>;
    testOllamaConnection: () => Promise<IpcValue>;
    reconnectOllama: () => Promise<boolean>;

    // OLLAMA-03: GPU Monitoring
    getOllamaGPUInfo: () => Promise<IpcValue>;
    startOllamaGPUMonitoring: (intervalMs?: number) => Promise<{ success: boolean; intervalMs: number }>;
    stopOllamaGPUMonitoring: () => Promise<{ success: boolean }>;
    setOllamaGPUAlertThresholds: (thresholds: { highMemoryPercent?: number; highTemperatureC?: number; lowMemoryMB?: number }) => Promise<{ success: boolean }>;
    getOllamaGPUAlertThresholds: () => Promise<{ highMemoryPercent: number; highTemperatureC: number; lowMemoryMB: number }>;
    onOllamaGPUAlert: (callback: (alert: IpcValue) => void) => () => void;
    onOllamaGPUStatus: (callback: (status: IpcValue) => void) => () => void;

    // llama.cpp
    llama: {
        loadModel: (
            modelPath: string,
            config?: Record<string, IpcValue>
        ) => Promise<{ success: boolean; error?: string }>;
        unloadModel: () => Promise<{ success: boolean }>;
        chat: (
            message: string,
            systemPrompt?: string
        ) => Promise<{ success: boolean; response?: string; error?: string }>;
        resetSession: () => Promise<{ success: boolean }>;
        getModels: () => Promise<LlamaModel[]>;
        downloadModel: (
            url: string,
            filename: string
        ) => Promise<{ success: boolean; path?: string; error?: string }>;
        deleteModel: (modelPath: string) => Promise<{ success: boolean; error?: string }>;
        getConfig: () => Promise<Record<string, IpcValue>>;
        setConfig: (config: Record<string, IpcValue>) => Promise<{ success: boolean }>;
        getGpuInfo: () => Promise<{ available: boolean; name?: string; vram?: number }>;
        getModelsDir: () => Promise<string>;
        onToken: (callback: (token: string) => void) => void;
        removeTokenListener: () => void;
        onDownloadProgress: (
            callback: (progress: { downloaded: number; total: number }) => void
        ) => void;
        removeDownloadProgressListener: () => void;
    };
    sdCpp: {
        getStatus: () => Promise<string>;
        reinstall: () => Promise<void>;
        getHistory: (limit?: number) => Promise<Array<{
            id: string;
            provider: string;
            prompt: string;
            negativePrompt?: string;
            width: number;
            height: number;
            steps: number;
            cfgScale: number;
            seed: number;
            imagePath: string;
            createdAt: number;
    decryptionError?: boolean;
            source?: string;
        }>>;
        regenerate: (historyId: string) => Promise<string>;
        getAnalytics: () => Promise<{
            totalGenerated: number;
            byProvider: Record<string, number>;
            averageSteps: number;
            bySource?: Record<string, number>;
            averageDurationMs?: number;
            editModeCounts?: Record<string, number>;
        }>;
        getPresetAnalytics: () => Promise<{
            totalPresets: number;
            providerCounts: Record<string, number>;
            customPresets: number;
        }>;
        getScheduleAnalytics: () => Promise<{
            total: number;
            byStatus: Record<string, number>;
            byPriority: Record<string, number>;
        }>;
        listPresets: () => Promise<Array<{
            id: string;
            name: string;
            promptPrefix?: string;
            width: number;
            height: number;
            steps: number;
            cfgScale: number;
            provider?: string;
            createdAt: number;
    decryptionError?: boolean;
            updatedAt: number;
        }>>;
        savePreset: (preset: {
            id?: string;
            name: string;
            promptPrefix?: string;
            width: number;
            height: number;
            steps: number;
            cfgScale: number;
            provider?: 'antigravity' | 'ollama' | 'sd-webui' | 'comfyui' | 'sd-cpp';
        }) => Promise<RuntimeValue>;
        deletePreset: (id: string) => Promise<boolean>;
        exportPresetShare: (id: string) => Promise<string>;
        importPresetShare: (code: string) => Promise<RuntimeValue>;
        listWorkflowTemplates: () => Promise<Array<{
            id: string;
            name: string;
            description?: string;
            workflow: Record<string, RuntimeValue>;
            createdAt: number;
    decryptionError?: boolean;
            updatedAt: number;
        }>>;
        saveWorkflowTemplate: (payload: {
            id?: string;
            name: string;
            description?: string;
            workflow: Record<string, RuntimeValue>;
        }) => Promise<RuntimeValue>;
        deleteWorkflowTemplate: (id: string) => Promise<boolean>;
        exportWorkflowTemplateShare: (id: string) => Promise<string>;
        importWorkflowTemplateShare: (code: string) => Promise<RuntimeValue>;
        schedule: (payload: {
            runAt: number;
            priority?: 'low' | 'normal' | 'high';
            resourceProfile?: 'balanced' | 'quality' | 'speed';
            options: {
                prompt: string;
                negativePrompt?: string;
                width?: number;
                height?: number;
                steps?: number;
                cfgScale?: number;
                seed?: number;
                count?: number;
            };
        }) => Promise<RuntimeValue>;
        listSchedules: () => Promise<RuntimeValue[]>;
        cancelSchedule: (id: string) => Promise<boolean>;
        compare: (ids: string[]) => Promise<RuntimeValue>;
        exportComparison: (payload: { ids: string[]; format?: 'json' | 'csv' }) => Promise<string>;
        shareComparison: (ids: string[]) => Promise<string>;
        batchGenerate: (requests: Array<{
            prompt: string;
            negativePrompt?: string;
            width?: number;
            height?: number;
            steps?: number;
            cfgScale?: number;
            seed?: number;
            count?: number;
        }>) => Promise<string[]>;
        getQueueStats: () => Promise<{ queued: number; running: boolean; byPriority?: Record<string, number> }>;
        searchHistory: (query: string, limit?: number) => Promise<Array<{
            id: string;
            provider: string;
            prompt: string;
            negativePrompt?: string;
            width: number;
            height: number;
            steps: number;
            cfgScale: number;
            seed: number;
            imagePath: string;
            createdAt: number;
    decryptionError?: boolean;
            source?: string;
        }>>;
        exportHistory: (format?: 'json' | 'csv') => Promise<string>;
        edit: (options: {
            sourceImage: string;
            mode: 'img2img' | 'inpaint' | 'outpaint' | 'style-transfer';
            prompt: string;
            negativePrompt?: string;
            strength?: number;
            width?: number;
            height?: number;
            maskImage?: string;
        }) => Promise<string>;
    };

    // Database
    db: {
        query: (sql: string, params?: IpcValue[]) => Promise<IpcValue[]>;
        execute: (sql: string, params?: IpcValue[]) => Promise<{ changes: number; lastInsertRowid: number }>;
        transaction: <T>(callback: () => Promise<T>) => Promise<T>;
        getStatus: () => Promise<{ isReady: boolean; size: number }>;
    };

    // Vector / Memory
    memory: {
        add: (text: string, metadata?: Record<string, IpcValue>) => Promise<string>;
        search: (query: string, limit?: number) => Promise<Array<{ text: string; metadata: Record<string, IpcValue>; score: number }>>;
        delete: (id: string) => Promise<boolean>;
        clear: () => Promise<void>;
    };

    advancedMemory: {
        addFragment: (fragment: AdvancedSemanticFragment) => Promise<string>;
        search: (query: string, options?: RecallContext) => Promise<AdvancedSemanticFragment[]>;
        getStatistics: () => Promise<MemoryStatistics>;
        sync: (request: SharedMemorySyncRequest) => Promise<SharedMemorySyncResult>;
        getAnalytics: () => Promise<SharedMemoryAnalytics>;
        getHistory: (limit?: number) => Promise<MemorySearchHistoryEntry[]>;
        export: (format: 'json' | 'csv') => Promise<MemoryImportResult>;
        import: (data: string, format: 'json' | 'csv') => Promise<MemoryImportResult>;
        createNamespace: (namespace: string) => Promise<SharedMemoryNamespace>;
        listNamespaces: () => Promise<SharedMemoryNamespace[]>;
        getPendingMemories: () => Promise<PendingMemory[]>;
        processPending: (id: string, action: 'approve' | 'reject') => Promise<void>;
    };

    codeSandbox: {
        create: (options: { image: string; cpu?: number; memory?: number }) => Promise<string>;
        execute: (id: string, code: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
        kill: (id: string) => Promise<void>;
        list: () => Promise<string[]>;
    };

    voice: {
        textToSpeech: (text: string, voiceId?: string) => Promise<ArrayBuffer>;
        speechToText: (audioData: ArrayBuffer) => Promise<string>;
        listVoices: () => Promise<Array<{ id: string; name: string }>>;
    };

    collaboration: {
        createSession: (workspaceId: string) => Promise<string>;
        joinSession: (sessionId: string) => Promise<boolean>;
        leaveSession: () => Promise<void>;
        sendMessage: (content: string) => Promise<void>;
        onMessage: (callback: (message: RuntimeValue) => void) => void;
        onUserJoin: (callback: (user: RuntimeValue) => void) => void;
        onUserLeave: (callback: (user: RuntimeValue) => void) => void;
    };

    modelCollaboration: {
        run: (request: {
            messages: Message[];
            models: Array<{ provider: string; model: string }>;
            strategy?: 'consensus' | 'voting' | 'best-of-n' | 'chain-of-thought';
        }) => Promise<{
            response?: string;
            responses: Array<{
                provider: string;
                model: string;
                content: string;
                latency: number;
            }>;
            consensus?: string;
            bestResponse?: {
                provider: string;
                model: string;
                content: string;
            };
            modelContributions?: Array<{ model: string; response: string }>;
        }>;
        getProviderStats: () => Promise<
            Array<{ provider: string; requestCount: number; avgLatency: number }>
        >;
        getActiveTaskCount: () => Promise<number>;
        setProviderConfig: (
            provider: string,
            config: { concurrencyLimit?: number; rateLimit?: number }
        ) => Promise<void>;
    };

    audit: {
        log: (event: string, details: Record<string, IpcValue>) => Promise<void>;
        getLogs: (options?: { limit?: number; offset?: number }) => Promise<RuntimeValue[]>;
    };

    agent: {
        list: () => Promise<AgentDefinition[]>;
        get: (id: string) => Promise<AgentDefinition | null>;
        create: (agent: Omit<AgentDefinition, 'id'>) => Promise<AgentDefinition>;
        update: (id: string, agent: Partial<AgentDefinition>) => Promise<AgentDefinition>;
        delete: (id: string) => Promise<boolean>;
        start: (id: string, options?: AgentStartOptions) => Promise<string>;
        stop: (sessionId: string) => Promise<void>;
        getStatus: (sessionId: string) => Promise<{ status: 'running' | 'stopped' | 'error'; error?: string }>;
    };

    terminal: {
        getProfiles: () => Promise<SSHConfig[]>;
        saveProfile: (profile: SSHConfig) => Promise<boolean>;
        deleteProfile: (id: string) => Promise<boolean>;
        importProfiles: (payload: string, options: RuntimeValue) => Promise<RuntimeValue>;
        importProfileShareCode: (shareCode: string, options: RuntimeValue) => Promise<RuntimeValue>;
        getShells: () => Promise<Array<{ id: string; name: string; path: string }>>;
        getBackends: () => Promise<Array<{ id: string; name: string; available: boolean }>>;
        getDiscoverySnapshot: (options?: { refresh?: boolean }) => Promise<{
            terminalAvailable: boolean;
            shells: Array<{ id: string; name: string; path: string }>;
            backends: Array<{ id: string; name: string; available: boolean }>;
            refreshedAt: number;
        }>;
        getRuntimeHealth: () => Promise<RuntimeValue>;
        getDockerContainers: () => Promise<RuntimeValue[]>;
        create: (options: RuntimeValue) => Promise<string>;
        detach: (options: RuntimeValue) => Promise<void>;
        getCommandHistory: (query: string, limit?: number) => Promise<RuntimeValue[]>;
        getSuggestions: (options: {
            command: string;
            shell: string;
            cwd: string;
            historyLimit?: number;
        }) => Promise<string[]>;
        explainCommand: (options: { command: string; shell: string; cwd?: string }) => Promise<string>;
        explainError: (options: {
            errorOutput: string;
            command?: string;
            shell: string;
            cwd?: string;
        }) => Promise<string>;
        fixError: (options: {
            errorOutput: string;
            command: string;
            shell: string;
            cwd?: string;
        }) => Promise<string>;
        clearCommandHistory: () => Promise<void>;
        close: (sessionId: string) => Promise<void>;
        write: (sessionId: string, data: string) => Promise<void>;
        resize: (sessionId: string, cols: number, rows: number) => Promise<void>;
        kill: (sessionId: string) => Promise<void>;
        getSessions: () => Promise<RuntimeValue[]>;
        restoreAllSnapshots: () => Promise<void>;
        exportSession: (sessionId: string, options: RuntimeValue) => Promise<string>;
        importSession: (payload: RuntimeValue, options: RuntimeValue) => Promise<string>;
        createSessionShareCode: (sessionId: string, options: RuntimeValue) => Promise<string>;
        importSessionShareCode: (shareCode: string, options: RuntimeValue) => Promise<string>;
        getSnapshotSessions: () => Promise<RuntimeValue[]>;
        getSessionTemplates: () => Promise<RuntimeValue[]>;
        saveSessionTemplate: (payload: RuntimeValue) => Promise<RuntimeValue>;
        deleteSessionTemplate: (templateId: string) => Promise<boolean>;
        createFromSessionTemplate: (templateId: string, options: RuntimeValue) => Promise<string>;
        restoreSnapshotSession: (snapshotId: string) => Promise<string>;
        searchScrollback: (sessionId: string, query: string, options: RuntimeValue) => Promise<RuntimeValue[]>;
        exportScrollback: (sessionId: string, exportPath: string) => Promise<boolean>;
        getSessionAnalytics: (sessionId: string) => Promise<RuntimeValue>;
        getSearchAnalytics: () => Promise<RuntimeValue>;
        getSearchSuggestions: (query: string, limit?: number) => Promise<string[]>;
        exportSearchResults: (sessionId: string, query: string, options: RuntimeValue) => Promise<boolean>;
        addScrollbackMarker: (sessionId: string, label: string, lineNumber: number) => Promise<string>;
        listScrollbackMarkers: (sessionId: string) => Promise<RuntimeValue[]>;
        deleteScrollbackMarker: (markerId: string) => Promise<boolean>;
        filterScrollback: (sessionId: string, options: RuntimeValue) => Promise<RuntimeValue[]>;
        setSessionTitle: (sessionId: string, title: string) => Promise<void>;
        onData: (callback: (data: { id: string; data: string }) => void) => () => void;
        onExit: (callback: (data: { id: string; code: number }) => void) => () => void;
        readBuffer: (sessionId: string) => Promise<string>;
        removeAllListeners: () => void;
    };

    ssh: {
        connect: (config: SSHConfig) => Promise<{ success: boolean; connectionId?: string; error?: string }>;
        disconnect: (connectionId: string) => Promise<boolean>;
        execute: (connectionId: string, command: string, options?: SSHExecOptions) => Promise<{ stdout: string; stderr: string; code: number }>;
        putFile: (connectionId: string, localPath: string, remotePath: string) => Promise<boolean>;
        getFile: (connectionId: string, remotePath: string, localPath: string) => Promise<boolean>;
        listDirectory: (connectionId: string, path: string) => Promise<SSHFile[]>;
        copyPath: (
            connectionId: string,
            sourcePath: string,
            destinationPath: string
        ) => Promise<{ success: boolean; error?: string }>;
        getSystemStats: (connectionId: string) => Promise<SSHSystemStats>;
        onSystemStats: (callback: (data: { connectionId: string; stats: SSHSystemStats }) => void) => () => void;
        getLogFiles: (connectionId: string) => Promise<string[]>;
        readLogFile: (connectionId: string, path: string, lines?: number) => Promise<string>;
        getProfiles: () => Promise<SSHConfig[]>;
        saveProfile: (profile: SSHConfig) => Promise<boolean>;
        deleteProfile: (id: string) => Promise<boolean>;
        createTunnel: (payload: RuntimeValue) => Promise<RuntimeValue>;
        listTunnels: (connectionId?: string) => Promise<SSHPortForward[]>;
        closeTunnel: (forwardId: string) => Promise<boolean>;
        saveTunnelPreset: (preset: RuntimeValue) => Promise<SSHTunnelPreset>;
        listTunnelPresets: () => Promise<SSHTunnelPreset[]>;
        deleteTunnelPreset: (id: string) => Promise<boolean>;
        listManagedKeys: () => Promise<SSHManagedKey[]>;
        generateManagedKey: (payload: RuntimeValue) => Promise<RuntimeValue>;
        importManagedKey: (payload: RuntimeValue) => Promise<SSHManagedKey>;
        deleteManagedKey: (id: string) => Promise<boolean>;
        rotateManagedKey: (payload: RuntimeValue) => Promise<SSHManagedKey | null>;
        backupManagedKey: (id: string) => Promise<RuntimeValue>;
        listKnownHosts: () => Promise<SSHKnownHostEntry[]>;
        addKnownHost: (payload: SSHKnownHostEntry) => Promise<boolean>;
        removeKnownHost: (payload: RuntimeValue) => Promise<boolean>;
        searchRemoteFiles: (payload: RuntimeValue) => Promise<SSHRemoteSearchResult[]>;
        getSearchHistory: (connectionId?: string) => Promise<SSHSearchHistoryEntry[]>;
        exportSearchHistory: () => Promise<string>;
        reconnect: (connectionId: string, retries?: number) => Promise<RuntimeValue>;
        acquireConnection: (connectionId: string) => Promise<RuntimeValue>;
        releaseConnection: (connectionId: string) => Promise<boolean>;
        getConnectionPoolStats: () => Promise<RuntimeValue[]>;
        enqueueTransfer: (task: SSHTransferTask) => Promise<void>;
        getTransferQueue: () => Promise<SSHTransferTask[]>;
        runTransferBatch: (tasks: Array<RuntimeValue>, concurrency?: number) => Promise<boolean[]>;
        listRemoteContainers: (connectionId: string) => Promise<SSHDevContainer[]>;
        runRemoteContainer: (payload: RuntimeValue) => Promise<RuntimeValue>;
        stopRemoteContainer: (connectionId: string, containerId: string) => Promise<boolean>;
        saveProfileTemplate: (template: RuntimeValue) => Promise<SSHProfileTemplate>;
        listProfileTemplates: () => Promise<SSHProfileTemplate[]>;
        deleteProfileTemplate: (id: string) => Promise<boolean>;
        exportProfiles: (ids?: string[]) => Promise<string>;
        importProfiles: (payload: string) => Promise<number>;
        validateProfile: (profile: RuntimeValue) => Promise<RuntimeValue>;
        testProfile: (profile: RuntimeValue) => Promise<RuntimeValue>;
        startSessionRecording: (connectionId: string) => Promise<SSHSessionRecording>;
        stopSessionRecording: (connectionId: string) => Promise<SSHSessionRecording | null>;
        getSessionRecording: (connectionId: string) => Promise<SSHSessionRecording | null>;
        searchSessionRecording: (connectionId: string, query: string) => Promise<string[]>;
        exportSessionRecording: (connectionId: string) => Promise<string>;
        listSessionRecordings: () => Promise<SSHSessionRecording[]>;
    };

    mcp: {
        list: () => Promise<Array<{ name: string; status: string; type: string }>>;
        dispatch: (service: string, action: string, args?: Record<string, IpcValue>) => Promise<Record<string, IpcValue>>;
        toggle: (service: string, enabled: boolean) => Promise<{ success: boolean; isEnabled: boolean }>;
        install: (config: MCPServerConfig) => Promise<{ success: boolean; error?: string }>;
        uninstall: (name: string) => Promise<{ success: boolean }>;
        getDebugMetrics: () => Promise<RuntimeValue[]>;
        listPermissionRequests: () => Promise<RuntimeValue[]>;
        setActionPermission: (service: string, action: string, policy: string) => Promise<RuntimeValue>;
        resolvePermissionRequest: (requestId: string, decision: string) => Promise<RuntimeValue>;
        onResult: (callback: (result: Record<string, IpcValue>) => void) => void;
        removeResultListener: () => void;
    };

    proxyEmbed: {
        start: (options?: RuntimeValue) => Promise<Record<string, IpcValue>>;
        stop: () => Promise<Record<string, IpcValue>>;
        status: () => Promise<Record<string, IpcValue>>;
    };

    captureScreenshot: () => Promise<{ success: boolean; image?: string; error?: string }>;
    captureCookies: (url: string, timeoutMs?: number) => Promise<{ success: boolean }>;
    openExternal: (url: string) => void;
    openTerminal: (command: string) => Promise<boolean>;

    readPdf: (path: string) => Promise<{ success: boolean; text?: string; error?: string }>;
    selectDirectory: () => Promise<{ success: boolean; path?: string }>;
    selectFile: (options?: RuntimeValue) => Promise<{ success: boolean; path?: string }>;
    listDirectory: (path: string) => Promise<{ success: boolean; files?: FileEntry[]; error?: string }>;
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
    searchFiles: (rootPath: string, pattern: string) => Promise<{ success: boolean; matches?: string[]; error?: string }>;
    saveFile: (content: string, filename: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    exportChatToPdf: (chatId: string, title: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    exportMarkdown: (content: string, filePath: string) => Promise<{ success: boolean; error?: string }>;
    exportPDF: (htmlContent: string, filePath: string) => Promise<{ success: boolean; error?: string }>;
    searchFilesStream: (rootPath: string, pattern: string, onResult: (path: string) => void, onComplete?: () => void) => () => void;

    files: {
        listDirectory: (path: string) => Promise<FileEntry[]>;
        readFile: (path: string) => Promise<string>;
        readImage: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>;
        writeFile: (
            path: string,
            content: string,
            context?: { aiSystem?: string; chatSessionId?: string; changeReason?: string }
        ) => Promise<void>;
        exists: (path: string) => Promise<boolean>;
        copyPath: (
            sourcePath: string,
            destinationPath: string
        ) => Promise<{ success: boolean; error?: string }>;
    };

    workspace: {
        analyze: (rootPath: string, workspaceId: string) => Promise<WorkspaceAnalysis>;
        analyzeSummary: (rootPath: string, workspaceId?: string) => Promise<WorkspaceAnalysis>;
        getFileDiagnostics: (
            rootPath: string,
            filePath: string,
            content: string
        ) => Promise<WorkspaceIssue[]>;
        getFileDefinition: (
            rootPath: string,
            filePath: string,
            content: string,
            line: number,
            column: number
        ) => Promise<WorkspaceDefinitionLocation[]>;
        analyzeIdentity: (rootPath: string) => Promise<{ suggestedPrompts: string[]; colors: string[] }>;
        generateLogo: (
            workspacePath: string,
            options: { prompt: string; style: string; model: string; count: number }
        ) => Promise<string[]>;
        analyzeDirectory: (dirPath: string) => Promise<{
            hasPackageJson: boolean;
            pkg: Record<string, IpcValue>;
            stats: WorkspaceStats;
        }>;
        applyLogo: (workspacePath: string, tempLogoPath: string) => Promise<string>;
        getCompletion: (text: string) => Promise<string>;
        getInlineSuggestion: (request: InlineSuggestionRequest) => Promise<InlineSuggestionResponse>;
        trackInlineSuggestionStats: (
            event: InlineSuggestionUsageStats
        ) => Promise<{ success: boolean }>;
        improveLogoPrompt: (prompt: string) => Promise<string>;
        uploadLogo: (workspacePath: string) => Promise<string | null>;
        watch: (rootPath: string) => Promise<boolean>;
        unwatch: (rootPath: string) => Promise<boolean>;
        setActive: (rootPath: string | null) => Promise<{ rootPath: string | null }>;
        clearActive: (rootPath?: string) => Promise<{ rootPath: string | null }>;
        onFileChange: (callback: (event: string, path: string, rootPath: string) => void) => () => void;
    };

    process: {
        spawn: (command: string, args: string[], cwd: string) => Promise<string>;
        kill: (id: string) => Promise<boolean>;
        list: () => Promise<ProcessInfo[]>;
        scanScripts: (rootPath: string) => Promise<Record<string, string>>;
        resize: (id: string, cols: number, rows: number) => Promise<void>;
        write: (id: string, data: string) => Promise<void>;
        onData: (callback: (data: { id: string; data: string }) => void) => () => void;
        onExit: (callback: (data: { id: string; code: number }) => void) => () => void;
        removeListeners: () => void;
    };

    getSettings: () => Promise<AppSettings>;
    saveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;

    huggingface: {
        searchModels: (query: string, limit: number, page: number, sort?: string) => Promise<RuntimeValue>;
        getRecommendations: (limit?: number, query?: string) => Promise<RuntimeValue[]>;
        getFiles: (modelId: string) => Promise<RuntimeValue[]>;
        getModelPreview: (modelId: string) => Promise<RuntimeValue>;
        compareModels: (modelIds: string[]) => Promise<RuntimeValue>;
        validateCompatibility: (file: RuntimeValue, availableRamGB?: number, availableVramGB?: number) => Promise<RuntimeValue>;
        getWatchlist: () => Promise<string[]>;
        addToWatchlist: (modelId: string) => Promise<{ success: boolean }>;
        removeFromWatchlist: (modelId: string) => Promise<{ success: boolean }>;
        getCacheStats: () => Promise<RuntimeValue>;
        clearCache: () => Promise<{ success: boolean; removed: number }>;
        testDownloadedModel: (filePath: string) => Promise<RuntimeValue>;
        getConversionPresets: () => Promise<RuntimeValue[]>;
        getOptimizationSuggestions: (options: RuntimeValue) => Promise<string[]>;
        validateConversion: (options: RuntimeValue) => Promise<RuntimeValue>;
        convertModel: (options: RuntimeValue) => Promise<RuntimeValue>;
        onConversionProgress: (callback: (progress: RuntimeValue) => void) => () => void;
        getModelVersions: (modelId: string) => Promise<RuntimeValue[]>;
        registerModelVersion: (modelId: string, filePath: string, notes?: string) => Promise<RuntimeValue>;
        compareModelVersions: (modelId: string, leftVersionId: string, rightVersionId: string) => Promise<RuntimeValue>;
        rollbackModelVersion: (modelId: string, versionId: string, targetPath: string) => Promise<RuntimeValue>;
        pinModelVersion: (modelId: string, versionId: string, pinned: boolean) => Promise<{ success: boolean }>;
        getVersionNotifications: (modelId: string) => Promise<string[]>;
        prepareFineTuneDataset: (inputPath: string, outputPath: string) => Promise<RuntimeValue>;
        startFineTune: (modelId: string, datasetPath: string, outputPath: string, options?: RuntimeValue) => Promise<RuntimeValue>;
        listFineTuneJobs: (modelId?: string) => Promise<RuntimeValue[]>;
        getFineTuneJob: (jobId: string) => Promise<RuntimeValue>;
        cancelFineTuneJob: (jobId: string) => Promise<{ success: boolean }>;
        evaluateFineTuneJob: (jobId: string) => Promise<RuntimeValue>;
        exportFineTunedModel: (jobId: string, exportPath: string) => Promise<{ success: boolean; error?: string }>;
        onFineTuneProgress: (callback: (job: RuntimeValue) => void) => () => void;
        downloadFile: (url: string, outputPath: string, expectedSize: number, expectedSha256: string, scheduleAtMs?: number) => Promise<RuntimeValue>;
        onDownloadProgress: (callback: (progress: RuntimeValue) => void) => void;
        cancelDownload: () => void;
    };

    log: {
        write: (level: string, message: string, data?: IpcValue, context?: string) => void;
        debug: (message: string, data?: IpcValue, context?: string) => void;
        info: (message: string, data?: IpcValue, context?: string) => void;
        warn: (message: string, data?: IpcValue, context?: string) => void;
        error: (message: string, data?: IpcValue, context?: string) => void;
    };

    gallery: {
        list: () => Promise<RuntimeValue[]>;
        delete: (path: string) => Promise<boolean>;
        open: (path: string) => Promise<boolean>;
        reveal: (path: string) => Promise<boolean>;
        batchDownload: (input: RuntimeValue) => Promise<RuntimeValue>;
    };

    onAgentEvent: (callback: (payload: RuntimeValue) => void) => () => void;
    onSdCppStatus: (callback: (data: RuntimeValue) => void) => () => void;
    onSdCppProgress: (callback: (data: RuntimeValue) => void) => () => void;
    getUserDataPath: () => Promise<string>;

    update: {
        checkForUpdates: () => Promise<void>;
        downloadUpdate: () => Promise<void>;
        installUpdate: () => Promise<void>;
    };

    modelRegistry: {
        getAllModels: () => Promise<ModelDefinition[]>;
        getRemoteModels: () => Promise<ModelDefinition[]>;
        getInstalledModels: () => Promise<ModelDefinition[]>;
    };

    ipcRenderer: {
        on: (channel: string, listener: (event: IpcRendererEvent, ...args: IpcValue[]) => void) => () => void;
        off: (channel: string, listener: (event: IpcRendererEvent, ...args: IpcValue[]) => void) => void;
        send: (channel: string, ...args: IpcValue[]) => void;
        invoke: <T = IpcValue>(channel: string, ...args: IpcValue[]) => Promise<T>;
        removeAllListeners: (channel: string) => void;
    };

    getLinkedAccounts: (provider?: string) => Promise<LinkedAccountInfo[]>;
    getActiveLinkedAccount: (provider: string) => Promise<LinkedAccountInfo | null>;
    setActiveLinkedAccount: (provider: string, accountId: string) => Promise<{ success: boolean; error?: string }>;
    linkAccount: (provider: string, tokenData: TokenData) => Promise<{ success: boolean; account?: LinkedAccountInfo; error?: string }>;
    unlinkAccount: (accountId: string) => Promise<{ success: boolean; error?: string }>;
    unlinkProvider: (provider: string) => Promise<{ success: boolean; error?: string }>;
    hasLinkedAccount: (provider: string) => Promise<boolean>;

    performance: {
        getMetrics: () => Promise<RuntimeValue>;
        onUpdate: (callback: (metrics: RuntimeValue) => void) => () => void;
    };

    batch: {
        invoke: (requests: RuntimeValue[]) => Promise<RuntimeValue[]>;
        invokeSequential: (requests: RuntimeValue[]) => Promise<RuntimeValue[]>;
        getChannels: () => Promise<string[]>;
    };

    lazyServices: {
        getStatus: () => Promise<RuntimeValue>;
    };

    ipcContract: {
        getVersion: () => Promise<IpcContractVersionInfo>;
        isCompatible: () => Promise<boolean>;
    };

    backup: {
        create: (options: RuntimeValue) => Promise<RuntimeValue>;
        restore: (backupPath: string, options: RuntimeValue) => Promise<RuntimeValue>;
        list: () => Promise<RuntimeValue[]>;
        delete: (backupPath: string) => Promise<boolean>;
        getDir: () => Promise<string>;
        getAutoBackupStatus: () => Promise<RuntimeValue>;
        configureAutoBackup: (config: RuntimeValue) => Promise<RuntimeValue>;
        cleanup: () => Promise<void>;
        verify: (backupPath: string) => Promise<RuntimeValue>;
        syncToCloudDir: (backupPath: string, targetDir: string) => Promise<RuntimeValue>;
        createDisasterRecoveryBundle: (targetDir: string) => Promise<RuntimeValue>;
        restoreDisasterRecoveryBundle: (bundlePath: string) => Promise<RuntimeValue>;
    };

    export: {
        chat: (chat: Chat, options: RuntimeValue) => Promise<RuntimeValue>;
        chatToMarkdown: (chat: Chat, options: RuntimeValue) => Promise<RuntimeValue>;
        chatToHTML: (chat: Chat, options: RuntimeValue) => Promise<RuntimeValue>;
        chatToJSON: (chat: Chat, options: RuntimeValue) => Promise<RuntimeValue>;
        chatToText: (chat: Chat, options: RuntimeValue) => Promise<RuntimeValue>;
        chatToPDF: (chat: Chat, options: RuntimeValue) => Promise<RuntimeValue>;
        getContent: (chat: Chat, options: RuntimeValue) => Promise<RuntimeValue>;
    };

    session: {
        conversation: import('./session-conversation').SessionConversationApi;
        workspace: import('./session-domain-apis').SessionWorkspaceApi;
        council: import('./session-domain-apis').SessionCouncilApi;
        workspaceAgent: import('./session-domain-apis').SessionWorkspaceAgentApi;
        getState: (sessionId: string) => Promise<SessionState | null>;
        list: () => Promise<SessionRecoverySnapshot[]>;
        listCapabilities: () => Promise<SessionCapabilityDescriptor[]>;
        health: () => Promise<{ status: 'ready'; activeSessions: number }>;
        onEvent: (callback: (event: SessionEventEnvelope) => void) => () => void;
    };

    extension: {
        shouldShowWarning: () => Promise<boolean>;
        dismissWarning: () => Promise<void>;
        getStatus: () => Promise<RuntimeValue>;
        setInstalled: (installed: boolean) => Promise<void>;
        getAll: () => Promise<RuntimeValue[]>;
        get: (extensionId: string) => Promise<RuntimeValue>;
        install: (extensionPath: string) => Promise<RuntimeValue>;
        uninstall: (extensionId: string) => Promise<RuntimeValue>;
        activate: (extensionId: string) => Promise<RuntimeValue>;
        deactivate: (extensionId: string) => Promise<RuntimeValue>;
        devStart: (options: RuntimeValue) => Promise<RuntimeValue>;
        devStop: (extensionId: string) => Promise<RuntimeValue>;
        devReload: (extensionId: string) => Promise<RuntimeValue>;
        test: (options: RuntimeValue) => Promise<RuntimeValue>;
        publish: (options: RuntimeValue) => Promise<RuntimeValue>;
        getProfile: (extensionId: string) => Promise<RuntimeValue>;
        validate: (manifest: RuntimeValue) => Promise<RuntimeValue>;
    };

    clipboard: {
        writeText: (text: string) => Promise<void>;
        readText: () => Promise<string>;
    };

    modelDownloader: {
        start: (request: RuntimeValue) => Promise<string>;
        pause: (downloadId: string) => Promise<void>;
        resume: (downloadId: string) => Promise<void>;
        cancel: (downloadId: string) => Promise<void>;
    };

    promptTemplates: {
        getAll: () => Promise<RuntimeValue[]>;
        getByCategory: (category: string) => Promise<RuntimeValue[]>;
        getByTag: (tag: string) => Promise<RuntimeValue[]>;
        search: (query: string) => Promise<RuntimeValue[]>;
        get: (id: string) => Promise<RuntimeValue>;
        create: (template: RuntimeValue) => Promise<RuntimeValue>;
        update: (id: string, updates: RuntimeValue) => Promise<RuntimeValue>;
        delete: (id: string) => Promise<{ success: boolean }>;
        render: (templateId: string, variables: Record<string, string>) => Promise<string>;
        getCategories: () => Promise<string[]>;
        getTags: () => Promise<string[]>;
    };

    sharedPrompts: {
        list: (filter?: {
            query?: string;
            category?: string;
            tags?: string[];
            limit?: number;
            offset?: number;
        }) => Promise<Array<{
            id: string;
            title: string;
            content: string;
            category: string;
            tags: string[];
            author: string;
            createdAt: number;
    decryptionError?: boolean;
            updatedAt: number;
        }>>;
        create: (input: {
            title: string;
            content: string;
            category?: string;
            tags?: string[];
            author?: string;
        }) => Promise<{
            id: string;
            title: string;
            content: string;
            category: string;
            tags: string[];
            author: string;
            createdAt: number;
    decryptionError?: boolean;
            updatedAt: number;
        }>;
        update: (id: string, input: {
            title?: string;
            content?: string;
            category?: string;
            tags?: string[];
            author?: string;
        }) => Promise<{
            id: string;
            title: string;
            content: string;
            category: string;
            tags: string[];
            author: string;
            createdAt: number;
    decryptionError?: boolean;
            updatedAt: number;
        } | undefined>;
        delete: (id: string) => Promise<boolean>;
        export: (filePath?: string) => Promise<{ success: boolean; path?: string; data?: string }>;
        import: (filePathOrJson: string, isFilePath?: boolean) => Promise<{ success: boolean; imported: number }>;
    };

    userCollaboration: {
        joinRoom: (params: JoinCollaborationRoom) => Promise<CollaborationResponse>;
        leaveRoom: (roomId: string) => Promise<CollaborationResponse>;
        sendUpdate: (params: CollaborationSyncUpdate) => Promise<CollaborationResponse>;
        onJoined: (callback: (payload: { roomId: string }) => void) => () => void;
        onLeft: (callback: (payload: { roomId: string }) => void) => () => void;
        onSyncUpdate: (callback: (payload: { roomId: string; data: string }) => void) => () => void;
        onError: (callback: (payload: { roomId: string; error: string }) => void) => () => void;
    };
    runtime: {
        getStatus: () => Promise<RuntimeBootstrapExecutionResult | null>;
        refreshStatus: () => Promise<RuntimeBootstrapExecutionResult | null>;
        repair: (manifestUrl?: string) => Promise<RuntimeBootstrapExecutionResult | null>;
        runComponentAction: (componentId: string) => Promise<{ success: boolean; message: string }>;
    };
    liveCollaboration: ElectronAPI['userCollaboration'];
}

