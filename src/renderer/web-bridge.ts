import type { ElectronAPI } from './electron.d.ts'

const getStoredSettings = () => {
    const stored = localStorage.getItem('ai-chat-settings')
    const mock = {
        ollama: { url: 'http://localhost:11434' },
        openai: { apiKey: '' },
        appearance: { theme: 'dark' },
        general: { defaultModel: 'llama3.1:8b', lastModel: 'llama3.1:8b', favoriteModels: [], recentModels: [], hiddenModels: [] }
    }
    return stored ? JSON.parse(stored) : mock
}

const mockDB = {
    chats: JSON.parse(localStorage.getItem('ai-chat-chats') || '[]'),
    messages: JSON.parse(localStorage.getItem('ai-chat-messages') || '{}'),
    folders: JSON.parse(localStorage.getItem('ai-chat-folders') || '[]'),
    projects: []
}

const saveDB = () => {
    localStorage.setItem('ai-chat-chats', JSON.stringify(mockDB.chats))
    localStorage.setItem('ai-chat-messages', JSON.stringify(mockDB.messages))
    localStorage.setItem('ai-chat-folders', JSON.stringify(mockDB.folders))
}

const webBridge: ElectronAPI = {
    minimize: () => console.log('Window: Minimize'),
    maximize: () => console.log('Window: Maximize'),
    close: () => console.log('Window: Close'),
    resizeWindow: (res) => console.log('Window: Resize', res),
    toggleCompact: (enabled) => console.log('Window: Toggle Compact', enabled),

    githubLogin: async () => ({ device_code: 'mock', user_code: 'mock', verification_uri: 'mock', expires_in: 600, interval: 5 }),
    pollToken: async () => ({ success: true, token: 'mock-token' }),
    antigravityLogin: async () => ({ url: 'mock', state: 'mock' }),
    geminiLogin: async () => ({ url: 'mock', state: 'mock' }),
    claudeLogin: async () => ({ url: 'mock', state: 'mock' }),
    anthropicLogin: async () => ({ url: 'mock', state: 'mock' }),
    codexLogin: async () => ({ url: 'mock', state: 'mock' }),
    checkAuthStatus: async () => ({ authenticated: true }),
    getProxyModels: async () => [],
    getQuota: async () => ({}),
    getCopilotQuota: async () => ({}),
    getCodexUsage: async () => ({}),
    importChatHistory: async () => ({ success: true }),
    importChatHistoryJson: async () => ({ success: true }),

    getModels: async () => [{ name: 'llama3.1:8b', details: { family: 'llama' } }],
    chat: async () => ({}),
    chatStream: async () => ({}),
    chatOpenAI: async () => ({}),
    abortChat: () => { },
    onStreamChunk: () => { },
    removeStreamChunkListener: () => { },

    isOllamaRunning: async () => true,
    startOllama: async () => ({ success: true, message: 'Running' }),
    pullModel: async () => ({ success: true }),
    deleteOllamaModel: async () => ({ success: true }),
    getLibraryModels: async () => [],
    onPullProgress: () => { },
    removePullProgressListener: () => { },

    llama: {
        loadModel: async () => ({ success: true }),
        unloadModel: async () => ({ success: true }),
        chat: async () => ({ success: true, response: 'Mock' }),
        resetSession: async () => ({ success: true }),
        getModels: async () => [],
        downloadModel: async () => ({ success: true }),
        deleteModel: async () => ({ success: true }),
        getConfig: async () => ({}),
        setConfig: async () => ({ success: true }),
        getGpuInfo: async () => ({ available: false }),
        getModelsDir: async () => '',
        onToken: () => { },
        removeTokenListener: () => { },
        onDownloadProgress: () => { },
        removeDownloadProgressListener: () => { }
    },

    db: {
        createChat: async (chat) => { mockDB.chats.push(chat); saveDB(); return { success: true } },
        updateChat: async (id, updates) => {
            const idx = mockDB.chats.findIndex((c: any) => c.id === id)
            if (idx !== -1) { mockDB.chats[idx] = { ...mockDB.chats[idx], ...updates }; saveDB() }
            return { success: true }
        },
        deleteChat: async (id) => {
            mockDB.chats = mockDB.chats.filter((c: any) => c.id !== id)
            delete (mockDB.messages as any)[id]
            saveDB()
            return { success: true }
        },
        duplicateChat: async (id) => {
            const chat = mockDB.chats.find((c: any) => c.id === id)
            if (!chat) return null
            const dup = { ...chat, id: `${chat.id}-copy`, title: `${chat.title} (Kopya)`, createdAt: new Date() }
            mockDB.chats.push(dup)
            saveDB()
            return dup
        },
        archiveChat: async (id, isArchived) => {
            const idx = mockDB.chats.findIndex((c: any) => c.id === id)
            if (idx !== -1) { mockDB.chats[idx] = { ...mockDB.chats[idx], isArchived }; saveDB() }
            return { success: true }
        },
        getChat: async (id) => mockDB.chats.find((c: any) => c.id === id) || null,
        getAllChats: async () => [...mockDB.chats].reverse(),
        searchChats: async (q) => mockDB.chats.filter((c: any) => c.title.toLowerCase().includes(q.toLowerCase())),
        addMessage: async (m) => {
            const cid = (m as any).chatId || 'default'
            if (!(mockDB.messages as any)[cid]) (mockDB.messages as any)[cid] = []
                ; (mockDB.messages as any)[cid].push(m)
            saveDB()
            return { success: true }
        },
        deleteMessage: async (id) => {
            Object.keys(mockDB.messages).forEach(cid => { (mockDB.messages as any)[cid] = ((mockDB.messages as any)[cid] || []).filter((m: any) => m.id !== id) })
            saveDB()
            return { success: true }
        },
        updateMessage: async (id, up) => {
            Object.keys(mockDB.messages).forEach(cid => { (mockDB.messages as any)[cid] = ((mockDB.messages as any)[cid] || []).map((m: any) => m.id === id ? { ...m, ...up } : m) })
            saveDB()
            return { success: true }
        },
        deleteAllChats: async () => { mockDB.chats = []; mockDB.messages = {}; saveDB(); return { success: true } },
        getMessages: async (cid) => (mockDB.messages as any)[cid] || [],
        getStats: async () => ({ chatCount: mockDB.chats.length, messageCount: 0, dbSize: 0 }),
        getDetailedStats: async () => ({ chatCount: 0, messageCount: 0, dbSize: 0, totalTokens: 0, promptTokens: 0, completionTokens: 0, tokenTimeline: [], activity: [] }),
        getProjects: async () => [],
        createProject: async () => { },
        updateProject: async () => { },
        createFolder: async (name) => {
            const f = { id: Date.now().toString(), name, createdAt: Date.now(), updatedAt: Date.now() }
            mockDB.folders.push(f)
            saveDB()
            return f
        },
        deleteFolder: async (id) => { mockDB.folders = mockDB.folders.filter((f: any) => f.id !== id); saveDB(); return { success: true } },
        updateFolder: async (id, name) => {
            const idx = mockDB.folders.findIndex((f: any) => f.id === id)
            if (idx !== -1) { mockDB.folders[idx] = { ...mockDB.folders[idx], name, updatedAt: Date.now() }; saveDB() }
            return { success: true }
        },
        getFolders: async () => mockDB.folders
    },

    ssh: {
        connect: async () => ({ success: true }),
        disconnect: async () => ({ success: true }),
        execute: async () => ({}),
        upload: async () => ({ success: true }),
        download: async () => ({ success: true }),
        listDir: async () => ({ success: true, files: [] }),
        readFile: async () => ({ success: true, content: '' }),
        writeFile: async () => ({ success: true }),
        deleteDir: async () => ({ success: true }),
        deleteFile: async () => ({ success: true }),
        mkdir: async () => ({ success: true }),
        rename: async () => ({ success: true }),
        getConnections: async () => [],
        isConnected: async () => false,
        onStdout: () => { },
        onStderr: () => { },
        onConnected: () => { },
        onDisconnected: () => { },
        onUploadProgress: () => { },
        onDownloadProgress: () => { },
        removeAllListeners: () => { },
        onShellData: () => { },
        shellStart: async () => ({ success: true }),
        shellWrite: async () => ({ success: true })
    },

    executeTools: async () => ({}),
    killTool: async () => ({}),
    getToolDefinitions: async () => [],

    mcp: {
        list: async () => [],
        dispatch: async () => ({}),
        toggle: async () => ({ success: true, isEnabled: true }),
        install: async () => ({ success: true }),
        uninstall: async () => ({ success: true }),
        onResult: () => { },
        removeResultListener: () => { }
    },

    proxyEmbed: {
        start: async () => ({}),
        stop: async () => ({}),
        status: async () => ({})
    },

    captureScreenshot: async () => ({ success: true }),
    openExternal: async (_url: string) => { },
    openTerminal: async () => true,

    readPdf: async () => ({ success: true, text: '' }),
    selectDirectory: async () => ({ success: true, path: '' }),
    listDirectory: async () => ({ success: true, files: [] }),
    readFile: async () => ({ success: true, content: '' }),
    writeFile: async () => ({ success: true }),
    createDirectory: async () => ({ success: true }),
    deleteFile: async () => ({ success: true }),
    deleteDirectory: async () => ({ success: true }),
    renamePath: async () => ({ success: true }),
    searchFiles: async () => ({ success: true, matches: [] }),
    saveFile: async () => ({ success: true, path: '' }),

    getSettings: async () => getStoredSettings(),
    saveSettings: async (s) => { localStorage.setItem('ai-chat-settings', JSON.stringify(s)); return s },

    huggingface: {
        searchModels: async () => []
    },

    log: {
        write: () => { },
        debug: () => { },
        info: () => { },
        warn: () => { },
        error: () => { }
    },

    deleteProxyAuthFile: async (fileName: string) => {
        console.log('[deleteProxyAuthFile] Deleting auth file:', fileName)

        return { success: true }
    },
}

export default webBridge
