import {
    AppSettings, ProjectAnalysis, Chat, Message, Folder, Project,
    AgentDefinition, SSHConnection, SSHFile,
    SSHConfig, ToolCall, ToolDefinition, ToolResult, IpcValue, AuthStatus, QuotaResponse,
    SSHSystemStats, SSHPackageInfo, FileSearchResult, CopilotQuota, CouncilSession
} from '@/shared/types'
import { IpcRendererEvent } from 'electron'

export interface TodoItem {
    file: string
    line: number
    text: string
}

export interface FileEntry {
    name: string
    isDirectory: boolean
    size: number
    mtime: number
    path: string
}

export interface ProcessInfo {
    pid: number
    name: string
    cmd: string
    cpu: number
    memory: number
}

export interface ModelDefinition {
    id: string
    name: string
    provider: string
    quotaInfo?: { remainingQuota?: number; totalQuota?: number; resetTime?: string; remainingFraction?: number }
    percentage?: number
    reset?: string
    [key: string]: IpcValue | undefined
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
    deleteProxyAuthFile: (name: string) => Promise<{ success: boolean }>

    code: {
        scanTodos: (rootPath: string) => Promise<TodoItem[]>
        findSymbols: (rootPath: string, query: string) => Promise<FileSearchResult[]>
        searchFiles: (rootPath: string, query: string, isRegex?: boolean) => Promise<FileSearchResult[]>
        indexProject: (rootPath: string, projectId: string) => Promise<void>
        queryIndexedSymbols: (query: string) => Promise<{ name: string; path: string; line: number }[]>
    }

    // Project System
    project: {
        analyze: (rootPath: string, projectId: string) => Promise<ProjectAnalysis>
        saveState: (rootPath: string, state: Record<string, IpcValue>) => Promise<boolean>
        loadState: (rootPath: string) => Promise<Record<string, IpcValue>>
        generateLogo: (projectPath: string, prompt: string, style: string) => Promise<string>
        analyzeIdentity: (projectPath: string) => Promise<{ suggestedPrompts: string[], colors: string[] }>
        applyLogo: (projectPath: string, tempLogoPath: string) => Promise<string>
        getCompletion: (text: string) => Promise<string>
        analyzeDirectory: (dirPath: string) => Promise<{ hasPackageJson: boolean; pkg: Record<string, IpcValue>; readme: string | null; stats: ProjectStats }>
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

    files: {
        listDirectory: (path: string) => Promise<FileEntry[]>
        readFile: (path: string) => Promise<string>
        readImage: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>
        writeFile: (path: string, content: string) => Promise<void>
        exists: (path: string) => Promise<boolean>
    }

    // Proxy
    getProxyModels: () => Promise<{ id: string; object: string }[]>
    getQuota: (provider?: string) => Promise<QuotaResponse | null>
    getCopilotQuota: () => Promise<CopilotQuota>
    getCodexUsage: () => Promise<Partial<QuotaResponse>>
    importChatHistory: (provider: string) => Promise<{ success: boolean; importedChats?: number; importedMessages?: number; message?: string }>
    importChatHistoryJson: (jsonContent: string) => Promise<{ success: boolean; importedChats?: number; importedMessages?: number; message?: string }>
    runCommand: (command: string, args: string[], cwd?: string) => Promise<{ stdout: string; stderr: string; code: number }>

    // LLM chat
    getModels: () => Promise<ModelDefinition[] | { antigravityError?: string }>
    chat: (messages: Message[], model: string) => Promise<{ content: string }>
    chatOpenAI: (messages: Message[], model: string, tools?: ToolDefinition[], provider?: string, options?: Record<string, IpcValue>, projectId?: string) => Promise<IpcValue>
    chatStream: (messages: Message[], model: string, tools?: ToolDefinition[], provider?: string, options?: Record<string, IpcValue>, chatId?: string, projectId?: string) => Promise<void>
    abortChat: () => void
    onStreamChunk: (callback: (chunk: { content?: string; toolCalls?: ToolCall[]; reasoning?: string }) => void) => void
    removeStreamChunkListener: (callback?: (chunk: { content?: string; toolCalls?: ToolCall[]; reasoning?: string }) => void) => void

    // Ollama management
    isOllamaRunning: () => Promise<boolean>
    startOllama: () => Promise<{ success: boolean; message: string }>
    pullModel: (modelName: string) => Promise<{ success: boolean; error?: string }>
    deleteOllamaModel: (modelName: string) => Promise<{ success: boolean; error?: string }>
    getLibraryModels: () => Promise<{ name: string; description: string; tags: string[] }[]>
    onPullProgress: (callback: (progress: { status: string; digest?: string; total?: number; completed?: number }) => void) => void
    removePullProgressListener: () => void

    // Health and GPU checks
    getOllamaHealthStatus: () => Promise<{ status: 'ok' | 'error' }>
    forceOllamaHealthCheck: () => Promise<{ status: 'ok' | 'error' }>
    checkCuda: () => Promise<{ hasCuda: boolean; detail?: string }>
    onOllamaStatusChange: (callback: (status: { status: string }) => void) => void

    // llama.cpp
    llama: {
        loadModel: (modelPath: string, config?: Record<string, IpcValue>) => Promise<{ success: boolean; error?: string }>
        unloadModel: () => Promise<{ success: boolean }>
        chat: (message: string, systemPrompt?: string) => Promise<{ success: boolean; response?: string; error?: string }>
        resetSession: () => Promise<{ success: boolean }>
        getModels: () => Promise<{ name: string; path: string; size: number }[]>
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
        duplicateChat: (id: string) => Promise<Chat | null>
        archiveChat: (id: string, isArchived: boolean) => Promise<{ success: boolean }>
        getChat: (id: string) => Promise<Chat | null>
        getAllChats: () => Promise<Chat[]>
        searchChats: (query: string) => Promise<Chat[]>
        addMessage: (message: Message) => Promise<{ success: boolean }>
        deleteMessage: (id: string) => Promise<{ success: boolean }>
        updateMessage: (id: string, updates: Partial<Message>) => Promise<{ success: boolean }>
        deleteAllChats: () => Promise<{ success: boolean }>
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
        getProjects: () => Promise<Project[]>
        getFolders: () => Promise<Folder[]>
        createProject: (name: string, path: string, description: string, mounts?: string) => Promise<void>
        updateProject: (id: string, updates: Partial<Project>) => Promise<void>
        deleteProject: (id: string) => Promise<void>
        archiveProject: (id: string, isArchived: boolean) => Promise<void>
        createFolder: (name: string, color?: string) => Promise<Folder>
        deleteFolder: (id: string) => Promise<void>
        updateFolder: (id: string, updates: Partial<Folder>) => Promise<void>

        // Prompts
        createPrompt: (title: string, content: string, tags?: string[]) => Promise<{ id: string }>
        deletePrompt: (id: string) => Promise<void>
        updatePrompt: (id: string, updates: Record<string, IpcValue>) => Promise<void>
        getPrompts: () => Promise<IpcValue[]>
    }

    terminal: {
        isAvailable: () => Promise<boolean>
        getShells: () => Promise<{ id: string; name: string; path: string }[]>
        create: (options: { id: string; shell?: string; cwd?: string; cols?: number; rows?: number }) => Promise<{ success: boolean; error?: string }>
        write: (sessionId: string, data: string) => Promise<boolean>
        resize: (sessionId: string, cols: number, rows: number) => Promise<boolean>
        kill: (sessionId: string) => Promise<boolean>
        getSessions: () => Promise<string[]>
        onData: (callback: (data: { id: string; data: string }) => void) => () => void
        onExit: (callback: (data: { id: string; code: number }) => void) => () => void
        readBuffer: (sessionId: string) => Promise<string>
        removeAllListeners: () => void
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

    agent: {
        getAll: () => Promise<AgentDefinition[]>
        get: (id: string) => Promise<AgentDefinition | null>
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
        list: () => Promise<{ name: string; status: string }[]>
        dispatch: (service: string, action: string, args?: Record<string, IpcValue>) => Promise<IpcValue>
        toggle: (service: string, enabled: boolean) => Promise<{ success: boolean; isEnabled: boolean }>
        install: (config: Record<string, IpcValue>) => Promise<{ success: boolean; error?: string }>
        uninstall: (name: string) => Promise<{ success: boolean }>
        onResult: (callback: (result: IpcValue) => void) => void
        removeResultListener: () => void
    }

    proxyEmbed: {
        start: (options?: { configPath?: string; port?: number; health?: boolean }) => Promise<IpcValue>
        stop: () => Promise<IpcValue>
        status: () => Promise<IpcValue>
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
    exportChatToPdf: (chatId: string, title: string) => Promise<{ success: boolean; path?: string; error?: string }>

    // Settings
    getSettings: () => Promise<AppSettings>
    saveSettings: (settings: AppSettings) => Promise<void>

    huggingface: {
        searchModels: (query: string, limit: number, page: number, sort: string) => Promise<{ models: { id: string; name: string; author: string; description: string; downloads: number; likes: number; tags: string[]; lastModified: string }[], total: number }>
        getFiles: (modelId: string) => Promise<{ path: string; size: number; oid: string; quantization: string }[]>
        downloadFile: (url: string, outputPath: string, expectedSize: number, expectedSha256: string) => Promise<{ success: boolean; error?: string }>
        onDownloadProgress: (callback: (progress: { filename: string; received: number; total: number }) => void) => void
        cancelDownload: () => void
    }

    log: {
        write: (level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: IpcValue) => void
        debug: (message: string, data?: IpcValue) => void
        info: (message: string, data?: IpcValue) => void
        warn: (message: string, data?: IpcValue) => void
        error: (message: string, data?: IpcValue) => void
    }

    gallery: {
        list: () => Promise<{ name: string; path: string; url: string; mtime: number }[]>
        delete: (path: string) => Promise<boolean>
        open: (path: string) => Promise<boolean>
        reveal: (path: string) => Promise<boolean>
    }

    getUserDataPath: () => Promise<string>

    update: {
        checkForUpdates: () => Promise<void>
        downloadUpdate: () => Promise<void>
        installUpdate: () => Promise<void>
    }

    // Explicit ipcRenderer exposure for flexible components
    ipcRenderer: {
        on: (channel: string, listener: (event: IpcRendererEvent, ...args: IpcValue[]) => void) => () => void
        off: (channel: string, listener: (event: IpcRendererEvent, ...args: IpcValue[]) => void) => void
        send: (channel: string, ...args: IpcValue[]) => void
        invoke: (channel: string, ...args: IpcValue[]) => Promise<IpcValue>
        removeAllListeners: (channel: string) => void
    }
    // Backward compatibility for components using window.electron.on
    on: (channel: string, listener: (event: IpcRendererEvent, ...args: IpcValue[]) => void) => () => void
}

declare global {
    interface Window {
        electron: ElectronAPI
        orbitSpeak: (text: string) => void
    }
}
