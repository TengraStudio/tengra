import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Sidebar } from './components/Sidebar'
import { MessageBubble } from './components/MessageBubble'
import { SSHManager } from './components/SSHManager'
import { SettingsPage } from './pages/SettingsPage'
import { ProjectsPage } from './pages/ProjectsPage'

import { CommandPalette } from './components/CommandPalette'
import { ModelSelector } from './components/ModelSelector'
import { useVoiceInput } from './hooks/useVoiceInput'
import { AnimatePresence, motion } from 'framer-motion'
import {
    Mic, Send, Paperclip, ImageIcon, FileText,
    Eraser, Bot, TerminalSquare, User,
    Star, Download, Box, X
} from 'lucide-react'
import { SlashMenu, SlashCommand } from './components/SlashMenu'
import { getSystemPrompt } from './lib/identity'
import { useTranslation, Language } from './i18n'

import {
    Message,
    Chat,
    OllamaModel,
    Attachment,
    Toast,
    ToolResult,
    Folder,
    Project
} from './types'

import { generateId } from './lib/utils'

export default function App() {
    const isWeb = !window.electron
    const [chats, setChats] = useState<Chat[]>([])
    const [folders, setFolders] = useState<Folder[]>([])
    const [projects, setProjects] = useState<any[]>([])
    const [selectedProject, setSelectedProject] = useState<Project | null>(null)
    const [attachments, setAttachments] = useState<Attachment[]>([])
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [currentChatId, setCurrentChatId] = useState<string | null>(null)
    const [models, setModels] = useState<OllamaModel[]>([])
    const [selectedModel, setSelectedModel] = useState<string>('')
    const [language, setLanguage] = useState<Language>('tr')
    const { t } = useTranslation(language)
    const [proxyModels, setProxyModels] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [streamingContent, setStreamingContent] = useState('')
    const [messageQueue, setMessageQueue] = useState<string[]>([])
    const [showSSHManager, setShowSSHManager] = useState(false)
    const [currentView, setCurrentView] = useState<'chat' | 'projects' | 'settings' | 'mcp'>('chat')
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
    const [showFileMenu, setShowFileMenu] = useState(false)
    const [input, setInput] = useState('')
    const [toasts, setToasts] = useState<Toast[]>([])
    const [isCompact, setIsCompact] = useState(false)
    const [appSettings, setAppSettings] = useState<any>(null)
    const [settingsCategory, setSettingsCategory] = useState<'accounts' | 'general' | 'appearance' | 'models' | 'statistics' | 'gallery' | 'personas' | 'mcp-servers' | 'mcp-marketplace'>('general')
    const [showCommandPalette, setShowCommandPalette] = useState(false)
    useEffect(() => {
        if (appSettings?.general?.language) {
            setLanguage(appSettings.general.language)
        }
    }, [appSettings?.general?.language])
    const [sessionTokens] = useState({ prompt: 0, completion: 0, total: 0 })
    const [_hyperparams, _setHyperparams] = useState({ temperature: 0.7, topP: 0.9, topK: 40, repeatPenalty: 1.1 })
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const [selectedProvider, setSelectedProvider] = useState<'ollama' | 'openai' | 'gemini' | 'claude' | 'antigravity' | 'copilot'>('ollama')
    const [selectedPersona, setSelectedPersona] = useState<{ id: string, name: string, description: string, prompt: string } | null>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const [drafts, setDrafts] = useState<Record<string, string>>({})
    const prevChatIdRef = useRef<string | null>(null)

    const currentChat = chats.find(c => c.id === currentChatId)
    const messages = currentChat?.messages || []

    // Draft Management
    useEffect(() => {
        // Save previous chat draft
        if (prevChatIdRef.current && prevChatIdRef.current !== currentChatId) {
            const oldId = prevChatIdRef.current
            setDrafts(prev => ({ ...prev, [oldId]: input }))
        }

        // Load new chat draft
        if (currentChatId) {
            setInput(drafts[currentChatId] || '')
        } else {
            setInput('')
        }

        prevChatIdRef.current = currentChatId
    }, [currentChatId]) // Removed drafts and input to prevent resetting while typing

    // Scroll Management (Automatic)
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages.length, streamingContent])

    const displayMessages = useMemo(() => {
        const merged: Message[] = []
        const mergeContent = (primary?: string, secondary?: string) => {
            const a = (primary || '').trim()
            const b = (secondary || '').trim()
            if (!a) return b
            if (!b) return a
            if (a === b) return a
            if (a.includes(b)) return a
            if (b.includes(a)) return b
            return `${a}\n\n${b}`
        }
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i]
            if (msg.role !== 'assistant') {
                merged.push(msg)
                continue
            }
            const group: Message[] = [msg]
            let j = i + 1
            while (j < messages.length && messages[j].role === 'assistant') {
                group.push(messages[j])
                j += 1
            }
            const toolIndex = group.findIndex(m => (m.toolCalls?.length || 0) > 0 || (m.toolResults?.length || 0) > 0)
            if (toolIndex < 0) {
                merged.push(...group)
                i = j - 1
                continue
            }
            const base = group[toolIndex]
            const mergedContent = group.reduce((acc, m) => mergeContent(acc, m.content), '')
            const contentSource = [...group].reverse().find(m => (m.content || '').trim()) || base
            merged.push({
                ...base,
                id: contentSource.id,
                content: mergedContent,
                timestamp: contentSource.timestamp || base.timestamp,
                provider: contentSource.provider || base.provider,
                model: contentSource.model || base.model,
                isPinned: Boolean(base.isPinned || contentSource.isPinned)
            })
            i = j - 1
        }
        return merged
    }, [messages])
    const showTypingIndicator = isLoading && !streamingContent && (
        displayMessages.length === 0 || displayMessages[displayMessages.length - 1].role === 'user'
    )

    const inferProviderFromModel = (model: string): 'ollama' | 'openai' | 'gemini' | 'claude' | 'antigravity' | 'copilot' => {
        const name = model.toLowerCase()
        if (name.startsWith('copilot-') || name.includes('codex')) return 'copilot'
        if (name.startsWith('gpt-') || name.startsWith('o1-') || name.includes('openai')) return 'openai'
        if (name.startsWith('claude-') || name.includes('claude')) return 'claude'
        if (name.startsWith('gemini-') || name.includes('gemini')) return 'gemini'
        if (name.includes('antigravity')) return 'antigravity'
        return 'ollama'
    }

    const persistLastSelection = async (provider: string, model: string) => {
        if (!appSettings?.general) return
        const updated = {
            ...appSettings,
            general: {
                ...appSettings.general,
                lastModel: model,
                lastProvider: provider
            }
        }
        setAppSettings(updated)
        try {
            await window.electron.saveSettings(updated)
        } catch (e) {
            console.error('Failed to save last model selection:', e)
        }
    }

    useEffect(() => {
        if (!selectedModel) return
        const inferred = inferProviderFromModel(selectedModel)

        // Strict consistency check to avoid overriding user choice:
        // Only switch if the model name explicitly mandates a specific provider 
        // that is different from the current one.
        // e.g. if model is 'copilot-gpt-4', provider MUST be 'copilot'.
        // if model is 'gpt-4o', it could be openai OR copilot OR proxy.

        if (selectedModel.startsWith('copilot-') && selectedProvider !== 'copilot') {
            setSelectedProvider('copilot')
        } else if (selectedModel.startsWith('gemini-') && selectedProvider !== 'gemini') {
            setSelectedProvider('gemini')
        } else if (selectedModel.startsWith('claude-') && selectedProvider !== 'claude') {
            setSelectedProvider('claude')
        }
        // Otherwise, trust the user's manual provider selection (or the previous selection)
    }, [selectedModel])

    const loadAppSettings = async () => {
        try {
            const data = await window.electron.getSettings()

            // Check connected accounts and merge
            try {
                const status = await window.electron.checkAuthStatus()
                const files = status?.files || []

                if (files.find((f: any) => f.provider === 'codex' || f.provider === 'openai')) {
                    if (!data.openai) data.openai = {}
                    data.openai.apiKey = 'connected'
                }
                if (files.find((f: any) => f.provider === 'claude' || f.provider === 'anthropic')) {
                    if (!data.claude) data.claude = {}
                    data.claude.apiKey = 'connected'
                }
                if (files.find((f: any) => f.provider === 'gemini' || f.provider === 'gemini-cli')) {
                    if (!data.gemini) data.gemini = {}
                    data.gemini.apiKey = 'connected'
                }
                if (files.find((f: any) => f.provider === 'antigravity')) {
                    if (!data.antigravity) data.antigravity = {}
                    data.antigravity.connected = true
                }
            } catch (e) {
                console.error('Auth check failed:', e)
            }

            setAppSettings(data)
            if (data?.general?.defaultModel && !selectedModel) {
                const preferred = data.general.lastModel || data.general.defaultModel
                if (preferred) {
                    setSelectedModel(preferred)
                    setSelectedProvider(inferProviderFromModel(preferred))
                }
            }
        } catch (e) {
            console.error('Failed to load settings:', e)
        }
    }

    useEffect(() => {
        loadAppSettings()
    }, [])

    useEffect(() => {
        if (appSettings?.general?.fontSize) {
            document.documentElement.style.fontSize = `${appSettings.general.fontSize}px`
        } else {
            document.documentElement.style.fontSize = '14px'
        }

        if (appSettings?.general?.fontFamily) {
            document.documentElement.style.fontFamily = appSettings.general.fontFamily
        } else {
            document.documentElement.style.fontFamily = 'Inter, sans-serif'
        }
    }, [appSettings?.general?.fontSize, appSettings?.general?.fontFamily])

    useEffect(() => {
        const theme = appSettings?.general?.theme
        // Default to 'graphite' if missing or 'dark' (legacy)
        const effectiveTheme = (!theme || theme === 'dark') ? 'graphite' : theme
        document.documentElement.setAttribute('data-theme', effectiveTheme)
    }, [appSettings?.general?.theme])

    const toggleCompact = () => {
        const next = !isCompact
        setIsCompact(next)
        window.electron.toggleCompact(next)
    }

    const handleSend = async (textInput: string = input) => {
        if (!textInput.trim() && attachments.length === 0) return
        let finalContent = textInput.trim()
        const images: string[] = []
        for (const att of attachments) {
            if (att.type === 'text' && att.content) {
                finalContent += `\n\n--- Dosya: ${att.file.name} ---\n${att.content}\n--- Dosya Sonu ---`
            } else if (att.type === 'image' && att.preview) {
                const base64 = att.preview.split(',')[1]
                if (base64) images.push(base64)
            }
        }
        if (!finalContent && images.length > 0) finalContent = "Bu resim hakkında..."
        if (isLoading && images.length > 0) {
            setToasts(prev => [...prev, { id: generateId(), message: 'Gorselli mesajlar icin yanitin bitmesini bekleyin.', type: 'info' }])
            return
        }
        setInput('')
        setAttachments([])
        if (textareaRef.current) textareaRef.current.style.height = 'auto'
        await sendMessage(finalContent, images)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = Array.from(e.clipboardData?.items || [])
        let addedImage = false
        for (const item of items) {
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const file = item.getAsFile()
                if (file) {
                    const withName = file.name
                        ? file
                        : new File([file], `pasted-${Date.now()}.png`, { type: file.type })
                    processFile(withName)
                    addedImage = true
                }
            }
        }
        if (addedImage) {
            setToasts(prev => [...prev, { id: generateId(), message: 'Resim eklendi.', type: 'success' }])
        }
    }

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        const types = Array.from(e.dataTransfer?.types || [])
        const hasFiles = types.includes('Files') || (e.dataTransfer?.files?.length ?? 0) > 0
        if (hasFiles) {
            setIsDragging(true)
        }
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        if (e.currentTarget === e.target) setIsDragging(false)
    }, [])

    const processFile = async (file: File) => {
        const isImage = file.type.startsWith('image/')
        const isText = file.type.startsWith('text/') || /\.(ts|tsx|js|json|md|py|java|c|cpp)$/.test(file.name)
        const isPdf = file.name.endsWith('.pdf')
        if (isPdf) {
            try {
                const path = (file as any).path
                const result = await window.electron.readPdf(path)
                if (result.success && result.text) {
                    setAttachments(prev => [...prev, { file, type: 'text', content: result.text }])
                } else {
                    alert(`PDF okunamadı: ${file.name}`)
                }
            } catch (error) { console.error('PDF error:', error) }
            return
        }
        if (isImage) {
            const reader = new FileReader()
            reader.onload = (e) => setAttachments(prev => [...prev, { file, type: 'image', preview: e.target?.result as string }])
            reader.readAsDataURL(file)
        } else if (isText) {
            const reader = new FileReader()
            reader.onload = (e) => setAttachments(prev => [...prev, { file, type: 'text', content: e.target?.result as string }])
            reader.readAsText(file)
        } else alert(`Desteklenmeyen dosya türü: ${file.name}`)
    }

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const files = Array.from(e.dataTransfer.files || [])
        if (files.length === 0) return
        files.forEach(processFile)
    }, [])

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) Array.from(e.target.files).forEach(processFile)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const removeAttachment = (index: number) => setAttachments(prev => prev.filter((_, i) => i !== index))

    const handleVoiceResult = useCallback((text: string) => setInput(prev => (prev + ' ' + text).trim()), [])
    const { isListening, startListening, stopListening } = useVoiceInput(handleVoiceResult)

    useEffect(() => {
        loadChats()
        loadModels()
        loadProjects()
        loadFolders()

        const timeouts = [
            setTimeout(() => loadModels(), 4000),
            setTimeout(() => loadModels(), 12000),
            setTimeout(() => loadModels(), 30000),
            setTimeout(() => loadModels(), 60000)
        ]

        const handleFocus = () => loadModels()
        const handleVisibility = () => {
            if (!document.hidden) loadModels()
        }
        window.addEventListener('focus', handleFocus)
        document.addEventListener('visibilitychange', handleVisibility)

        return () => {
            timeouts.forEach(clearTimeout)
            window.removeEventListener('focus', handleFocus)
            document.removeEventListener('visibilitychange', handleVisibility)
        }
    }, [])

    const loadProjects = async () => {
        try {
            const data = await window.electron.db.getProjects()
            const normalized = (Array.isArray(data) ? data : []).map((project: any) => {
                let councilConfig = project.councilConfig
                if (typeof councilConfig === 'string') {
                    try { councilConfig = JSON.parse(councilConfig) } catch { councilConfig = null }
                }
                let mounts = project.mounts
                if (typeof mounts === 'string') {
                    try { mounts = JSON.parse(mounts) } catch { mounts = null }
                }

                const createdAt = project.createdAt instanceof Date
                    ? project.createdAt
                    : new Date(project.createdAt || Date.now())
                if (!Array.isArray(mounts) || mounts.length === 0) {
                    if (project.path) {
                        mounts = [{ id: `local-${project.id}`, name: 'Local', type: 'local', rootPath: project.path }]
                    } else { mounts = [] }
                }
                return {
                    id: project.id,
                    title: project.title || project.name || 'Yeni Proje',
                    description: project.description || '',
                    path: project.path || '',
                    mounts,
                    createdAt,
                    chatIds: Array.isArray(project.chatIds) ? project.chatIds : [],
                    councilConfig: councilConfig && typeof councilConfig === 'object'
                        ? councilConfig
                        : { enabled: false, members: [], consensusThreshold: 0.7 },
                    status: project.status || 'active'
                }
            })
            setProjects(normalized)
        } catch (e) { console.error('Failed to load projects:', e) }
    }

    const loadChats = async () => {
        try {
            const dbChats = await window.electron.db.getAllChats()
            const uiChats: Chat[] = dbChats.map(c => ({
                ...c,
                messages: [],
                createdAt: new Date(c.createdAt),
                updatedAt: new Date(c.updatedAt)
            }))
            setChats(uiChats)
            if (uiChats.length > 0 && !currentChatId) setCurrentChatId(uiChats[0].id)
        } catch (error) { console.error('Failed to load chats:', error) }
    }

    const handleSearch = useCallback(async (query: string) => {
        if (!query.trim()) {
            loadChats()
            return
        }
        try {
            const results = await window.electron.db.searchChats(query)
            const uiChats: Chat[] = results.map((c: any) => ({
                ...c,
                messages: [],
                createdAt: new Date(c.createdAt),
                updatedAt: new Date(c.updatedAt)
            }))
            setChats(uiChats)
        } catch (error) { console.error('Failed to search chats:', error) }
    }, [])

    const deleteChat = async (id: string) => {
        if (!confirm('Bu sohbeti silmek istediğinize emin misiniz?')) return
        try {
            await window.electron.db.deleteChat(id)
            setChats(prev => prev.filter(c => c.id !== id))
            if (currentChatId === id) setCurrentChatId(null)
        } catch (error) { console.error('Failed to delete chat:', error) }
    }

    const toggleChatPin = async (id: string, isPinned: boolean) => {
        try {
            await window.electron.db.updateChat(id, { isPinned })
            loadChats()
        } catch (error) { console.error('Failed to pin chat:', error) }
    }

    const toggleChatFavorite = async (id: string, isFavorite: boolean) => {
        try {
            await window.electron.db.updateChat(id, { isFavorite })
            loadChats()
        } catch (error) { console.error('Failed to favorite chat:', error) }
    }

    const loadFolders = async () => {
        try {
            const data = await window.electron.db.getFolders()
            setFolders(data || [])
        } catch (e) { console.error('Failed to load folders:', e) }
    }

    const handleCreateFolder = async (name: string) => {
        try {
            await window.electron.db.createFolder(name)
            loadFolders()
        } catch (e) { console.error(e) }
    }

    const handleDeleteFolder = async (id: string) => {
        if (!confirm('Klasörü silmek istediğinize emin misiniz? Sohbetler silinmeyecek, ana listeye taşınacak.')) return
        try {
            await window.electron.db.deleteFolder(id)
            loadFolders()
            loadChats()
        } catch (e) { console.error(e) }
    }

    const handleUpdateFolder = async (id: string, name: string) => {
        try {
            await window.electron.db.updateFolder(id, name)
            loadFolders()
        } catch (e) { console.error(e) }
    }

    const handleMoveChatToFolder = async (chatId: string, folderId: string | null) => {
        try {
            await window.electron.db.updateChat(chatId, { folderId })
            loadChats()
        } catch (e) { console.error(e) }
    }

    const loadModels = async (attempt: number = 0) => {
        try {
            const settings = await window.electron.getSettings()
            const modelList = await window.electron.getModels()
            const normalizedModels = Array.isArray(modelList) ? modelList : (modelList as any)?.models || []
            const finalModels = [...normalizedModels]
            if (settings.openai?.apiKey) {
                finalModels.push(...[{ name: 'gpt-3.5-turbo' }, { name: 'gpt-4' }, { name: 'gpt-4o' }, { name: 'gpt-4o-mini' }].map(m => ({ ...m, details: { parameter_size: '?' } } as any)))
            }
            setModels(finalModels)
            if (!selectedModel) {
                const preferred = settings?.general?.lastModel || settings?.general?.defaultModel
                if (preferred) {
                    setSelectedModel(preferred)
                    setSelectedProvider(inferProviderFromModel(preferred))
                } else if (finalModels.length > 0) {
                    setSelectedModel(finalModels[0].name)
                }
            }
            let hasProxyModels = false
            try {
                const pRes: any = await window.electron.getProxyModels()
                const pModels = Array.isArray(pRes) ? pRes : (pRes?.data || pRes?.models || [])
                setProxyModels(pModels)
                if (pModels.length > 0) hasProxyModels = true
            } catch (e) { console.error('Failed to load proxy models:', e) }
            if (attempt < 3 && (normalizedModels.length === 0 || !hasProxyModels)) {
                setTimeout(() => loadModels(attempt + 1), 1200)
            }
        } catch (error) { console.error('Failed to load models:', error) }
    }

    useEffect(() => {
        if (currentChatId) loadMessages(currentChatId)
    }, [currentChatId])

    const loadMessages = async (chatId: string) => {
        try {
            let chat = chats.find(c => c.id === chatId)
            if (!chat) {
                try {
                    const dbChat = await window.electron.db.getChat(chatId)
                    if (dbChat) chat = dbChat
                } catch (e) { console.error('Failed to load chat metadata:', e) }
            }
            const fallbackModel = chat?.model
            const fallbackProvider = chat?.backend
            const dbMessages = await window.electron.db.getMessages(chatId)
            const uiMessages: Message[] = dbMessages.map(m => ({
                id: m.id,
                role: m.role as any,
                content: m.content,
                toolCalls: m.toolCalls ? JSON.parse(m.toolCalls) : undefined,
                toolResults: m.toolResults ? JSON.parse(m.toolResults) : undefined,
                timestamp: new Date(m.timestamp),
                provider: m.provider || fallbackProvider,
                model: m.model || fallbackModel
            }))
            setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: uiMessages } : c))

            // Sync global selection with current chat
            if (chat?.model) setSelectedModel(chat.model)
            if (chat?.backend) setSelectedProvider(chat.backend as any)
        } catch (error) { console.error('Failed to load messages:', error) }
    }

    const createNewChat = useCallback(() => {
        setCurrentView('chat')
        setCurrentChatId(null)
        setInput('')
        setAttachments([])
        setStreamingContent('')

        // Reset to default model on new chat
        if (appSettings?.general?.defaultModel) {
            const def = appSettings.general.defaultModel
            setSelectedModel(def)
            setSelectedProvider(inferProviderFromModel(def))
        }
    }, [appSettings])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.metaKey || e.ctrlKey) {
                if (e.key === 'k') { e.preventDefault(); setShowCommandPalette(prev => !prev) }
                if (e.key === 'n') { e.preventDefault(); createNewChat() }
                if (e.key === ',') { e.preventDefault(); setCurrentView('settings') }
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [createNewChat])

    const stopGeneration = async () => {
        try { await window.electron.abortChat(); setIsLoading(false); setStreamingContent('') } catch (e) { console.error(e) }
    }

    useEffect(() => {
        if (!isLoading && messageQueue.length > 0) {
            const next = messageQueue[0]; setMessageQueue(prev => prev.slice(1)); sendMessage(next)
        }
    }, [isLoading, messageQueue])


    const formatChatError = (err: unknown) => {
        const raw = err instanceof Error ? err.message : String(err); const lower = raw.toLowerCase()
        if (lower.includes('und_err_headers_timeout') || lower.includes('headers timeout')) return 'Sunucudan yanit gec geliyor. Lutfen tekrar deneyin.'
        if (lower.includes('econnrefused')) return 'Proxy baglantisi reddedildi. Proxy calisiyor mu?'
        if (lower.includes('openai api key is not set')) return 'API anahtari eksik.'
        if (lower.includes('invalid api key')) return 'API anahtari gecersiz.'
        if (lower.includes('instructions are required')) return 'Model yanit uretmedi. Tekrar deneyin.'
        if (lower.includes('access denied')) return 'Erisim reddedildi.'
        if (lower.includes('fetch failed')) return 'Ag hatasi: sunucuya ulasilamadi.'
        if (lower.includes('429')) return raw
        return raw
    }

    async function generateResponse(chatId: string, model: string, history: any[], provider: string) {
        setIsLoading(true); setStreamingContent('')
        try {
            const systemPrompt = getSystemPrompt(language, selectedPersona?.prompt)
            const all = [{ role: 'system', content: systemPrompt }, ...history]
            let full = ''
            const listener = (chunk: string) => { full += chunk; setStreamingContent(full) }
            window.electron.onStreamChunk(listener)
            let res; let tools: any[] = []
            try { tools = await window.electron.getToolDefinitions() } catch (e) { console.error(e) }
            const normalizedModel = String(model || '').trim().replace(/[–—−]/g, '-').toLowerCase()
            const normalizedProvider = (provider || inferProviderFromModel(model)).toLowerCase()
            const shouldUseProxy = normalizedProvider !== 'ollama' || /^(gpt-|copilot-|claude-|gemini-|o1-|grok-)/.test(normalizedModel)
            if (shouldUseProxy) res = await window.electron.chatOpenAI(all, model, tools, provider)
            else res = await window.electron.chatStream(all, model, tools)
            window.electron.removeStreamChunkListener(listener)
            if (res?.error) throw new Error(res.error)
            const completionTokens = typeof res?.completionTokens === 'number' ? res.completionTokens : undefined
            const reasoningContent = typeof res?.reasoning_content === 'string' ? res.reasoning_content : ''
            const mainContent = res?.content || full || ''
            const combinedContent = reasoningContent ? `<think>${reasoningContent}</think>\n\n${mainContent}`.trim() : mainContent
            const rawToolCalls = Array.isArray(res?.tool_calls) ? res.tool_calls : []
            const calls = rawToolCalls.map((tc: any) => {
                const fn = tc.function || {}; const id = tc.id || tc.call_id || generateId()
                const name = fn.name || tc.name || tc.tool?.name || ''
                let args: any = {}
                try { args = typeof fn.arguments === 'string' ? JSON.parse(fn.arguments) : (fn.arguments || tc.arguments || {}) } catch { args = { raw: fn.arguments } }
                return { id, name, arguments: args }
            }).filter((tc: any) => !!tc.name)
            const assistantId = generateId(); const assistantTs = Date.now()
            const assistantMsg: Message = { id: assistantId, role: 'assistant', content: combinedContent, timestamp: new Date(assistantTs), toolCalls: calls.length > 0 ? calls : undefined, toolResults: [], provider, model }
            setChats(prev => prev.map(c => {
                if (c.id === chatId) {
                    let title = c.title
                    if (c.messages.length <= 1 && assistantMsg.content) title = assistantMsg.content.split('\n')[0].replace(/[#*`]/g, '').trim().slice(0, 50) || 'Yeni Sohbet'
                    return { ...c, title, messages: [...c.messages, assistantMsg] }
                }
                return c
            }))
            const results: ToolResult[] = []; let followupRes = res; let followupMessages: any[] | null = null
            if (calls.length > 0) {
                const toolMessages: any[] = []
                for (const call of calls) {
                    try {
                        const r = await window.electron.executeTools(call.name, call.arguments, call.id)
                        const tr: ToolResult = { toolCallId: call.id, name: call.name, result: r, isImage: call.name === 'capture_screenshot' && r.image }
                        results.push(tr); toolMessages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(r) })
                    } catch (e) {
                        const err = { error: String(e) }; results.push({ toolCallId: call.id, name: call.name, result: err })
                        toolMessages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(err) })
                    }
                    setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: c.messages.map(m => m.id === assistantId ? { ...m, toolResults: [...results] } : m) } : c))
                }
                if (toolMessages.length > 0) {
                    const assistantToolMessage = { role: 'assistant', content: null, tool_calls: rawToolCalls }
                    followupMessages = [...all, assistantToolMessage, ...toolMessages]
                    followupRes = await window.electron.chatOpenAI(followupMessages, model, tools, provider)
                }
            }
            await window.electron.db.addMessage({ id: assistantId, chatId, role: 'assistant', content: assistantMsg.content, timestamp: assistantTs, toolCalls: calls.length > 0 ? JSON.stringify(calls) : undefined, toolResults: results.length > 0 ? JSON.stringify(results) : undefined, completionTokens, provider, model })
            if (calls.length > 0) {
                let followReasoning = typeof followupRes?.reasoning_content === 'string' ? followupRes.reasoning_content : ''
                let followContent = (followupRes?.content || '').trim()
                if (!followContent && followupMessages) {
                    try {
                        const finalRes = await window.electron.chatOpenAI([...followupMessages, { role: 'user', content: 'Final response please.' }], model, [], provider)
                        followContent = finalRes?.content || ''; if (!followReasoning) followReasoning = finalRes?.reasoning_content || ''
                    } catch (e) { console.error(e) }
                }
                const followCombined = followReasoning ? `<think>${followReasoning}</think>\n\n${followContent}`.trim() : followContent
                if (followCombined) {
                    setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: c.messages.map(m => m.id === assistantId ? { ...m, content: followCombined } : m) } : c))
                    await window.electron.db.updateMessage(assistantId, { content: followCombined })
                }
            }
        } catch (e) {
            const errText = formatChatError(e); const err: Message = { id: generateId(), role: 'assistant', content: `Hata: ${errText}`, timestamp: new Date() }
            setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, err] } : c))
        } finally { setIsLoading(false); setStreamingContent('') }
    }

    async function sendMessage(content: string, images?: string[]) {
        if (!content.trim() && (!images || images.length === 0)) return
        if (!selectedModel) return
        if (isLoading) { if (!images || images.length === 0) setMessageQueue(prev => [...prev, content]); return }
        let chatId = currentChatId
        if (!chatId) {
            chatId = generateId(); const ts = Date.now(); const cdb = { id: chatId, title: content.slice(0, 50), model: selectedModel, backend: selectedProvider, createdAt: ts, updatedAt: ts }
            await window.electron.db.createChat(cdb); setChats(prev => [{ ...cdb, messages: [], createdAt: new Date(ts), updatedAt: new Date(ts) }, ...prev]); setCurrentChatId(chatId)
        }
        const ts = Date.now(); const userMsg: Message = { id: generateId(), role: 'user', content, images, timestamp: new Date(ts), provider: selectedProvider, model: selectedModel }
        await window.electron.db.addMessage({ ...userMsg, chatId, timestamp: ts, toolCalls: null, toolResults: null, provider: selectedProvider, model: selectedModel })
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, userMsg], title: c.messages.length === 0 ? content.slice(0, 50) : c.title } : c))
        const refChat = chats.find(c => c.id === chatId); const allMessages = [...(refChat?.messages || []), userMsg]
        const history = getSmartContext(allMessages); await generateResponse(chatId, selectedModel, history, selectedProvider)
    }

    const getSmartContext = (messages: Message[]) => {
        const pinned = messages.filter(m => m.isPinned); const others = messages.filter(m => !m.isPinned)
        const contextLimit = appSettings?.general?.contextMessageLimit ?? 50
        const recent = others.slice(-Math.max(0, contextLimit - pinned.length))
        const combined = [...pinned, ...recent].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        const unique = Array.from(new Map(combined.map(m => [m.id, m])).values())
        return unique.map(m => ({ role: m.role, content: m.content, images: m.images }))
    }

    const handleExportChat = async () => {
        if (!currentChatId) return
        try {
            const fullChat = await window.electron.db.getChat(currentChatId); const msgs = await window.electron.db.getMessages(currentChatId)
            let content = `# ${fullChat.title}\n\n_Exported on ${new Date().toLocaleString()}_\n\n---\n\n`
            content += msgs.map((m: any) => `### ${m.role.toUpperCase()} (${new Date(m.timestamp).toLocaleString()})\n\n${m.content}\n\n`).join('---\n\n')
            await window.electron.saveFile(content, `chat-export-${new Date().getTime()}.md`)
            setToasts(prev => [...prev, { id: generateId(), message: 'Sohbet dışa aktarıldı', type: 'success' }])
        } catch (e) { console.error(e) }
    }

    const allCommands: SlashCommand[] = [
        { id: 'new', label: 'Yeni Sohbet', description: 'Yeni başlatır', icon: <Eraser className="w-4 h-4" />, action: createNewChat },
        ...(!isWeb ? [{ id: 'ssh', label: 'SSH', icon: <TerminalSquare className="w-4 h-4" />, action: () => setShowSSHManager(true) }] : []),
        ...(appSettings?.personas || []).map((p: any) => ({
            id: `persona-${p.id}`, label: p.name, description: p.description, icon: <User className="w-4 h-4" />,
            action: () => { setSelectedPersona(p); setToasts(prev => [...prev, { id: generateId(), message: `${p.name} aktif`, type: 'success' }]) }
        })),
        { id: 'reset', label: 'Normal', icon: <Bot className="w-4 h-4" />, action: () => { setSelectedPersona(null); setToasts(prev => [...prev, { id: generateId(), message: `Normal mod`, type: 'info' }]) } }
    ]

    const handleDuplicateChat = async (id: string) => {
        const duplicated = await window.electron.db.duplicateChat(id)
        if (duplicated) { setChats([duplicated, ...chats]); setCurrentChatId(duplicated.id) }
    }

    const handleArchiveChat = async (id: string, isArchived: boolean) => {
        await window.electron.db.archiveChat(id, isArchived)
        setChats(chats.map(c => c.id === id ? { ...c, isArchived } : c))
    }

    const handleUpdateChatTitle = async (id: string, title: string) => {
        await window.electron.db.updateChat(id, { title })
        setChats(chats.map(c => c.id === id ? { ...c, title } : c))
    }

    return (
        <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden font-sans">
            {!isCompact && (
                <Sidebar
                    chats={chats}
                    currentChatId={currentChatId}
                    onSelectChat={setCurrentChatId}
                    onNewChat={createNewChat}
                    onDeleteChat={deleteChat}
                    onDuplicateChat={handleDuplicateChat}
                    onArchiveChat={handleArchiveChat}
                    onUpdateChatTitle={handleUpdateChatTitle}
                    onTogglePin={toggleChatPin}
                    folders={folders}
                    onCreateFolder={handleCreateFolder}
                    onDeleteFolder={handleDeleteFolder}
                    onUpdateFolder={handleUpdateFolder}
                    onMoveChat={handleMoveChatToFolder}
                    onToggleFavorite={toggleChatFavorite}
                    onOpenSettings={(cat: any) => { setCurrentView('settings'); if (cat) setSettingsCategory(cat) }}
                    isCollapsed={isSidebarCollapsed}
                    toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    currentView={currentView}
                    onChangeView={setCurrentView}
                    activeProject={selectedProject}
                    settingsCategory={settingsCategory}
                    onSelectSettingsCategory={setSettingsCategory}
                    onSearch={handleSearch}
                    language={language}
                />
            )}
            <div className="flex-1 flex flex-col min-w-0 relative z-10 bg-background">
                <header className="h-14 border-b border-white/5 flex items-center justify-between px-4 sm:px-6 bg-transparent z-40 select-none shrink-0" style={{ WebkitAppRegion: "drag" } as any}>
                    <div className="flex items-center gap-4" style={{ WebkitAppRegion: "no-drag" } as any}>
                        {isCompact && <button className="text-sm font-bold px-2.5 py-1 rounded-full border bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 transition-all duration-300" onClick={toggleCompact}>EXPAND</button>}
                    </div>
                    {sessionTokens.total > 0 && <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted/30 border border-border/50 text-sm"><span className="text-muted-foreground/60">Tokens:</span><span className="text-foreground/80 font-mono">{sessionTokens.total.toLocaleString()}</span></div>}
                    {currentView === 'chat' && currentChatId && (
                        <div className="flex items-center gap-1">
                            <button onClick={() => { const chat = chats.find(c => c.id === currentChatId); if (chat) toggleChatFavorite(chat.id, !chat.isFavorite) }} className={cn("p-2 hover:bg-white/5 rounded-full transition-colors", chats.find(c => c.id === currentChatId)?.isFavorite ? "text-yellow-400" : "text-muted-foreground/40 hover:text-foreground")}><Star className={cn("w-4 h-4", chats.find(c => c.id === currentChatId)?.isFavorite && "fill-current")} /></button>
                            <button onClick={handleExportChat} className="p-2 hover:bg-white/5 rounded-full transition-colors text-muted-foreground/40 hover:text-foreground"><Download className="w-4 h-4" /></button>
                        </div>
                    )}
                    {!isWeb && (
                        <div className="flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" } as any}>
                            <div className="flex gap-1.5"><button onClick={() => window.electron.minimize()} className="p-1 hover:bg-muted/20 rounded transition-colors text-muted-foreground/40 hover:text-foreground"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 12H4" /></svg></button><button onClick={() => window.electron.maximize()} className="p-1 hover:bg-muted/20 rounded transition-colors text-muted-foreground/40 hover:text-foreground"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4h16v16H4z" /></svg></button><button onClick={() => window.electron.close()} className="p-1 hover:bg-red-500/20 hover:text-red-500 rounded transition-colors text-muted-foreground/40"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg></button></div>
                        </div>
                    )}
                </header>
                <div className="flex-1 flex flex-col relative bg-transparent overflow-hidden" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
                    <AnimatePresence>{isDragging && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center border-4 border-dashed border-primary/30 m-6 rounded-[32px] overflow-hidden"><div className="absolute inset-0 bg-primary/5 animate-pulse" /><div className="relative text-center space-y-4"><div className="text-6xl mb-4">🏮</div><div className="text-2xl font-black tracking-tight text-foreground uppercase font-sans">Siparişi Bırakın</div><div className="text-muted-foreground/60 text-sm font-medium">Analiz için dosyaları merkeze gönderin.</div></div></motion.div>}</AnimatePresence>
                    <main className="flex-1 overflow-hidden relative">
                        <AnimatePresence mode="wait">
                            {currentView === 'chat' && (
                                <motion.div key="chat" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full flex flex-col">
                                    <div className="flex-1 overflow-y-auto p-0 flex flex-col scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
                                        {displayMessages.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center p-6 sm:p-8 text-center max-w-2xl mx-auto space-y-8">
                                                <div className="w-24 h-24 rounded-[2rem] bg-primary/10 flex items-center justify-center text-primary shadow-xl shadow-primary/5"><Box className="w-10 h-10" /></div>
                                                <div className="space-y-4"><h1 className="text-4xl font-bold tracking-tight text-white">{t('welcome.title')}</h1><p className="text-muted-foreground text-lg">{t('welcome.tagline')}</p></div>
                                            </div>
                                        ) : (
                                            <div className="max-w-4xl mx-auto w-full p-4 sm:p-6 space-y-8 min-h-full flex flex-col pt-8 sm:pt-12">
                                                {displayMessages.map((m, i) => <MessageBubble key={m.id} message={m} isLast={i === displayMessages.length - 1 && !streamingContent} isStreaming={isLoading && i === displayMessages.length - 1 && m.role === 'assistant'} language={language} />)}
                                                {showTypingIndicator && <MessageBubble message={{ id: 'typing-indicator', role: 'assistant', content: '', timestamp: new Date(), provider: selectedProvider, model: selectedModel }} isStreaming isLast language={language} />}
                                                {streamingContent && <MessageBubble message={{ id: 'streaming', role: 'assistant', content: streamingContent, timestamp: new Date() }} isStreaming isLast={true} language={language} />}
                                                <div ref={messagesEndRef} className="h-4" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4 sm:p-8 pt-2 max-w-4xl mx-auto w-full relative">
                                        <AnimatePresence>{attachments.length > 0 && <motion.div initial={{ opacity: 0, scale: 0.9, height: 0 }} animate={{ opacity: 1, scale: 1, height: 'auto' }} exit={{ opacity: 0, scale: 0.9, height: 0 }} className="flex gap-3 overflow-x-auto py-3 px-2 mb-3 no-scrollbar">{attachments.map((att, i) => <div key={i} className="relative group/att shrink-0"><div className="w-20 h-20 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden flex items-center justify-center relative shadow-xl">{att.type === 'image' ? <img src={att.preview} alt="preview" className="w-full h-full object-cover" /> : <div className="flex flex-col items-center gap-1"><FileText className="w-8 h-8 text-blue-400" /><div className="text-xs font-bold text-muted-foreground uppercase">{att.file.name.split('.').pop()}</div></div>}<button onClick={() => removeAttachment(i)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-sm opacity-0 group-hover/att:opacity-100 transition-all hover:scale-110 shadow-lg"><X className="w-3 h-3" /></button></div></div>)}</motion.div>}</AnimatePresence>
                                        <div className="relative flex items-end rounded-2xl bg-muted/20 border border-border transition-all duration-300 focus-within:bg-muted/40 focus-within:border-primary/30 shadow-sm group/input">
                                            <SlashMenu isOpen={input.startsWith('/')} onClose={() => { }} query={input.slice(1)} onSelect={(cmd: any) => { cmd.action(); setInput('') }} commands={allCommands} />
                                            <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                                            <div className="relative flex items-center p-2 pl-3 pb-3 gap-2">
                                                <ModelSelector selectedProvider={selectedProvider} selectedModel={selectedModel} onSelect={(provider: any, model) => { setSelectedProvider(provider as any); setSelectedModel(model); persistLastSelection(provider, model) }} settings={appSettings} localModels={models} proxyModels={proxyModels} />
                                                <button onClick={() => setShowFileMenu(!showFileMenu)} className="text-muted-foreground hover:text-primary transition-all p-2 hover:bg-primary/10 rounded-xl group/btn"><Paperclip className="w-5 h-5" /></button>
                                                <AnimatePresence>{showFileMenu && <motion.div initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 10 }} className="absolute bottom-full left-4 mb-4 bg-card border border-border rounded-2xl p-2 shadow-2xl z-50 min-w-[180px]"><button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground transition-all" onClick={() => { fileInputRef.current?.click(); setShowFileMenu(false) }}><ImageIcon className="w-4 h-4 text-emerald-400" />{t('attachments.image')}</button><button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground transition-all" onClick={() => { fileInputRef.current?.click(); setShowFileMenu(false) }}><FileText className="w-4 h-4 text-blue-400" />{t('attachments.document')}</button></motion.div>}</AnimatePresence>
                                            </div>
                                            <textarea ref={textareaRef} className="flex-1 bg-transparent border-none py-5 pl-0 pr-4 min-h-[60px] max-h-[300px] resize-none focus:ring-0 text-base leading-[1.6] scrollbar-hide placeholder:text-muted-foreground/30 outline-none text-foreground font-medium" placeholder={t('chat.placeholder')} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} onPaste={handlePaste} rows={1} style={{ height: 'auto', overflowY: input.split('\n').length > 10 ? 'auto' : 'hidden' }} />
                                            <div className="p-3 pr-4 flex items-end gap-3">
                                                <button onClick={isListening ? stopListening : startListening} className={cn("h-10 w-10 inline-flex items-center justify-center rounded-xl transition-all duration-300", isListening ? "bg-red-500 text-white animate-pulse" : "bg-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground")}>{isListening ? <div className="w-3 h-3 bg-white rounded-sm" /> : <Mic className="w-5 h-5" />}</button>
                                                <button onClick={() => (isLoading ? stopGeneration() : handleSend())} disabled={!isLoading && !input.trim()} className={cn("h-10 w-10 inline-flex items-center justify-center rounded-xl transition-all duration-300 shadow-sm", !isLoading && !input.trim() ? "bg-white/5 text-muted-foreground/30 cursor-not-allowed" : "bg-primary text-primary-foreground hover:bg-primary/90")}>{isLoading ? <div className="w-3 h-3 bg-white rounded-sm" /> : <Send className="w-5 h-5 ml-0.5" />}</button>
                                            </div>
                                        </div>
                                        <div className="text-sm text-center mt-4 text-muted-foreground/30 font-bold tracking-widest uppercase select-none">{t('welcome.title')}</div>
                                    </div>
                                </motion.div>
                            )}
                            {currentView === 'projects' && <motion.div key="projects" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full overflow-hidden"><ProjectsPage projects={projects} onRefresh={loadProjects} selectedProject={selectedProject} onSelectProject={setSelectedProject} language={language} /></motion.div>}
                            {currentView === 'settings' && <motion.div key="settings" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full overflow-hidden"><SettingsPage {...({ installedModels: models, proxyModels: proxyModels, onRefreshModels: loadModels, activeTab: settingsCategory, onTabChange: (tab: any) => setSettingsCategory(tab), onSettingsChange: setAppSettings } as any)} /></motion.div>}

                        </AnimatePresence>
                    </main>
                </div>
                <AnimatePresence>{showSSHManager && <SSHManager isOpen={showSSHManager} onClose={() => setShowSSHManager(false)} />}</AnimatePresence>
                <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">{toasts.map(t => <div key={t.id} className={cn("px-4 py-3 rounded-lg shadow-2xl border backdrop-blur-md animate-in slide-in-from-right-full duration-300 pointer-events-auto flex items-center gap-3 min-w-[240px]", t.type === 'success' ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : t.type === 'error' ? "bg-red-500/20 border-red-500/30 text-red-400" : "bg-zinc-800/80 border-white/10 text-white")}><span className="text-lg">{t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}</span><div className="text-sm font-medium">{t.message}</div><button onClick={() => setToasts(prev => prev.filter(toast => toast.id !== t.id))} className="ml-auto opacity-50 hover:opacity-100 transition-opacity">×</button></div>)}</div>
                <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} onNewChat={createNewChat} onOpenSettings={() => setCurrentView('settings')} onOpenSSHManager={() => setShowSSHManager(true)} onRefreshModels={loadModels} models={models} onSelectModel={setSelectedModel} selectedModel={selectedModel} />
            </div>
        </div>
    )
}
