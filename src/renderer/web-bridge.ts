import type { ElectronAPI } from './electron.d.ts'

const mockSettings = {
    ollama: { url: 'http://localhost:11434' },
    openai: { apiKey: '' },
    appearance: { theme: 'dark' }
}

const getStoredSettings = () => {
    const stored = localStorage.getItem('ai-chat-settings')
    return stored ? JSON.parse(stored) : mockSettings
}

const mockDB = {
    chats: JSON.parse(localStorage.getItem('ai-chat-chats') || '[]'),
    messages: JSON.parse(localStorage.getItem('ai-chat-messages') || '{}')
}

const saveDB = () => {
    localStorage.setItem('ai-chat-chats', JSON.stringify(mockDB.chats))
    localStorage.setItem('ai-chat-messages', JSON.stringify(mockDB.messages))
}

const webBridge: ElectronAPI = {
    minimize: () => console.log('Window: Minimize (Web Mock)'),
    maximize: () => console.log('Window: Maximize (Web Mock)'),
    close: () => console.log('Window: Close (Web Mock)'),
    toggleCompact: (enabled) => console.log('Window: Toggle Compact (Web Mock)', enabled),

    getModels: async () => {
        try {
            const res = await fetch(`${getStoredSettings().ollama.url}/api/tags`)
            if (!res.ok) throw new Error('Ollama not reachable')
            const data = await res.json()
            return data.models || []
        } catch (e) {
            console.warn('Ollama fetch failed, returning mock models', e)
            return [{ name: 'llama3.1:8b', details: { family: 'llama' } }]
        }
    },

    chat: async (messages, model) => {
        const response = await fetch(`${getStoredSettings().ollama.url}/api/chat`, {
            method: 'POST',
            body: JSON.stringify({ model, messages, stream: false })
        })
        return await response.json()
    },

    chatOpenAI: async () => ({ error: 'OpenAI not supported in web mock yet' }),
    chatStream: async () => ({ error: 'Streaming not supported in web mock yet' }),
    abortChat: () => { },
    onStreamChunk: () => { },
    removeStreamChunkListener: () => { },

    isOllamaRunning: async () => {
        try {
            const res = await fetch(getStoredSettings().ollama.url)
            return res.ok
        } catch {
            return false
        }
    },
    startOllama: async () => ({ success: false, message: 'Cannot start Ollama from browser' }),
    pullModel: async () => ({ success: false, error: 'Not supported in web mock' }),
    deleteOllamaModel: async () => ({ success: false, error: 'Not supported in web mock' }),
    getLibraryModels: async () => [],
    onPullProgress: () => { },
    removePullProgressListener: () => { },

    llama: {
        loadModel: async () => ({ success: false, error: 'Llama.cpp not supported in web mock' }),
        unloadModel: async () => ({ success: true }),
        chat: async () => ({ success: false, error: 'Not supported' }),
        resetSession: async () => ({ success: true }),
        getModels: async () => [],
        downloadModel: async () => ({ success: false }),
        deleteModel: async () => ({ success: false }),
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
        createChat: async (chat) => {
            mockDB.chats.push(chat)
            saveDB()
            return { success: true }
        },
        updateChat: async (id, updates) => {
            const idx = mockDB.chats.findIndex((c: any) => c.id === id)
            if (idx !== -1) {
                mockDB.chats[idx] = { ...mockDB.chats[idx], ...updates }
                saveDB()
            }
            return { success: true }
        },
        deleteChat: async (id) => {
            mockDB.chats = mockDB.chats.filter((c: any) => c.id !== id)
            delete mockDB.messages[id]
            saveDB()
            return { success: true }
        },
        getChat: async (id) => mockDB.chats.find((c: any) => c.id === id),
        getAllChats: async () => [...mockDB.chats].reverse(),
        searchChats: async (query) => mockDB.chats.filter((c: any) => c.title.toLowerCase().includes(query.toLowerCase())),
        addMessage: async (message) => {
            const chatId = message.chatId || 'default'
            if (!mockDB.messages[chatId]) mockDB.messages[chatId] = []
            mockDB.messages[chatId].push(message)
            saveDB()
            return { success: true }
        },
        getMessages: async (chatId) => mockDB.messages[chatId] || [],
        getStats: async () => ({
            chatCount: mockDB.chats.length,
            messageCount: Object.values(mockDB.messages).flat().length,
            dbSize: JSON.stringify(mockDB).length
        })
    },

    ssh: {
        connect: async () => ({ success: false, error: 'SSH not supported in web mock' }),
        disconnect: async () => ({ success: true }),
        execute: async () => ({}),
        upload: async () => ({ success: false }),
        download: async () => ({ success: false }),
        listDir: async () => ({ success: false }),
        deleteDir: async () => ({ success: false, error: 'Not supported in web mock' }),
        deleteFile: async () => ({ success: false, error: 'Not supported in web mock' }),
        mkdir: async () => ({ success: false, error: 'Not supported in web mock' }),
        rename: async () => ({ success: false, error: 'Not supported in web mock' }),
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
        shellStart: async () => ({ success: false, error: 'Not supported in web mock' }),
        shellWrite: async () => ({ success: false, error: 'Not supported in web mock' })
    },

    executeTools: async (name) => {
        if (name === 'get_system_usage') {
            return { cpu: Math.random() * 100, memory: Math.random() * 100 }
        }
        return { error: 'Tool not supported in web mock' }
    },
    killTool: async () => ({}),
    getToolDefinitions: async () => [],

    captureScreenshot: async () => ({ success: false, error: 'Not supported' }),
    openExternal: (url) => window.open(url, '_blank'),
    readPdf: async () => ({ success: false, error: 'Not supported' }),

    getSettings: async () => getStoredSettings(),
    saveSettings: async (settings) => {
        localStorage.setItem('ai-chat-settings', JSON.stringify(settings))
        return { success: true }
    }
}

if (!(window as any).electron) {
    (window as any).electron = webBridge
    console.log('[WebBridge] Initialized mock Electron API')
}
