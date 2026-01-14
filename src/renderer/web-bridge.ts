import type { ElectronAPI } from '@renderer/electron.d'
import type { Message, ToolDefinition, Chat, ToolResult, ToolCall, Folder } from '@shared/types/chat'
import type { AppSettings } from '@shared/types/settings'
import type { IpcValue, AuthStatus } from '@shared/types/common'
import type { IpcRendererEvent } from 'electron'
import type { SSHConnection, SSHSystemStats, SSHConfig } from '@/types/ssh'
import type { Project, ProjectAnalysis } from '@shared/types/project'
import type { QuotaResponse, CopilotQuota } from '@shared/types/quota'
import type { CouncilSession } from '@shared/types/agent'

// Mock Electron API for Web/Standalone development
export const webElectronMock: ElectronAPI = {
    minimize: () => console.log('minimize'),
    maximize: () => console.log('maximize'),
    close: () => console.log('close'),
    resizeWindow: (res: string) => console.log('resize', res),
    toggleCompact: (enabled: boolean) => console.log('compact', enabled),

    githubLogin: async (_appId?: 'profile' | 'copilot') => ({ device_code: '123', user_code: 'ABC', verification_uri: 'http://locahost', expires_in: 900, interval: 5 }),
    pollToken: async (_deviceCode: string, _interval: number, _appId?: 'profile' | 'copilot') => ({ success: true, token: 'mock-token' }),
    antigravityLogin: async () => ({ url: 'http://localhost', state: 'mock-state' }),

    claudeLogin: async () => ({ url: 'http://localhost', state: 'mock-state' }),
    anthropicLogin: async () => ({ url: 'http://localhost', state: 'mock-state' }),
    codexLogin: async () => ({ url: 'http://localhost', state: 'mock-state' }),

    checkAuthStatus: async () => ({
        authenticated: false,
        files: [],
        github: false,
        copilot: false,
        antigravity: false,

        claude: false,
        anthropic: false,
        codex: false
    } as AuthStatus),
    deleteProxyAuthFile: async (_name: string) => ({ success: true }),

    code: {
        scanTodos: async (_rootPath: string) => [],
        findSymbols: async (_rootPath: string, _query: string) => [],
        searchFiles: async (_rootPath: string, _query: string, _isRegex?: boolean) => [],
        indexProject: async (_rootPath: string, _projectId: string) => { },
        queryIndexedSymbols: async (_query: string) => []
    },

    project: {
        analyze: async (_rootPath: string, _projectId: string) => ({
            name: 'Mock Project',
            path: _rootPath,
            type: 'unknown',
            files: [],
            dependencies: {},
            scripts: {},
            frameworks: [],
            devDependencies: {},
            languages: {},
            stats: { fileCount: 0, totalSize: 0, loc: 0, lastModified: Date.now() },
            todos: []
        } as ProjectAnalysis),
        generateLogo: async (_projectPath: string, _prompt: string, _style: string) => '',
        analyzeIdentity: async (_projectPath: string) => ({ suggestedPrompts: [], colors: [] }),
        applyLogo: async (_projectPath: string, _tempLogoPath: string) => '',
        getCompletion: async (_text: string) => '',
        improveLogoPrompt: async (_prompt: string) => '',
        uploadLogo: async (_projectPath: string) => null,
        analyzeDirectory: async (_dirPath: string) => ({
            hasPackageJson: false,
            pkg: {},
            readme: null,
            stats: { fileCount: 0, totalSize: 0, loc: 0, lastModified: Date.now() }
        }),
        watch: async (_rootPath: string) => true,
        unwatch: async (_rootPath: string) => true,
        onFileChange: (_callback: (event: string, path: string, rootPath: string) => void) => () => { }
    },

    process: {
        spawn: async (_command: string, _args: string[], _cwd: string) => 'mock-id',
        kill: async (_id: string) => true,
        list: async () => [],
        scanScripts: async (_rootPath: string) => ({}),
        resize: async (_id: string, _cols: number, _rows: number) => { },
        write: async (_id: string, _data: string) => { },
        onData: (_callback: (data: { id: string; data: string }) => void) => () => { },
        onExit: (_callback: (data: { id: string; code: number }) => void) => () => { },
        removeListeners: () => { }
    },

    files: {
        listDirectory: async (_path: string) => [],
        readFile: async (_path: string) => '',
        readImage: async (_path: string) => ({ success: true }),
        writeFile: async (_path: string, _content: string) => { },
        exists: async (_path: string) => true
    },

    getProxyModels: async () => [],
    getQuota: async (_provider?: string) => ({
        status: 'ok',
        next_reset: new Date().toISOString(),
        models: [],
        limit: 100,
        remaining: 100,
        reset: new Date().toISOString()
    } as QuotaResponse),
    getClaudeQuota: async () => ({
        success: true,
        fiveHour: { utilization: 0, resetsAt: new Date().toISOString() },
        sevenDay: { utilization: 0, resetsAt: new Date().toISOString() }
    }),
    getCopilotQuota: async () => ({
        remaining: 100,
        limit: 100,
        chat_enabled: true,
        code_search_enabled: true,
        copilot_plan: 'business'
    } as CopilotQuota),
    getCodexUsage: async () => ({}),
    checkUsageLimit: async (_provider: string, _model: string) => ({ allowed: true }),
    getUsageCount: async (_period: 'hourly' | 'daily' | 'weekly', _provider?: string, _model?: string) => 0,
    importChatHistory: async (_provider: string) => ({ success: true }),
    importChatHistoryJson: async (_jsonContent: string) => ({ success: true }),

    getModels: async () => [],
    chat: async (_messages: Message[], _model: string) => ({ content: 'Mock response' }),
    chatOpenAI: async (_messages: Message[], _model: string, _tools?: ToolDefinition[], _provider?: string, _options?: Record<string, IpcValue>, _projectId?: string) => ({}),
    chatStream: async (_messages: Message[], _model: string, _tools?: ToolDefinition[], _provider?: string, _options?: Record<string, IpcValue>, _chatId?: string, _projectId?: string) => { },
    abortChat: () => { },
    onStreamChunk: (_callback: (chunk: { content?: string; toolCalls?: ToolCall[]; reasoning?: string }) => void) => () => { },
    removeStreamChunkListener: (_callback?: (chunk: { content?: string; toolCalls?: ToolCall[]; reasoning?: string }) => void) => { },

    isOllamaRunning: async () => true,
    startOllama: async () => ({ success: true, message: 'Ollama is starting' }),
    pullModel: async (_modelName: string) => ({ success: true }),
    deleteOllamaModel: async (_modelName: string) => ({ success: true }),
    getLibraryModels: async () => [],
    onPullProgress: (_callback: (progress: { status: string; digest?: string; total?: number; completed?: number }) => void) => { },
    removePullProgressListener: () => { },

    getOllamaHealthStatus: async () => ({ status: 'ok' as const }),
    forceOllamaHealthCheck: async () => ({ status: 'ok' as const }),
    checkCuda: async () => ({ hasCuda: true }),
    onOllamaStatusChange: (_callback: (status: { status: string }) => void) => { },

    llama: {
        loadModel: async (_modelPath: string, _config?: Record<string, IpcValue>) => ({ success: true }),
        unloadModel: async () => ({ success: true }),
        chat: async (_message: string, _systemPrompt?: string) => ({ success: true, response: 'Mock response' }),
        resetSession: async () => ({ success: true }),
        getModels: async () => [],
        downloadModel: async (_url: string, _filename: string) => ({ success: true }),
        deleteModel: async (_modelPath: string) => ({ success: true }),
        getConfig: async () => ({}),
        setConfig: async (_config: Record<string, IpcValue>) => ({ success: true }),
        getGpuInfo: async () => ({ available: true }),
        getModelsDir: async () => '/mock/dir',
        onToken: (_callback: (token: string) => void) => { },
        removeTokenListener: () => { },
        onDownloadProgress: (_callback: (progress: { downloaded: number; total: number }) => void) => { },
        removeDownloadProgressListener: () => { }
    },

    db: {
        createChat: async (_chat: Chat) => ({ success: true }),
        updateChat: async (_id: string, _updates: Partial<Chat>) => ({ success: true }),
        deleteChat: async (_id: string) => ({ success: true }),
        duplicateChat: async (_id: string) => null,
        archiveChat: async (_id: string, _isArchived: boolean) => ({ success: true }),
        getChat: async (_id: string) => null,
        getAllChats: async () => [],
        searchChats: async (_query: string) => [],
        addMessage: async (_message: Message) => ({ success: true }),
        deleteMessage: async (_id: string) => ({ success: true }),
        updateMessage: async (_id: string, _updates: Partial<Message>) => ({ success: true }),
        deleteAllChats: async () => ({ success: true }),
        deleteMessages: async (_chatId: string) => ({ success: true }),
        getMessages: async (_chatId: string) => [],
        getStats: async () => ({ chatCount: 0, messageCount: 0, dbSize: 0 }),
        getDetailedStats: async (_period: string) => ({
            chatCount: 0,
            messageCount: 0,
            dbSize: 0,
            totalTokens: 0,
            promptTokens: 0,
            completionTokens: 0,
            tokenTimeline: [],
            activity: []
        }),
        getTimeStats: async () => ({
            totalOnlineTime: 0,
            totalCodingTime: 0,
            projectCodingTime: {}
        }),
        getProjects: async () => [],
        getFolders: async () => [],
        createProject: async (_name: string, _path: string, _description: string, _mounts?: string) => { },
        updateProject: async (_id: string, _updates: Partial<Project>) => { },
        deleteProject: async (_id: string) => { },
        archiveProject: async (_id: string, _isArchived: boolean) => { },
        createFolder: async (_name: string, _color?: string) => ({ id: '1', name: _name, color: _color || 'blue', createdAt: new Date(), updatedAt: new Date() } as Folder),
        deleteFolder: async (_id: string) => { },
        updateFolder: async (_id: string, _updates: Partial<Folder>) => { },

        createPrompt: async (_title: string, _content: string, _tags?: string[]) => ({ id: '1' }),
        deletePrompt: async (_id: string) => { },
        updatePrompt: async (_id: string, _updates: Record<string, IpcValue>) => { },
        getPrompts: async () => []
    },

    agent: {
        getAll: async () => [],
        get: async (_id: string) => null
    },

    terminal: {
        isAvailable: async () => true,
        getShells: async () => [],
        create: async (_options: { id: string; shell?: string; cwd?: string; cols?: number; rows?: number }) => ({ success: true }),
        write: async (_sessionId: string, _data: string) => true,
        resize: async (_sessionId: string, _cols: number, _rows: number) => true,
        kill: async (_sessionId: string) => true,
        onData: (_callback: (data: { id: string; data: string }) => void) => () => { },
        onExit: (_callback: (data: { id: string; code: number }) => void) => () => { },
        removeAllListeners: () => { },
        getSessions: async () => [],
        readBuffer: async (_sessionId: string) => ''
    },

    council: {
        createSession: async (_goal: string) => ({
            id: '1',
            goal: _goal,
            status: 'created',
            agents: [],
            logs: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        } as CouncilSession),
        getSessions: async () => [],
        getSession: async (_id: string) => null,
        addLog: async (_sessionId: string, _agentId: string, _message: string, _type: 'info' | 'error' | 'success' | 'plan' | 'action') => { },
        runStep: (_sessionId: string) => { },
        startLoop: (_sessionId: string) => { },
        stopLoop: (_sessionId: string) => { }
    },

    ssh: {
        connect: async (_connection: SSHConnection) => ({ success: true, id: '1' }),
        disconnect: async (_connectionId: string) => ({ success: true }),
        execute: async (_connectionId: string, _command: string, _options?: Record<string, IpcValue>) => ({ stdout: '', stderr: '', code: 0 }),
        upload: async (_connectionId: string, _localPath: string, _remotePath: string) => ({ success: true }),
        download: async (_connectionId: string, _remotePath: string, _localPath: string) => ({ success: true }),
        listDir: async (_connectionId: string, _remotePath: string) => ({ success: true, files: [] }),
        readFile: async (_connectionId: string, _remotePath: string) => ({ success: true, content: '' }),
        writeFile: async (_connectionId: string, _remotePath: string, _content: string) => ({ success: true }),
        deleteDir: async (_connectionId: string, _path: string) => ({ success: true }),
        deleteFile: async (_connectionId: string, _path: string) => ({ success: true }),
        mkdir: async (_connectionId: string, _path: string) => ({ success: true }),
        rename: async (_connectionId: string, _oldPath: string, _newPath: string) => ({ success: true }),
        getConnections: async () => [],
        isConnected: async (_connectionId: string) => true,
        onStdout: (_callback: (data: string | Uint8Array) => void) => { },
        onStderr: (_callback: (data: string | Uint8Array) => void) => { },
        onConnected: (_callback: (connectionId: string) => void) => { },
        onDisconnected: (_callback: (connectionId: string) => void) => { },
        onUploadProgress: (_callback: (progress: { transferred: number; total: number }) => void) => { },
        onDownloadProgress: (_callback: (progress: { transferred: number; total: number }) => void) => { },
        removeAllListeners: () => { },
        onShellData: (_callback: (data: { data: string }) => void) => { },
        shellStart: async (_connectionId: string) => ({ success: true }),
        shellWrite: async (_connectionId: string, _data: string) => ({ success: true }),
        getSystemStats: async (_connectionId: string) => ({
            uptime: '',
            memory: { total: 0, used: 0, percent: 0 },
            cpu: 0,
            disk: '0%'
        } as SSHSystemStats),
        getInstalledPackages: async (_connectionId: string, _manager?: 'apt' | 'npm' | 'pip') => [],
        getLogFiles: async (_connectionId: string) => [],
        readLogFile: async (_connectionId: string, _path: string, _lines?: number) => '',
        getProfiles: async () => [],
        saveProfile: async (_profile: SSHConfig) => true,
        deleteProfile: async (_id: string) => true
    },

    git: {
        getBranch: async (_cwd: string) => ({ success: true, branch: 'main' }),
        getStatus: async (_cwd: string) => ({ success: true, isClean: true, changes: 0, files: [] }),
        getLastCommit: async (_cwd: string) => ({ success: true, hash: 'abc123', message: 'Initial commit', author: 'User', relativeTime: '2 hours ago', date: new Date().toISOString() }),
        getRecentCommits: async (_cwd: string, _count?: number) => ({ success: true, commits: [] }),
        getBranches: async (_cwd: string) => ({ success: true, branches: ['main'] }),
        isRepository: async (_cwd: string) => ({ success: true, isRepository: true }),
        getFileDiff: async (_cwd: string, _filePath: string, _staged?: boolean) => ({ success: true, original: '', modified: '' }),
        getUnifiedDiff: async (_cwd: string, _filePath: string, _staged?: boolean) => ({ success: true, diff: '' }),
        stageFile: async (_cwd: string, _filePath: string) => ({ success: true }),
        unstageFile: async (_cwd: string, _filePath: string) => ({ success: true }),
        getDetailedStatus: async (_cwd: string) => ({ success: true, stagedFiles: [], unstagedFiles: [], allFiles: [] }),
        checkout: async (_cwd: string, _branch: string) => ({ success: true }),
        commit: async (_cwd: string, _message: string) => ({ success: true }),
        push: async (_cwd: string, _remote?: string, _branch?: string) => ({ success: true, stdout: '', stderr: '' }),
        pull: async (_cwd: string) => ({ success: true, stdout: '', stderr: '' }),
        getRemotes: async (_cwd: string) => ({ success: true, remotes: [] }),
        getTrackingInfo: async (_cwd: string) => ({ success: true, tracking: null, ahead: 0, behind: 0 }),
        getCommitStats: async (_cwd: string, _days?: number) => ({ success: true, commitCounts: {} }),
        getDiffStats: async (_cwd: string) => ({
            success: true,
            staged: { added: 0, deleted: 0, files: 0 },
            unstaged: { added: 0, deleted: 0, files: 0 },
            total: { added: 0, deleted: 0, files: 0 }
        })
    },

    executeTools: async (_toolName: string, _args: Record<string, IpcValue>, _toolCallId?: string) => ({
        toolCallId: _toolCallId || 'mock',
        name: _toolName,
        success: true,
        result: null
    } as ToolResult),
    killTool: async (_toolCallId: string) => true,
    getToolDefinitions: async () => [],

    mcp: {
        list: async () => [],
        dispatch: async (_service: string, _action: string, _args?: Record<string, IpcValue>) => ({}),
        toggle: async (_service: string, _enabled: boolean) => ({ success: true, isEnabled: true }),
        install: async (_config: Record<string, IpcValue>) => ({ success: true }),
        uninstall: async (_name: string) => ({ success: true }),
        onResult: (_callback: (result: IpcValue) => void) => { },
        removeResultListener: () => { }
    },

    proxyEmbed: {
        start: async (_options?: Record<string, IpcValue>) => ({}),
        stop: async () => ({}),
        status: async () => ({})
    },

    captureScreenshot: async () => ({ success: true }),
    openExternal: (_url: string) => { },
    openTerminal: async (_command: string) => true,
    runCommand: async (_command: string, _args: string[], _cwd?: string) => ({ stdout: '', stderr: '', code: 0 }),

    readPdf: async (_path: string) => ({ success: true, text: '' }),
    selectDirectory: async () => ({ success: true, path: '' }),
    listDirectory: async (_path: string) => ({ success: true, files: [] }),
    readFile: async (_path: string) => ({ success: true, content: '' }),
    writeFile: async (_path: string, _content: string) => ({ success: true }),
    createDirectory: async (_path: string) => ({ success: true }),
    deleteFile: async (_path: string) => ({ success: true }),
    deleteDirectory: async (_path: string) => ({ success: true }),
    renamePath: async (_oldPath: string, _newPath: string) => ({ success: true }),
    searchFiles: async (_rootPath: string, _pattern: string) => ({ success: true, matches: [] }),
    saveFile: async (_content: string, _filename: string) => ({ success: true, path: '' }),
    exportChatToPdf: async (_chatId: string, _title: string) => ({ success: true, path: '' }),

    getSettings: async () => ({} as AppSettings),
    saveSettings: async (_settings: AppSettings) => { },

    huggingface: {
        searchModels: async (_query: string, _limit: number, _page: number, _sort: string) => ({ models: [], total: 0 }),
        getFiles: async (_modelId: string) => [],
        downloadFile: async (_url: string, _outputPath: string, _expectedSize: number, _expectedSha256: string) => ({ success: true }),
        onDownloadProgress: (_callback: (progress: { filename: string; received: number; total: number }) => void) => { },
        cancelDownload: () => { }
    },

    log: {
        write: (_level: 'debug' | 'info' | 'warn' | 'error', _message: string, _data?: IpcValue) => { },
        debug: (_message: string, _data?: IpcValue) => { },
        info: (_message: string, _data?: IpcValue) => { },
        warn: (_message: string, _data?: IpcValue) => { },
        error: (_message: string, _data?: IpcValue) => { }
    },

    gallery: {
        list: async () => [],
        delete: async (_path: string) => true,
        open: async (_path: string) => true,
        reveal: async (_path: string) => true
    },

    getUserDataPath: async () => '',
    update: {
        checkForUpdates: async () => { },
        downloadUpdate: async () => { },
        installUpdate: async () => { }
    },

    collaboration: {
        run: async (_request: { messages: Message[]; models: Array<{ provider: string; model: string }>; strategy?: string }) => ({
            response: 'Mock collaboration response',
            modelContributions: []
        }),
        getProviderStats: async () => [],
        getActiveTaskCount: async () => 0,
        setProviderConfig: async (_provider: string, _config: { concurrencyLimit?: number; rateLimit?: number }) => { }
    },

    audit: {
        getLogs: async (_startDate?: string, _endDate?: string, _category?: string) => []
    },

    ipcRenderer: {
        on: (_channel: string, _listener: (event: IpcRendererEvent, ..._args: IpcValue[]) => void) => () => { },
        off: (_channel: string, _listener: (event: IpcRendererEvent, ..._args: IpcValue[]) => void) => { },
        send: (_channel: string, ..._args: IpcValue[]) => { },
        invoke: async (_channel: string, ..._args: IpcValue[]) => ({}),
        removeAllListeners: (_channel: string) => { }
    },
    on: (_channel: string, _listener: (event: IpcRendererEvent, ..._args: IpcValue[]) => void) => () => { }
}

if (typeof window !== 'undefined' && !(window as any).electron) {
    (window as any).electron = webElectronMock
}

export default webElectronMock
