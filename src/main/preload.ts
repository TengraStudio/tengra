import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

// Increase max listeners for ipcRenderer to handle multiple terminal/process streams
ipcRenderer.setMaxListeners(50)
import {
    Chat, Message, Folder, Project, AgentDefinition, Prompt,
    SSHConnection, SSHFile, SSHConfig, ToolCall, ToolDefinition, ToolResult,
    MCPServerConfig,
    TodoItem, FileEntry, ProcessInfo,
    ProjectAnalysis, QuotaResponse, OllamaLibraryModel,
    AppSettings, IpcValue, SSHExecOptions, AuthStatus,
    SSHSystemStats, SSHPackageInfo, FileSearchResult, CopilotQuota, CouncilSession
} from '@shared/types'

interface ModelDefinition {
    id: string
    name: string
    provider: string
    quotaInfo?: { remainingQuota?: number; totalQuota?: number; resetTime?: string; remainingFraction?: number }
    percentage?: number
    reset?: string
    [key: string]: IpcValue | undefined
}

interface ProxyModelResponse {
    data: ModelDefinition[]
    antigravityError?: string
    [key: string]: IpcValue | undefined
}

interface LlamaModel {
    name: string
    path: string
    size: number
}

export interface ElectronAPI {
    // Window controls
    minimize: () => void
    maximize: () => void
    close: () => void
    resizeWindow: (resolution: string) => void
    toggleCompact: (enabled: boolean) => void

    // Auth
    githubLogin: (appId?: 'profile' | 'copilot') => Promise<{ device_code: string; user_code: string; verification_uri: string; expires_in: number; interval: number }>
    pollToken: (deviceCode: string, interval: number, appId?: 'profile' | 'copilot') => Promise<{ success: boolean; token?: string; error?: string }>
    antigravityLogin: () => Promise<{ url: string; state: string }>

    claudeLogin: () => Promise<{ url: string; state: string }>
    anthropicLogin: () => Promise<{ url: string; state: string }>
    codexLogin: () => Promise<{ url: string; state: string }>

    checkAuthStatus: () => Promise<AuthStatus>
    deleteProxyAuthFile: (name: string) => Promise<boolean>

    code: {
        scanTodos: (rootPath: string) => Promise<TodoItem[]>
        findSymbols: (rootPath: string, query: string) => Promise<FileSearchResult[]>
        searchFiles: (rootPath: string, query: string, isRegex?: boolean) => Promise<FileSearchResult[]>
        indexProject: (rootPath: string, projectId: string) => Promise<void>
        queryIndexedSymbols: (query: string) => Promise<{ name: string; path: string; line: number }[]>
    }

    // Proxy
    getProxyModels: () => Promise<ProxyModelResponse>
    getQuota: () => Promise<QuotaResponse | null>
    getCopilotQuota: () => Promise<CopilotQuota>
    getCodexUsage: () => Promise<Partial<QuotaResponse>>
    getClaudeQuota: () => Promise<{ success: boolean; fiveHour?: { utilization: number; resetsAt: string }; sevenDay?: { utilization: number; resetsAt: string } }>
    checkUsageLimit: (provider: string, model: string) => Promise<{ allowed: boolean; reason?: string }>
    getUsageCount: (period: 'hourly' | 'daily' | 'weekly', provider?: string, model?: string) => Promise<number>
    importChatHistory: (provider: string) => Promise<{ success: boolean; importedChats?: number; importedMessages?: number; message?: string }>
    importChatHistoryJson: (jsonContent: string) => Promise<{ success: boolean; importedChats?: number; importedMessages?: number; message?: string }>
    runCommand: (command: string, args: string[], cwd?: string) => Promise<{ stdout: string; stderr: string; code: number }>
    git: {
        getBranch: (cwd: string) => Promise<{ success: boolean; branch?: string; error?: string }>
        getStatus: (cwd: string) => Promise<{ success: boolean; isClean?: boolean; changes?: number; files?: Array<{ path: string; status: string }>; error?: string }>
        getLastCommit: (cwd: string) => Promise<{ success: boolean; hash?: string; message?: string; author?: string; relativeTime?: string; date?: string; error?: string }>
        getRecentCommits: (cwd: string, count?: number) => Promise<{ success: boolean; commits?: Array<{ hash: string; message: string; author: string; date: string }>; error?: string }>
        getBranches: (cwd: string) => Promise<{ success: boolean; branches?: string[]; error?: string }>
        isRepository: (cwd: string) => Promise<{ success: boolean; isRepository?: boolean }>
        getFileDiff: (cwd: string, filePath: string, staged?: boolean) => Promise<{ original: string; modified: string; success: boolean; error?: string }>
        getUnifiedDiff: (cwd: string, filePath: string, staged?: boolean) => Promise<{ diff: string; success: boolean; error?: string }>
        stageFile: (cwd: string, filePath: string) => Promise<{ success: boolean; error?: string }>
        unstageFile: (cwd: string, filePath: string) => Promise<{ success: boolean; error?: string }>
        getDetailedStatus: (cwd: string) => Promise<{ success: boolean; staged?: Array<{ path: string; status: string }>; unstaged?: Array<{ path: string; status: string }>; error?: string }>
        checkout: (cwd: string, branch: string) => Promise<{ success: boolean; error?: string }>
        commit: (cwd: string, message: string) => Promise<{ success: boolean; error?: string }>
        push: (cwd: string, remote?: string, branch?: string) => Promise<{ success: boolean; error?: string; stdout?: string; stderr?: string }>
        pull: (cwd: string) => Promise<{ success: boolean; error?: string; stdout?: string; stderr?: string }>
        getRemotes: (cwd: string) => Promise<{ success: boolean; remotes?: Array<{ name: string; url: string; fetch: boolean; push: boolean }>; error?: string }>
        getTrackingInfo: (cwd: string) => Promise<{ success: boolean; tracking?: string | null; ahead?: number; behind?: number }>
        getCommitStats: (cwd: string, days?: number) => Promise<{ success: boolean; commitCounts?: Record<string, number>; error?: string }>
        getDiffStats: (cwd: string) => Promise<{ success: boolean; staged?: { added: number; deleted: number; files: number }; unstaged?: { added: number; deleted: number; files: number }; total?: { added: number; deleted: number; files: number }; error?: string }>
    }


    // Ollama chat
    getModels: () => Promise<ModelDefinition[] | { antigravityError?: string }>
    chat: (messages: Message[], model: string) => Promise<{ content: string; done: boolean }>
    chatOpenAI: (messages: Message[], model: string, tools?: ToolDefinition[], provider?: string, options?: Record<string, IpcValue>) => Promise<{ content: string; toolCalls?: ToolCall[]; reasoning?: string; images?: string[]; sources?: string[] }>
    chatStream: (messages: Message[], model: string, tools?: ToolDefinition[], provider?: string, options?: Record<string, IpcValue>, chatId?: string, projectId?: string) => Promise<{ success: boolean; queued?: boolean }>
    abortChat: () => void
    onStreamChunk: (callback: (chunk: { content?: string; toolCalls?: ToolCall[]; reasoning?: string }) => void) => () => void
    removeStreamChunkListener: () => void

    // Ollama management
    isOllamaRunning: () => Promise<boolean>
    startOllama: () => Promise<{ success: boolean; message: string }>
    pullModel: (modelName: string) => Promise<{ success: boolean; error?: string }>
    deleteOllamaModel: (modelName: string) => Promise<{ success: boolean; error?: string }>
    getLibraryModels: () => Promise<OllamaLibraryModel[]>
    onPullProgress: (callback: (progress: { status: string; digest?: string; total?: number; completed?: number }) => void) => void
    removePullProgressListener: () => void

    // New health and GPU checks
    getOllamaHealthStatus: () => Promise<IpcValue>
    forceOllamaHealthCheck: () => Promise<void>
    checkCuda: () => Promise<{ hasCuda: boolean; detail?: string }>
    onOllamaStatusChange: (callback: (status: 'ok' | 'error' | 'stopped') => void) => void

    // llama.cpp
    llama: {
        loadModel: (modelPath: string, config?: Record<string, IpcValue>) => Promise<{ success: boolean; error?: string }>
        unloadModel: () => Promise<{ success: boolean }>
        chat: (message: string, systemPrompt?: string) => Promise<{ success: boolean; response?: string; error?: string }>
        resetSession: () => Promise<{ success: boolean }>
        getModels: () => Promise<LlamaModel[]>
        downloadModel: (url: string, filename: string) => Promise<{ success: boolean; path?: string; error?: string }>
        deleteModel: (modelPath: string) => Promise<{ success: boolean; error?: string }>
        getConfig: () => Promise<Record<string, IpcValue>>
        setConfig: (config: Record<string, IpcValue>) => Promise<{ success: boolean }>
        getGpuInfo: () => Promise<{ available: boolean; name?: string; vram?: number }>
        getModelsDir: () => Promise<string>
        onToken: (callback: (token: string) => void) => void
        removeTokenListener: () => void
        onDownloadProgress: (callback: (progress: { downloaded: number; total: number }) => void) => void
        removeDownloadProgressListener: () => void
    }

    // Database
    db: {
        createChat: (chat: Chat) => Promise<{ success: boolean }>
        updateChat: (id: string, updates: Partial<Chat>) => Promise<{ success: boolean }>
        deleteChat: (id: string) => Promise<{ success: boolean }>
        duplicateChat: (id: string) => Promise<Chat>
        archiveChat: (id: string, isArchived: boolean) => Promise<{ success: boolean }>
        getChat: (id: string) => Promise<Chat | null>
        getAllChats: () => Promise<Chat[]>
        getPrompts: () => Promise<{ id: string; title: string; content: string; tags: string[] }[]>
        createPrompt: (title: string, content: string, tags?: string[]) => Promise<{ success: boolean }>
        updatePrompt: (id: string, updates: Record<string, IpcValue>) => Promise<{ success: boolean }>
        deletePrompt: (id: string) => Promise<{ success: boolean }>
        searchChats: (query: string) => Promise<Chat[]>
        addMessage: (message: Message) => Promise<{ success: boolean }>
        deleteMessage: (id: string) => Promise<{ success: boolean }>
        updateMessage: (id: string, updates: Partial<Message>) => Promise<{ success: boolean }>
        deleteAllChats: () => Promise<{ success: boolean }>
        deleteChatsByTitle: (title: string) => Promise<number>
        deleteMessages: (chatId: string) => Promise<{ success: boolean }>
        getMessages: (chatId: string) => Promise<Message[]>
        getStats: () => Promise<{ chatCount: number; messageCount: number; dbSize: number }>
        getDetailedStats: (period: string) => Promise<{
            chatCount: number
            messageCount: number
            dbSize: number
            totalTokens: number
            promptTokens: number
            completionTokens: number
            tokenTimeline: { timestamp: number; promptTokens: number; completionTokens: number }[]
            activity: number[]
        }>
        getTimeStats: () => Promise<{
            totalOnlineTime: number
            totalCodingTime: number
            projectCodingTime: Record<string, number>
        }>
        getProjects: () => Promise<Project[]>
        createProject: (name: string, path: string, description: string, mounts?: string) => Promise<void>
        updateProject: (id: string, updates: Partial<Project>) => Promise<void>
        deleteProject: (id: string) => Promise<void>
        archiveProject: (id: string, isArchived: boolean) => Promise<void>
        createFolder: (name: string, color?: string) => Promise<Folder>
        deleteFolder: (id: string) => Promise<void>
        updateFolder: (id: string, updates: Partial<Folder>) => Promise<void>
        getFolders: () => Promise<Folder[]>
    }

    collaboration: {
        run: (request: {
            messages: Message[]
            models: Array<{ provider: string; model: string }>
            strategy: 'consensus' | 'vote' | 'best-of-n' | 'chain-of-thought'
            options?: { temperature?: number; maxTokens?: number }
        }) => Promise<{
            responses: Array<{
                provider: string
                model: string
                content: string
                latency: number
                tokens?: number
            }>
            consensus?: string
            votes?: Record<string, number>
            bestResponse?: {
                provider: string
                model: string
                content: string
            }
        }>
        getProviderStats: (provider?: string) => Promise<Record<string, {
            activeTasks: number
            queuedTasks: number
            totalCompleted: number
            totalErrors: number
            averageLatency: number
        }> | {
            activeTasks: number
            queuedTasks: number
            totalCompleted: number
            totalErrors: number
            averageLatency: number
        } | null>
        getActiveTaskCount: (provider: string) => Promise<number>
        setProviderConfig: (provider: string, config: {
            maxConcurrent: number
            priority: number
            rateLimitPerMinute: number
        }) => Promise<{ success: boolean }>
    }

    council: {
        createSession: (goal: string) => Promise<CouncilSession>
        getSessions: () => Promise<CouncilSession[]>
        getSession: (id: string) => Promise<CouncilSession | null>
        addLog: (sessionId: string, agentId: string, message: string, type: 'info' | 'error' | 'success' | 'plan' | 'action') => Promise<void>
        runStep: (sessionId: string) => void
        startLoop: (sessionId: string) => void
        stopLoop: (sessionId: string) => void
    }

    audit: {
        getLogs: (startDate?: string, endDate?: string, category?: string) => Promise<Array<{ timestamp: number; action: string; category: string; details?: Record<string, IpcValue>; success: boolean; error?: string }>>
    }

    agent: {
        getAll: () => Promise<AgentDefinition[]>
        get: (id: string) => Promise<AgentDefinition | null>
    }

    terminal: {
        isAvailable: () => Promise<boolean>
        getShells: () => Promise<{ id: string; name: string; path: string }[]>
        create: (options: { id: string; shell?: string; cwd?: string; cols?: number; rows?: number }) => Promise<{ success: boolean; error?: string }>
        write: (sessionId: string, data: string) => Promise<boolean>
        resize: (sessionId: string, cols: number, rows: number) => Promise<boolean>
        kill: (sessionId: string) => Promise<boolean>
        getSessions: () => Promise<string[]>
        onData: (callback: (data: { id: string; data: string }) => void) => void
        onExit: (callback: (data: { id: string; code: number }) => void) => void
        readBuffer: (sessionId: string) => Promise<string>
        removeAllListeners: () => void
    }

    // SSH
    ssh: {

        connect: (connection: SSHConnection) => Promise<{ success: boolean; error?: string; id?: string }>
        disconnect: (connectionId: string) => Promise<{ success: boolean }>
        execute: (connectionId: string, command: string, options?: SSHExecOptions) => Promise<{ stdout: string; stderr: string; code: number }>
        upload: (connectionId: string, localPath: string, remotePath: string) => Promise<{ success: boolean; error?: string }>
        download: (connectionId: string, remotePath: string, localPath: string) => Promise<{ success: boolean; error?: string }>
        listDir: (connectionId: string, remotePath: string) => Promise<{ success: boolean; files?: SSHFile[]; error?: string }>
        readFile: (connectionId: string, remotePath: string) => Promise<{ success: boolean; content?: string; error?: string }>
        writeFile: (connectionId: string, remotePath: string, content: string) => Promise<{ success: boolean; error?: string }>
        deleteDir: (connectionId: string, path: string) => Promise<{ success: boolean; error?: string }>
        deleteFile: (connectionId: string, path: string) => Promise<{ success: boolean; error?: string }>
        mkdir: (connectionId: string, path: string) => Promise<{ success: boolean; error?: string }>
        rename: (connectionId: string, oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>
        getConnections: () => Promise<SSHConnection[]>
        isConnected: (connectionId: string) => Promise<boolean>
        onStdout: (callback: (data: string | Uint8Array) => void) => void
        onStderr: (callback: (data: string | Uint8Array) => void) => void
        onConnected: (callback: (connectionId: string) => void) => void
        onDisconnected: (callback: (connectionId: string) => void) => void
        onUploadProgress: (callback: (progress: { transferred: number; total: number }) => void) => void
        onDownloadProgress: (callback: (progress: { transferred: number; total: number }) => void) => void
        removeAllListeners: () => void
        onShellData: (callback: (data: { data: string }) => void) => void
        shellStart: (connectionId: string) => Promise<{ success: boolean; error?: string }>
        shellWrite: (connectionId: string, data: string) => Promise<{ success: boolean; error?: string }>
        getSystemStats: (connectionId: string) => Promise<SSHSystemStats>
        getInstalledPackages: (connectionId: string, manager?: 'apt' | 'npm' | 'pip') => Promise<SSHPackageInfo[]>
        getLogFiles: (connectionId: string) => Promise<string[]>
        readLogFile: (connectionId: string, path: string, lines?: number) => Promise<string>
        getProfiles: () => Promise<SSHConfig[]>
        saveProfile: (profile: SSHConfig) => Promise<boolean>
        deleteProfile: (id: string) => Promise<boolean>
    }

    // Tools
    executeTools: (toolName: string, args: Record<string, IpcValue>, toolCallId?: string) => Promise<ToolResult>
    killTool: (toolCallId: string) => Promise<boolean>
    getToolDefinitions: () => Promise<ToolDefinition[]>

    // MCP
    mcp: {
        list: () => Promise<{ name: string; status: string; type: string }[]>
        dispatch: (service: string, action: string, args?: Record<string, IpcValue>) => Promise<Record<string, IpcValue>>
        toggle: (service: string, enabled: boolean) => Promise<{ success: boolean; isEnabled: boolean }>
        install: (config: MCPServerConfig) => Promise<{ success: boolean; error?: string }>
        uninstall: (name: string) => Promise<{ success: boolean }>
        onResult: (callback: (result: Record<string, IpcValue>) => void) => void
        removeResultListener: () => void
    }

    proxyEmbed: {
        start: (options?: { configPath?: string; port?: number; health?: boolean }) => Promise<Record<string, IpcValue>>
        stop: () => Promise<Record<string, IpcValue>>
        status: () => Promise<Record<string, IpcValue>>
    }

    // Screenshot
    captureScreenshot: () => Promise<{ success: boolean; image?: string; error?: string }>

    // Shell / External
    openExternal: (url: string) => void
    openTerminal: (command: string) => Promise<boolean>

    // Files
    readPdf: (path: string) => Promise<{ success: boolean; text?: string; error?: string }>
    selectDirectory: () => Promise<{ success: boolean; path?: string }>
    listDirectory: (path: string) => Promise<{ success: boolean; files?: FileEntry[]; error?: string }>
    readFile: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>
    writeFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>
    createDirectory: (path: string) => Promise<{ success: boolean; error?: string }>
    deleteFile: (path: string) => Promise<{ success: boolean; error?: string }>
    deleteDirectory: (path: string) => Promise<{ success: boolean; error?: string }>
    renamePath: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>
    searchFiles: (rootPath: string, pattern: string) => Promise<{ success: boolean; matches?: string[]; error?: string }>
    saveFile: (content: string, filename: string) => Promise<{ success: boolean; path?: string; error?: string }>
    searchFilesStream: (rootPath: string, pattern: string, onResult: (path: string) => void, onComplete?: () => void) => () => void

    files: {
        listDirectory: (path: string) => Promise<FileEntry[]>
        readFile: (path: string) => Promise<string>
        readImage: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>
        writeFile: (path: string, content: string) => Promise<void>
        exists: (path: string) => Promise<boolean>
    }

    project: {
        analyze: (rootPath: string, projectId: string) => Promise<ProjectAnalysis>
        analyzeIdentity: (rootPath: string) => Promise<{ suggestedPrompts: string[]; colors: string[] }>
        generateLogo: (projectPath: string, prompt: string, style: string) => Promise<string>
        analyzeDirectory: (dirPath: string) => Promise<{ hasPackageJson: boolean; pkg: Record<string, IpcValue>; readme: string | null; stats: { fileCount: number; totalSize: number } }>
        applyLogo: (projectPath: string, tempLogoPath: string) => Promise<string>
        getCompletion: (text: string) => Promise<string>
        improveLogoPrompt: (prompt: string) => Promise<string>
        uploadLogo: (projectPath: string) => Promise<string | null>
        watch: (rootPath: string) => Promise<boolean>
        unwatch: (rootPath: string) => Promise<boolean>
        onFileChange: (callback: (event: string, path: string, rootPath: string) => void) => () => void
    }

    process: {
        spawn: (command: string, args: string[], cwd: string) => Promise<string>
        kill: (id: string) => Promise<boolean>
        list: () => Promise<ProcessInfo[]>
        scanScripts: (rootPath: string) => Promise<Record<string, string>>
        resize: (id: string, cols: number, rows: number) => Promise<void>
        write: (id: string, data: string) => Promise<void>
        onData: (callback: (data: { id: string; data: string }) => void) => void
        onExit: (callback: (data: { id: string; code: number }) => void) => void
        removeListeners: () => void
    }

    // Settings
    getSettings: () => Promise<AppSettings>
    saveSettings: (settings: AppSettings) => Promise<AppSettings>

    huggingface: {
        searchModels: (query: string, limit: number, page: number) => Promise<{ models: { id: string; downloads: number; likes: number }[], total: number }>
        getFiles: (modelId: string) => Promise<{ path: string; size: number; oid: string; quantization: string }[]>
        downloadFile: (url: string, outputPath: string, expectedSize: number, expectedSha256: string) => Promise<{ success: boolean; error?: string }>
        onDownloadProgress: (callback: (progress: { filename: string; received: number; total: number }) => void) => void
        cancelDownload: () => void
    }

    log: {
        write: (level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: Record<string, IpcValue>) => void
        debug: (message: string, data?: Record<string, IpcValue>) => void
        info: (message: string, data?: Record<string, IpcValue>) => void
        warn: (message: string, data?: Record<string, IpcValue>) => void
        error: (message: string, data?: Record<string, IpcValue>) => void
    }

    gallery: {
        list: () => Promise<{ name: string; path: string; url: string; mtime: number }[]>
        delete: (path: string) => Promise<boolean>
        open: (path: string) => Promise<boolean>
        reveal: (path: string) => Promise<boolean>
    }

    on: (channel: string, callback: (...args: IpcValue[]) => void) => () => void
    getUserDataPath: () => Promise<string>

    update: {
        checkForUpdates: () => Promise<void>
        downloadUpdate: () => Promise<void>
        installUpdate: () => Promise<void>
    }

    ipcRenderer: {
        on: (channel: string, listener: (event: IpcRendererEvent, ...args: IpcValue[]) => void) => () => void
        off: (channel: string, listener: (event: IpcRendererEvent, ...args: IpcValue[]) => void) => void
        send: (channel: string, ...args: IpcValue[]) => void
        invoke: <T = IpcValue>(channel: string, ...args: IpcValue[]) => Promise<T>
        removeAllListeners: (channel: string) => void
    }

    // IPC Batching for performance
    batch: {
        invoke: (requests: Array<{ channel: string; args: IpcValue[] }>) => Promise<{
            results: Array<{ channel: string; success: boolean; data?: IpcValue; error?: string }>
            timing: { startTime: number; endTime: number; totalMs: number }
        }>
        invokeSequential: (requests: Array<{ channel: string; args: IpcValue[] }>) => Promise<{
            results: Array<{ channel: string; success: boolean; data?: IpcValue; error?: string }>
            timing: { startTime: number; endTime: number; totalMs: number }
        }>
        getChannels: () => Promise<string[]>
    }

    // Backup & Restore
    backup: {
        create: (options?: { includeChats?: boolean; includeAuth?: boolean; includeSettings?: boolean; includePrompts?: boolean }) => Promise<{ success: boolean; path?: string; error?: string; metadata?: { version: string; createdAt: string; appVersion: string; platform: string; includes: string[] } }>
        restore: (backupPath: string, options?: { restoreChats?: boolean; restoreSettings?: boolean; restorePrompts?: boolean; mergeChats?: boolean }) => Promise<{ success: boolean; restored: string[]; errors: string[] }>
        list: () => Promise<Array<{ name: string; path: string; metadata?: { version: string; createdAt: string; appVersion: string; platform: string; includes: string[] } }>>
        delete: (backupPath: string) => Promise<boolean>
        getDir: () => Promise<string>
        getAutoBackupStatus: () => Promise<{ enabled: boolean; intervalHours: number; maxBackups: number; lastBackup: string | null }>
        configureAutoBackup: (config: { enabled: boolean; intervalHours?: number; maxBackups?: number }) => Promise<void>
        cleanup: () => Promise<number>
    }

    // Export chat to multiple formats
    export: {
        chat: (chat: Chat, options: { format: 'markdown' | 'html' | 'json' | 'txt'; includeTimestamps?: boolean; includeMetadata?: boolean; includeSystemMessages?: boolean; includeToolCalls?: boolean; title?: string }) => Promise<{ success: boolean; path?: string; error?: string }>
        chatToMarkdown: (chat: Chat, options?: { includeTimestamps?: boolean; includeMetadata?: boolean; title?: string }) => Promise<{ success: boolean; path?: string; error?: string }>
        chatToHTML: (chat: Chat, options?: { includeTimestamps?: boolean; includeMetadata?: boolean; title?: string }) => Promise<{ success: boolean; path?: string; error?: string }>
        chatToJSON: (chat: Chat, options?: { includeTimestamps?: boolean; includeMetadata?: boolean; title?: string }) => Promise<{ success: boolean; path?: string; error?: string }>
        chatToText: (chat: Chat, options?: { includeTimestamps?: boolean; includeMetadata?: boolean; title?: string }) => Promise<{ success: boolean; path?: string; error?: string }>
        chatToPDF: (chat: Chat, options?: { title?: string }) => Promise<{ success: boolean; path?: string; error?: string }>
        getContent: (chat: Chat, options: { format: 'markdown' | 'html' | 'json' | 'txt'; includeTimestamps?: boolean; includeMetadata?: boolean; title?: string }) => Promise<{ success: boolean; content?: string; error?: string }>
    }
}

const api: ElectronAPI = {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    toggleCompact: (enabled) => ipcRenderer.send('window:toggle-compact', enabled),
    resizeWindow: (resolution) => ipcRenderer.send('window:resize', resolution),

    githubLogin: (appId?: 'profile' | 'copilot') => ipcRenderer.invoke('auth:github-login', appId),
    pollToken: (deviceCode: string, interval: number, appId?: 'profile' | 'copilot') => ipcRenderer.invoke('auth:poll-token', deviceCode, interval, appId),
    antigravityLogin: () => ipcRenderer.invoke('proxy:antigravityLogin'),

    claudeLogin: () => ipcRenderer.invoke('proxy:claudeLogin'),
    anthropicLogin: () => ipcRenderer.invoke('proxy:anthropicLogin'),
    codexLogin: () => ipcRenderer.invoke('proxy:codexLogin'),
    checkAuthStatus: () => ipcRenderer.invoke('proxy:checkAuthStatus'),
    deleteProxyAuthFile: (name: string) => ipcRenderer.invoke('proxy:deleteAuthFile', name),

    code: {
        scanTodos: (rootPath) => ipcRenderer.invoke('code:scanTodos', rootPath),
        findSymbols: (rootPath, query) => ipcRenderer.invoke('code:findSymbols', rootPath, query),
        searchFiles: (rootPath, query, isRegex) => ipcRenderer.invoke('code:searchFiles', rootPath, query, isRegex),
        indexProject: (rootPath, projectId) => ipcRenderer.invoke('code:indexProject', rootPath, projectId),
        queryIndexedSymbols: (query) => ipcRenderer.invoke('code:queryIndexedSymbols', query)
    },

    getProxyModels: () => ipcRenderer.invoke('proxy:getModels'),
    getQuota: () => ipcRenderer.invoke('proxy:getQuota'),
    getCopilotQuota: () => ipcRenderer.invoke('proxy:getCopilotQuota'),
    getCodexUsage: () => ipcRenderer.invoke('proxy:getCodexUsage'),
    getClaudeQuota: () => ipcRenderer.invoke('proxy:getClaudeQuota'),
    checkUsageLimit: (provider: string, model: string) => ipcRenderer.invoke('usage:checkLimit', provider, model),
    getUsageCount: (period: 'hourly' | 'daily' | 'weekly', provider?: string, model?: string) => ipcRenderer.invoke('usage:getUsageCount', period, provider, model),
    importChatHistory: (provider: string) => ipcRenderer.invoke('history:import', provider),
    importChatHistoryJson: (jsonContent: string) => ipcRenderer.invoke('history:import-json', jsonContent),

    getModels: () => ipcRenderer.invoke('ollama:getModels'),
    chat: (messages, model) => ipcRenderer.invoke('ollama:chat', messages, model),
    chatOpenAI: async (messages, model, tools, provider, options) => {
        const res = await ipcRenderer.invoke('chat:openai', messages, model, tools, provider, options)
        if (res.success) return res.data
        throw new Error(res.error?.message || 'Chat request failed')
    },
    chatStream: (messages, model, tools, provider, options, chatId, projectId) => ipcRenderer.invoke('chat:stream', messages, model, tools, provider, options, chatId, projectId),
    abortChat: () => ipcRenderer.invoke('ollama:abort'),
    onStreamChunk: (callback) => {
        console.log(`[Preload] onStreamChunk registered on ${window.location.href}`);
        const listener = (_event: IpcRendererEvent, chunk: { content?: string; toolCalls?: ToolCall[]; reasoning?: string; chatId?: string; done?: boolean }) => {
            console.log('[Preload] Received ollama:streamChunk:', JSON.stringify(chunk));
            callback(chunk);
        }
        ipcRenderer.on('ollama:streamChunk', listener)
        return () => {
            console.log('[Preload] onStreamChunk unsubscribing');
            ipcRenderer.removeListener('ollama:streamChunk', listener)
        }
    },
    removeStreamChunkListener: () => {
        console.log('[Preload] removeAllListeners for ollama:streamChunk');
        ipcRenderer.removeAllListeners('ollama:streamChunk')
    },

    isOllamaRunning: () => ipcRenderer.invoke('ollama:isRunning'),
    startOllama: () => ipcRenderer.invoke('ollama:start'),
    pullModel: (modelName) => ipcRenderer.invoke('ollama:pullModel', modelName),
    deleteOllamaModel: (modelName) => ipcRenderer.invoke('ollama:deleteModel', modelName),
    getLibraryModels: () => ipcRenderer.invoke('ollama:getLibraryModels'),
    onPullProgress: (callback) => {
        ipcRenderer.on('ollama:pullProgress', (_event, progress) => callback(progress))
    },
    removePullProgressListener: () => ipcRenderer.removeAllListeners('ollama:pullProgress'),

    getOllamaHealthStatus: () => ipcRenderer.invoke('ollama:healthStatus'),
    forceOllamaHealthCheck: () => ipcRenderer.invoke('ollama:forceHealthCheck'),
    checkCuda: () => ipcRenderer.invoke('ollama:checkCuda'),
    onOllamaStatusChange: (callback) => ipcRenderer.on('ollama:statusChange', (_event, value) => callback(value as 'ok' | 'error' | 'stopped')),

    llama: {
        loadModel: (modelPath, config) => ipcRenderer.invoke('llama:loadModel', modelPath, config),
        unloadModel: () => ipcRenderer.invoke('llama:unloadModel'),
        chat: (message, systemPrompt) => ipcRenderer.invoke('llama:chat', message, systemPrompt),
        resetSession: () => ipcRenderer.invoke('llama:resetSession'),
        getModels: () => ipcRenderer.invoke('llama:getModels'),
        downloadModel: (url, filename) => ipcRenderer.invoke('llama:downloadModel', url, filename),
        deleteModel: (modelPath) => ipcRenderer.invoke('llama:deleteModel', modelPath),
        getConfig: () => ipcRenderer.invoke('llama:getConfig'),
        setConfig: (config) => ipcRenderer.invoke('llama:setConfig', config),
        getGpuInfo: () => ipcRenderer.invoke('llama:getGpuInfo'),
        getModelsDir: () => ipcRenderer.invoke('llama:getModelsDir'),
        onToken: (callback) => {
            ipcRenderer.on('llama:token', (_event, token) => callback(token))
        },
        removeTokenListener: () => {
            ipcRenderer.removeAllListeners('llama:token')
        },
        onDownloadProgress: (callback) => {
            ipcRenderer.on('llama:downloadProgress', (_event, progress) => callback(progress))
        },
        removeDownloadProgressListener: () => {
            ipcRenderer.removeAllListeners('llama:downloadProgress')
        }
    },

    db: {
        createChat: (chat) => ipcRenderer.invoke('db:createChat', chat),
        updateChat: (id, updates) => ipcRenderer.invoke('db:updateChat', id, updates),
        deleteChat: (id) => ipcRenderer.invoke('db:deleteChat', id),
        duplicateChat: (id) => ipcRenderer.invoke('db:duplicateChat', id),
        archiveChat: (id, isArchived) => ipcRenderer.invoke('db:archiveChat', id, isArchived),
        getChat: (id) => ipcRenderer.invoke('db:getChat', id),
        getAllChats: () => ipcRenderer.invoke('db:getAllChats'),
        searchChats: (query) => ipcRenderer.invoke('db:searchChats', query),
        addMessage: (message) => ipcRenderer.invoke('db:addMessage', message),
        deleteMessage: (id) => ipcRenderer.invoke('db:deleteMessage', id),
        updateMessage: (id, updates) => ipcRenderer.invoke('db:updateMessage', id, updates),
        deleteAllChats: () => ipcRenderer.invoke('db:deleteAllChats'),
        deleteChatsByTitle: (title) => ipcRenderer.invoke('db:deleteChatsByTitle', title),
        deleteMessages: (chatId) => ipcRenderer.invoke('db:deleteMessages', chatId),
        getMessages: (chatId) => ipcRenderer.invoke('db:getMessages', chatId),
        getStats: () => ipcRenderer.invoke('db:getStats'),
        getDetailedStats: (period) => ipcRenderer.invoke('db:getDetailedStats', period),
        getTimeStats: () => ipcRenderer.invoke('db:getTimeStats'),
        getProjects: () => ipcRenderer.invoke('db:getProjects'),
        createProject: (name, path, desc, mounts) => ipcRenderer.invoke('db:createProject', name, path, desc, mounts),
        updateProject: (id, updates) => ipcRenderer.invoke('db:updateProject', id, updates),
        deleteProject: (id: string) => ipcRenderer.invoke('db:deleteProject', id),
        archiveProject: (id: string, isArchived: boolean) => ipcRenderer.invoke('db:archiveProject', id, isArchived),
        getFolders: () => ipcRenderer.invoke('db:getFolders'),
        createFolder: (name: string, color?: string) => ipcRenderer.invoke('db:createFolder', name, color),
        deleteFolder: (id: string) => ipcRenderer.invoke('db:deleteFolder', id),
        updateFolder: (id: string, updates: Partial<Folder>) => ipcRenderer.invoke('db:updateFolder', id, updates),
        getPrompts: () => ipcRenderer.invoke('db:getPrompts'),
        createPrompt: (title: string, content: string, tags?: string[]) => ipcRenderer.invoke('db:createPrompt', title, content, tags),
        updatePrompt: (id: string, updates: Partial<Prompt>) => ipcRenderer.invoke('db:updatePrompt', id, updates),
        deletePrompt: (id: string) => ipcRenderer.invoke('db:deletePrompt', id)
    },
    audit: {
        getLogs: (startDate?: string, endDate?: string, category?: string) => ipcRenderer.invoke('audit:getLogs', startDate, endDate, category),
    },
    collaboration: {
        run: (request: {
            messages: any[]
            models: Array<{ provider: string; model: string }>
            strategy: 'consensus' | 'vote' | 'best-of-n' | 'chain-of-thought'
            options?: { temperature?: number; maxTokens?: number }
        }) => ipcRenderer.invoke('collaboration:run', request),
        getProviderStats: (provider?: string) => ipcRenderer.invoke('collaboration:getProviderStats', provider),
        getActiveTaskCount: (provider: string) => ipcRenderer.invoke('collaboration:getActiveTaskCount', provider),
        setProviderConfig: (provider: string, config: {
            maxConcurrent: number
            priority: number
            rateLimitPerMinute: number
        }) => ipcRenderer.invoke('collaboration:setProviderConfig', provider, config)
    },

    council: {
        createSession: (goal: string) => ipcRenderer.invoke('council:create', goal),
        getSessions: () => ipcRenderer.invoke('council:get-all'),
        getSession: (id: string) => ipcRenderer.invoke('council:get', id),
        addLog: (sessionId: string, agentId: string, message: string, type: 'info' | 'error' | 'success' | 'plan' | 'action') =>
            ipcRenderer.invoke('council:log', sessionId, agentId, message, type),
        runStep: (sessionId: string) => ipcRenderer.send('council:run-step', sessionId),
        startLoop: (sessionId: string) => ipcRenderer.send('council:start-loop', sessionId),
        stopLoop: (sessionId: string) => ipcRenderer.send('council:stop-loop', sessionId)
    },

    agent: {
        getAll: () => ipcRenderer.invoke('agent:get-all'),
        get: (id: string) => ipcRenderer.invoke('agent:get', id)
    },

    ssh: {
        connect: (connection) => ipcRenderer.invoke('ssh:connect', connection),
        disconnect: (connectionId) => ipcRenderer.invoke('ssh:disconnect', connectionId),
        execute: (connectionId, command, options) => ipcRenderer.invoke('ssh:execute', connectionId, command, options),
        upload: (connectionId, local, remote) => ipcRenderer.invoke('ssh:upload', { connectionId, local, remote }),
        download: (connectionId, remote, local) => ipcRenderer.invoke('ssh:download', { connectionId, remote, local }),
        listDir: (connectionId, path) => ipcRenderer.invoke('ssh:listDir', { connectionId, path }),
        readFile: (connectionId, path) => ipcRenderer.invoke('ssh:readFile', { connectionId, path }),
        writeFile: (connectionId, path, content) => ipcRenderer.invoke('ssh:writeFile', { connectionId, path, content }),
        deleteDir: (connectionId, path) => ipcRenderer.invoke('ssh:deleteDir', { connectionId, path }),
        deleteFile: (connectionId, path) => ipcRenderer.invoke('ssh:deleteFile', { connectionId, path }),
        mkdir: (connectionId, path) => ipcRenderer.invoke('ssh:mkdir', { connectionId, path }),
        rename: (connectionId, oldPath, newPath) => ipcRenderer.invoke('ssh:rename', { connectionId, oldPath, newPath }),
        getConnections: () => ipcRenderer.invoke('ssh:getConnections'),
        isConnected: (connectionId) => ipcRenderer.invoke('ssh:isConnected', connectionId),
        onStdout: (callback) => ipcRenderer.on('ssh:stdout', (_event, data: string | Uint8Array) => callback(data)),
        onStderr: (callback) => ipcRenderer.on('ssh:stderr', (_event, data: string | Uint8Array) => callback(data)),
        onConnected: (callback) => ipcRenderer.on('ssh:connected', (_event, id) => callback(id)),
        onDisconnected: (callback) => ipcRenderer.on('ssh:disconnected', (_event, id) => callback(id)),
        onUploadProgress: (callback) => ipcRenderer.on('ssh:uploadProgress', (_event, p) => callback(p)),
        onDownloadProgress: (callback) => ipcRenderer.on('ssh:downloadProgress', (_event, p) => callback(p)),
        removeAllListeners: () => {
            ipcRenderer.removeAllListeners('ssh:stdout')
            ipcRenderer.removeAllListeners('ssh:stderr')
            ipcRenderer.removeAllListeners('ssh:connected')
            ipcRenderer.removeAllListeners('ssh:disconnected')
            ipcRenderer.removeAllListeners('ssh:uploadProgress')
            ipcRenderer.removeAllListeners('ssh:downloadProgress')
            ipcRenderer.removeAllListeners('ssh:shellData')
        },
        onShellData: (callback) => ipcRenderer.on('ssh:shellData', (_event, data: { data: string }) => callback(data)),
        shellStart: (connectionId) => ipcRenderer.invoke('ssh:shellStart', connectionId),
        shellWrite: (connectionId, data) => ipcRenderer.invoke('ssh:shellWrite', { connectionId, data }),
        getSystemStats: (connectionId) => ipcRenderer.invoke('ssh:getSystemStats', connectionId),
        getInstalledPackages: (connectionId, manager) => ipcRenderer.invoke('ssh:getInstalledPackages', connectionId, manager),
        getLogFiles: (connectionId) => ipcRenderer.invoke('ssh:getLogFiles', connectionId),
        readLogFile: (connectionId, path, lines) => ipcRenderer.invoke('ssh:readLogFile', { connectionId, path, lines }),
        getProfiles: () => ipcRenderer.invoke('ssh:getProfiles'),
        saveProfile: (profile) => ipcRenderer.invoke('ssh:saveProfile', profile),
        deleteProfile: (id) => ipcRenderer.invoke('ssh:deleteProfile', id)
    },

    executeTools: (toolName, args, toolCallId) => ipcRenderer.invoke('tools:execute', toolName, args, toolCallId),
    killTool: (toolCallId) => ipcRenderer.invoke('tools:kill', toolCallId),
    getToolDefinitions: () => ipcRenderer.invoke('tools:getDefinitions'),

    mcp: {
        list: () => ipcRenderer.invoke('mcp:list'),
        dispatch: (service, action, args) => ipcRenderer.invoke('mcp:dispatch', { service, action, args }),
        toggle: (service, enabled) => ipcRenderer.invoke('mcp:toggle', { service, enabled }),
        install: (config) => ipcRenderer.invoke('mcp:install', config),
        uninstall: (name) => ipcRenderer.invoke('mcp:uninstall', name),
        onResult: (callback) => ipcRenderer.on('mcp:result', (_event, result) => callback(result)),
        removeResultListener: () => ipcRenderer.removeAllListeners('mcp:result')
    },

    proxyEmbed: {
        start: (options) => ipcRenderer.invoke('proxy-embed:start', options),
        stop: () => ipcRenderer.invoke('proxy-embed:stop'),
        status: () => ipcRenderer.invoke('proxy-embed:status')
    },

    captureScreenshot: () => ipcRenderer.invoke('screenshot:capture'),
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
    openTerminal: (command) => ipcRenderer.invoke('shell:openTerminal', command),
    runCommand: (command, args, cwd) => ipcRenderer.invoke('shell:runCommand', command, args, cwd),
    git: {
        getBranch: (cwd) => ipcRenderer.invoke('git:getBranch', cwd),
        getStatus: (cwd) => ipcRenderer.invoke('git:getStatus', cwd),
        getLastCommit: (cwd) => ipcRenderer.invoke('git:getLastCommit', cwd),
        getRecentCommits: (cwd, count) => ipcRenderer.invoke('git:getRecentCommits', cwd, count),
        getBranches: (cwd) => ipcRenderer.invoke('git:getBranches', cwd),
        isRepository: (cwd) => ipcRenderer.invoke('git:isRepository', cwd),
        getFileDiff: (cwd: string, filePath: string, staged?: boolean) => ipcRenderer.invoke('git:getFileDiff', cwd, filePath, staged),
        getUnifiedDiff: (cwd: string, filePath: string, staged?: boolean) => ipcRenderer.invoke('git:getUnifiedDiff', cwd, filePath, staged),
        stageFile: (cwd: string, filePath: string) => ipcRenderer.invoke('git:stageFile', cwd, filePath),
        unstageFile: (cwd: string, filePath: string) => ipcRenderer.invoke('git:unstageFile', cwd, filePath),
        getDetailedStatus: (cwd: string) => ipcRenderer.invoke('git:getDetailedStatus', cwd),
        checkout: (cwd: string, branch: string) => ipcRenderer.invoke('git:checkout', cwd, branch),
        commit: (cwd: string, message: string) => ipcRenderer.invoke('git:commit', cwd, message),
        push: (cwd: string, remote?: string, branch?: string) => ipcRenderer.invoke('git:push', cwd, remote, branch),
        pull: (cwd: string) => ipcRenderer.invoke('git:pull', cwd),
        getRemotes: (cwd: string) => ipcRenderer.invoke('git:getRemotes', cwd),
        getTrackingInfo: (cwd: string) => ipcRenderer.invoke('git:getTrackingInfo', cwd),
        getCommitStats: (cwd: string, days?: number) => ipcRenderer.invoke('git:getCommitStats', cwd, days),
        getDiffStats: (cwd: string) => ipcRenderer.invoke('git:getDiffStats', cwd)
    },

    readPdf: (path) => ipcRenderer.invoke('files:readPdf', path),
    selectDirectory: () => ipcRenderer.invoke('files:selectDirectory'),
    listDirectory: (path) => ipcRenderer.invoke('files:listDirectory', path),
    readFile: (path) => ipcRenderer.invoke('files:readFile', path),
    writeFile: (path, content) => ipcRenderer.invoke('files:writeFile', path, content),
    createDirectory: (path) => ipcRenderer.invoke('files:createDirectory', path),
    deleteFile: (path) => ipcRenderer.invoke('files:deleteFile', path),
    deleteDirectory: (path) => ipcRenderer.invoke('files:deleteDirectory', path),
    renamePath: (oldPath, newPath) => ipcRenderer.invoke('files:renamePath', oldPath, newPath),
    searchFiles: (rootPath, pattern) => ipcRenderer.invoke('files:searchFiles', rootPath, pattern),
    searchFilesStream: (rootPath: string, pattern: string, onResult: (path: string) => void, onComplete?: () => void) => {
        const jobId = Math.random().toString(36).substring(7)

        const resultListener = (_event: IpcRendererEvent, path: string) => onResult(path)
        const completeListener = () => {
            ipcRenderer.removeListener(`files:search-result:${jobId}`, resultListener)
            ipcRenderer.removeListener(`files:search-complete:${jobId}`, completeListener)
            if (onComplete) onComplete()
        }

        ipcRenderer.on(`files:search-result:${jobId}`, resultListener)
        ipcRenderer.on(`files:search-complete:${jobId}`, completeListener)

        ipcRenderer.invoke('files:searchFilesStream', rootPath, pattern, jobId)

        return () => { // unsubscribe function
            ipcRenderer.removeListener(`files:search-result:${jobId}`, resultListener)
            ipcRenderer.removeListener(`files:search-complete:${jobId}`, completeListener)
        }
    },
    saveFile: (content, filename) => ipcRenderer.invoke('dialog:saveFile', { content, filename }),

    files: {
        listDirectory: (path: string) => ipcRenderer.invoke('files:listDirectory', path).then(r => r.data),
        readFile: (filePath: string) => ipcRenderer.invoke('files:readFile', filePath).then(r => r.data),
        readImage: (filePath: string) => ipcRenderer.invoke('files:readImage', filePath).then(r => r.data),
        writeFile: (filePath: string, content: string) => ipcRenderer.invoke('files:writeFile', filePath, content).then(r => r.data),
        exists: (path: string) => ipcRenderer.invoke('files:exists', path).then(r => r.data)
    },

    getSettings: () => ipcRenderer.invoke('settings:get'),
    saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

    project: {
        analyze: async (rootPath: string, projectId: string) => {
            const res = await ipcRenderer.invoke('project:analyze', rootPath, projectId)
            if (res.success) return res.data
            throw new Error(res.error?.message || 'Analysis failed')
        },
        analyzeIdentity: async (rootPath: string) => {
            const res = await ipcRenderer.invoke('project:analyzeIdentity', rootPath)
            if (res.success) return res.data
            throw new Error(res.error?.message || 'Identity analysis failed')
        },
        generateLogo: async (projectPath: string, prompt: string, style: string) => {
            const res = await ipcRenderer.invoke('project:generateLogo', projectPath, prompt, style)
            if (res.success) return res.data
            throw new Error(res.error?.message || 'Logo generation failed')
        },
        analyzeDirectory: async (dirPath: string) => {
            const res = await ipcRenderer.invoke('project:analyzeDirectory', dirPath)
            if (res.success) return res.data
            throw new Error(res.error?.message || 'Directory analysis failed')
        },
        applyLogo: async (projectPath: string, tempLogoPath: string) => {
            const res = await ipcRenderer.invoke('project:applyLogo', projectPath, tempLogoPath)
            if (res.success) return res.data
            throw new Error(res.error?.message || 'Apply logo failed')
        },
        getCompletion: async (text: string) => {
            const res = await ipcRenderer.invoke('project:getCompletion', text)
            if (res.success) return res.data
            throw new Error(res.error?.message || 'Completion failed')
        },
        improveLogoPrompt: async (prompt: string) => {
            const res = await ipcRenderer.invoke('project:improveLogoPrompt', prompt)
            if (res.success) return res.data
            throw new Error(res.error?.message || 'Prompt improvement failed')
        },
        uploadLogo: async (projectPath: string) => {
            const res = await ipcRenderer.invoke('project:uploadLogo', projectPath)
            if (res.success) return res.data
            return null
        },
        watch: async (rootPath: string) => {
            const res = await ipcRenderer.invoke('project:watch', rootPath)
            return res.success
        },
        unwatch: async (rootPath: string) => {
            const res = await ipcRenderer.invoke('project:unwatch', rootPath)
            return res.success
        },
        onFileChange: (callback: (event: string, path: string, rootPath: string) => void) => {
            const listener = (_event: IpcRendererEvent, data: { event: string, path: string, rootPath: string }) => callback(data.event, data.path, data.rootPath)
            ipcRenderer.on('project:file-change', listener)
            return () => ipcRenderer.removeListener('project:file-change', listener)
        }
    },

    process: {
        spawn: (command: string, args: string[], cwd: string) => ipcRenderer.invoke('process:spawn', command, args, cwd),
        kill: (id: string) => ipcRenderer.invoke('process:kill', id),
        list: () => ipcRenderer.invoke('process:list'),
        scanScripts: (rootPath: string) => ipcRenderer.invoke('process:scan-scripts', rootPath),
        resize: (id: string, cols: number, rows: number) => ipcRenderer.invoke('process:resize', id, cols, rows),
        write: (id: string, data: string) => ipcRenderer.invoke('process:write', id, data),
        onData: (callback: (data: { id: string; data: string }) => void) => ipcRenderer.on('process:data', (_event, data) => callback(data)),
        onExit: (callback: (data: { id: string; code: number }) => void) => ipcRenderer.on('process:exit', (_event, data) => callback(data)),
        removeListeners: () => {
            ipcRenderer.removeAllListeners('process:data')
            ipcRenderer.removeAllListeners('process:exit')
        }
    },

    huggingface: {
        searchModels: (query: string, limit: number, page: number) => ipcRenderer.invoke('hf:search-models', query, limit, page),
        getFiles: (modelId: string) => ipcRenderer.invoke('hf:get-files', modelId),
        downloadFile: (url: string, outputPath: string, expectedSize: number, expectedSha256: string) => ipcRenderer.invoke('hf:download-file', url, outputPath, expectedSize, expectedSha256),
        onDownloadProgress: (callback) => ipcRenderer.on('hf:download-progress', (_event, progress) => callback(progress)),
        cancelDownload: () => ipcRenderer.invoke('hf:cancel-download')
    },

    log: {
        write: (level, message, data) => ipcRenderer.send('log:write', { level, message, data }),
        debug: (message, data) => ipcRenderer.send('log:write', { level: 'debug', message, data }),
        info: (message, data) => ipcRenderer.send('log:write', { level: 'info', message, data }),
        warn: (message, data) => ipcRenderer.send('log:write', { level: 'warn', message, data }),
        error: (message, data) => ipcRenderer.send('log:write', { level: 'error', message, data })
    },

    terminal: {
        isAvailable: () => ipcRenderer.invoke('terminal:isAvailable'),
        getShells: () => ipcRenderer.invoke('terminal:getShells'),
        create: (options) => ipcRenderer.invoke('terminal:create', options),
        write: (sessionId, data) => ipcRenderer.invoke('terminal:write', sessionId, data),
        resize: (sessionId, cols, rows) => ipcRenderer.invoke('terminal:resize', sessionId, cols, rows),
        kill: (sessionId) => ipcRenderer.invoke('terminal:kill', sessionId),
        getSessions: () => ipcRenderer.invoke('terminal:getSessions'),
        onData: (callback) => {
            const listener = (_event: IpcRendererEvent, data: { id: string; data: string }) => callback(data)
            ipcRenderer.on('terminal:data', listener)
            return () => ipcRenderer.removeListener('terminal:data', listener)
        },
        onExit: (callback) => {
            const listener = (_event: IpcRendererEvent, data: { id: string; code: number }) => callback(data)
            ipcRenderer.on('terminal:exit', listener)
            return () => ipcRenderer.removeListener('terminal:exit', listener)
        },
        readBuffer: (sessionId) => ipcRenderer.invoke('terminal:readBuffer', sessionId),
        removeAllListeners: () => {
            ipcRenderer.removeAllListeners('terminal:data')
            ipcRenderer.removeAllListeners('terminal:exit')
        }
    },

    gallery: {
        list: () => ipcRenderer.invoke('gallery:list'),
        delete: (path) => ipcRenderer.invoke('gallery:delete', path),
        open: (path) => ipcRenderer.invoke('gallery:open', path),
        reveal: (path) => ipcRenderer.invoke('gallery:reveal', path)
    },

    on: (channel: string, callback: (...args: IpcValue[]) => void) => {
        const listener = (_event: IpcRendererEvent, ...args: IpcValue[]) => callback(...args)
        ipcRenderer.on(channel, listener)
        return () => ipcRenderer.removeListener(channel, listener)
    },

    getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath'),

    update: {
        checkForUpdates: () => ipcRenderer.invoke('update:check'),
        downloadUpdate: () => ipcRenderer.invoke('update:download'),
        installUpdate: () => ipcRenderer.invoke('update:install')
    },

    ipcRenderer: {
        on: (channel: string, listener: (event: IpcRendererEvent, ...args: IpcValue[]) => void) => {
            ipcRenderer.on(channel, listener)
            return () => ipcRenderer.removeListener(channel, listener)
        },
        off: (channel: string, listener: (event: IpcRendererEvent, ...args: IpcValue[]) => void) => ipcRenderer.removeListener(channel, listener),
        send: (channel: string, ...args: IpcValue[]) => ipcRenderer.send(channel, ...args),
        invoke: <T = IpcValue>(channel: string, ...args: IpcValue[]) => ipcRenderer.invoke(channel, ...args) as Promise<T>,
        removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel)
    },

    batch: {
        invoke: (requests) => ipcRenderer.invoke('batch:invoke', requests),
        invokeSequential: (requests) => ipcRenderer.invoke('batch:invokeSequential', requests),
        getChannels: () => ipcRenderer.invoke('batch:getChannels')
    },

    backup: {
        create: (options) => ipcRenderer.invoke('backup:create', options),
        restore: (backupPath, options) => ipcRenderer.invoke('backup:restore', backupPath, options),
        list: () => ipcRenderer.invoke('backup:list'),
        delete: (backupPath) => ipcRenderer.invoke('backup:delete', backupPath),
        getDir: () => ipcRenderer.invoke('backup:getDir'),
        getAutoBackupStatus: () => ipcRenderer.invoke('backup:getAutoBackupStatus'),
        configureAutoBackup: (config) => ipcRenderer.invoke('backup:configureAutoBackup', config),
        cleanup: () => ipcRenderer.invoke('backup:cleanup')
    },

    export: {
        chat: (chat, options) => ipcRenderer.invoke('export:chat', chat, options),
        chatToMarkdown: (chat, options) => ipcRenderer.invoke('export:chatToMarkdown', chat, options),
        chatToHTML: (chat, options) => ipcRenderer.invoke('export:chatToHTML', chat, options),
        chatToJSON: (chat, options) => ipcRenderer.invoke('export:chatToJSON', chat, options),
        chatToText: (chat, options) => ipcRenderer.invoke('export:chatToText', chat, options),
        chatToPDF: (chat, options) => ipcRenderer.invoke('export:chatToPDF', chat, options),
        getContent: (chat, options) => ipcRenderer.invoke('export:getContent', chat, options)
    }
}

contextBridge.exposeInMainWorld('electron', api)
