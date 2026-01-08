import { contextBridge, ipcRenderer } from 'electron'

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
    geminiLogin: () => Promise<{ url: string; state: string }>
    claudeLogin: () => Promise<{ url: string; state: string }>
    anthropicLogin: () => Promise<{ url: string; state: string }>
    codexLogin: () => Promise<{ url: string; state: string }>

    checkAuthStatus: () => Promise<any>
    deleteProxyAuthFile: (name: string) => Promise<any>

    code: {
        scanTodos: (rootPath: string) => Promise<any[]>
        findSymbols: (rootPath: string, query: string) => Promise<any[]>
        searchFiles: (rootPath: string, query: string, isRegex?: boolean) => Promise<any[]>
        indexProject: (rootPath: string, projectId: string) => Promise<void>
        queryIndexedSymbols: (query: string) => Promise<any[]>
    }

    // Proxy
    getProxyModels: () => Promise<any[]>
    getQuota: () => Promise<any>
    getCopilotQuota: () => Promise<any>
    getCodexUsage: () => Promise<any>
    importChatHistory: (provider: string) => Promise<{ success: boolean; importedChats?: number; importedMessages?: number; message?: string }>
    importChatHistoryJson: (jsonContent: string) => Promise<{ success: boolean; importedChats?: number; importedMessages?: number; message?: string }>
    runCommand: (command: string, args: string[], cwd?: string) => Promise<{ stdout: string; stderr: string; code: number }>


    // Ollama chat
    getModels: () => Promise<any[]>
    chat: (messages: any[], model: string) => Promise<any>
    chatOpenAI: (messages: any[], model: string, tools?: any[], provider?: string) => Promise<any>
    chatStream: (messages: any[], model: string, tools?: any[], provider?: string, options?: any) => Promise<any>
    abortChat: () => void
    onStreamChunk: (callback: (chunk: any) => void) => void
    removeStreamChunkListener: (callback?: (chunk: any) => void) => void

    // Ollama management
    isOllamaRunning: () => Promise<boolean>
    startOllama: () => Promise<{ success: boolean; message: string }>
    pullModel: (modelName: string) => Promise<{ success: boolean; error?: string }>
    deleteOllamaModel: (modelName: string) => Promise<{ success: boolean; error?: string }>
    getLibraryModels: () => Promise<any[]>
    onPullProgress: (callback: (progress: any) => void) => void
    removePullProgressListener: () => void

    // New health and GPU checks
    getOllamaHealthStatus: () => Promise<any>
    forceOllamaHealthCheck: () => Promise<any>
    checkCuda: () => Promise<{ hasCuda: boolean; detail?: string }>
    onOllamaStatusChange: (callback: (status: any) => void) => void

    // llama.cpp
    llama: {
        loadModel: (modelPath: string, config?: any) => Promise<{ success: boolean; error?: string }>
        unloadModel: () => Promise<{ success: boolean }>
        chat: (message: string, systemPrompt?: string) => Promise<{ success: boolean; response?: string; error?: string }>
        resetSession: () => Promise<{ success: boolean }>
        getModels: () => Promise<any[]>
        downloadModel: (url: string, filename: string) => Promise<{ success: boolean; path?: string; error?: string }>
        deleteModel: (modelPath: string) => Promise<{ success: boolean; error?: string }>
        getConfig: () => Promise<any>
        setConfig: (config: any) => Promise<{ success: boolean }>
        getGpuInfo: () => Promise<{ available: boolean; name?: string; vram?: number }>
        getModelsDir: () => Promise<string>
        onToken: (callback: (token: string) => void) => void
        removeTokenListener: () => void
        onDownloadProgress: (callback: (progress: { downloaded: number; total: number }) => void) => void
        removeDownloadProgressListener: () => void
    }

    // Database
    db: {
        createChat: (chat: any) => Promise<{ success: boolean }>
        updateChat: (id: string, updates: any) => Promise<{ success: boolean }>
        deleteChat: (id: string) => Promise<{ success: boolean }>
        duplicateChat: (id: string) => Promise<any>
        archiveChat: (id: string, isArchived: boolean) => Promise<{ success: boolean }>
        getChat: (id: string) => Promise<any>
        getAllChats: () => Promise<any[]>
        getPrompts: () => Promise<any[]>
        createPrompt: (title: string, content: string, tags?: string[]) => Promise<{ success: boolean }>
        updatePrompt: (id: string, updates: any) => Promise<{ success: boolean }>
        deletePrompt: (id: string) => Promise<{ success: boolean }>
        searchChats: (query: string) => Promise<any[]>
        addMessage: (message: any) => Promise<{ success: boolean }>
        deleteMessage: (id: string) => Promise<{ success: boolean }>
        updateMessage: (id: string, updates: any) => Promise<{ success: boolean }>
        deleteAllChats: () => Promise<{ success: boolean }>
        deleteChatsByTitle: (title: string) => Promise<number>
        deleteMessages: (chatId: string) => Promise<{ success: boolean }>
        getMessages: (chatId: string) => Promise<any[]>
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
        getProjects: () => Promise<any[]>
        createProject: (name: string, path: string, description: string, mounts?: string) => Promise<void>
        updateProject: (id: string, updates: any) => Promise<void>
        deleteProject: (id: string) => Promise<void>
        archiveProject: (id: string, isArchived: boolean) => Promise<void>
        createFolder: (name: string, color?: string) => Promise<any>
        deleteFolder: (id: string) => Promise<void>
        updateFolder: (id: string, updates: any) => Promise<void>
        getFolders: () => Promise<any[]>
    }

    council: {
        runSession: (projectId: string, taskId: string) => Promise<void>
        onUpdate: (callback: (data: any) => void) => void
        removeUpdateListener: () => void
        approvePlan: (sessionId: string, approved: boolean, editedPlan?: string) => Promise<boolean>
        generateAgents: (taskDescription: string) => Promise<any[]>
        getSessions: (projectId?: string) => Promise<any[]>
        getSessionById: (id: string) => Promise<any>
    }

    agent: {
        getAll: () => Promise<any[]>
        get: (id: string) => Promise<any>
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
        removeAllListeners: () => void
    }

    // SSH
    ssh: {

        connect: (connection: any) => Promise<{ success: boolean; error?: string; id?: string }>
        disconnect: (connectionId: string) => Promise<{ success: boolean }>
        execute: (connectionId: string, command: string, options?: any) => Promise<any>
        upload: (connectionId: string, localPath: string, remotePath: string) => Promise<{ success: boolean; error?: string }>
        download: (connectionId: string, remotePath: string, localPath: string) => Promise<{ success: boolean; error?: string }>
        listDir: (connectionId: string, remotePath: string) => Promise<{ success: boolean; files?: any[]; error?: string }>
        readFile: (connectionId: string, remotePath: string) => Promise<{ success: boolean; content?: string; error?: string }>
        writeFile: (connectionId: string, remotePath: string, content: string) => Promise<{ success: boolean; error?: string }>
        deleteDir: (connectionId: string, path: string) => Promise<{ success: boolean; error?: string }>
        deleteFile: (connectionId: string, path: string) => Promise<{ success: boolean; error?: string }>
        mkdir: (connectionId: string, path: string) => Promise<{ success: boolean; error?: string }>
        rename: (connectionId: string, oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>
        getConnections: () => Promise<any[]>
        isConnected: (connectionId: string) => Promise<boolean>
        onStdout: (callback: (data: any) => void) => void
        onStderr: (callback: (data: any) => void) => void
        onConnected: (callback: (connectionId: string) => void) => void
        onDisconnected: (callback: (connectionId: string) => void) => void
        onUploadProgress: (callback: (progress: { transferred: number; total: number }) => void) => void
        onDownloadProgress: (callback: (progress: { transferred: number; total: number }) => void) => void
        removeAllListeners: () => void
        onShellData: (callback: (data: any) => void) => void
        shellStart: (connectionId: string) => Promise<{ success: boolean; error?: string }>
        shellWrite: (connectionId: string, data: string) => Promise<{ success: boolean; error?: string }>
        getSystemStats: (connectionId: string) => Promise<any>
        getInstalledPackages: (connectionId: string, manager?: 'apt' | 'npm' | 'pip') => Promise<any[]>
        getLogFiles: (connectionId: string) => Promise<string[]>
        readLogFile: (connectionId: string, path: string, lines?: number) => Promise<string>
        getProfiles: () => Promise<any[]>
        saveProfile: (profile: any) => Promise<boolean>
        deleteProfile: (id: string) => Promise<boolean>
    }

    // Tools
    executeTools: (toolName: string, args: any, toolCallId?: string) => Promise<any>
    killTool: (toolCallId: string) => Promise<any>
    getToolDefinitions: () => Promise<any[]>

    // MCP
    mcp: {
        list: () => Promise<any[]>
        dispatch: (service: string, action: string, args?: any) => Promise<any>
        toggle: (service: string, enabled: boolean) => Promise<{ success: boolean; isEnabled: boolean }>
        install: (config: any) => Promise<{ success: boolean; error?: string }>
        uninstall: (name: string) => Promise<{ success: boolean }>
        onResult: (callback: (result: any) => void) => void
        removeResultListener: () => void
    }

    proxyEmbed: {
        start: (options?: { configPath?: string; port?: number; health?: boolean }) => Promise<any>
        stop: () => Promise<any>
        status: () => Promise<any>
    }

    // Screenshot
    captureScreenshot: () => Promise<{ success: boolean; image?: string; error?: string }>

    // Shell / External
    openExternal: (url: string) => void
    openTerminal: (command: string) => Promise<boolean>

    // Files
    readPdf: (path: string) => Promise<{ success: boolean; text?: string; error?: string }>
    selectDirectory: () => Promise<{ success: boolean; path?: string }>
    listDirectory: (path: string) => Promise<{ success: boolean; files?: any[]; error?: string }>
    readFile: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>
    writeFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>
    createDirectory: (path: string) => Promise<{ success: boolean; error?: string }>
    deleteFile: (path: string) => Promise<{ success: boolean; error?: string }>
    deleteDirectory: (path: string) => Promise<{ success: boolean; error?: string }>
    renamePath: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>
    searchFiles: (rootPath: string, pattern: string) => Promise<{ success: boolean; matches?: string[]; error?: string }>
    saveFile: (content: string, filename: string) => Promise<{ success: boolean; path?: string; error?: string }>

    files: {
        listDirectory: (path: string) => Promise<any[]>
        readFile: (path: string) => Promise<string>
        readImage: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>
        writeFile: (path: string, content: string) => Promise<void>
        exists: (path: string) => Promise<boolean>
    }

    project: {
        analyze: (rootPath: string) => Promise<any>
        saveState: (rootPath: string, state: any) => Promise<boolean>
        loadState: (rootPath: string) => Promise<any>
        analyzeIdentity: (rootPath: string) => Promise<{ suggestedPrompts: string[]; colors: string[] }>
        generateLogo: (projectPath: string, prompt: string, style: string) => Promise<string>
        analyzeDirectory: (dirPath: string) => Promise<any>
    }

    process: {
        spawn: (command: string, args: string[], cwd: string) => Promise<string>
        kill: (id: string) => Promise<boolean>
        list: () => Promise<any[]>
        scanScripts: (rootPath: string) => Promise<Record<string, string>>
        resize: (id: string, cols: number, rows: number) => Promise<void>
        write: (id: string, data: string) => Promise<void>
        onData: (callback: (data: { id: string; data: string }) => void) => void
        onExit: (callback: (data: { id: string; code: number }) => void) => void
        removeListeners: () => void
    }

    // Settings
    getSettings: () => Promise<any>
    saveSettings: (settings: any) => Promise<any>

    huggingface: {
        searchModels: (query: string, limit: number, page: number) => Promise<any[]>
        getFiles: (modelId: string) => Promise<any[]>
        downloadFile: (url: string, outputPath: string, expectedSize: number, expectedSha256: string) => Promise<{ success: boolean; error?: string }>
        onDownloadProgress: (callback: (progress: { filename: string; received: number; total: number }) => void) => void
        cancelDownload: () => void
    }

    log: {
        write: (level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any) => void
        debug: (message: string, data?: any) => void
        info: (message: string, data?: any) => void
        warn: (message: string, data?: any) => void
        error: (message: string, data?: any) => void
    }

    gallery: {
        list: () => Promise<{ name: string; path: string; url: string; mtime: number }[]>
        delete: (path: string) => Promise<boolean>
        open: (path: string) => Promise<boolean>
        reveal: (path: string) => Promise<boolean>
    }



    on: (channel: string, callback: (...args: any[]) => void) => void
    getUserDataPath: () => Promise<string>

    update: {
        checkForUpdates: () => Promise<void>
        downloadUpdate: () => Promise<void>
        installUpdate: () => Promise<void>
    }

    ipcRenderer: {
        on: (channel: string, listener: (event: any, ...args: any[]) => void) => () => void
        off: (channel: string, listener: (...args: any[]) => void) => void
        send: (channel: string, ...args: any[]) => void
        invoke: (channel: string, ...args: any[]) => Promise<any>
        removeAllListeners: (channel: string) => void
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
    geminiLogin: () => ipcRenderer.invoke('proxy:geminiLogin'),
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
    importChatHistory: (provider: string) => ipcRenderer.invoke('history:import', provider),
    importChatHistoryJson: (jsonContent: string) => ipcRenderer.invoke('history:import-json', jsonContent),

    getModels: () => ipcRenderer.invoke('ollama:getModels'),
    chat: (messages, model) => ipcRenderer.invoke('ollama:chat', messages, model),
    chatOpenAI: (messages: any[], model: string, tools?: any[], provider?: string, options?: any) => ipcRenderer.invoke('chat:openai', messages, model, tools, provider, options),
    chatStream: (messages: any[], model: string, tools?: any[], provider?: string, options?: any) => ipcRenderer.invoke('chat:stream', messages, model, tools, provider, options),
    abortChat: () => ipcRenderer.invoke('ollama:abort'),
    onStreamChunk: (callback) => {
        const listener = (_event: any, chunk: any) => callback(chunk)
        ipcRenderer.on('ollama:streamChunk', listener)
    },
    removeStreamChunkListener: () => {
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
    onOllamaStatusChange: (callback: (status: any) => void) => ipcRenderer.on('ollama:statusChange', (_event, value) => callback(value)),

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
        getProjects: () => ipcRenderer.invoke('db:getProjects'),
        createProject: (name, path, desc, mounts) => ipcRenderer.invoke('db:createProject', name, path, desc, mounts),
        updateProject: (id: string, updates: any) => ipcRenderer.invoke('db:updateProject', id, updates),
        deleteProject: (id: string) => ipcRenderer.invoke('db:deleteProject', id),
        archiveProject: (id: string, isArchived: boolean) => ipcRenderer.invoke('db:archiveProject', id, isArchived),
        getFolders: () => ipcRenderer.invoke('db:getFolders'),
        createFolder: (name: string, color?: string) => ipcRenderer.invoke('db:createFolder', name, color),
        deleteFolder: (id: string) => ipcRenderer.invoke('db:deleteFolder', id),
        updateFolder: (id: string, updates: any) => ipcRenderer.invoke('db:updateFolder', id, updates),
        getPrompts: () => ipcRenderer.invoke('db:getPrompts'),
        createPrompt: (title: string, content: string, tags?: string[]) => ipcRenderer.invoke('db:createPrompt', title, content, tags),
        updatePrompt: (id: string, updates: any) => ipcRenderer.invoke('db:updatePrompt', id, updates),
        deletePrompt: (id: string) => ipcRenderer.invoke('db:deletePrompt', id)
    },

    council: {
        runSession: (projectId: string, taskId: string) => ipcRenderer.invoke('council:run', projectId, taskId),
        onUpdate: (callback: (data: any) => void) => {
            ipcRenderer.on('council:update', (_event, data) => callback(data))
        },
        removeUpdateListener: () => ipcRenderer.removeAllListeners('council:update'),
        approvePlan: (sessionId: string, approved: boolean, editedPlan?: string) => ipcRenderer.invoke('council:approvePlan', sessionId, approved, editedPlan),
        generateAgents: (taskDescription: string) => ipcRenderer.invoke('council:generateAgents', taskDescription),
        getSessions: (projectId?: string) => ipcRenderer.invoke('db:getCouncilSessions', projectId),
        getSessionById: (id: string) => ipcRenderer.invoke('db:getCouncilSessionById', id)
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
        onStdout: (callback) => ipcRenderer.on('ssh:stdout', (_event, data) => callback(data)),
        onStderr: (callback) => ipcRenderer.on('ssh:stderr', (_event, data) => callback(data)),
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
        onShellData: (callback) => ipcRenderer.on('ssh:shellData', (_event, data) => callback(data)),
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
    saveFile: (content, filename) => ipcRenderer.invoke('dialog:saveFile', { content, filename }),

    files: {
        listDirectory: (path: string) => ipcRenderer.invoke('files:listDirectory', path),
        readFile: (filePath: string) => ipcRenderer.invoke('files:readFile', filePath),
        readImage: (filePath: string) => ipcRenderer.invoke('files:readImage', filePath),
        writeFile: (filePath: string, content: string) => ipcRenderer.invoke('files:writeFile', filePath, content),
        exists: (path: string) => ipcRenderer.invoke('files:exists', path)
    },

    getSettings: () => ipcRenderer.invoke('settings:get'),
    saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

    project: {
        analyze: (rootPath: string) => ipcRenderer.invoke('project:analyze', rootPath),
        saveState: (rootPath: string, state: any) => ipcRenderer.invoke('project:save-state', rootPath, state),
        loadState: (rootPath: string) => ipcRenderer.invoke('project:load-state', rootPath),
        analyzeIdentity: (rootPath: string) => ipcRenderer.invoke('project:analyzeIdentity', rootPath),
        generateLogo: (projectPath: string, prompt: string, style: string) => ipcRenderer.invoke('project:generateLogo', projectPath, prompt, style),
        analyzeDirectory: (dirPath: string) => ipcRenderer.invoke('project:analyzeDirectory', dirPath)
    },

    process: {
        spawn: (command: string, args: string[], cwd: string) => ipcRenderer.invoke('process:spawn', command, args, cwd),
        kill: (id: string) => ipcRenderer.invoke('process:kill', id),
        list: () => ipcRenderer.invoke('process:list'),
        scanScripts: (rootPath: string) => ipcRenderer.invoke('process:scan-scripts', rootPath),
        resize: (id: string, cols: number, rows: number) => ipcRenderer.invoke('process:resize', id, cols, rows),
        write: (id: string, data: string) => ipcRenderer.invoke('process:write', id, data),
        onData: (callback: (data: any) => void) => ipcRenderer.on('process:data', (_event, data) => callback(data)),
        onExit: (callback: (data: any) => void) => ipcRenderer.on('process:exit', (_event, data) => callback(data)),
        removeListeners: () => {
            ipcRenderer.removeAllListeners('process:data')
            ipcRenderer.removeAllListeners('process:exit')
        }
    },

    huggingface: {
        searchModels: (query: string, limit: number, page: number) => ipcRenderer.invoke('hf:search-models', query, limit, page),
        getFiles: (modelId: string) => ipcRenderer.invoke('hf:get-files', modelId),
        downloadFile: (url: string, outputPath: string, expectedSize: number, expectedSha256: string) => ipcRenderer.invoke('hf:download-file', url, outputPath, expectedSize, expectedSha256),
        onDownloadProgress: (callback: (progress: any) => void) => ipcRenderer.on('hf:download-progress', (_event, progress) => callback(progress)),
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
        onData: (callback) => ipcRenderer.on('terminal:data', (_event, data) => callback(data)),
        onExit: (callback) => ipcRenderer.on('terminal:exit', (_event, data) => callback(data)),
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



    // Generic event listener for IPC events
    on: (channel: string, callback: (...args: any[]) => void) => {
        const listener = (_event: any, ...args: any[]) => callback(_event, ...args)
        ipcRenderer.on(channel, listener)
        // Return cleanup function
        return () => ipcRenderer.removeListener(channel, listener)
    },

    getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath'),

    update: {
        checkForUpdates: () => ipcRenderer.invoke('update:check'),
        downloadUpdate: () => ipcRenderer.invoke('update:download'),
        installUpdate: () => ipcRenderer.invoke('update:install')
    },

    ipcRenderer: {
        on: (channel: string, listener: (event: any, ...args: any[]) => void) => {
            ipcRenderer.on(channel, listener)
            return () => ipcRenderer.removeListener(channel, listener)
        },
        off: (channel: string, listener: (...args: any[]) => void) => ipcRenderer.removeListener(channel, listener),
        send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
        invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
        removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel)
    }
}

contextBridge.exposeInMainWorld('electron', api)
