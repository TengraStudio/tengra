import { contextBridge, ipcRenderer } from 'electron'

export interface ElectronAPI {
    // Window controls
    minimize: () => void
    maximize: () => void
    close: () => void
    toggleCompact: (enabled: boolean) => void

    // Auth
    githubLogin: () => Promise<{ device_code: string; user_code: string; verification_uri: string; expires_in: number; interval: number }>
    pollToken: (deviceCode: string, interval: number) => Promise<{ success: boolean; token?: string; error?: string }>

    // Proxy
    getProxyModels: () => Promise<any[]>

    // Ollama chat
    getModels: () => Promise<any[]>
    chat: (messages: any[], model: string) => Promise<any>
    chatOpenAI: (messages: any[], model: string) => Promise<any>
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
        getChat: (id: string) => Promise<any>
        getAllChats: () => Promise<any[]>
        searchChats: (query: string) => Promise<any[]>
        addMessage: (message: any) => Promise<{ success: boolean }>
        getMessages: (chatId: string) => Promise<any[]>
        getStats: () => Promise<{ chatCount: number; messageCount: number; dbSize: number }>
    }

    // SSH
    ssh: {
        connect: (connection: any) => Promise<{ success: boolean; error?: string }>
        disconnect: (connectionId: string) => Promise<{ success: boolean }>
        execute: (connectionId: string, command: string, options?: any) => Promise<any>
        upload: (connectionId: string, localPath: string, remotePath: string) => Promise<{ success: boolean; error?: string }>
        download: (connectionId: string, remotePath: string, localPath: string) => Promise<{ success: boolean; error?: string }>
        listDir: (connectionId: string, remotePath: string) => Promise<{ success: boolean; files?: any[]; error?: string }>
        getConnections: () => Promise<any[]>
        isConnected: (connectionId: string) => Promise<boolean>
        onStdout: (callback: (data: any) => void) => void
        onStderr: (callback: (data: any) => void) => void
        onConnected: (callback: (connectionId: string) => void) => void
        onDisconnected: (callback: (connectionId: string) => void) => void
        onUploadProgress: (callback: (progress: { transferred: number; total: number }) => void) => void
        onDownloadProgress: (callback: (progress: { transferred: number; total: number }) => void) => void
        removeAllListeners: () => void
    }

    // Tools
    executeTools: (toolName: string, args: any, toolCallId?: string) => Promise<any>
    killTool: (toolCallId: string) => Promise<any>
    getToolDefinitions: () => Promise<any[]>

    // Screenshot
    captureScreenshot: () => Promise<{ success: boolean; image?: string; error?: string }>

    // Shell
    openExternal: (url: string) => void

    // Files
    readPdf: (path: string) => Promise<{ success: boolean; text?: string; error?: string }>

    // Settings
    getSettings: () => Promise<any>
    saveSettings: (settings: any) => Promise<any>
}

const api: ElectronAPI = {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    toggleCompact: (enabled) => ipcRenderer.send('window:toggle-compact', enabled),

    // Auth
    githubLogin: () => ipcRenderer.invoke('auth:github-login'),
    pollToken: (deviceCode: string, interval: number) => ipcRenderer.invoke('auth:poll-token', deviceCode, interval),

    getProxyModels: () => ipcRenderer.invoke('proxy:getModels'),

    getModels: () => ipcRenderer.invoke('ollama:getModels'),
    chat: (messages, model) => ipcRenderer.invoke('ollama:chat', messages, model),
    chatOpenAI: (messages, model) => {
        console.log('[Preload] chatOpenAI called with:', model)
        return ipcRenderer.invoke('chat:openai', messages, model)
    },
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
        getChat: (id) => ipcRenderer.invoke('db:getChat', id),
        getAllChats: () => ipcRenderer.invoke('db:getAllChats'),
        searchChats: (query) => ipcRenderer.invoke('db:searchChats', query),
        addMessage: (message) => ipcRenderer.invoke('db:addMessage', message),
        getMessages: (chatId) => ipcRenderer.invoke('db:getMessages', chatId),
        getStats: () => ipcRenderer.invoke('db:getStats')
    },

    ssh: {
        connect: (connection) => ipcRenderer.invoke('ssh:connect', connection),
        disconnect: (connectionId) => ipcRenderer.invoke('ssh:disconnect', connectionId),
        execute: (connectionId, command, options) => ipcRenderer.invoke('ssh:execute', connectionId, command, options),
        upload: (connectionId, localPath, remotePath) => ipcRenderer.invoke('ssh:upload', connectionId, localPath, remotePath),
        download: (connectionId, remotePath, localPath) => ipcRenderer.invoke('ssh:download', connectionId, remotePath, localPath),
        listDir: (connectionId, remotePath) => ipcRenderer.invoke('ssh:listDir', connectionId, remotePath),
        getConnections: () => ipcRenderer.invoke('ssh:getConnections'),
        isConnected: (connectionId) => ipcRenderer.invoke('ssh:isConnected', connectionId),
        onStdout: (callback) => {
            ipcRenderer.on('ssh:stdout', (_event, data) => callback(data))
        },
        onStderr: (callback) => {
            ipcRenderer.on('ssh:stderr', (_event, data) => callback(data))
        },
        onConnected: (callback) => {
            ipcRenderer.on('ssh:connected', (_event, connectionId) => callback(connectionId))
        },
        onDisconnected: (callback) => {
            ipcRenderer.on('ssh:disconnected', (_event, connectionId) => callback(connectionId))
        },
        onUploadProgress: (callback) => {
            ipcRenderer.on('ssh:uploadProgress', (_event, progress) => callback(progress))
        },
        onDownloadProgress: (callback) => {
            ipcRenderer.on('ssh:downloadProgress', (_event, progress) => callback(progress))
        },
        removeAllListeners: () => {
            ipcRenderer.removeAllListeners('ssh:stdout')
            ipcRenderer.removeAllListeners('ssh:stderr')
            ipcRenderer.removeAllListeners('ssh:connected')
            ipcRenderer.removeAllListeners('ssh:disconnected')
            ipcRenderer.removeAllListeners('ssh:uploadProgress')
            ipcRenderer.removeAllListeners('ssh:downloadProgress')
        }
    },

    executeTools: (toolName, args, toolCallId) => ipcRenderer.invoke('tools:execute', toolName, args, toolCallId),
    killTool: (toolCallId) => ipcRenderer.invoke('tools:kill', toolCallId),
    getToolDefinitions: () => ipcRenderer.invoke('tools:getDefinitions'),

    captureScreenshot: () => ipcRenderer.invoke('screenshot:capture'),

    openExternal: (url) => ipcRenderer.send('shell:openExternal', url),

    readPdf: (path) => ipcRenderer.invoke('files:read-pdf', path),

    getSettings: () => ipcRenderer.invoke('settings:get'),
    saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings)
}

contextBridge.exposeInMainWorld('electron', api)
