import type { IpcContractVersionInfo } from '@shared/constants/ipc-contract';
import type { IpcRendererEvent } from 'electron';

// Marketplace model from database
export interface DbMarketplaceModel {
    id: string;
    name: string;
    provider: 'ollama' | 'huggingface';
    pulls?: string;
    tagCount: number;
    lastUpdated?: string;
    categories: string[];
    shortDescription?: string;
    downloads?: number;
    likes?: number;
    author?: string;
    createdAt: number;
    updatedAt: number;
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

export type MarketplaceModelDetails =
    | OllamaMarketplaceModelDetails
    | HuggingFaceMarketplaceModelDetails;

import {
    AgentDefinition,
    AgentStartOptions,
    AppSettings,
    Chat,
    ChatRequest,
    ChatStreamRequest,
    ClaudeQuota,
    CopilotQuota,
    EntityKnowledge,
    EpisodicMemory,
    FileSearchResult,
    Folder,
    IdeaProgress,
    IdeaSession,
    IdeaSessionConfig,
    IpcValue,
    Message,
    Project,
    ProjectAnalysis,
    ProjectIdea,
    ProjectState,
    ProjectStats,
    ProjectStep,
    QuotaResponse,
    ResearchData,
    ResearchProgress,
    SemanticFragment,
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
    ToolCall,
    ToolDefinition,
    ToolResult,
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
import {
    VoiceCommand,
    VoiceInfo,
    VoiceRecognitionResult,
    VoiceSettings,
    VoiceSynthesisOptions,
} from '@/shared/types/voice';

export interface FileEntry {
    name: string;
    isDirectory: boolean;
    size: number;
    mtime: number;
    path: string;
}

export interface ProcessInfo {
    pid: number;
    name: string;
    cmd: string;
    cpu: number;
    memory: number;
}

export interface OrchestratorStateView extends ProjectState {
    activeAgentId?: string;
    assignments: Record<string, string>;
}

export interface ModelDefinition {
    id: string;
    name: string;
    provider: string;
    quotaInfo?: {
        remainingQuota?: number;
        totalQuota?: number;
        resetTime?: string;
        remainingFraction?: number;
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
 * await window.electron.chatStream(messages, model, tools, provider, options, chatId)
 * ```
 */
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

    /**
     * Resizes the window to a specific resolution.
     * @param resolution - Resolution string in format "WIDTHxHEIGHT" (e.g., "1920x1080")
     */
    resizeWindow: (resolution: string) => void;

    /**
     * Toggles compact mode for the window.
     * @param enabled - Whether to enable compact mode
     */
    toggleCompact: (enabled: boolean) => void;

    /**
     * Initiates GitHub OAuth login flow.
     * @param appId - Optional app identifier ('profile' or 'copilot')
     * @returns Promise resolving to OAuth device code information
     */
    githubLogin: (appId?: 'profile' | 'copilot') => Promise<{
        device_code: string;
        user_code: string;
        verification_uri: string;
        expires_in: number;
        interval: number;
    }>;

    /**
     * Polls for GitHub OAuth token after device code authentication.
     * @param deviceCode - Device code received from githubLogin
     * @param interval - Polling interval in seconds
     * @param appId - Optional app identifier ('profile' or 'copilot')
     * @returns Promise resolving to authentication result
     */
    pollToken: (
        deviceCode: string,
        interval: number,
        appId?: 'profile' | 'copilot'
    ) => Promise<{ success: boolean; token?: string; error?: string }>;

    /**
     * Initiates Antigravity OAuth login flow.
     * @returns Promise resolving to OAuth URL and state
     */
    antigravityLogin: () => Promise<{ url: string; state: string }>;

    claudeLogin: () => Promise<{ url: string; state: string }>;
    claudeBrowserLogin: () => Promise<{ sessionKey?: string; status?: string; error?: string }>;
    anthropicLogin: () => Promise<{ url: string; state: string }>;
    codexLogin: () => Promise<{ url: string; state: string }>;

    saveClaudeSession: (
        sessionKey: string,
        accountId?: string
    ) => Promise<{ success: boolean; error?: string }>;
    triggerClaudeSessionCapture: () => Promise<{ success: boolean; error?: string }>;

    // --- Linked Accounts (New Multi-Account API) ---

    /**
     * Get all linked accounts, optionally filtered by provider.
     */
    getLinkedAccounts: (provider?: string) => Promise<LinkedAccountInfo[]>;

    /**
     * Get the active linked account for a provider.
     */
    getActiveLinkedAccount: (provider: string) => Promise<LinkedAccountInfo | null>;

    /**
     * Set which account should be active for a provider.
     */
    setActiveLinkedAccount: (
        provider: string,
        accountId: string
    ) => Promise<{ success: boolean; error?: string }>;

    /**
     * Link a new account for a provider.
     */
    linkAccount: (
        provider: string,
        tokenData: TokenData
    ) => Promise<{ success: boolean; account?: LinkedAccountInfo; error?: string }>;

    /**
     * Unlink (remove) a specific account.
     */
    unlinkAccount: (accountId: string) => Promise<{ success: boolean; error?: string }>;

    /**
     * Unlink all accounts for a provider.
     */
    unlinkProvider: (provider: string) => Promise<{ success: boolean; error?: string }>;

    /**
     * Check if a provider has any linked accounts.
     */
    hasLinkedAccount: (provider: string) => Promise<boolean>;

    /**
     * Get all linked accounts for a provider (alias for getLinkedAccounts).
     */
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

    code: {
        scanTodos: (rootPath: string) => Promise<TodoFile[]>;
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
            content: string;
            symbolCount: number;
            generatedAt: string;
            error?: string;
        }>;
        generateProjectDocumentation: (
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
            projectId?: string,
            isRegex?: boolean
        ) => Promise<FileSearchResult[]>;
        indexProject: (rootPath: string, projectId: string) => Promise<void>;
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

    // Project System
    project: {
        analyze: (rootPath: string, projectId: string) => Promise<ProjectAnalysis>;
        generateLogo: (
            projectPath: string,
            options: { prompt: string; style: string; model: string; count: number }
        ) => Promise<string[]>;
        analyzeIdentity: (
            projectPath: string
        ) => Promise<{ suggestedPrompts: string[]; colors: string[] }>;
        applyLogo: (projectPath: string, tempLogoPath: string) => Promise<string>;
        getCompletion: (text: string) => Promise<string>;
        improveLogoPrompt: (prompt: string) => Promise<string>;
        uploadLogo: (projectPath: string) => Promise<string | null>;
        analyzeDirectory: (dirPath: string) => Promise<{
            hasPackageJson: boolean;
            pkg: Record<string, IpcValue>;
            readme: string | null;
            stats: ProjectStats;
        }>;
        watch: (rootPath: string) => Promise<boolean>;
        unwatch: (rootPath: string) => Promise<boolean>;
        onFileChange: (
            callback: (event: string, path: string, rootPath: string) => void
        ) => () => void;
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

    files: {
        listDirectory: (path: string) => Promise<FileEntry[]>;
        readFile: (path: string) => Promise<string>;
        readImage: (
            path: string
        ) => Promise<{ success: boolean; content?: string; error?: string }>;
        writeFile: (path: string, content: string) => Promise<void>;
        exists: (path: string) => Promise<boolean>;
    };

    // Proxy
    getProxyModels: () => Promise<{ id: string; object: string }[]>;
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
    checkUsageLimit: (
        provider: string,
        model: string
    ) => Promise<{ allowed: boolean; reason?: string }>;
    getUsageCount: (
        period: 'hourly' | 'daily' | 'weekly',
        provider?: string,
        model?: string
    ) => Promise<number>;
    performance: {
        getMemoryStats: () => Promise<IpcValue>;
        detectLeak: () => Promise<IpcValue>;
        triggerGC: () => Promise<IpcValue>;
        getDashboard: () => Promise<IpcValue>;
    };
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
            stagedFiles?: Array<{ status: string; path: string; staged: boolean }>;
            unstagedFiles?: Array<{ status: string; path: string; staged: boolean }>;
            allFiles?: Array<{ status: string; path: string; staged: boolean }>;
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
        getCommitDiff: (
            cwd: string,
            hash: string
        ) => Promise<{ diff: string; success: boolean; error?: string }>;
    };

    // LLM chat
    getModels: () => Promise<ModelDefinition[] | { antigravityError?: string }>;
    chat: (messages: Message[], model: string) => Promise<{ content: string }>;
    chatOpenAI: (request: ChatRequest) => Promise<IpcValue>;
    chatStream: (request: ChatStreamRequest) => Promise<void>;
    abortChat: () => void;
    onStreamChunk: (
        callback: (chunk: {
            content?: string;
            toolCalls?: ToolCall[];
            reasoning?: string;
            done?: boolean;
        }) => void
    ) => () => void;
    removeStreamChunkListener: (
        callback?: (chunk: {
            content?: string;
            toolCalls?: ToolCall[];
            reasoning?: string;
            done?: boolean;
        }) => void
    ) => void;

    // Ollama management
    isOllamaRunning: () => Promise<boolean>;
    startOllama: () => Promise<{ success: boolean; message: string }>;
    pullModel: (modelName: string) => Promise<{ success: boolean; error?: string }>;
    deleteOllamaModel: (modelName: string) => Promise<{ success: boolean; error?: string }>;
    getLibraryModels: () => Promise<{ name: string; description: string; tags: string[] }[]>;
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
    getOllamaHealthStatus: () => Promise<{ status: 'ok' | 'error' }>;
    forceOllamaHealthCheck: () => Promise<{ status: 'ok' | 'error' }>;
    checkCuda: () => Promise<{ hasCuda: boolean; detail?: string }>;
    onOllamaStatusChange: (callback: (status: { status: string }) => void) => void;
    onChatGenerationStatus: (
        callback: (data: { chatId?: string; isGenerating?: boolean }) => void
    ) => () => void;
    onAgentEvent: (callback: (payload: unknown) => void) => () => void;
    onSdCppStatus: (callback: (data: unknown) => void) => () => void;
    onSdCppProgress: (callback: (data: unknown) => void) => () => void;
    modelDownloader: {
        start: (request: Record<string, unknown>) => Promise<unknown>;
        pause: (downloadId: string) => Promise<unknown>;
        resume: (downloadId: string) => Promise<unknown>;
        cancel: (downloadId: string) => Promise<unknown>;
    };

    // Marketplace API (models from database)
    marketplace: {
        getModels: (
            provider?: 'ollama' | 'huggingface',
            limit?: number,
            offset?: number
        ) => Promise<DbMarketplaceModel[]>;
        searchModels: (
            query: string,
            provider?: 'ollama' | 'huggingface',
            limit?: number
        ) => Promise<DbMarketplaceModel[]>;
        getModelDetails: (
            modelName: string,
            provider?: 'ollama' | 'huggingface'
        ) => Promise<MarketplaceModelDetails | null>;
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
        getModels: () => Promise<{ name: string; path: string; size: number }[]>;
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
        schedule: (payload: {
            runAt: number;
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
        getQueueStats: () => Promise<{ queued: number; running: boolean }>;
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
    clipboard: {
        writeText: (text: string) => Promise<{ success: boolean }>;
        readText: () => Promise<{ success: boolean; text: string }>;
    };
    // Database
    db: {
        createChat: (chat: Chat) => Promise<{ success: boolean }>;
        updateChat: (id: string, updates: Partial<Chat>) => Promise<{ success: boolean }>;
        deleteChat: (id: string) => Promise<{ success: boolean }>;
        duplicateChat: (id: string) => Promise<Chat | null>;
        archiveChat: (id: string, isArchived: boolean) => Promise<{ success: boolean }>;
        getChat: (id: string) => Promise<Chat | null>;
        getAllChats: () => Promise<Chat[]>;
        searchChats: (query: string) => Promise<Chat[]>;
        addMessage: (message: Message) => Promise<{ success: boolean }>;
        deleteMessage: (id: string) => Promise<{ success: boolean }>;
        updateMessage: (id: string, updates: Partial<Message>) => Promise<{ success: boolean }>;
        deleteAllChats: () => Promise<{ success: boolean }>;
        deleteMessages: (chatId: string) => Promise<{ success: boolean }>;
        getMessages: (chatId: string) => Promise<Message[]>;
        getStats: () => Promise<{ chatCount: number; messageCount: number; dbSize: number }>;
        getDetailedStats: (period: string) => Promise<{
            chatCount: number;
            messageCount: number;
            dbSize: number;
            totalTokens: number;
            promptTokens: number;
            completionTokens: number;
            tokenTimeline: { timestamp: number; promptTokens: number; completionTokens: number }[];
            activity: number[];
        }>;
        getTimeStats: () => Promise<{
            totalOnlineTime: number;
            totalCodingTime: number;
            projectCodingTime: Record<string, number>;
        }>;
        getTokenStats: (period: 'daily' | 'weekly' | 'monthly') => Promise<{
            totalSent: number;
            totalReceived: number;
            totalCost: number;
            timeline: Array<{ timestamp: number; sent: number; received: number }>;
            byProvider: Record<string, { sent: number; received: number; cost: number }>;
            byModel: Record<string, { sent: number; received: number; cost: number }>;
        }>;
        addTokenUsage: (record: {
            messageId?: string;
            chatId: string;
            projectId?: string;
            provider: string;
            model: string;
            tokensSent: number;
            tokensReceived: number;
            costEstimate?: number;
        }) => Promise<{ success: boolean }>;
        getProjects: () => Promise<Project[]>;
        getFolders: () => Promise<Folder[]>;
        createProject: (
            name: string,
            path: string,
            description: string,
            mounts?: string
        ) => Promise<Project>;
        updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
        deleteProject: (id: string, deleteFiles?: boolean) => Promise<void>;
        archiveProject: (id: string, isArchived: boolean) => Promise<void>;
        bulkDeleteProjects: (ids: string[], deleteFiles?: boolean) => Promise<void>;
        bulkArchiveProjects: (ids: string[], isArchived: boolean) => Promise<void>;
        createFolder: (name: string, color?: string) => Promise<Folder>;
        deleteFolder: (id: string) => Promise<void>;
        updateFolder: (id: string, updates: Partial<Folder>) => Promise<void>;

        // Prompts
        createPrompt: (title: string, content: string, tags?: string[]) => Promise<{ id: string }>;
        deletePrompt: (id: string) => Promise<void>;
        updatePrompt: (id: string, updates: Record<string, IpcValue>) => Promise<void>;
        getPrompts: () => Promise<IpcValue[]>;
    };

    terminal: {
        isAvailable: () => Promise<boolean>;
        getProfiles: () => Promise<Array<{
            id: string;
            name: string;
            shell: string;
            args?: string[];
            env?: Record<string, string | undefined>;
            icon?: string;
            isDefault?: boolean;
        }>>;
        saveProfile: (profile: {
            id: string;
            name: string;
            shell: string;
            args?: string[];
            env?: Record<string, string | undefined>;
            icon?: string;
            isDefault?: boolean;
        }) => Promise<void>;
        deleteProfile: (id: string) => Promise<void>;
        validateProfile: (profile: {
            id: string;
            name: string;
            shell: string;
            args?: string[];
            env?: Record<string, string | undefined>;
            icon?: string;
            isDefault?: boolean;
        }) => Promise<{ valid: boolean; errors: string[] }>;
        getProfileTemplates: () => Promise<Array<{
            id: string;
            name: string;
            shell: string;
            args?: string[];
            env?: Record<string, string | undefined>;
            icon?: string;
            isDefault?: boolean;
        }>>;
        exportProfiles: () => Promise<string>;
        exportProfileShareCode: (profileId: string) => Promise<string | null>;
        importProfiles: (
            payload: string,
            options?: { overwrite?: boolean }
        ) => Promise<{ success: boolean; imported: number; skipped: number; errors: string[] }>;
        importProfileShareCode: (
            shareCode: string,
            options?: { overwrite?: boolean }
        ) => Promise<{ success: boolean; imported: boolean; profileId?: string; error?: string }>;
        getShells: () => Promise<{ id: string; name: string; path: string }[]>;
        getBackends: () => Promise<Array<{ id: string; name: string; available: boolean }>>;
        getRuntimeHealth: () => Promise<{
            terminalAvailable: boolean;
            totalBackends: number;
            availableBackends: number;
            backends: Array<{ id: string; name: string; available: boolean }>;
        }>;
        create: (options: {
            id?: string;
            shell?: string;
            cwd?: string;
            cols?: number;
            rows?: number;
            backendId?: string;
            title?: string;
            metadata?: Record<string, unknown>;
        }) => Promise<string>;
        getDockerContainers: () => Promise<Array<{ id: string; name: string; status: string }>>;
        detach: (options: {
            sessionId: string;
            title?: string;
            shell?: string;
            cwd?: string;
        }) => Promise<boolean>;
        getCommandHistory: (
            query?: string,
            limit?: number
        ) => Promise<
            Array<{
                command: string;
                shell?: string;
                cwd?: string;
                timestamp: number;
                sessionId: string;
            }>
        >;
        getSuggestions: (options: {
            command: string;
            shell: string;
            cwd: string;
            historyLimit?: number;
        }) => Promise<string[]>;
        explainCommand: (options: { command: string; shell: string; cwd?: string }) => Promise<{
            explanation: string;
            breakdown: Array<{ part: string; description: string }>;
            warnings?: string[];
            relatedCommands?: string[];
        }>;
        explainError: (options: {
            errorOutput: string;
            command?: string;
            shell: string;
            cwd?: string;
        }) => Promise<{
            summary: string;
            cause: string;
            solution: string;
            steps?: string[];
        }>;
        fixError: (options: {
            errorOutput: string;
            command: string;
            shell: string;
            cwd?: string;
        }) => Promise<{
            suggestedCommand: string;
            explanation: string;
            confidence: 'high' | 'medium' | 'low';
            alternativeCommands?: string[];
        }>;
        clearCommandHistory: () => Promise<boolean>;
        close: (sessionId: string) => Promise<boolean>;
        write: (sessionId: string, data: string) => Promise<boolean>;
        resize: (sessionId: string, cols: number, rows: number) => Promise<boolean>;
        kill: (sessionId: string) => Promise<boolean>;
        getSessions: () => Promise<string[]>;
        restoreAllSnapshots: () => Promise<{ restored: number; failed: number; sessionIds: string[] }>;
        exportSession: (
            sessionId: string,
            options?: { includeScrollback?: boolean }
        ) => Promise<string | null>;
        importSession: (
            payload: string,
            options?: { overwrite?: boolean; sessionId?: string }
        ) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
        createSessionShareCode: (
            sessionId: string,
            options?: { includeScrollback?: boolean }
        ) => Promise<string | null>;
        importSessionShareCode: (
            shareCode: string,
            options?: { overwrite?: boolean; sessionId?: string }
        ) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
        getSnapshotSessions: () => Promise<Array<{
            id: string;
            shell: string;
            cwd: string;
            title?: string;
            cols: number;
            rows: number;
            timestamp: number;
            backendId: string;
            workspaceId?: string;
            metadata?: Record<string, unknown>;
        }>>;
        getSessionTemplates: () => Promise<Array<{
            id: string;
            name: string;
            shell: string;
            cwd: string;
            cols: number;
            rows: number;
            backendId: string;
            workspaceId?: string;
            metadata?: Record<string, unknown>;
            createdAt: number;
            updatedAt: number;
        }>>;
        saveSessionTemplate: (payload: {
            sessionId: string;
            templateId?: string;
            name?: string;
        }) => Promise<{
            id: string;
            name: string;
            shell: string;
            cwd: string;
            cols: number;
            rows: number;
            backendId: string;
            workspaceId?: string;
            metadata?: Record<string, unknown>;
            createdAt: number;
            updatedAt: number;
        } | null>;
        deleteSessionTemplate: (templateId: string) => Promise<boolean>;
        createFromSessionTemplate: (
            templateId: string,
            options?: { sessionId?: string; title?: string }
        ) => Promise<string | null>;
        restoreSnapshotSession: (snapshotId: string) => Promise<boolean>;
        searchScrollback: (
            sessionId: string,
            query: string,
            options?: { regex?: boolean; caseSensitive?: boolean; limit?: number }
        ) => Promise<Array<{ lineNumber: number; line: string }>>;
        exportScrollback: (
            sessionId: string,
            exportPath?: string
        ) => Promise<{ success: boolean; path?: string; content?: string; error?: string }>;
        getSessionAnalytics: (sessionId: string) => Promise<{
            sessionId: string;
            bytes: number;
            lineCount: number;
            commandCount: number;
            updatedAt: number;
        }>;
        getSearchAnalytics: () => Promise<{
            totalSearches: number;
            regexSearches: number;
            plainSearches: number;
            lastSearchAt: number;
        }>;
        getSearchSuggestions: (query?: string, limit?: number) => Promise<string[]>;
        exportSearchResults: (
            sessionId: string,
            query: string,
            options?: {
                regex?: boolean;
                caseSensitive?: boolean;
                limit?: number;
                exportPath?: string;
                format?: 'json' | 'txt';
            }
        ) => Promise<{ success: boolean; path?: string; content?: string; error?: string }>;
        addScrollbackMarker: (
            sessionId: string,
            label: string,
            lineNumber?: number
        ) => Promise<{ id: string; sessionId: string; label: string; lineNumber: number; createdAt: number } | null>;
        listScrollbackMarkers: (sessionId?: string) => Promise<Array<{
            id: string;
            sessionId: string;
            label: string;
            lineNumber: number;
            createdAt: number;
        }>>;
        deleteScrollbackMarker: (markerId: string) => Promise<boolean>;
        filterScrollback: (
            sessionId: string,
            options?: { query?: string; fromLine?: number; toLine?: number; caseSensitive?: boolean }
        ) => Promise<string[]>;
        setSessionTitle: (sessionId: string, title: string) => Promise<boolean>;
        onData: (callback: (data: { id: string; data: string }) => void) => () => void;
        onExit: (callback: (data: { id: string; code: number }) => void) => () => void;
        readBuffer: (sessionId: string) => Promise<string>;
        removeAllListeners: () => void;
    };

    agent: {
        getAll: () => Promise<AgentDefinition[]>;
        get: (id: string) => Promise<AgentDefinition | null>;
        create: (payload: {
            agent: {
                id?: string;
                name: string;
                description?: string;
                systemPrompt: string;
                tools?: string[];
                parentModel?: string;
                color?: string;
            };
            options?: { cloneFromId?: string; createWorkspace?: boolean };
        }) => Promise<{ success: boolean; id?: string; workspacePath?: string; error?: string }>;
        delete: (
            id: string,
            options?: { confirm?: boolean; softDelete?: boolean; backupBeforeDelete?: boolean }
        ) => Promise<{ success: boolean; archivedId?: string; recoveryToken?: string; error?: string }>;
        clone: (id: string, newName?: string) => Promise<{ success: boolean; id?: string; error?: string }>;
        exportAgent: (id: string) => Promise<string | null>;
        importAgent: (payload: string) => Promise<{ success: boolean; id?: string; workspacePath?: string; error?: string }>;
        getTemplatesLibrary: () => Promise<Array<{
            id?: string;
            name: string;
            description: string;
            systemPrompt: string;
            tools: string[];
            parentModel?: string;
            color?: string;
            category?: string;
        }>>;
        validateTemplate: (template: {
            name?: string;
            description?: string;
            systemPrompt?: string;
            tools?: string[];
            parentModel?: string;
            color?: string;
        }) => Promise<{ valid: boolean; errors: string[] }>;
        recover: (archiveId: string) => Promise<{ success: boolean; id?: string; error?: string }>;
    };

    modelRegistry: {
        getAllModels: () => Promise<ModelDefinition[]>;
        getRemoteModels: () => Promise<ModelDefinition[]>;
        getInstalledModels: () => Promise<ModelDefinition[]>;
    };

    // SSH
    ssh: {
        connect: (
            connection: SSHConnection
        ) => Promise<{ success: boolean; error?: string; id?: string; diagnostics?: { category: string; hint: string } }>;
        disconnect: (connectionId: string) => Promise<{ success: boolean }>;
        execute: (
            connectionId: string,
            command: string,
            options?: SSHExecOptions
        ) => Promise<{ stdout: string; stderr: string; code: number }>;
        upload: (
            connectionId: string,
            localPath: string,
            remotePath: string
        ) => Promise<{ success: boolean; error?: string }>;
        download: (
            connectionId: string,
            remotePath: string,
            localPath: string
        ) => Promise<{ success: boolean; error?: string }>;
        listDir: (
            connectionId: string,
            remotePath: string
        ) => Promise<{ success: boolean; files?: SSHFile[]; error?: string }>;
        readFile: (
            connectionId: string,
            remotePath: string
        ) => Promise<{ success: boolean; content?: string; error?: string }>;
        writeFile: (
            connectionId: string,
            remotePath: string,
            content: string
        ) => Promise<{ success: boolean; error?: string }>;
        deleteDir: (
            connectionId: string,
            path: string
        ) => Promise<{ success: boolean; error?: string }>;
        deleteFile: (
            connectionId: string,
            path: string
        ) => Promise<{ success: boolean; error?: string }>;
        mkdir: (
            connectionId: string,
            path: string
        ) => Promise<{ success: boolean; error?: string }>;
        rename: (
            connectionId: string,
            oldPath: string,
            newPath: string
        ) => Promise<{ success: boolean; error?: string }>;
        getConnections: () => Promise<SSHConnection[]>;
        isConnected: (connectionId: string) => Promise<boolean>;
        onStdout: (callback: (data: string | Uint8Array) => void) => void;
        onStderr: (callback: (data: string | Uint8Array) => void) => void;
        onConnected: (callback: (connectionId: string) => void) => void;
        onDisconnected: (callback: (connectionId: string) => void) => void;
        onUploadProgress: (
            callback: (progress: { transferred: number; total: number }) => void
        ) => void;
        onDownloadProgress: (
            callback: (progress: { transferred: number; total: number }) => void
        ) => void;
        removeAllListeners: () => void;
        onShellData: (callback: (data: { data: string }) => void) => void;
        shellStart: (connectionId: string) => Promise<{ success: boolean; error?: string }>;
        shellWrite: (
            connectionId: string,
            data: string
        ) => Promise<{ success: boolean; error?: string }>;
        getSystemStats: (connectionId: string) => Promise<SSHSystemStats>;
        getInstalledPackages: (
            connectionId: string,
            manager?: 'apt' | 'npm' | 'pip'
        ) => Promise<SSHPackageInfo[]>;
        getLogFiles: (connectionId: string) => Promise<string[]>;
        readLogFile: (connectionId: string, path: string, lines?: number) => Promise<string>;
        getProfiles: () => Promise<SSHConfig[]>;
        saveProfile: (profile: SSHConfig) => Promise<boolean>;
        deleteProfile: (id: string) => Promise<boolean>;
        createTunnel: (payload: {
            connectionId: string;
            type: 'local' | 'remote' | 'dynamic';
            localHost: string;
            localPort: number;
            remoteHost?: string;
            remotePort?: number;
        }) => Promise<{ success: boolean; forwardId?: string; error?: string }>;
        listTunnels: (connectionId?: string) => Promise<SSHPortForward[]>;
        closeTunnel: (forwardId: string) => Promise<boolean>;
        saveTunnelPreset: (preset: {
            name: string;
            type: 'local' | 'remote' | 'dynamic';
            localHost: string;
            localPort: number;
            remoteHost: string;
            remotePort: number;
        }) => Promise<SSHTunnelPreset>;
        listTunnelPresets: () => Promise<SSHTunnelPreset[]>;
        deleteTunnelPreset: (id: string) => Promise<boolean>;
        listManagedKeys: () => Promise<SSHManagedKey[]>;
        generateManagedKey: (payload: { name: string; passphrase?: string }) => Promise<{
            key: SSHManagedKey;
            privateKey: string;
            publicKey: string;
        }>;
        importManagedKey: (payload: {
            name: string;
            privateKey: string;
            passphrase?: string;
        }) => Promise<SSHManagedKey>;
        deleteManagedKey: (id: string) => Promise<boolean>;
        rotateManagedKey: (payload: { id: string; nextPassphrase?: string }) => Promise<SSHManagedKey | null>;
        backupManagedKey: (id: string) => Promise<{ filename: string; privateKey: string } | null>;
        listKnownHosts: () => Promise<SSHKnownHostEntry[]>;
        addKnownHost: (payload: SSHKnownHostEntry) => Promise<boolean>;
        removeKnownHost: (payload: { host: string; keyType?: string }) => Promise<boolean>;
        searchRemoteFiles: (payload: {
            connectionId: string;
            query: string;
            options?: { path?: string; contentSearch?: boolean; limit?: number };
        }) => Promise<SSHRemoteSearchResult[]>;
        getSearchHistory: (connectionId?: string) => Promise<SSHSearchHistoryEntry[]>;
        exportSearchHistory: () => Promise<string>;
        reconnect: (connectionId: string, retries?: number) => Promise<{ success: boolean; error?: string }>;
        acquireConnection: (connectionId: string) => Promise<{ success: boolean; error?: string }>;
        releaseConnection: (connectionId: string) => Promise<boolean>;
        getConnectionPoolStats: () => Promise<Array<{ connectionId: string; refs: number }>>;
        enqueueTransfer: (task: SSHTransferTask) => Promise<void>;
        getTransferQueue: () => Promise<SSHTransferTask[]>;
        runTransferBatch: (tasks: SSHTransferTask[], concurrency?: number) => Promise<boolean[]>;
        listRemoteContainers: (connectionId: string) => Promise<SSHDevContainer[]>;
        runRemoteContainer: (payload: {
            connectionId: string;
            image: string;
            name: string;
            ports?: Array<{ hostPort: number; containerPort: number }>;
        }) => Promise<{ success: boolean; id?: string; error?: string }>;
        stopRemoteContainer: (connectionId: string, containerId: string) => Promise<boolean>;
        saveProfileTemplate: (template: {
            name: string;
            port: number;
            username: string;
            tags?: string[];
        }) => Promise<SSHProfileTemplate>;
        listProfileTemplates: () => Promise<SSHProfileTemplate[]>;
        deleteProfileTemplate: (id: string) => Promise<boolean>;
        exportProfiles: (ids?: string[]) => Promise<string>;
        importProfiles: (payload: string) => Promise<number>;
        validateProfile: (profile: Partial<SSHConnection>) => Promise<{ valid: boolean; errors: string[] }>;
        testProfile: (profile: Partial<SSHConnection>) => Promise<{
            success: boolean;
            latencyMs: number;
            authMethod: 'password' | 'key';
            message: string;
            error?: string;
            errorCode?: string;
            uiState?: 'ready' | 'failure' | 'empty';
        }>;
        startSessionRecording: (connectionId: string) => Promise<SSHSessionRecording>;
        stopSessionRecording: (connectionId: string) => Promise<SSHSessionRecording | null>;
        getSessionRecording: (connectionId: string) => Promise<SSHSessionRecording | null>;
        searchSessionRecording: (connectionId: string, query: string) => Promise<string[]>;
        exportSessionRecording: (connectionId: string) => Promise<string>;
        listSessionRecordings: () => Promise<SSHSessionRecording[]>;
    };

    // Tools
    executeTools: (
        toolName: string,
        args: Record<string, IpcValue>,
        toolCallId?: string
    ) => Promise<ToolResult>;
    killTool: (toolCallId: string) => Promise<boolean>;
    getToolDefinitions: () => Promise<ToolDefinition[]>;

    // MCP
    mcp: {
        list: () => Promise<{ name: string; status: string }[]>;
        dispatch: (
            service: string,
            action: string,
            args?: Record<string, IpcValue>
        ) => Promise<IpcValue>;
        toggle: (
            service: string,
            enabled: boolean
        ) => Promise<{ success: boolean; isEnabled: boolean }>;
        install: (
            config: Record<string, IpcValue>
        ) => Promise<{ success: boolean; error?: string }>;
        uninstall: (name: string) => Promise<{ success: boolean }>;
        getDebugMetrics: () => Promise<IpcValue[]>;
        listPermissionRequests: () => Promise<IpcValue[]>;
        setActionPermission: (
            service: string,
            action: string,
            policy: 'allow' | 'deny' | 'ask'
        ) => Promise<{ success: boolean; error?: string }>;
        resolvePermissionRequest: (
            requestId: string,
            decision: 'approved' | 'denied'
        ) => Promise<{ success: boolean; error?: string }>;
        onResult: (callback: (result: IpcValue) => void) => void;
        removeResultListener: () => void;
    };

    // MCP Marketplace
    mcpMarketplace: {
        list: () => Promise<{ success: boolean; servers?: IpcValue[]; error?: string }>;
        search: (
            query: string
        ) => Promise<{ success: boolean; servers?: IpcValue[]; error?: string }>;
        filter: (
            category: string
        ) => Promise<{ success: boolean; servers?: IpcValue[]; error?: string }>;
        categories: () => Promise<{ success: boolean; categories?: string[]; error?: string }>;
        install: (serverId: string) => Promise<{ success: boolean; error?: string }>;
        uninstall: (serverId: string) => Promise<{ success: boolean; error?: string }>;
        installed: () => Promise<{ success: boolean; servers?: IpcValue[]; error?: string }>;
        toggle: (
            serverId: string,
            enabled: boolean
        ) => Promise<{ success: boolean; error?: string }>;
        updateConfig: (
            serverId: string,
            patch: Record<string, IpcValue>
        ) => Promise<{ success: boolean; error?: string }>;
        versionHistory: (
            serverId: string
        ) => Promise<{ success: boolean; history?: string[]; error?: string }>;
        rollbackVersion: (
            serverId: string,
            targetVersion: string
        ) => Promise<{ success: boolean; error?: string }>;
        debug: () => Promise<{ success: boolean; metrics?: IpcValue; error?: string }>;
        refresh: () => Promise<{ success: boolean; error?: string }>;
        health: () => Promise<{
            success: boolean;
            data?: {
                status: 'healthy' | 'degraded';
                uiState: 'ready' | 'failure';
                budgets: { fastMs: number; standardMs: number; heavyMs: number };
                metrics: Record<string, IpcValue>;
            };
            error?: string;
            errorCode?: string;
            messageKey?: string;
            retryable?: boolean;
            uiState?: 'ready' | 'failure';
            fallbackUsed?: boolean;
        }>;
    };

    proxyEmbed: {
        start: (options?: {
            configPath?: string;
            port?: number;
            health?: boolean;
        }) => Promise<IpcValue>;
        stop: () => Promise<IpcValue>;
        status: () => Promise<IpcValue>;
    };

    // Screenshot
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

    // Settings
    getSettings: () => Promise<AppSettings>;
    saveSettings: (settings: AppSettings) => Promise<void>;

    huggingface: {
        searchModels: (
            query: string,
            limit: number,
            page: number,
            sort: string
        ) => Promise<{
            models: {
                id: string;
                name: string;
                author: string;
                description: string;
                downloads: number;
                likes: number;
                tags: string[];
                lastModified: string;
            }[];
            total: number;
        }>;
        getRecommendations: (
            limit?: number,
            query?: string
        ) => Promise<Array<{
            id: string;
            name: string;
            author: string;
            description: string;
            downloads: number;
            likes: number;
            tags: string[];
            lastModified: string;
            category: string;
            recommendationScore: number;
        }>>;
        getFiles: (
            modelId: string
        ) => Promise<{ path: string; size: number; oid: string; quantization: string }[]>;
        getModelPreview: (modelId: string) => Promise<unknown>;
        compareModels: (modelIds: string[]) => Promise<unknown>;
        validateCompatibility: (
            file: { path: string; size: number; oid?: string; quantization: string },
            availableRamGB?: number,
            availableVramGB?: number
        ) => Promise<{
            compatible: boolean;
            reasons: string[];
            estimatedRamGB: number;
            estimatedVramGB: number;
        }>;
        getWatchlist: () => Promise<string[]>;
        addToWatchlist: (modelId: string) => Promise<{ success: boolean }>;
        removeFromWatchlist: (modelId: string) => Promise<{ success: boolean }>;
        getCacheStats: () => Promise<{
            size: number;
            maxSize: number;
            ttlMs: number;
            oldestAgeMs: number;
            watchlistSize: number;
        }>;
        clearCache: () => Promise<{ success: boolean; removed: number }>;
        testDownloadedModel: (filePath: string) => Promise<{
            success: boolean;
            error?: string;
            metadata?: { architecture?: string; contextLength?: number };
        }>;
        getConversionPresets: () => Promise<Array<{
            id: 'balanced' | 'quality' | 'speed' | 'tiny';
            quantization: 'F16' | 'Q8_0' | 'Q6_K' | 'Q5_K_M' | 'Q4_K_M';
            description: string;
        }>>;
        getOptimizationSuggestions: (options: {
            sourcePath: string;
            outputPath: string;
            quantization: string;
            preset?: string;
            modelId?: string;
        }) => Promise<string[]>;
        validateConversion: (options: {
            sourcePath: string;
            outputPath: string;
            quantization: string;
            preset?: string;
            modelId?: string;
        }) => Promise<{ valid: boolean; errors: string[] }>;
        convertModel: (options: {
            sourcePath: string;
            outputPath: string;
            quantization: string;
            preset?: string;
            modelId?: string;
        }) => Promise<{ success: boolean; error?: string; warnings?: string[] }>;
        onConversionProgress: (
            callback: (progress: { stage: string; percent: number; message: string }) => void
        ) => () => void;
        getModelVersions: (modelId: string) => Promise<Array<{
            versionId: string;
            modelId: string;
            path: string;
            createdAt: number;
            notes?: string;
            pinned?: boolean;
            metadata?: { architecture?: string; contextLength?: number };
        }>>;
        registerModelVersion: (modelId: string, filePath: string, notes?: string) => Promise<unknown>;
        compareModelVersions: (modelId: string, leftVersionId: string, rightVersionId: string) => Promise<unknown>;
        rollbackModelVersion: (modelId: string, versionId: string, targetPath: string) => Promise<{ success: boolean; error?: string }>;
        pinModelVersion: (modelId: string, versionId: string, pinned: boolean) => Promise<{ success: boolean }>;
        getVersionNotifications: (modelId: string) => Promise<string[]>;
        prepareFineTuneDataset: (inputPath: string, outputPath: string) => Promise<{
            success: boolean;
            outputPath: string;
            records: number;
            error?: string;
        }>;
        startFineTune: (
            modelId: string,
            datasetPath: string,
            outputPath: string,
            options?: { epochs?: number; learningRate?: number }
        ) => Promise<unknown>;
        listFineTuneJobs: (modelId?: string) => Promise<unknown[]>;
        getFineTuneJob: (jobId: string) => Promise<unknown>;
        cancelFineTuneJob: (jobId: string) => Promise<{ success: boolean }>;
        evaluateFineTuneJob: (jobId: string) => Promise<unknown>;
        exportFineTunedModel: (jobId: string, exportPath: string) => Promise<{ success: boolean; error?: string }>;
        onFineTuneProgress: (callback: (job: unknown) => void) => () => void;
        downloadFile: (
            url: string,
            outputPath: string,
            expectedSize: number,
            expectedSha256: string,
            scheduleAtMs?: number
        ) => Promise<{ success: boolean; error?: string }>;
        onDownloadProgress: (
            callback: (progress: { filename: string; received: number; total: number }) => void
        ) => void;
        cancelDownload: () => void;
    };

    log: {
        write: (
            level: 'debug' | 'info' | 'warn' | 'error',
            message: string,
            data?: IpcValue
        ) => void;
        debug: (message: string, data?: IpcValue) => void;
        info: (message: string, data?: IpcValue) => void;
        warn: (message: string, data?: IpcValue) => void;
        error: (message: string, data?: IpcValue) => void;
    };

    gallery: {
        list: () => Promise<{ name: string; path: string; url: string; mtime: number }[]>;
        delete: (path: string) => Promise<boolean>;
        open: (path: string) => Promise<boolean>;
        reveal: (path: string) => Promise<boolean>;
    };

    // Ideas feature
    ideas: {
        createSession: (config: IdeaSessionConfig) => Promise<IdeaSession>;
        getSession: (id: string) => Promise<IdeaSession | null>;
        getSessions: () => Promise<IdeaSession[]>;
        cancelSession: (id: string) => Promise<{ success: boolean }>;
        generateMarketPreview: (categories: IdeaCategory[]) => Promise<{
            success: boolean;
            data?: Array<{
                category: IdeaCategory;
                summary: string;
                keyTrends: string[];
                marketSize: string;
                competition: string;
            }>;
        }>;
        startResearch: (sessionId: string) => Promise<{ success: boolean; data?: ResearchData }>;
        startGeneration: (sessionId: string) => Promise<{ success: boolean }>;
        enrichIdea: (ideaId: string) => Promise<{ success: boolean; data?: ProjectIdea }>;
        getIdea: (id: string) => Promise<ProjectIdea | null>;
        getIdeas: (sessionId?: string) => Promise<ProjectIdea[]>;
        regenerateIdea: (ideaId: string) => Promise<{ success: boolean; idea?: ProjectIdea }>;
        approveIdea: (
            ideaId: string,
            projectPath: string,
            selectedName?: string
        ) => Promise<{ success: boolean; project?: Project }>;
        rejectIdea: (ideaId: string) => Promise<{ success: boolean }>;
        canGenerateLogo: () => Promise<boolean>;
        generateLogo: (
            ideaId: string,
            options: { prompt: string; style: string; model: string; count: number }
        ) => Promise<{ success: boolean; logoPaths?: string[] }>;
        queryResearch: (
            ideaId: string,
            question: string
        ) => Promise<{ success: boolean; answer: string }>;
        // Deep research handlers
        deepResearch: (
            topic: string,
            category: string
        ) => Promise<{ success: boolean; report?: IpcValue }>;
        validateIdea: (
            title: string,
            description: string,
            category: string
        ) => Promise<{ success: boolean; validation?: IpcValue }>;
        clearResearchCache: () => Promise<{ success: boolean }>;
        // Scoring handlers
        scoreIdea: (ideaId: string) => Promise<{ success: boolean; score?: IpcValue }>;
        rankIdeas: (ideaIds: string[]) => Promise<{ success: boolean; ranked?: IpcValue[] }>;
        compareIdeas: (
            ideaId1: string,
            ideaId2: string
        ) => Promise<{ success: boolean; comparison?: IpcValue }>;
        quickScore: (
            title: string,
            description: string,
            category: string
        ) => Promise<{ success: boolean; score?: number }>;
        // Data management handlers
        deleteIdea: (ideaId: string) => Promise<{ success: boolean }>;
        deleteSession: (sessionId: string) => Promise<{ success: boolean }>;
        archiveIdea: (ideaId: string) => Promise<{ success: boolean }>;
        restoreIdea: (ideaId: string) => Promise<{ success: boolean }>;
        getArchivedIdeas: (sessionId?: string) => Promise<ProjectIdea[]>;
        // Progress events
        onResearchProgress: (callback: (progress: ResearchProgress) => void) => () => void;
        onIdeaProgress: (callback: (progress: IdeaProgress) => void) => () => void;
        onDeepResearchProgress: (
            callback: (progress: { stage: string; progress: number }) => void
        ) => () => void;
    };

    getUserDataPath: () => Promise<string>;

    update: {
        checkForUpdates: () => Promise<void>;
        downloadUpdate: () => Promise<void>;
        installUpdate: () => Promise<void>;
    };

    collaboration: {
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
        getLogs: (
            startDate?: string,
            endDate?: string,
            category?: string
        ) => Promise<
            Array<{
                timestamp: number;
                action: string;
                category: string;
                details?: Record<string, IpcValue>;
                success: boolean;
                error?: string;
            }>
        >;
    };

    memory: {
        getAll: () => Promise<{
            facts: SemanticFragment[];
            episodes: EpisodicMemory[];
            entities: EntityKnowledge[];
        }>;
        addFact: (
            content: string,
            tags?: string[]
        ) => Promise<{ success: boolean; id?: string; error?: string }>;
        deleteFact: (id: string) => Promise<{ success: boolean; error?: string }>;
        deleteEntity: (id: string) => Promise<{ success: boolean; error?: string }>;
        setEntityFact: (
            entityType: string,
            entityName: string,
            key: string,
            value: string
        ) => Promise<{ success: boolean; id?: string; error?: string }>;
        search: (
            query: string
        ) => Promise<{ facts: SemanticFragment[]; episodes: EpisodicMemory[] }>;
    };

    /**
     * Advanced Memory System - Staging buffer, validation, context-aware recall
     */
    advancedMemory: {
        // Pending memories (staging buffer)
        getPending: () => Promise<{ success: boolean; data: PendingMemory[]; error?: string }>;
        confirm: (
            id: string,
            adjustments?: {
                content?: string;
                category?: MemoryCategory;
                tags?: string[];
                importance?: number;
            }
        ) => Promise<{ success: boolean; data?: AdvancedSemanticFragment; error?: string }>;
        reject: (id: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
        confirmAll: () => Promise<{ success: boolean; confirmed: number; error?: string }>;
        rejectAll: () => Promise<{ success: boolean; rejected: number; error?: string }>;

        // Explicit memory
        remember: (
            content: string,
            options?: { category?: MemoryCategory; tags?: string[]; projectId?: string }
        ) => Promise<{ success: boolean; data?: AdvancedSemanticFragment; error?: string }>;

        // Recall
        recall: (context: RecallContext) => Promise<{
            success: boolean;
            data: { memories: AdvancedSemanticFragment[]; totalMatches: number };
            error?: string;
        }>;
        search: (
            query: string,
            limit?: number
        ) => Promise<{ success: boolean; data: AdvancedSemanticFragment[]; error?: string }>;
        getSearchAnalytics: () => Promise<{
            success: boolean;
            data: MemorySearchAnalytics;
            error?: string;
        }>;
        getSearchHistory: (
            limit?: number
        ) => Promise<{ success: boolean; data: MemorySearchHistoryEntry[]; error?: string }>;
        getSearchSuggestions: (
            prefix?: string,
            limit?: number
        ) => Promise<{ success: boolean; data: string[]; error?: string }>;
        export: (query?: string, limit?: number) => Promise<{
            success: boolean;
            data?: {
                exportedAt: string;
                query?: string;
                count: number;
                memories: AdvancedSemanticFragment[];
            };
            error?: string;
        }>;
        import: (payload: {
            memories?: Array<Partial<AdvancedSemanticFragment>>;
            pendingMemories?: Array<Partial<PendingMemory>>;
            replaceExisting?: boolean;
        }) => Promise<{ success: boolean; data?: MemoryImportResult; error?: string }>;

        // Stats & Maintenance
        getStats: () => Promise<{ success: boolean; data?: MemoryStatistics; error?: string }>;
        runDecay: () => Promise<{ success: boolean; error?: string }>;

        // Extraction
        extractFromMessage: (
            content: string,
            sourceId: string,
            projectId?: string
        ) => Promise<{ success: boolean; data: PendingMemory[]; error?: string }>;

        // Delete & Edit
        delete: (id: string) => Promise<{ success: boolean; error?: string }>;
        deleteMany: (
            ids: string[]
        ) => Promise<{ success: boolean; deleted: number; failed: string[]; error?: string }>;
        edit: (
            id: string,
            updates: {
                content?: string;
                category?: MemoryCategory;
                tags?: string[];
                importance?: number;
                projectId?: string | null;
                expiresAt?: number;
            }
        ) => Promise<{ success: boolean; data?: AdvancedSemanticFragment; error?: string }>;
        archive: (id: string) => Promise<{ success: boolean; error?: string }>;
        archiveMany: (
            ids: string[]
        ) => Promise<{ success: boolean; archived: number; failed: string[]; error?: string }>;
        restore: (id: string) => Promise<{ success: boolean; error?: string }>;
        get: (
            id: string
        ) => Promise<{ success: boolean; data?: AdvancedSemanticFragment; error?: string }>;
        shareWithProject: (
            memoryId: string,
            targetProjectId: string
        ) => Promise<{ success: boolean; data?: AdvancedSemanticFragment; error?: string }>;
        createSharedNamespace: (payload: {
            id: string;
            name: string;
            projectIds: string[];
            accessControl?: Record<string, string[]>;
        }) => Promise<{
            success: boolean;
            data?: import('@shared/types/advanced-memory').SharedMemoryNamespace;
            error?: string;
        }>;
        syncSharedNamespace: (
            request: import('@shared/types/advanced-memory').SharedMemorySyncRequest
        ) => Promise<{
            success: boolean;
            data?: import('@shared/types/advanced-memory').SharedMemorySyncResult;
            error?: string;
        }>;
        getSharedNamespaceAnalytics: (namespaceId: string) => Promise<{
            success: boolean;
            data?: import('@shared/types/advanced-memory').SharedMemoryAnalytics;
            error?: string;
        }>;
        searchAcrossProjects: (payload: {
            namespaceId: string;
            query: string;
            projectId: string;
            limit?: number;
        }) => Promise<{ success: boolean; data: AdvancedSemanticFragment[]; error?: string }>;
        getHistory: (
            id: string
        ) => Promise<{ success: boolean; data: import('@shared/types/advanced-memory').MemoryVersion[]; error?: string }>;
        rollback: (
            id: string,
            versionIndex: number
        ) => Promise<{ success: boolean; data?: AdvancedSemanticFragment; error?: string }>;
        recategorize: (ids?: string[]) => Promise<{ success: boolean; error?: string }>;

        // Visualization
        getAllEntityKnowledge: () => Promise<{ success: boolean; data: EntityKnowledge[]; error?: string }>;
        getAllEpisodes: () => Promise<{ success: boolean; data: EpisodicMemory[]; error?: string }>;
        getAllAdvancedMemories: () => Promise<{ success: boolean; data: AdvancedSemanticFragment[]; error?: string }>;
        health: () => Promise<{
            success: boolean;
            data?: {
                status: 'healthy' | 'degraded';
                uiState: 'ready' | 'failure';
                budgets: { fastMs: number; standardMs: number; heavyMs: number };
                metrics: Record<string, IpcValue>;
            };
            error?: string;
            errorCode?: string;
            messageKey?: string;
            retryable?: boolean;
        }>;
    };

    // IPC Batching API
    batch: {
        invoke: (requests: Array<{ channel: string; args: IpcValue[] }>) => Promise<{
            results: Array<{
                channel: string;
                success: boolean;
                data?: IpcValue;
                error?: string;
            }>;
            timing: {
                startTime: number;
                endTime: number;
                totalMs: number;
            };
        }>;
        invokeSequential: (requests: Array<{ channel: string; args: IpcValue[] }>) => Promise<{
            results: Array<{
                channel: string;
                success: boolean;
                data?: IpcValue;
                error?: string;
            }>;
            timing: {
                startTime: number;
                endTime: number;
                totalMs: number;
            };
        }>;
        getChannels: () => Promise<string[]>;
    };
    lazyServices: {
        getStatus: () => Promise<{
            registered: string[];
            loaded: string[];
            loading: string[];
            totals: {
                registered: number;
                loaded: number;
                loading: number;
            };
        }>;
    };
    ipcContract: {
        getVersion: () => Promise<IpcContractVersionInfo>;
        isCompatible: () => Promise<boolean>;
    };

    // Explicit ipcRenderer exposure for flexible components
    ipcRenderer: {
        on: (
            channel: string,
            listener: (event: IpcRendererEvent, ...args: IpcValue[]) => void
        ) => () => void;
        off: (
            channel: string,
            listener: (event: IpcRendererEvent, ...args: IpcValue[]) => void
        ) => void;
        send: (channel: string, ...args: IpcValue[]) => void;
        invoke: (channel: string, ...args: IpcValue[]) => Promise<IpcValue>;
        removeAllListeners: (channel: string) => void;
    };
    // Backward compatibility for components using window.electron.on
    on: (
        channel: string,
        listener: (event: IpcRendererEvent, ...args: IpcValue[]) => void
    ) => () => void;

    projectAgent: {
        start: (options: AgentStartOptions) => Promise<{ taskId: string }>;
        generatePlan: (options: AgentStartOptions) => Promise<void>;
        approvePlan: (plan: string[] | ProjectStep[], taskId?: string) => Promise<void>;
        stop: (taskId?: string) => Promise<void>;
        createPullRequest: (
            taskId?: string
        ) => Promise<{ success: boolean; url?: string; error?: string }>;
        resetState: () => Promise<void>;
        getStatus: (taskId?: string) => Promise<ProjectState>;
        retryStep: (index: number, taskId?: string) => Promise<void>;
        selectModel: (payload: {
            taskId: string;
            provider: string;
            model: string;
        }) => Promise<{ success: boolean; error?: string }>;
        // AGT-HIL: Human-in-the-Loop step actions
        approveStep: (taskId: string, stepId: string) => Promise<void>;
        skipStep: (taskId: string, stepId: string) => Promise<void>;
        editStep: (taskId: string, stepId: string, text: string) => Promise<void>;
        addStepComment: (taskId: string, stepId: string, comment: string) => Promise<void>;
        insertInterventionPoint: (taskId: string, afterStepId: string) => Promise<void>;
        getCheckpoints: (
            taskId: string
        ) => Promise<Array<{ id: string; stepIndex: number; trigger: string; createdAt: number }>>;
        rollbackCheckpoint: (checkpointId: string) => Promise<{
            success: boolean;
            taskId: string;
            resumedCheckpointId: string;
            preRollbackCheckpointId: string;
            planVersionId?: string;
        }>;
        getPlanVersions: (taskId: string) => Promise<
            Array<{
                id: string;
                taskId: string;
                versionNumber: number;
                reason: string;
                plan: ProjectStep[];
                createdAt: number;
            }>
        >;
        deleteTaskByNodeId: (nodeId: string) => Promise<boolean>;
        getProfiles: () => Promise<import('@shared/types/project-agent').AgentProfile[]>;
        getRoutingRules: () => Promise<import('@shared/types/project-agent').ModelRoutingRule[]>;
        setRoutingRules: (
            rules: import('@shared/types/project-agent').ModelRoutingRule[]
        ) => Promise<{ success: boolean }>;
        createVotingSession: (payload: {
            taskId: string;
            stepIndex: number;
            question: string;
            options: string[];
        }) => Promise<import('@shared/types/project-agent').VotingSession>;
        submitVote: (payload: {
            sessionId: string;
            modelId: string;
            provider: string;
            decision: string;
            confidence: number;
            reasoning?: string;
        }) => Promise<import('@shared/types/project-agent').VotingSession | null>;
        requestVotes: (payload: {
            sessionId: string;
            models: Array<{ provider: string; model: string }>;
        }) => Promise<import('@shared/types/project-agent').VotingSession | null>;
        resolveVoting: (
            sessionId: string
        ) => Promise<import('@shared/types/project-agent').VotingSession | null>;
        getVotingSession: (
            sessionId: string
        ) => Promise<import('@shared/types/project-agent').VotingSession | null>;
        listVotingSessions: (
            taskId?: string
        ) => Promise<import('@shared/types/project-agent').VotingSession[]>;
        overrideVotingDecision: (payload: {
            sessionId: string;
            finalDecision: string;
            reason?: string;
        }) => Promise<import('@shared/types/project-agent').VotingSession | null>;
        getVotingAnalytics: (
            taskId?: string
        ) => Promise<import('@shared/types/project-agent').VotingAnalytics>;
        getVotingConfiguration: () => Promise<import('@shared/types/project-agent').VotingConfiguration>;
        updateVotingConfiguration: (
            patch: Partial<import('@shared/types/project-agent').VotingConfiguration>
        ) => Promise<import('@shared/types/project-agent').VotingConfiguration>;
        listVotingTemplates: () => Promise<import('@shared/types/project-agent').VotingTemplate[]>;
        buildConsensus: (
            outputs: Array<{ modelId: string; provider: string; output: string }>
        ) => Promise<import('@shared/types/project-agent').ConsensusResult>;
        createDebateSession: (payload: {
            taskId: string;
            stepIndex: number;
            topic: string;
        }) => Promise<import('@shared/types/project-agent').DebateSession | null>;
        submitDebateArgument: (payload: {
            sessionId: string;
            agentId: string;
            provider: string;
            side: import('@shared/types/project-agent').DebateSide;
            content: string;
            confidence: number;
            citations?: import('@shared/types/project-agent').DebateCitation[];
        }) => Promise<import('@shared/types/project-agent').DebateSession | null>;
        resolveDebateSession: (
            sessionId: string
        ) => Promise<import('@shared/types/project-agent').DebateSession | null>;
        overrideDebateSession: (payload: {
            sessionId: string;
            moderatorId: string;
            decision: import('@shared/types/project-agent').DebateSide | 'balanced';
            reason?: string;
        }) => Promise<import('@shared/types/project-agent').DebateSession | null>;
        getDebateSession: (
            sessionId: string
        ) => Promise<import('@shared/types/project-agent').DebateSession | null>;
        listDebateHistory: (
            taskId?: string
        ) => Promise<import('@shared/types/project-agent').DebateSession[]>;
        getDebateReplay: (
            sessionId: string
        ) => Promise<import('@shared/types/project-agent').DebateReplay | null>;
        generateDebateSummary: (sessionId: string) => Promise<string | null>;
        getTeamworkAnalytics: () => Promise<import('@shared/types/project-agent').AgentTeamworkAnalytics | null>;
        getTemplates: (
            category?: import('@shared/types/project-agent').AgentTemplateCategory
        ) => Promise<import('@shared/types/project-agent').AgentTemplate[]>;
        getTemplate: (
            id: string
        ) => Promise<import('@shared/types/project-agent').AgentTemplate | null>;
        saveTemplate: (
            template: import('@shared/types/project-agent').AgentTemplate
        ) => Promise<{
            success: boolean;
            template: import('@shared/types/project-agent').AgentTemplate;
        }>;
        deleteTemplate: (id: string) => Promise<{ success: boolean }>;
        exportTemplate: (
            id: string
        ) => Promise<import('@shared/types/project-agent').AgentTemplateExport | null>;
        importTemplate: (
            exported: import('@shared/types/project-agent').AgentTemplateExport
        ) => Promise<{
            success: boolean;
            template?: import('@shared/types/project-agent').AgentTemplate;
            error?: string;
        }>;
        applyTemplate: (payload: {
            templateId: string;
            values: Record<string, string | number | boolean>;
        }) => Promise<{
            success: boolean;
            template?: import('@shared/types/project-agent').AgentTemplate;
            task?: string;
            steps?: string[];
            error?: string;
        }>;
        onUpdate: (callback: (state: ProjectState) => void) => () => void;
        // Canvas persistence
        saveCanvasNodes: (
            nodes: Array<{
                id: string;
                type: string;
                position: { x: number; y: number };
                data: Record<string, IpcValue>;
            }>
        ) => Promise<void>;
        getCanvasNodes: () => Promise<
            Array<{
                id: string;
                type: string;
                position: { x: number; y: number };
                data: Record<string, IpcValue>;
            }>
        >;
        deleteCanvasNode: (id: string) => Promise<void>;
        saveCanvasEdges: (
            edges: Array<{
                id: string;
                source: string;
                target: string;
                sourceHandle?: string;
                targetHandle?: string;
            }>
        ) => Promise<void>;
        getCanvasEdges: () => Promise<
            Array<{
                id: string;
                source: string;
                target: string;
                sourceHandle?: string;
                targetHandle?: string;
            }>
        >;
        deleteCanvasEdge: (id: string) => Promise<void>;
        health: () => Promise<{
            success: boolean;
            data?: {
                status: 'healthy' | 'degraded';
                uiState: 'ready' | 'failure';
                budgets: { fastMs: number; standardMs: number; heavyMs: number };
                metrics: Record<string, IpcValue>;
            };
            error?: string;
            errorCode?: string;
            messageKey?: string;
            retryable?: boolean;
            uiState?: 'ready' | 'failure';
            fallbackUsed?: boolean;
        }>;
    };
    orchestrator: {
        start: (task: string, projectId?: string) => Promise<void>;
        approve: (plan: ProjectStep[]) => Promise<void>;
        getState: () => Promise<OrchestratorStateView>;
        stop: () => Promise<void>;
        onUpdate: (callback: (state: OrchestratorStateView) => void) => () => void;
    };

    workflow: {
        getAll: () => Promise<import('@shared/types/workflow.types').Workflow[]>;
        get: (id: string) => Promise<import('@shared/types/workflow.types').Workflow | null>;
        create: (workflow: Omit<import('@shared/types/workflow.types').Workflow, 'id' | 'createdAt' | 'updatedAt'>) => Promise<import('@shared/types/workflow.types').Workflow>;
        update: (id: string, updates: Partial<import('@shared/types/workflow.types').Workflow>) => Promise<import('@shared/types/workflow.types').Workflow>;
        delete: (id: string) => Promise<void>;
        execute: (id: string, context?: Record<string, unknown>) => Promise<import('@shared/types/workflow.types').WorkflowExecutionResult>;
        triggerManual: (triggerId: string, context?: Record<string, unknown>) => Promise<void>;
    };

    voice: {
        getSettings: () => Promise<VoiceSettings>;
        updateSettings: (settings: Partial<VoiceSettings>) => Promise<{ success: boolean; settings: VoiceSettings }>;
        getCommands: () => Promise<VoiceCommand[]>;
        addCommand: (command: VoiceCommand) => Promise<{ success: boolean; command: VoiceCommand }>;
        removeCommand: (commandId: string) => Promise<{ success: boolean }>;
        processTranscript: (transcript: string) => Promise<{
            success: boolean;
            result: VoiceRecognitionResult;
            command: VoiceCommand | null;
        }>;
        executeCommand: (command: VoiceCommand) => Promise<{ success: boolean; action: string }>;
        getVoices: () => Promise<VoiceInfo[]>;
        synthesize: (options: VoiceSynthesisOptions) => Promise<{ success: boolean }>;
        health: () => Promise<{
            success: boolean;
            data?: {
                status: 'healthy' | 'degraded';
                uiState: 'ready' | 'failure';
                budgets: { fastMs: number; standardMs: number; heavyMs: number };
                metrics: Record<string, IpcValue>;
            };
            error?: string;
            errorCode?: string;
            messageKey?: string;
            retryable?: boolean;
        }>;
    };

    extension: {
        getAll: () => Promise<{
            success: boolean;
            extensions: Array<{
                manifest: import('@shared/types/extension').ExtensionManifest;
                status: import('@shared/types/extension').ExtensionStatus;
            }>;
        }>;
        get: (extensionId: string) => Promise<{
            success: boolean;
            extension?: {
                manifest: import('@shared/types/extension').ExtensionManifest;
                status: import('@shared/types/extension').ExtensionStatus;
            };
        }>;
        install: (extensionPath: string) => Promise<{ success: boolean; extensionId?: string; error?: string }>;
        uninstall: (extensionId: string) => Promise<{ success: boolean; error?: string }>;
        activate: (extensionId: string) => Promise<{ success: boolean; error?: string }>;
        deactivate: (extensionId: string) => Promise<{ success: boolean; error?: string }>;
        devStart: (options: import('@shared/types/extension').ExtensionDevOptions) => Promise<{ success: boolean; error?: string }>;
        devStop: (extensionId: string) => Promise<{ success: boolean; error?: string }>;
        devReload: (extensionId: string) => Promise<{ success: boolean; error?: string }>;
        test: (options: import('@shared/types/extension').ExtensionTestOptions) => Promise<import('@shared/types/extension').ExtensionTestResult>;
        publish: (options: import('@shared/types/extension').ExtensionPublishOptions) => Promise<import('@shared/types/extension').ExtensionPublishResult>;
        getProfile: (extensionId: string) => Promise<{
            success: boolean;
            profile?: import('@shared/types/extension').ExtensionProfileData;
        }>;
        validate: (manifest: unknown) => Promise<{ valid: boolean; errors: string[] }>;
    };
}

declare global {
    interface Window {
        electron: ElectronAPI;
        TandemSpeak: (text: string) => void;
    }
}
