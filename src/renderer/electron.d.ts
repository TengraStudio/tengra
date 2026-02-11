import type { IpcRendererEvent } from 'electron';

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
    SSHFile,
    SSHPackageInfo,
    SSHSystemStats,
    TodoFile,
    ToolCall,
    ToolDefinition,
    ToolResult,
} from '@/shared/types';
import {
    AdvancedSemanticFragment,
    MemoryCategory,
    MemoryStatistics,
    PendingMemory,
    RecallContext,
} from '@/shared/types/advanced-memory';

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

    code: {
        scanTodos: (rootPath: string) => Promise<TodoFile[]>;
        findSymbols: (rootPath: string, query: string) => Promise<FileSearchResult[]>;
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
        }) => void
    ) => void;
    removePullProgressListener: () => void;

    // Health and GPU checks
    getOllamaHealthStatus: () => Promise<{ status: 'ok' | 'error' }>;
    forceOllamaHealthCheck: () => Promise<{ status: 'ok' | 'error' }>;
    checkCuda: () => Promise<{ hasCuda: boolean; detail?: string }>;
    onOllamaStatusChange: (callback: (status: { status: string }) => void) => void;

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
        getShells: () => Promise<{ id: string; name: string; path: string }[]>;
        getBackends: () => Promise<Array<{ id: string; name: string; available: boolean }>>;
        create: (options: {
            id?: string;
            shell?: string;
            cwd?: string;
            cols?: number;
            rows?: number;
            backendId?: string;
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
        onData: (callback: (data: { id: string; data: string }) => void) => () => void;
        onExit: (callback: (data: { id: string; code: number }) => void) => () => void;
        readBuffer: (sessionId: string) => Promise<string>;
        removeAllListeners: () => void;
    };

    agent: {
        getAll: () => Promise<AgentDefinition[]>;
        get: (id: string) => Promise<AgentDefinition | null>;
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
        ) => Promise<{ success: boolean; error?: string; id?: string }>;
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
        refresh: () => Promise<{ success: boolean; error?: string }>;
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
        getFiles: (
            modelId: string
        ) => Promise<{ path: string; size: number; oid: string; quantization: string }[]>;
        downloadFile: (
            url: string,
            outputPath: string,
            expectedSize: number,
            expectedSha256: string
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
        start: (options: AgentStartOptions) => Promise<void>;
        generatePlan: (options: AgentStartOptions) => Promise<void>;
        approvePlan: (plan: string[] | ProjectStep[]) => Promise<void>;
        stop: () => Promise<void>;
        resetState: () => Promise<void>;
        getStatus: () => Promise<ProjectState>;
        retryStep: (index: number) => Promise<void>;
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
    };

    /**
     * Browser extension management APIs
     */
    extension: {
        /** Check if extension warning should be shown */
        shouldShowWarning: () => Promise<boolean>;
        /** Dismiss the extension warning permanently */
        dismissWarning: () => Promise<{ success: boolean }>;
        /** Get extension installation status */
        getStatus: () => Promise<{ installed: boolean; shouldShowWarning: boolean }>;
        /** Mark extension as installed/uninstalled */
        setInstalled: (installed: boolean) => Promise<{ success: boolean }>;
    };
}

declare global {
    interface Window {
        electron: ElectronAPI;
        TandemSpeak: (text: string) => void;
    }
}
