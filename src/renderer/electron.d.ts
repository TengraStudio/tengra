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

declare global {
    interface Window {
        electron: ElectronAPI
        SpeechRecognition: any
        webkitSpeechRecognition: any
    }
}
