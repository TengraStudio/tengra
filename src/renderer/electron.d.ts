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

    // Project System
    project: {
        analyze: (rootPath: string, projectId: string) => Promise<any>
        saveState: (rootPath: string, state: any) => Promise<boolean>
        loadState: (rootPath: string) => Promise<any>
        generateLogo: (projectPath: string, prompt: string, style: string) => Promise<string>
        analyzeIdentity: (projectPath: string) => Promise<{ suggestedPrompts: string[], colors: string[] }>
        applyLogo: (projectPath: string, tempLogoPath: string) => Promise<string>
        getCompletion: (text: string) => Promise<string>
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

    files: {
        listDirectory: (path: string) => Promise<any[]>
        readFile: (path: string) => Promise<string>
        readImage: (path: string) => Promise<{ success: boolean; content?: string; error?: string }>
        writeFile: (path: string, content: string) => Promise<void>
        exists: (path: string) => Promise<boolean>
    }

    // Proxy
    getProxyModels: () => Promise<any[]>
    getQuota: (provider?: string) => Promise<any>
    getCopilotQuota: () => Promise<any>
    getCodexUsage: () => Promise<any>
    importChatHistory: (provider: string) => Promise<{ success: boolean; importedChats?: number; importedMessages?: number; message?: string }>
    importChatHistoryJson: (jsonContent: string) => Promise<{ success: boolean; importedChats?: number; importedMessages?: number; message?: string }>
    runCommand: (command: string, args: string[], cwd?: string) => Promise<{ stdout: string; stderr: string; code: number }>

    // Ollama chat
    getModels: () => Promise<any[]>
    chat: (messages: any[], model: string) => Promise<any>
    chatOpenAI: (messages: any[], model: string, tools?: any[], provider?: string, options?: any, projectId?: string) => Promise<any>
    chatStream: (messages: any[], model: string, tools?: any[], provider?: string, options?: any, chatId?: string, projectId?: string) => Promise<any>
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
        searchChats: (query: string) => Promise<any[]>
        addMessage: (message: any) => Promise<{ success: boolean }>
        deleteMessage: (id: string) => Promise<{ success: boolean }>
        updateMessage: (id: string, updates: any) => Promise<{ success: boolean }>
        deleteAllChats: () => Promise<{ success: boolean }>
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
        getFolders: () => Promise<any[]>
        createProject: (name: string, path: string, description: string, mounts?: string) => Promise<void>
        updateProject: (id: string, updates: any) => Promise<void>
        deleteProject: (id: string) => Promise<void>
        archiveProject: (id: string, isArchived: boolean) => Promise<void>
        createFolder: (name: string, color?: string) => Promise<any>
        deleteFolder: (id: string) => Promise<void>
        updateFolder: (id: string, updates: any) => Promise<void>

        // Prompts
        createPrompt: (title: string, content: string, tags?: string[]) => Promise<any>
        deletePrompt: (id: string) => Promise<void>
        updatePrompt: (id: string, updates: any) => Promise<void>
        getPrompts: () => Promise<any[]>
    }

    terminal: {
        isAvailable: () => Promise<boolean>
        getShells: () => Promise<{ id: string; name: string; path: string }[]>
        create: (options: { id: string; shell?: string; cwd?: string; cols?: number; rows?: number }) => Promise<{ success: boolean; error?: string }>
        write: (sessionId: string, data: string) => Promise<boolean>
        resize: (sessionId: string, cols: number, rows: number) => Promise<boolean>
        kill: (sessionId: string) => Promise<boolean>
        getSessions: () => Promise<string[]>
        readBuffer: (sessionId: string) => Promise<string>
        onData: (callback: (data: { id: string; data: string }) => void) => void
        onExit: (callback: (data: { id: string; code: number }) => void) => void
        removeAllListeners: () => void
    }

    council: {
        createSession: (goal: string) => Promise<any>
        getSessions: () => Promise<any[]>
        getSession: (id: string) => Promise<any>
        addLog: (sessionId: string, agentId: string, message: string, type: 'info' | 'error' | 'success' | 'plan' | 'action') => Promise<void>
        runStep: (sessionId: string) => void
        startLoop: (sessionId: string) => void
        stopLoop: (sessionId: string) => void
    }

    agent: {
        getAll: () => Promise<any[]>
        get: (id: string) => Promise<any>
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
    exportChatToPdf: (chatId: string, title: string) => Promise<{ success: boolean; path?: string; error?: string }>

    // Settings
    getSettings: () => Promise<any>
    saveSettings: (settings: any) => Promise<any>

    huggingface: {
        searchModels: (query: string, limit: number, page: number, sort: string) => Promise<{ models: any[], total: number }>
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

    on: (channel: string, listener: (event: any, ...args: any[]) => void) => () => void




    // Generic event listener
    on: (channel: string, callback: (...args: any[]) => void) => () => void
    getUserDataPath: () => Promise<string>

    update: {
        checkForUpdates: () => Promise<void>
        downloadUpdate: () => Promise<void>
        installUpdate: () => Promise<void>
    }

    // Explicit ipcRenderer exposure for flexible components
    ipcRenderer: {
        on: (channel: string, listener: (event: any, ...args: any[]) => void) => () => void
        off: (channel: string, listener: (...args: any[]) => void) => void
        send: (channel: string, ...args: any[]) => void
        invoke: (channel: string, ...args: any[]) => Promise<any>
        removeAllListeners: (channel: string) => void
    }
}

declare global {
    interface Window {
        electron: ElectronAPI
    }
}
