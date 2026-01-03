import { useState, useEffect, useCallback, useRef } from 'react'
import { cn, generateId } from '@/lib/utils'
import { Sidebar } from './components/Sidebar'
import { MessageBubble } from './components/MessageBubble'
import { SSHManager } from './components/SSHManager'
import { SettingsModal } from './components/SettingsModal'
import { CommandPalette } from './components/CommandPalette'
import { useVoiceInput } from './hooks/useVoiceInput'
import { motion, AnimatePresence } from 'framer-motion'

import {
    Message,
    Chat,
    OllamaModel,
    Attachment,
    Toast,
    ToolResult
} from './types'


export default function App() {
    const [chats, setChats] = useState<Chat[]>([])
    const [attachments, setAttachments] = useState<Attachment[]>([])
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    // ...
    const [currentChatId, setCurrentChatId] = useState<string | null>(null)
    const [models, setModels] = useState<OllamaModel[]>([])
    const [selectedModel, setSelectedModel] = useState<string>('')
    const [isLoading, setIsLoading] = useState(false)
    const [streamingContent, setStreamingContent] = useState('')
    const [messageQueue, setMessageQueue] = useState<string[]>([])
    const [showSSHManager, setShowSSHManager] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [input, setInput] = useState('')
    const [toasts, setToasts] = useState<Toast[]>([])
    const [isCompact, setIsCompact] = useState(false)
    const [appSettings, setAppSettings] = useState<any>(null)
    const [showCommandPalette, setShowCommandPalette] = useState(false)
    const [sessionTokens, setSessionTokens] = useState({ prompt: 0, completion: 0, total: 0 })
    const [_hyperparams, _setHyperparams] = useState({ temperature: 0.7, topP: 0.9, topK: 40, repeatPenalty: 1.1 })
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const currentChat = chats.find(c => c.id === currentChatId)
    const messages = currentChat?.messages || []
    const isThinking = isLoading // Simplified thinking state

    // Scroll to bottom effect
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages.length, streamingContent])

    const loadAppSettings = async () => {
        try {
            const data = await window.electron.getSettings()
            setAppSettings(data)
        } catch (e) {
            console.error('Failed to load settings:', e)
        }
    }

    useEffect(() => {
        loadAppSettings()
    }, [])

    // Command Palette keyboard shortcut (Cmd+K / Ctrl+K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                setShowCommandPalette(prev => !prev)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    const toggleCompact = () => {
        const next = !isCompact
        setIsCompact(next)
        window.electron.toggleCompact(next)
    }

    const handleSend = async (textInput: string = input) => {
        if ((!textInput.trim() && attachments.length === 0) || isLoading || !currentChatId) return

        let finalContent = textInput.trim()
        const images: string[] = []

        // Process attachments
        for (const att of attachments) {
            if (att.type === 'text' && att.content) {
                finalContent += `\n\n--- Dosya: ${att.file.name} ---\n${att.content}\n--- Dosya Sonu ---`
            } else if (att.type === 'image' && att.preview) {
                // Remove data:image/xxx;base64, prefix
                const base64 = att.preview.split(',')[1]
                if (base64) images.push(base64)
            }
        }

        // Fallback for image-only
        if (!finalContent && images.length > 0) {
            finalContent = "Bu resim hakkında..."
        }

        await sendMessage(finalContent, images)

        setInput('')
        setAttachments([])
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    // --- File Handling ---
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        if (e.currentTarget === e.target) {
            setIsDragging(false)
        }
    }, [])

    const processFile = async (file: File) => {
        const isImage = file.type.startsWith('image/')
        const isText = file.type.startsWith('text/') ||
            file.name.endsWith('.ts') ||
            file.name.endsWith('.tsx') ||
            file.name.endsWith('.js') ||
            file.name.endsWith('.json') ||
            file.name.endsWith('.md') ||
            file.name.endsWith('.py') ||
            file.name.endsWith('.java') ||
            file.name.endsWith('.c') ||
            file.name.endsWith('.cpp')

        const isPdf = file.name.endsWith('.pdf')

        if (isPdf) {
            try {
                // Electron File object has path property
                const path = (file as any).path
                const result = await window.electron.readPdf(path)
                if (result.success && result.text) {
                    setAttachments(prev => [...prev, {
                        file,
                        type: 'text',
                        content: result.text
                    }])
                } else {
                    console.error('PDF parsing failed:', result.error)
                    alert(`PDF okunamadı: ${file.name}`)
                }
            } catch (error) {
                console.error('PDF error:', error)
            }
            return
        }

        if (isImage) {
            const reader = new FileReader()
            reader.onload = (e) => {
                setAttachments(prev => [...prev, {
                    file,
                    type: 'image',
                    preview: e.target?.result as string
                }])
            }
            reader.readAsDataURL(file)
        } else if (isText) {
            const reader = new FileReader()
            reader.onload = (e) => {
                setAttachments(prev => [...prev, {
                    file,
                    type: 'text',
                    content: e.target?.result as string
                }])
            }
            reader.readAsText(file)
        } else {
            alert(`Desteklenmeyen dosya türü: ${file.name}\nSadece resim, PDF ve metin dosyaları destekleniyor.`)
        }
    }

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)

        const files = Array.from(e.dataTransfer.files)
        files.forEach(processFile)
    }, [])

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            Array.from(e.target.files).forEach(processFile)
        }
        // Reset input so same file can be selected again
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index))
    }
    // ---------------------

    const handleVoiceResult = useCallback((text: string) => {
        setInput(prev => (prev + ' ' + text).trim())
    }, [])

    const { isListening, startListening, stopListening, isSupported } = useVoiceInput(handleVoiceResult)



    // Load chats on mount
    useEffect(() => {
        loadChats()
        loadModels()
    }, [])

    const loadChats = async () => {
        try {
            const dbChats = await window.electron.db.getAllChats()
            // Convert timestamp to Date for UI
            const uiChats: Chat[] = dbChats.map(c => ({
                ...c,
                messages: [], // Messages loaded on demand
                createdAt: new Date(c.createdAt),
                updatedAt: new Date(c.updatedAt)
            }))
            setChats(uiChats)

            // Restore last active chat if exists
            if (uiChats.length > 0 && !currentChatId) {
                setCurrentChatId(uiChats[0].id) // Most recent first
            }
        } catch (error) {
            console.error('Failed to load chats:', error)
        }
    }

    const deleteChat = async (id: string) => {
        if (!confirm('Bu sohbeti silmek istediğinize emin misiniz?')) return
        try {
            await window.electron.db.deleteChat(id)
            setChats(prev => prev.filter(c => c.id !== id))
            if (currentChatId === id) {
                setCurrentChatId(null)
            }
        } catch (error) {
            console.error('Failed to delete chat:', error)
        }
    }

    const toggleChatPin = async (id: string, isPinned: boolean) => {
        try {
            await window.electron.db.updateChat(id, { isPinned })
            // Reload to get correct sort order
            loadChats()
        } catch (error) {
            console.error('Failed to pin chat:', error)
        }
    }

    const loadModels = async () => {
        try {
            const settings = await window.electron.getSettings()
            const modelList = await window.electron.getModels()

            // Add OpenAI models if API key is present
            const finalModels = [...modelList]
            if (settings.openai?.apiKey) {
                const openaiModels = [
                    { name: 'gpt-3.5-turbo', details: { parameter_size: '20B' } },
                    { name: 'gpt-4', details: { parameter_size: '?' } },
                    { name: 'gpt-4o', details: { parameter_size: '?' } },
                    { name: 'gpt-4o-mini', details: { parameter_size: '?' } }
                ]
                finalModels.push(...openaiModels)
            }

            setModels(finalModels)
            if (finalModels.length > 0 && !selectedModel) {
                setSelectedModel(finalModels[0].name)
            }
        } catch (error) {
            console.error('Failed to load models:', error)
        }
    }

    // Load messages when chat changes
    useEffect(() => {
        if (currentChatId) {
            loadMessages(currentChatId)
        }
    }, [currentChatId])

    const loadMessages = async (chatId: string) => {
        try {
            const dbMessages = await window.electron.db.getMessages(chatId)
            const uiMessages: Message[] = dbMessages.map(m => ({
                id: m.id,
                role: m.role,
                content: m.content,
                toolCalls: m.toolCalls ? JSON.parse(m.toolCalls) : undefined,
                toolResults: m.toolResults ? JSON.parse(m.toolResults) : undefined,
                timestamp: new Date(m.timestamp)
            }))

            setChats(prev => prev.map(c =>
                c.id === chatId ? { ...c, messages: uiMessages } : c
            ))
        } catch (error) {
            console.error('Failed to load messages:', error)
        }
    }

    const createNewChat = useCallback(async () => {
        const newChat: Chat = {
            id: generateId(),
            title: 'Yeni Sohbet',
            messages: [],
            model: selectedModel, // Use the currently selected model
            createdAt: new Date(),
            backend: 'ollama',
            updatedAt: new Date()
        }

        try {
            await window.electron.db.createChat({
                id: newChat.id,
                title: newChat.title,
                model: newChat.model,
                backend: newChat.backend,
                createdAt: newChat.createdAt.getTime(),
                updatedAt: newChat.updatedAt?.getTime() || Date.now()
            })

            setChats(prev => [newChat, ...prev])
            setCurrentChatId(newChat.id)
        } catch (error) {
            console.error('Failed to create chat:', error)
        }
    }, [selectedModel])



    const stopGeneration = async () => {
        if (!isLoading) return
        try {
            await window.electron.abortChat()
            setIsLoading(false)
            setStreamingContent('')
        } catch (error) {
            console.error('Failed to abort chat:', error)
        }
    }

    // Process Queue Effect
    useEffect(() => {
        if (!isLoading && messageQueue.length > 0) {
            const nextMessage = messageQueue[0]
            setMessageQueue(prev => prev.slice(1))
            sendMessage(nextMessage)
        }
    }, [isLoading, messageQueue])

    const sendMessage = async (content: string, images?: string[]) => {
        console.log('[sendMessage] called with model:', selectedModel)

        if (!content.trim() && (!images || images.length === 0)) return
        if (!selectedModel) {
            console.error('[sendMessage] No model selected!')
            return
        }

        // If loading, queue the message
        if (isLoading) {
            // For now discard queue if images present as queue logic is string-only
            if (!images || images.length === 0) {
                setMessageQueue(prev => [...prev, content])
            }
            return
        }

        let chatId = currentChatId

        // Create chat if needed
        if (!chatId) {
            const newChatId = generateId()
            const timestamp = Date.now()
            const newChatDb = {
                id: newChatId,
                title: content.slice(0, 50),
                model: selectedModel,
                backend: 'ollama' as const,
                createdAt: timestamp,
                updatedAt: timestamp
            }

            try {
                await window.electron.db.createChat(newChatDb)
                const newChatUi: Chat = {
                    ...newChatDb,
                    messages: [],
                    createdAt: new Date(timestamp),
                    updatedAt: new Date(timestamp)
                }
                setChats(prev => [newChatUi, ...prev])
                chatId = newChatId
                setCurrentChatId(chatId)
            } catch (error) {
                console.error('Failed to create chat:', error)
                return
            }
        }

        // Add user message to UI and DB
        const timestamp = Date.now()
        const userMessage: Message = {
            id: generateId(),
            role: 'user',
            content,
            images,
            timestamp: new Date(timestamp)
        }

        try {
            await window.electron.db.addMessage({
                ...userMessage,
                chatId,
                timestamp,
                toolCalls: null,
                toolResults: null
            })

            setChats(prev => prev.map(chat =>
                chat.id === chatId
                    ? {
                        ...chat,
                        messages: [...chat.messages, userMessage],
                        title: chat.messages.length === 0 ? content.slice(0, 50) : chat.title
                    }
                    : chat
            ))

            // Update title if needed
            const currentChat = chats.find(c => c.id === chatId)
            if (currentChat && currentChat.messages.length === 0) {
                await window.electron.db.updateChat(chatId, { title: content.slice(0, 50) })
            }
        } catch (error) {
            console.error('Failed to save message:', error)
        }

        setIsLoading(true)
        setStreamingContent('')

        try {
            console.log('[Renderer] BEFORE getToolDefinitions')
            // Temporarily bypass tools to rule out hang
            const tools: any[] = [] // await window.electron.getToolDefinitions()
            console.log('[Renderer] Tools bypassed')

            const dbRefChat = chats.find(c => c.id === chatId)
            const chatMessages = [...(dbRefChat?.messages || []), userMessage].map(m => ({
                role: m.role,
                content: m.content,
                images: m.images
            }))

            const systemMessage = {
                role: 'system',
                content: `You are Orbit, an intelligent and capable OS Assistant with full access to the local system.

CAPABILITIES:
- File System: Read/Write/List/Search files (recursive) and calculate hashes.
- Terminal: Execute PowerShell/CMD commands.
- Web: Search the internet and analyze webpages.
- Vision: Analyze images and screen content.
- System: Monitor CPU/RAM usage, battery status, and OS information.
- Network: Check local/public IP, DNS lookups, and connectivity.
- Notifications: Send desktop notifications.

COMMUNICATION GUIDELINES:
1. **Language Adaptation:** STRICTLY respond in the same language as the user (Turkish or English).
2. **Style:** Be professional, concise, and helpful. Use Markdown (bold, lists, code blocks) to structure your answers for maximum readability.
3. **No Fluff:** Avoid starting with "As an AI..." or "Here is the answer". Go straight to the point.
4. **Conversational:** For greetings ("Nasılsın", "Merhaba"), be warm and natural. DO NOT use tools for simple chat.
5. **Planning:** For complex tasks, output a Plan in \`<plan>\` tags. Format as a Markdown task list (e.g. \` - [] Task name\`).
6. **Proactive Planning:** If a task involves multiple steps, proactively propose a plan or ask the user if they'd like one. Use the task list format.

TOOL USAGE PROTOCOL:
- Use tools ONLY when necessary to fulfill a request.
- If a task is complex, briefly outline your plan before executing tools.
- When running commands, provide a brief explanation of what the command does.`
            }

            const allMessages = [systemMessage, ...chatMessages]

            let fullContent = ''
            const streamListener = (chunk: string) => {
                fullContent += chunk
                setStreamingContent(fullContent)
            }
            window.electron.onStreamChunk(streamListener)

            // Call Appropriate Backend
            console.log('Starting chat with:', selectedModel)
            let response;

            // window.alert(`Debug: Calling service for ${selectedModel}`)

            if (selectedModel.startsWith('gpt-') ||
                selectedModel.startsWith('copilot-') ||
                selectedModel.startsWith('claude-') ||
                selectedModel.startsWith('gemini-') ||
                selectedModel.startsWith('o1-') ||
                selectedModel.startsWith('grok-')) {
                console.log('[Renderer] Calling window.electron.chatOpenAI...')
                response = await window.electron.chatOpenAI(allMessages, selectedModel)
            } else {
                console.log('[Renderer] Falling back to chatStream (Ollama) for model:', selectedModel)
                response = await window.electron.chatStream(allMessages, selectedModel, tools)
            }

            // window.alert(`Debug: Got response: ${JSON.stringify(response).slice(0, 100)}`)
            console.log('Chat finished, response:', response)

            // Explicitly check for IPC error response
            if (response && response.error) {
                throw new Error(response.error)
            }

            // Remove listener
            window.electron.removeStreamChunkListener(streamListener) // Fix: Pass the same listener reference

            let finalContent = response.content || fullContent || ''

            // Parse tool calls
            const toolCalls = (response.tool_calls || []).map((tc: any) => ({
                id: tc.id || generateId(),
                name: tc.function.name,
                arguments: typeof tc.function.arguments === 'string'
                    ? JSON.parse(tc.function.arguments)
                    : tc.function.arguments
            }))

            const assistantId = generateId()
            const assistantTimestamp = Date.now()

            const assistantMessage: Message = {
                id: assistantId,
                role: 'assistant',
                content: finalContent,
                timestamp: new Date(assistantTimestamp),
                toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                toolResults: []
            }

            // Update UI immediately
            setChats(prev => prev.map(chat => {
                if (chat.id === chatId) {
                    // Auto-title from first AI response
                    let newTitle = chat.title
                    if (chat.messages.length <= 1 && finalContent) {
                        const firstLine = finalContent.split('\n')[0].replace(/[#*`]/g, '').trim()
                        newTitle = firstLine.slice(0, 50) || 'Yeni Sohbet'
                    }
                    return { ...chat, title: newTitle, messages: [...chat.messages, assistantMessage] }
                }
                return chat
            }))

            // Update token count
            if (response.prompt_eval_count || response.eval_count) {
                setSessionTokens(prev => ({
                    prompt: prev.prompt + (response.prompt_eval_count || 0),
                    completion: prev.completion + (response.eval_count || 0),
                    total: prev.total + (response.prompt_eval_count || 0) + (response.eval_count || 0)
                }))
            }

            // Execute tools
            const results: ToolResult[] = []
            if (toolCalls.length > 0) {
                for (const toolCall of toolCalls) {
                    try {
                        console.log('Executing tool:', toolCall.name, toolCall.arguments)
                        const result = await window.electron.executeTools(toolCall.name, toolCall.arguments, toolCall.id)
                        console.log('Tool Result:', result)
                        const toolResult: ToolResult = {
                            toolCallId: toolCall.id,
                            name: toolCall.name,
                            result,
                            isImage: toolCall.name === 'capture_screenshot' && result.image
                        }
                        results.push(toolResult)
                    } catch (error) {
                        results.push({
                            toolCallId: toolCall.id,
                            name: toolCall.name,
                            result: { error: String(error) }
                        })
                    }

                    // Update UI (incremental)
                    setChats(prev => prev.map(chat =>
                        chat.id === chatId
                            ? {
                                ...chat,
                                messages: chat.messages.map(m =>
                                    m.id === assistantId
                                        ? { ...m, toolResults: [...results] }
                                        : m
                                )
                            }
                            : chat
                    ))
                }
            }

            // Save to DB
            // Save to DB
            await window.electron.db.addMessage({
                id: assistantId,
                chatId,
                role: 'assistant',
                content: finalContent,
                timestamp: assistantTimestamp,
                toolCalls: toolCalls.length > 0 ? JSON.stringify(toolCalls) : undefined,
                toolResults: results.length > 0 ? JSON.stringify(results) : undefined
            })

            // Smart Title Generation (Background)
            // If this is a new conversation or short enough, generate a title.
            const isNewChat = !chats.find(c => c.id === chatId) || chats.find(c => c.id === chatId)?.messages.length === 0

            // Allow title generation for the first few turns
            if (isNewChat || (currentChat?.messages.length || 0) < 4) {
                (async () => {
                    try {
                        console.log('Generating smart title...')
                        const titlePrompt = [
                            { role: 'system', content: 'Sen bir başlık üreticisisin. Verilen sohbet içeriğine uygun, konuşma diliyle aynı dilde (Türkçe ise Türkçe, İngilizce ise İngilizce), 3-5 kelimelik, kısa, net ve ilgi çekici bir başlık yaz. Sadece başlığı çıktı olarak ver.' },
                            { role: 'user', content: `Kullanıcı: ${content}\nAsistan: ${finalContent.slice(0, 200)}...` }
                        ]

                        // Use the same model
                        const titleResponse = await window.electron.chat(titlePrompt, selectedModel)

                        if (titleResponse && titleResponse.content) {
                            let newTitle = titleResponse.content.trim().replace(/^["']|["']$/g, '').replace(/\.$/, '')
                            if (newTitle.length > 50) newTitle = newTitle.slice(0, 50) + "..."
                            console.log('New Title Generated:', newTitle)

                            await window.electron.db.updateChat(chatId!, { title: newTitle })
                            setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: newTitle } : c))
                        }
                    } catch (err) {
                        console.error('Smart title failed:', err)
                    }
                })()
            }

        } catch (error) {
            console.error('Chat error:', error)

            // Restore Error Message Display
            const errorMessage: Message = {
                id: generateId(),
                role: 'assistant',
                content: `❌ Hata oluştu: ${error instanceof Error ? error.message : String(error)}`,
                timestamp: new Date()
            }

            setChats(prev => prev.map(chat =>
                chat.id === chatId
                    ? { ...chat, messages: [...chat.messages, errorMessage] }
                    : chat
            ))
        } finally {
            setIsLoading(false)
            setStreamingContent('')
        }

    }

    return (
        <div className="flex flex-col flex-1 relative z-10">
            {/* Custom Titlebar / Top Bar */}
            <header
                className="h-12 border-b border-white/5 flex items-center justify-between px-6 bg-black/20 backdrop-blur-md z-40 select-none"
                style={{ WebkitAppRegion: "drag" } as any}
            >
                <div className="flex items-center gap-4" style={{ WebkitAppRegion: "no-drag" } as any}>
                    <div className="flex items-center gap-2">
                        <img src="./src/renderer/assets/logo.png" alt="Orbit" className="w-5 h-5 object-contain" />
                        <span className="text-xs font-bold tracking-widest text-foreground/80 uppercase">Orbit</span>
                    </div>
                    <button
                        className={cn(
                            "text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all duration-300",
                            isCompact ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10 hover:text-foreground"
                        )}
                        onClick={toggleCompact}
                    >
                        {isCompact ? "EX-PANSE" : "COMPACT"}
                    </button>
                    </div>

                    {/* Token Counter */}
                    {sessionTokens.total > 0 && (
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px]">
                            <span className="text-muted-foreground/60">Tokens:</span>
                            <span className="text-foreground/80 font-mono">{sessionTokens.total.toLocaleString()}</span>
                        </div>
                    )}

                    <div className="flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" } as any}>
                        <div className="flex gap-1.5 titlebar-controls">
                            <button onClick={() => window.electron.minimize()} className="p-1 hover:bg-white/5 rounded transition-colors text-muted-foreground/40 hover:text-foreground">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 12H4" /></svg>
                            </button>
                            <button onClick={() => window.electron.maximize()} className="p-1 hover:bg-white/5 rounded transition-colors text-muted-foreground/40 hover:text-foreground">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4h16v16H4z" /></svg>
                            </button>
                            <button onClick={() => window.electron.close()} className="p-1 hover:bg-red-500/20 hover:text-red-500 rounded transition-colors text-muted-foreground/40">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    </div>
                </header>

                <div className="flex flex-1 overflow-hidden">
                    {!isCompact && (
                        <Sidebar
                            chats={chats}
                            currentChatId={currentChatId}
                            models={models}
                            selectedModel={selectedModel}
                            onSelectChat={setCurrentChatId}
                            onNewChat={createNewChat}
                            onDeleteChat={deleteChat}
                            onTogglePin={toggleChatPin}
                            onSelectModel={setSelectedModel}
                            onRefreshModels={loadModels}
                            onOpenSSHManager={() => setShowSSHManager(true)}
                            onOpenSettings={() => setShowSettings(true)}
                        />
                    )}

                    <div
                        className="flex-1 flex flex-col relative bg-transparent overflow-hidden"
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        {/* Assistant Drag Overlay */}
                        <AnimatePresence>
                            {isDragging && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 z-50 bg-[#020617]/80 backdrop-blur-md flex items-center justify-center border-4 border-dashed border-primary/30 m-6 rounded-[32px] overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-primary/5 animate-pulse" />
                                    <div className="relative text-center space-y-4">
                                        <div className="text-6xl mb-4">🏮</div>
                                        <div className="text-2xl font-black tracking-tight text-white uppercase font-sans">Siparişi Bırakın</div>
                                        <div className="text-muted-foreground/60 text-sm font-medium">Analiz için dosyaları merkeze gönderin.</div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Chat Area */}
                        <div className="flex-1 overflow-y-auto p-0 flex flex-col scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
                            {messages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center p-8 text-center max-w-2xl mx-auto space-y-12">
                                    <motion.div
                                        initial={{ scale: 0.8, opacity: 0, rotate: -10 }}
                                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                                        transition={{ duration: 1, type: "spring", bounce: 0.4 }}
                                        className="relative"
                                    >
                                        <div className="absolute inset-0 bg-primary/30 blur-3xl rounded-full" />
                                        <div className="relative w-32 h-32 rounded-[32px] bg-gradient-to-br from-primary via-indigo-600 to-purple-700 flex items-center justify-center text-5xl shadow-[0_20px_50px_rgba(var(--primary),0.3)] border border-white/20">
                                            🧊
                                        </div>
                                    </motion.div>
                                    <div className="space-y-4">
                                        <h1 className="text-6xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/30 leading-none">
                                            Orbit AI
                                        </h1>
                                        <p className="text-muted-foreground/40 text-xl font-medium max-w-md mx-auto">
                                            Zeka ve zarafetin buluştuğu noktada, bir sonraki adımınızı birlikte planlayalım.
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 w-full mt-12">
                                        {[
                                            { icon: '⚡', title: 'Hızlı Prototip', desc: 'Kod ve yapı oluştur' },
                                            { icon: '🔎', title: 'Derin Analiz', desc: 'Metinleri çözümle' },
                                            { icon: '🧬', title: 'Yaratıcı Gen', desc: 'Yeni fikirler türet' },
                                            { icon: '🛰️', title: 'Sistem Kontrol', desc: 'Donanımı yönet' }
                                        ].map((item, i) => (
                                            <motion.button
                                                key={i}
                                                whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.03)' }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => setInput(item.title)}
                                                className="bg-white/[0.02] border border-white/5 p-5 text-left rounded-3xl transition-all flex flex-col gap-1 group"
                                            >
                                                <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">{item.icon}</span>
                                                <span className="text-[14px] font-bold text-foreground/80 tracking-tight">{item.title}</span>
                                                <span className="text-[10px] text-muted-foreground/30 font-bold uppercase tracking-widest">{item.desc}</span>
                                            </motion.button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className={cn("mx-auto py-12 space-y-12 h-fit", isCompact ? "px-6 max-w-full" : "px-8 max-w-4xl")}>
                                    <AnimatePresence initial={false} mode="popLayout">
                                        {messages.map((msg, index) => (
                                            <motion.div
                                                key={msg.id || index}
                                                initial={{ opacity: 0, y: 30, scale: 0.98 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                                            >
                                                <MessageBubble
                                                    message={msg}
                                                    isLast={index === messages.length - 1}
                                                    userAvatar={appSettings?.userAvatar}
                                                    aiAvatar={appSettings?.aiAvatar}
                                                />
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                    {isThinking && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="flex gap-5 px-6 items-center"
                                        >
                                            <div className="relative w-10 h-10">
                                                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                                                <div className="relative w-full h-full rounded-full border-2 border-primary/20 flex items-center justify-center overflow-hidden">
                                                    <div className="absolute inset-0 bg-gradient-to-t from-primary/40 to-transparent animate-[spin_3s_linear_infinite]" />
                                                    <div className="relative w-7 h-7 bg-[#020617] rounded-full flex items-center justify-center">
                                                        <div className="w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary),0.8)]" />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" />
                                                <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0.1s' }} />
                                                <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0.2s' }} />
                                            </div>
                                        </motion.div>
                                    )}
                                    <div ref={messagesEndRef} className="h-4" />
                                </div>
                            )}
                        </div>

                        {/* Input Area */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn("p-6 bg-transparent z-10 transition-all duration-300", isCompact ? "pb-6" : "pb-12")}
                        >
                            <div className={cn("mx-auto relative group transition-all duration-500", isCompact ? "max-w-full" : "max-w-3xl")}>

                                {/* Attachments Preview */}
                                <AnimatePresence>
                                    {attachments.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.9, height: 0 }}
                                            animate={{ opacity: 1, scale: 1, height: 'auto' }}
                                            exit={{ opacity: 0, scale: 0.9, height: 0 }}
                                            className="flex gap-3 overflow-x-auto py-3 px-2 mb-3 no-scrollbar"
                                        >
                                            {attachments.map((att, i) => (
                                                <div key={i} className="relative group/att shrink-0">
                                                    <div className="w-20 h-20 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden flex items-center justify-center relative shadow-xl">
                                                        {att.type === 'image' ? (
                                                            <img src={att.preview} alt="preview" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="flex flex-col items-center gap-1">
                                                                <div className="text-2xl">📄</div>
                                                                <div className="text-[8px] font-bold text-muted-foreground uppercase">{att.file.name.split('.').pop()}</div>
                                                            </div>
                                                        )}
                                                        <button
                                                            onClick={() => removeAttachment(i)}
                                                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[12px] opacity-0 group-hover/att:opacity-100 transition-all hover:scale-110 shadow-lg"
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="relative flex items-end rounded-[28px] bg-white/5 backdrop-blur-2xl border border-white/10 shadow-2xl transition-all duration-500 focus-within:bg-white/[0.08] focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10 overflow-hidden group/input">
                                    <input
                                        type="file"
                                        multiple
                                        className="hidden"
                                        ref={fileInputRef}
                                        onChange={handleFileSelect}
                                    />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="absolute left-3.5 bottom-3.5 text-muted-foreground/60 hover:text-primary transition-all p-2 hover:bg-primary/10 rounded-full group/btn"
                                        title="Dosya Ekle"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 group-hover/btn:rotate-12 transition-transform"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                                    </button>

                                    <textarea
                                        ref={textareaRef}
                                        className="flex-1 bg-transparent border-none py-5 pl-14 pr-4 min-h-[60px] max-h-[300px] resize-none focus:ring-0 text-[16px] leading-[1.6] scrollbar-hide placeholder:text-muted-foreground/30 outline-none text-foreground disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                                        placeholder="Her şeyi sorun..."
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        rows={1}
                                        disabled={isLoading}
                                        style={{
                                            height: 'auto',
                                            overflowY: input.split('\n').length > 10 ? 'auto' : 'hidden'
                                        }}
                                    />
                                    <div className="p-3 pr-4 flex items-end gap-3">
                                        {isSupported && (
                                            <button
                                                onClick={isListening ? stopListening : startListening}
                                                className={cn(
                                                    "h-10 w-10 inline-flex items-center justify-center rounded-full transition-all duration-300",
                                                    isListening
                                                        ? "bg-red-500 text-white animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.5)]"
                                                        : "bg-white/5 text-muted-foreground/60 hover:bg-white/10 hover:text-foreground border border-white/5"
                                                )}
                                            >
                                                {isListening ? (
                                                    <div className="w-3 h-3 bg-white rounded-sm" />
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                                                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                                        <line x1="12" y1="19" x2="12" y2="23" />
                                                        <line x1="8" y1="23" x2="16" y2="23" />
                                                    </svg>
                                                )}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleSend()}
                                            disabled={!input.trim() && !isLoading}
                                            className={cn(
                                                "h-10 w-10 inline-flex items-center justify-center rounded-full transition-all duration-300 shadow-lg",
                                                !input.trim() && !isLoading
                                                    ? "bg-white/5 text-muted-foreground/30 cursor-not-allowed"
                                                    : "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 active:scale-95 shadow-primary/20"
                                            )}
                                        >
                                            {isLoading && !input.trim() ? (
                                                <div onClick={(e) => { e.stopPropagation(); stopGeneration(); }}>
                                                    <span className="font-bold text-sm">■</span>
                                                </div>
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 ml-0.5"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                                            )}
                                        </button>
                                    </div>
                                </div>
                                <div className="text-[10px] text-center mt-4 text-muted-foreground/30 font-bold tracking-widest uppercase select-none">
                                    Orbit • Your Personal AI Assistant
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>

                <AnimatePresence>
                    {showSSHManager && (
                        <SSHManager
                            isOpen={showSSHManager}
                            onClose={() => setShowSSHManager(false)}
                        />
                    )}

                    {showSettings && (
                        <SettingsModal
                            isOpen={showSettings}
                            onClose={() => { setShowSettings(false); loadAppSettings(); }}
                            installedModels={models}
                            onRefreshModels={loadModels}
                        />
                    )}
                </AnimatePresence>

                {/* Toast Container */}
                <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
                    {toasts.map(toast => (
                        <div
                            key={toast.id}
                            className={cn(
                                "px-4 py-3 rounded-lg shadow-2xl border backdrop-blur-md animate-in slide-in-from-right-full duration-300 pointer-events-auto flex items-center gap-3 min-w-[240px]",
                                toast.type === 'success' ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" :
                                    toast.type === 'error' ? "bg-red-500/20 border-red-500/30 text-red-400" :
                                        "bg-zinc-800/80 border-white/10 text-white"
                            )}
                        >
                            <span className="text-lg">
                                {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}
                            </span>
                            <div className="text-sm font-medium">{toast.message}</div>
                            <button
                                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                                className="ml-auto opacity-50 hover:opacity-100 transition-opacity"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>

                {/* Command Palette */}
                <CommandPalette
                    isOpen={showCommandPalette}
                    onClose={() => setShowCommandPalette(false)}
                    onNewChat={createNewChat}
                    onOpenSettings={() => setShowSettings(true)}
                    onOpenSSHManager={() => setShowSSHManager(true)}
                    onRefreshModels={loadModels}
                    models={models}
                    onSelectModel={setSelectedModel}
                    selectedModel={selectedModel}
                />
            </div>
    )
}
