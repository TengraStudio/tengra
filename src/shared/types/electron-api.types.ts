import type {
    InlineSuggestionRequest,
    InlineSuggestionResponse,
    InlineSuggestionTelemetry,
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
import { DbMarketplaceModel } from './db-api';
import {
    AgentDefinition,
    AgentStartOptions,
    AppSettings,
    Chat,
    ChatRequest,
    ChatStreamRequest,
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
    ToolCall,
    WorkspaceAnalysis,
    WorkspaceState,
    WorkspaceStep,
} from './index';
import {
    OrchestratorState,
} from './workspace-agent';

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
    };
    percentage?: number;
    reset?: string;
    [key: string]: IpcValue | undefined;
}

export interface OllamaMarketplaceModelDetails {
    name: string;
    shortDescription: string;
    longDescriptionHtml: string;
    versions: Array<{
        version: string;
        size: string;
        maxContext: string;
        inputType: string;
        digest: string;
    }>;
}

export interface HuggingFaceMarketplaceModelDetails {
    name: string;
    shortDescription: string;
    longDescriptionMarkdown: string;
}

export type MarketplaceModelDetails = OllamaMarketplaceModelDetails | HuggingFaceMarketplaceModelDetails;

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
}

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

export interface IpcContractVersionInfo {
    version: string;
    minCompatibleVersion: string;
}

export interface ElectronAPI {
    // Window controls
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    resizeWindow: (resolution: string) => void;
    toggleCompact: (enabled: boolean) => void;

    // Auth
    githubLogin: (appId?: 'profile' | 'copilot') => Promise<{
        device_code: string;
        user_code: string;
        verification_uri: string;
        expires_in: number;
        interval: number;
    }>;
    pollToken: (
        deviceCode: string,
        interval: number,
        appId?: 'profile' | 'copilot'
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
    antigravityLogin: () => Promise<{ url: string; state: string }>;
    codexLogin: () => Promise<{ url: string; state: string }>;
    claudeLogin: () => Promise<{ url: string; state: string }>;

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

    // Ollama chat
    getModels: () => Promise<ModelDefinition[] | { antigravityError?: string }>;
    chat: (messages: Message[], model: string) => Promise<{ content: string; done: boolean }>;
    chatOpenAI: (request: ChatRequest) => Promise<{
        content: string;
        toolCalls?: ToolCall[];
        reasoning?: string;
        images?: string[];
        sources?: string[];
    }>;
    chatStream: (request: ChatStreamRequest) => Promise<{ success: boolean; queued?: boolean }>;
    abortChat: (chatId?: string) => void;
    onStreamChunk: (
        callback: (chunk: { content?: string; toolCalls?: ToolCall[]; reasoning?: string }) => void
    ) => () => void;
    removeStreamChunkListener: () => void;

    // Ollama management
    isOllamaRunning: () => Promise<boolean>;
    startOllama: () => Promise<{ success: boolean; message: string }>;
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

    // Marketplace API (models from database)
    marketplace: {
        getModels: (provider?: 'ollama' | 'huggingface', limit?: number, offset?: number) => Promise<DbMarketplaceModel[]>;
        searchModels: (query: string, provider?: 'ollama' | 'huggingface', limit?: number) => Promise<DbMarketplaceModel[]>;
        getModelDetails: (modelName: string, provider?: 'ollama' | 'huggingface') => Promise<MarketplaceModelDetails | null>;
        getStatus: () => Promise<{ lastScrapeTime: number; isScraping: boolean }>;
    };

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
            provider?: 'antigravity' | 'ollama' | 'sd-webui' | 'comfyui' | 'pollinations' | 'sd-cpp';
        }) => Promise<unknown>;
        deletePreset: (id: string) => Promise<boolean>;
        exportPresetShare: (id: string) => Promise<string>;
        importPresetShare: (code: string) => Promise<unknown>;
        listWorkflowTemplates: () => Promise<Array<{
            id: string;
            name: string;
            description?: string;
            workflow: Record<string, unknown>;
            createdAt: number;
            updatedAt: number;
        }>>;
        saveWorkflowTemplate: (payload: {
            id?: string;
            name: string;
            description?: string;
            workflow: Record<string, unknown>;
        }) => Promise<unknown>;
        deleteWorkflowTemplate: (id: string) => Promise<boolean>;
        exportWorkflowTemplateShare: (id: string) => Promise<string>;
        importWorkflowTemplateShare: (code: string) => Promise<unknown>;
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
        }) => Promise<unknown>;
        listSchedules: () => Promise<unknown[]>;
        cancelSchedule: (id: string) => Promise<boolean>;
        compare: (ids: string[]) => Promise<unknown>;
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
        onMessage: (callback: (message: unknown) => void) => void;
        onUserJoin: (callback: (user: unknown) => void) => void;
        onUserLeave: (callback: (user: unknown) => void) => void;
    };

    audit: {
        log: (event: string, details: Record<string, IpcValue>) => Promise<void>;
        getLogs: (options?: { limit?: number; offset?: number }) => Promise<unknown[]>;
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
        importProfiles: (payload: string, options: unknown) => Promise<unknown>;
        importProfileShareCode: (shareCode: string, options: unknown) => Promise<unknown>;
        getShells: () => Promise<string[]>;
        getBackends: () => Promise<string[]>;
        getRuntimeHealth: () => Promise<unknown>;
        getDockerContainers: () => Promise<unknown[]>;
        create: (options: unknown) => Promise<string>;
        detach: (options: unknown) => Promise<void>;
        getCommandHistory: (query: string, limit?: number) => Promise<unknown[]>;
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
        getSessions: () => Promise<unknown[]>;
        restoreAllSnapshots: () => Promise<void>;
        exportSession: (sessionId: string, options: unknown) => Promise<string>;
        importSession: (payload: unknown, options: unknown) => Promise<string>;
        createSessionShareCode: (sessionId: string, options: unknown) => Promise<string>;
        importSessionShareCode: (shareCode: string, options: unknown) => Promise<string>;
        getSnapshotSessions: () => Promise<unknown[]>;
        getSessionTemplates: () => Promise<unknown[]>;
        saveSessionTemplate: (payload: unknown) => Promise<unknown>;
        deleteSessionTemplate: (templateId: string) => Promise<boolean>;
        createFromSessionTemplate: (templateId: string, options: unknown) => Promise<string>;
        restoreSnapshotSession: (snapshotId: string) => Promise<string>;
        searchScrollback: (sessionId: string, query: string, options: unknown) => Promise<unknown[]>;
        exportScrollback: (sessionId: string, exportPath: string) => Promise<boolean>;
        getSessionAnalytics: (sessionId: string) => Promise<unknown>;
        getSearchAnalytics: () => Promise<unknown>;
        getSearchSuggestions: (query: string, limit?: number) => Promise<string[]>;
        exportSearchResults: (sessionId: string, query: string, options: unknown) => Promise<boolean>;
        addScrollbackMarker: (sessionId: string, label: string, lineNumber: number) => Promise<string>;
        listScrollbackMarkers: (sessionId: string) => Promise<unknown[]>;
        deleteScrollbackMarker: (markerId: string) => Promise<boolean>;
        filterScrollback: (sessionId: string, options: unknown) => Promise<unknown[]>;
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
        getSystemStats: (connectionId: string) => Promise<SSHSystemStats>;
        onSystemStats: (callback: (data: { connectionId: string; stats: SSHSystemStats }) => void) => () => void;
        getLogFiles: (connectionId: string) => Promise<string[]>;
        readLogFile: (connectionId: string, path: string, lines?: number) => Promise<string>;
        getProfiles: () => Promise<SSHConfig[]>;
        saveProfile: (profile: SSHConfig) => Promise<boolean>;
        deleteProfile: (id: string) => Promise<boolean>;
        createTunnel: (payload: unknown) => Promise<unknown>;
        listTunnels: (connectionId?: string) => Promise<SSHPortForward[]>;
        closeTunnel: (forwardId: string) => Promise<boolean>;
        saveTunnelPreset: (preset: unknown) => Promise<SSHTunnelPreset>;
        listTunnelPresets: () => Promise<SSHTunnelPreset[]>;
        deleteTunnelPreset: (id: string) => Promise<boolean>;
        listManagedKeys: () => Promise<SSHManagedKey[]>;
        generateManagedKey: (payload: unknown) => Promise<unknown>;
        importManagedKey: (payload: unknown) => Promise<SSHManagedKey>;
        deleteManagedKey: (id: string) => Promise<boolean>;
        rotateManagedKey: (payload: unknown) => Promise<SSHManagedKey | null>;
        backupManagedKey: (id: string) => Promise<unknown>;
        listKnownHosts: () => Promise<SSHKnownHostEntry[]>;
        addKnownHost: (payload: SSHKnownHostEntry) => Promise<boolean>;
        removeKnownHost: (payload: unknown) => Promise<boolean>;
        searchRemoteFiles: (payload: unknown) => Promise<SSHRemoteSearchResult[]>;
        getSearchHistory: (connectionId?: string) => Promise<SSHSearchHistoryEntry[]>;
        exportSearchHistory: () => Promise<string>;
        reconnect: (connectionId: string, retries?: number) => Promise<unknown>;
        acquireConnection: (connectionId: string) => Promise<unknown>;
        releaseConnection: (connectionId: string) => Promise<boolean>;
        getConnectionPoolStats: () => Promise<unknown[]>;
        enqueueTransfer: (task: SSHTransferTask) => Promise<void>;
        getTransferQueue: () => Promise<SSHTransferTask[]>;
        runTransferBatch: (tasks: Array<unknown>, concurrency?: number) => Promise<boolean[]>;
        listRemoteContainers: (connectionId: string) => Promise<SSHDevContainer[]>;
        runRemoteContainer: (payload: unknown) => Promise<unknown>;
        stopRemoteContainer: (connectionId: string, containerId: string) => Promise<boolean>;
        saveProfileTemplate: (template: unknown) => Promise<SSHProfileTemplate>;
        listProfileTemplates: () => Promise<SSHProfileTemplate[]>;
        deleteProfileTemplate: (id: string) => Promise<boolean>;
        exportProfiles: (ids?: string[]) => Promise<string>;
        importProfiles: (payload: string) => Promise<number>;
        validateProfile: (profile: unknown) => Promise<unknown>;
        testProfile: (profile: unknown) => Promise<unknown>;
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
        getDebugMetrics: () => Promise<unknown[]>;
        listPermissionRequests: () => Promise<unknown[]>;
        setActionPermission: (service: string, action: string, policy: string) => Promise<unknown>;
        resolvePermissionRequest: (requestId: string, decision: string) => Promise<unknown>;
        onResult: (callback: (result: Record<string, IpcValue>) => void) => void;
        removeResultListener: () => void;
    };

    mcpMarketplace: {
        list: () => Promise<{ success: boolean; servers?: unknown[]; error?: string }>;
        search: (query: string) => Promise<{ success: boolean; servers?: unknown[]; error?: string }>;
        filter: (category: string) => Promise<{ success: boolean; servers?: unknown[]; error?: string }>;
        categories: () => Promise<{ success: boolean; categories?: string[]; error?: string }>;
        install: (serverId: string) => Promise<{ success: boolean; error?: string }>;
        uninstall: (serverId: string) => Promise<{ success: boolean; error?: string }>;
        installed: () => Promise<{ success: boolean; servers?: MCPServerConfig[]; error?: string }>;
        toggle: (serverId: string, enabled: boolean) => Promise<{ success: boolean; error?: string }>;
        updateConfig: (serverId: string, patch: Partial<MCPServerConfig>) => Promise<{ success: boolean; error?: string }>;
        versionHistory: (serverId: string) => Promise<{ success: boolean; history?: string[]; error?: string }>;
        rollbackVersion: (serverId: string, targetVersion: string) => Promise<{ success: boolean; error?: string }>;
        debug: () => Promise<{ success: boolean; metrics?: Record<string, IpcValue>; error?: string }>;
        refresh: () => Promise<{ success: boolean; error?: string }>;
        health: () => Promise<unknown>;
    };

    proxyEmbed: {
        start: (options?: unknown) => Promise<Record<string, IpcValue>>;
        stop: () => Promise<Record<string, IpcValue>>;
        status: () => Promise<Record<string, IpcValue>>;
    };

    captureScreenshot: () => Promise<{ success: boolean; image?: string; error?: string }>;
    captureCookies: (url: string, timeoutMs?: number) => Promise<{ success: boolean }>;
    openExternal: (url: string) => void;
    openTerminal: (command: string) => Promise<boolean>;

    readPdf: (path: string) => Promise<{ success: boolean; text?: string; error?: string }>;
    selectDirectory: () => Promise<{ success: boolean; path?: string }>;
    selectFile: (options?: unknown) => Promise<{ success: boolean; path?: string }>;
    listDirectory: (path: string) => Promise<{ success: boolean; files?: FileEntry[]; error?: string }>;
    readFile: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>;
    writeFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>;
    createDirectory: (path: string) => Promise<{ success: boolean; error?: string }>;
    deleteFile: (path: string) => Promise<{ success: boolean; error?: string }>;
    deleteDirectory: (path: string) => Promise<{ success: boolean; error?: string }>;
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
        writeFile: (path: string, content: string) => Promise<void>;
        exists: (path: string) => Promise<boolean>;
    };

    workspace: {
        analyze: (rootPath: string, workspaceId: string) => Promise<WorkspaceAnalysis>;
        analyzeIdentity: (rootPath: string) => Promise<{ suggestedPrompts: string[]; colors: string[] }>;
        generateLogo: (
            workspacePath: string,
            options: { prompt: string; style: string; model: string; count: number }
        ) => Promise<string[]>;
        analyzeDirectory: (dirPath: string) => Promise<{
            hasPackageJson: boolean;
            pkg: Record<string, IpcValue>;
            readme: string | null;
            stats: { fileCount: number; totalSize: number };
        }>;
        applyLogo: (workspacePath: string, tempLogoPath: string) => Promise<string>;
        getCompletion: (text: string) => Promise<string>;
        getInlineSuggestion: (request: InlineSuggestionRequest) => Promise<InlineSuggestionResponse>;
        trackInlineSuggestionTelemetry: (
            event: InlineSuggestionTelemetry
        ) => Promise<{ success: boolean }>;
        improveLogoPrompt: (prompt: string) => Promise<string>;
        uploadLogo: (workspacePath: string) => Promise<string | null>;
        watch: (rootPath: string) => Promise<boolean>;
        unwatch: (rootPath: string) => Promise<boolean>;
        onFileChange: (callback: (event: string, path: string, rootPath: string) => void) => () => void;
    };

    process: {
        spawn: (command: string, args: string[], cwd: string) => Promise<string>;
        kill: (id: string) => Promise<boolean>;
        list: () => Promise<ProcessInfo[]>;
        scanScripts: (rootPath: string) => Promise<Record<string, string>>;
        resize: (id: string, cols: number, rows: number) => Promise<void>;
        write: (id: string, data: string) => Promise<void>;
        onData: (callback: (data: { id: string; data: string }) => void) => void;
        onExit: (callback: (data: { id: string; code: number }) => void) => void;
        removeListeners: () => void;
    };

    getSettings: () => Promise<AppSettings>;
    saveSettings: (settings: AppSettings) => Promise<AppSettings>;

    huggingface: {
        searchModels: (query: string, limit: number, page: number, sort?: string) => Promise<unknown>;
        getRecommendations: (limit?: number, query?: string) => Promise<unknown[]>;
        getFiles: (modelId: string) => Promise<unknown[]>;
        getModelPreview: (modelId: string) => Promise<unknown>;
        compareModels: (modelIds: string[]) => Promise<unknown>;
        validateCompatibility: (file: unknown, availableRamGB?: number, availableVramGB?: number) => Promise<unknown>;
        getWatchlist: () => Promise<string[]>;
        addToWatchlist: (modelId: string) => Promise<{ success: boolean }>;
        removeFromWatchlist: (modelId: string) => Promise<{ success: boolean }>;
        getCacheStats: () => Promise<unknown>;
        clearCache: () => Promise<{ success: boolean; removed: number }>;
        testDownloadedModel: (filePath: string) => Promise<unknown>;
        getConversionPresets: () => Promise<unknown[]>;
        getOptimizationSuggestions: (options: unknown) => Promise<string[]>;
        validateConversion: (options: unknown) => Promise<unknown>;
        convertModel: (options: unknown) => Promise<unknown>;
        onConversionProgress: (callback: (progress: unknown) => void) => () => void;
        getModelVersions: (modelId: string) => Promise<unknown[]>;
        registerModelVersion: (modelId: string, filePath: string, notes?: string) => Promise<unknown>;
        compareModelVersions: (modelId: string, leftVersionId: string, rightVersionId: string) => Promise<unknown>;
        rollbackModelVersion: (modelId: string, versionId: string, targetPath: string) => Promise<unknown>;
        pinModelVersion: (modelId: string, versionId: string, pinned: boolean) => Promise<{ success: boolean }>;
        getVersionNotifications: (modelId: string) => Promise<string[]>;
        prepareFineTuneDataset: (inputPath: string, outputPath: string) => Promise<unknown>;
        startFineTune: (modelId: string, datasetPath: string, outputPath: string, options?: unknown) => Promise<unknown>;
        listFineTuneJobs: (modelId?: string) => Promise<unknown[]>;
        getFineTuneJob: (jobId: string) => Promise<unknown>;
        cancelFineTuneJob: (jobId: string) => Promise<{ success: boolean }>;
        evaluateFineTuneJob: (jobId: string) => Promise<unknown>;
        exportFineTunedModel: (jobId: string, exportPath: string) => Promise<{ success: boolean; error?: string }>;
        onFineTuneProgress: (callback: (job: unknown) => void) => () => void;
        downloadFile: (url: string, outputPath: string, expectedSize: number, expectedSha256: string, scheduleAtMs?: number) => Promise<unknown>;
        onDownloadProgress: (callback: (progress: unknown) => void) => void;
        cancelDownload: () => void;
    };

    log: {
        write: (level: string, message: string, data?: Record<string, IpcValue>) => void;
        debug: (message: string, data?: Record<string, IpcValue>) => void;
        info: (message: string, data?: Record<string, IpcValue>) => void;
        warn: (message: string, data?: Record<string, IpcValue>) => void;
        error: (message: string, data?: Record<string, IpcValue>) => void;
    };

    gallery: {
        list: () => Promise<unknown[]>;
        delete: (path: string) => Promise<boolean>;
        open: (path: string) => Promise<boolean>;
        reveal: (path: string) => Promise<boolean>;
        batchDownload: (input: unknown) => Promise<unknown>;
    };

    onChatGenerationStatus: (callback: (data: unknown) => void) => () => void;
    onAgentEvent: (callback: (payload: unknown) => void) => () => void;
    onSdCppStatus: (callback: (data: unknown) => void) => () => void;
    onSdCppProgress: (callback: (data: unknown) => void) => () => void;
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
        getMetrics: () => Promise<unknown>;
        onUpdate: (callback: (metrics: unknown) => void) => () => void;
    };

    batch: {
        invoke: (requests: unknown[]) => Promise<unknown[]>;
        invokeSequential: (requests: unknown[]) => Promise<unknown[]>;
        getChannels: () => Promise<string[]>;
    };

    lazyServices: {
        getStatus: () => Promise<unknown>;
    };

    ipcContract: {
        getVersion: () => Promise<IpcContractVersionInfo>;
        isCompatible: () => Promise<boolean>;
    };

    backup: {
        create: (options: unknown) => Promise<unknown>;
        restore: (backupPath: string, options: unknown) => Promise<unknown>;
        list: () => Promise<unknown[]>;
        delete: (backupPath: string) => Promise<boolean>;
        getDir: () => Promise<string>;
        getAutoBackupStatus: () => Promise<unknown>;
        configureAutoBackup: (config: unknown) => Promise<unknown>;
        cleanup: () => Promise<void>;
        verify: (backupPath: string) => Promise<unknown>;
        syncToCloudDir: (backupPath: string, targetDir: string) => Promise<unknown>;
        createDisasterRecoveryBundle: (targetDir: string) => Promise<unknown>;
        restoreDisasterRecoveryBundle: (bundlePath: string) => Promise<unknown>;
    };

    export: {
        chat: (chat: Chat, options: unknown) => Promise<unknown>;
        chatToMarkdown: (chat: Chat, options: unknown) => Promise<unknown>;
        chatToHTML: (chat: Chat, options: unknown) => Promise<unknown>;
        chatToJSON: (chat: Chat, options: unknown) => Promise<unknown>;
        chatToText: (chat: Chat, options: unknown) => Promise<unknown>;
        chatToPDF: (chat: Chat, options: unknown) => Promise<unknown>;
        getContent: (chat: Chat, options: unknown) => Promise<unknown>;
    };

    ideas: {
        createSession: (config: unknown) => Promise<unknown>;
        getSession: (id: string) => Promise<unknown>;
        getSessions: () => Promise<unknown[]>;
        cancelSession: (id: string) => Promise<void>;
        generateMarketPreview: (categories: string[]) => Promise<unknown>;
        startResearch: (sessionId: string) => Promise<void>;
        startGeneration: (sessionId: string) => Promise<void>;
        enrichIdea: (ideaId: string) => Promise<unknown>;
        getIdea: (id: string) => Promise<unknown>;
        getIdeas: (sessionId: string) => Promise<unknown[]>;
        regenerateIdea: (ideaId: string) => Promise<unknown>;
        approveIdea: (ideaId: string, workspacePath: string, selectedName: string) => Promise<unknown>;
        rejectIdea: (ideaId: string) => Promise<void>;
        canGenerateLogo: () => Promise<boolean>;
        generateLogo: (ideaId: string, options: unknown) => Promise<string[]>;
        queryResearch: (ideaId: string, question: string) => Promise<string>;
        deepResearch: (topic: string, category: string) => Promise<unknown>;
        validateIdea: (title: string, description: string, category: string) => Promise<unknown>;
        clearResearchCache: () => Promise<void>;
        scoreIdea: (ideaId: string) => Promise<unknown>;
        rankIdeas: (ideaIds: string[]) => Promise<string[]>;
        compareIdeas: (ideaId1: string, ideaId2: string) => Promise<unknown>;
        quickScore: (title: string, description: string, category: string) => Promise<unknown>;
        deleteIdea: (ideaId: string) => Promise<void>;
        deleteSession: (sessionId: string) => Promise<void>;
        archiveIdea: (ideaId: string) => Promise<void>;
        restoreIdea: (ideaId: string) => Promise<void>;
        getArchivedIdeas: (sessionId?: string) => Promise<unknown[]>;
        onResearchProgress: (callback: (progress: unknown) => void) => () => void;
        onIdeaProgress: (callback: (progress: unknown) => void) => () => void;
        onDeepResearchProgress: (callback: (progress: unknown) => void) => () => void;
    };

    workspaceAgent: {
        start: (options: unknown) => Promise<string>;
        generatePlan: (options: unknown) => Promise<unknown>;
        approvePlan: (plan: unknown, taskId: string) => Promise<unknown>;
        stop: (taskId: string) => Promise<void>;
        pauseTask: (taskId: string) => Promise<void>;
        resumeTask: (taskId: string) => Promise<void>;
        saveSnapshot: (taskId: string) => Promise<void>;
        approveCurrentPlan: (taskId: string) => Promise<void>;
        rejectCurrentPlan: (taskId: string, reason: string) => Promise<void>;
        createPullRequest: (taskId: string) => Promise<void>;
        resetState: () => Promise<void>;
        getStatus: (taskId: string) => Promise<unknown>;
        getTaskMessages: (taskId: string) => Promise<unknown[]>;
        getTaskEvents: (taskId: string) => Promise<unknown[]>;
        getTaskTelemetry: (taskId: string) => Promise<unknown>;
        getTaskHistory: (workspaceId: string) => Promise<unknown[]>;
        deleteTask: (taskId: string) => Promise<void>;
        getAvailableModels: () => Promise<unknown[]>;
        retryStep: (index: number, taskId: string) => Promise<void>;
        selectModel: (payload: unknown) => Promise<void>;
        approveStep: (taskId: string, stepId: string) => Promise<void>;
        skipStep: (taskId: string, stepId: string) => Promise<void>;
        editStep: (taskId: string, stepId: string, text: string) => Promise<void>;
        addStepComment: (taskId: string, stepId: string, comment: string) => Promise<void>;
        insertInterventionPoint: (taskId: string, afterStepId: string) => Promise<void>;
        getCheckpoints: (taskId: string) => Promise<unknown[]>;
        rollbackCheckpoint: (checkpointId: string) => Promise<void>;
        getPlanVersions: (taskId: string) => Promise<unknown[]>;
        deleteTaskByNodeId: (nodeId: string) => Promise<void>;
        getProfiles: () => Promise<unknown[]>;
        getRoutingRules: () => Promise<unknown[]>;
        setRoutingRules: (rules: unknown[]) => Promise<void>;
        createVotingSession: (payload: unknown) => Promise<unknown>;
        submitVote: (payload: unknown) => Promise<unknown>;
        requestVotes: (payload: unknown) => Promise<void>;
        resolveVoting: (sessionId: string) => Promise<void>;
        getVotingSession: (sessionId: string) => Promise<unknown>;
        listVotingSessions: (taskId: string) => Promise<unknown[]>;
        overrideVotingDecision: (payload: unknown) => Promise<void>;
        getVotingAnalytics: (taskId: string) => Promise<unknown>;
        getVotingConfiguration: () => Promise<unknown>;
        updateVotingConfiguration: (patch: unknown) => Promise<void>;
        listVotingTemplates: () => Promise<unknown[]>;
        buildConsensus: (outputs: unknown[]) => Promise<unknown>;
        createDebateSession: (payload: unknown) => Promise<unknown>;
        submitDebateArgument: (payload: unknown) => Promise<unknown>;
        resolveDebateSession: (sessionId: string) => Promise<void>;
        overrideDebateSession: (payload: unknown) => Promise<void>;
        getDebateSession: (sessionId: string) => Promise<unknown>;
        listDebateHistory: (taskId: string) => Promise<unknown[]>;
        getDebateReplay: (sessionId: string) => Promise<unknown>;
        generateDebateSummary: (sessionId: string) => Promise<string>;
        getTeamworkAnalytics: () => Promise<unknown>;
        councilSendMessage: (payload: unknown) => Promise<void>;
        councilGetMessages: (payload: unknown) => Promise<unknown[]>;
        councilCleanupExpiredMessages: (taskId: string) => Promise<void>;
        councilHandleQuotaInterrupt: (payload: unknown) => Promise<void>;
        councilRegisterWorkerAvailability: (payload: unknown) => Promise<void>;
        councilListAvailableWorkers: (payload: unknown) => Promise<unknown[]>;
        councilScoreHelperCandidates: (payload: unknown) => Promise<unknown[]>;
        councilGenerateHelperHandoff: (payload: unknown) => Promise<unknown>;
        councilReviewHelperMerge: (payload: unknown) => Promise<unknown>;
        council: {
            generatePlan: (taskId: string, task: string) => Promise<unknown>;
            getProposal: (taskId: string) => Promise<unknown>;
            approveProposal: (taskId: string) => Promise<unknown>;
            rejectProposal: (taskId: string, reason: string) => Promise<unknown>;
            startExecution: (taskId: string) => Promise<void>;
            pauseExecution: (taskId: string) => Promise<void>;
            resumeExecution: (taskId: string) => Promise<void>;
            getTimeline: (taskId: string) => Promise<unknown[]>;
        };
        getTemplates: (category?: string) => Promise<unknown[]>;
        getTemplate: (id: string) => Promise<unknown>;
        saveTemplate: (template: unknown) => Promise<unknown>;
        deleteTemplate: (id: string) => Promise<boolean>;
        exportTemplate: (id: string) => Promise<string>;
        importTemplate: (exported: string) => Promise<unknown>;
        applyTemplate: (payload: unknown) => Promise<void>;
        onUpdate: (callback: (state: WorkspaceState) => void) => () => void;
        onQuotaInterrupt: (callback: (payload: unknown) => void) => () => void;
        saveCanvasNodes: (nodes: unknown[]) => Promise<void>;
        getCanvasNodes: () => Promise<unknown[]>;
        deleteCanvasNode: (id: string) => Promise<void>;
        saveCanvasEdges: (edges: unknown[]) => Promise<void>;
        getCanvasEdges: () => Promise<unknown[]>;
        deleteCanvasEdge: (id: string) => Promise<void>;
        health: () => Promise<unknown>;
    };

    orchestrator: {
        start: (task: string, workspaceId?: string) => Promise<string>;
        approve: (plan: WorkspaceStep[]) => Promise<void>;
        getState: () => Promise<OrchestratorState>;
        stop: () => Promise<void>;
        onUpdate: (callback: (state: OrchestratorState) => void) => () => void;
    };

    extension: {
        shouldShowWarning: () => Promise<boolean>;
        dismissWarning: () => Promise<void>;
        getStatus: () => Promise<unknown>;
        setInstalled: (installed: boolean) => Promise<void>;
        getAll: () => Promise<unknown[]>;
        get: (extensionId: string) => Promise<unknown>;
        install: (extensionPath: string) => Promise<unknown>;
        uninstall: (extensionId: string) => Promise<unknown>;
        activate: (extensionId: string) => Promise<unknown>;
        deactivate: (extensionId: string) => Promise<unknown>;
        devStart: (options: unknown) => Promise<unknown>;
        devStop: (extensionId: string) => Promise<unknown>;
        devReload: (extensionId: string) => Promise<unknown>;
        test: (options: unknown) => Promise<unknown>;
        publish: (options: unknown) => Promise<unknown>;
        getProfile: (extensionId: string) => Promise<unknown>;
        validate: (manifest: unknown) => Promise<unknown>;
    };

    clipboard: {
        writeText: (text: string) => Promise<void>;
        readText: () => Promise<string>;
    };

    workflow: {
        getAll: () => Promise<unknown[]>;
        get: (id: string) => Promise<unknown>;
        create: (workflow: unknown) => Promise<unknown>;
        update: (id: string, updates: unknown) => Promise<unknown>;
        delete: (id: string) => Promise<boolean>;
        execute: (id: string, context?: unknown) => Promise<unknown>;
        triggerManual: (triggerId: string, context?: unknown) => Promise<unknown>;
    };

    modelDownloader: {
        start: (request: unknown) => Promise<string>;
        pause: (downloadId: string) => Promise<void>;
        resume: (downloadId: string) => Promise<void>;
        cancel: (downloadId: string) => Promise<void>;
    };

    promptTemplates: {
        getAll: () => Promise<unknown[]>;
        getByCategory: (category: string) => Promise<unknown[]>;
        getByTag: (tag: string) => Promise<unknown[]>;
        search: (query: string) => Promise<unknown[]>;
        get: (id: string) => Promise<unknown>;
        create: (template: unknown) => Promise<unknown>;
        update: (id: string, updates: unknown) => Promise<unknown>;
        delete: (id: string) => Promise<{ success: boolean }>;
        render: (templateId: string, variables: Record<string, string>) => Promise<string>;
        getCategories: () => Promise<string[]>;
        getTags: () => Promise<string[]>;
    };
}
