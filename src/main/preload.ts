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

    // Proxy
    getProxyModels: () => Promise<any[]>
    getQuota: () => Promise<any>
    getCopilotQuota: () => Promise<any>
    getCodexUsage: () => Promise<any>
    importChatHistory: (provider: string) => Promise<{ success: boolean; importedChats?: number; importedMessages?: number; message?: string }>
    importChatHistoryJson: (jsonContent: string) => Promise<{ success: boolean; importedChats?: number; importedMessages?: number; message?: string }>


    // Ollama chat
    getModels: () => Promise<any[]>
    chat: (messages: any[], model: string) => Promise<any>
    chatOpenAI: (messages: any[], model: string, tools?: any[], provider?: string) => Promise<any>
    chatStream: (messages: any[], model: string, tools?: any[]) => Promise<any>
    abortChat: () => void
    onStreamChunk: (callback: (chunk: string) => void) => void
    removeStreamChunkListener: (callback?: (chunk: string) => void) => void

    // Ollama management
    isOllamaRunning: () => Promise<boolean>
    startOllama: () => Promise<{ success: boolean; message: string }>
    pullModel: (modelName: string) => Promise<{ success: boolean; error?: string }>
    deleteOllamaModel: (modelName: string) => Promise<{ success: boolean; error?: string }>
    getLibraryModels: () => Promise<any[]>
    onPullProgress: (callback: (progress: any) => void) => void
    removePullProgressListener: () => void

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
        searchChats: (query: string) => Promise<any[]>
        addMessage: (message: any) => Promise<{ success: boolean }>
        deleteMessage: (id: string) => Promise<{ success: boolean }>
        updateMessage: (id: string, updates: any) => Promise<{ success: boolean }>
        deleteAllChats: () => Promise<{ success: boolean }>
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
        createFolder: (name: string) => Promise<any>
        deleteFolder: (id: string) => Promise<{ success: boolean }>
        updateFolder: (id: string, name: string) => Promise<{ success: boolean }>
        getFolders: () => Promise<any[]>
    }

    // SSH
    ssh: {
        connect: (connection: any) => Promise<{ success: boolean; error?: string }>
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

    // Settings
    getSettings: () => Promise<any>
    saveSettings: (settings: any) => Promise<any>

    huggingface: {
        searchModels: (query: string, limit: number, page: number) => Promise<any[]>
    }

    log: {
        write: (level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any) => void
        debug: (message: string, data?: any) => void
        info: (message: string, data?: any) => void
        warn: (message: string, data?: any) => void
        error: (message: string, data?: any) => void
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

    getProxyModels: () => ipcRenderer.invoke('proxy:getModels'),
    getQuota: () => ipcRenderer.invoke('proxy:getQuota'),
    getCopilotQuota: () => ipcRenderer.invoke('proxy:getCopilotQuota'),
    getCodexUsage: () => ipcRenderer.invoke('proxy:getCodexUsage'),
    importChatHistory: (provider: string) => ipcRenderer.invoke('history:import', provider),
    importChatHistoryJson: (jsonContent: string) => ipcRenderer.invoke('history:import-json', jsonContent),

    getModels: () => ipcRenderer.invoke('ollama:getModels'),
    chat: (messages, model) => ipcRenderer.invoke('ollama:chat', messages, model),
    chatOpenAI: (messages, model, tools, provider) => ipcRenderer.invoke('chat:openai', messages, model, tools, provider),
    chatStream: (messages, model, tools) => ipcRenderer.invoke('ollama:chatStream', messages, model, tools),
    abortChat: () => ipcRenderer.invoke('ollama:abort'),
    onStreamChunk: (callback) => {
        const listener = (_event: any, chunk: string) => callback(chunk)
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
    removePullProgressListener: () => {
        ipcRenderer.removeAllListeners('ollama:pullProgress')
    },

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
        getMessages: (chatId) => ipcRenderer.invoke('db:getMessages', chatId),
        getStats: () => ipcRenderer.invoke('db:getStats'),
        getDetailedStats: (period) => ipcRenderer.invoke('db:getDetailedStats', period),
        getProjects: () => ipcRenderer.invoke('db:getProjects'),
        createProject: (name, path, desc, mounts) => ipcRenderer.invoke('db:createProject', name, path, desc, mounts),
        updateProject: (id, updates) => ipcRenderer.invoke('db:updateProject', id, updates),
        createFolder: (name) => ipcRenderer.invoke('db:createFolder', name),
        deleteFolder: (id) => ipcRenderer.invoke('db:deleteFolder', id),
        updateFolder: (id, name) => ipcRenderer.invoke('db:updateFolder', id, name),
        getFolders: () => ipcRenderer.invoke('db:getFolders')
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
        shellWrite: (connectionId, data) => ipcRenderer.invoke('ssh:shellWrite', { connectionId, data })
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
    openExternal: (url) => ipcRenderer.send('shell:openExternal', url),
    openTerminal: (command) => ipcRenderer.invoke('shell:openTerminal', command),

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

    getSettings: () => ipcRenderer.invoke('settings:get'),
    saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

    huggingface: {
        searchModels: (query: string, limit: number, page: number) => ipcRenderer.invoke('hf:search-models', query, limit, page)
    },

    log: {
        write: (level, message, data) => ipcRenderer.send('log:write', { level, message, data }),
        debug: (message, data) => ipcRenderer.send('log:write', { level: 'debug', message, data }),
        info: (message, data) => ipcRenderer.send('log:write', { level: 'info', message, data }),
        warn: (message, data) => ipcRenderer.send('log:write', { level: 'warn', message, data }),
        error: (message, data) => ipcRenderer.send('log:write', { level: 'error', message, data })
    }
}

contextBridge.exposeInMainWorld('electron', api)
