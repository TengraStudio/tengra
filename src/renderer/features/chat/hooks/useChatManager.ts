import { useState, useEffect, useMemo } from 'react'
import { generateId } from '@/lib/utils'
import { chatStream } from '@/lib/chat-stream'
import { getSystemPrompt } from '@/lib/identity'
import { Chat, Message, Folder, Prompt, AppSettings, Attachment, ToolDefinition } from '@/types'
import { CatchError, IpcValue } from '../../../../shared/types/common'

type SpeechRecognitionResultLike = { isFinal: boolean; 0: { transcript: string } }
type SpeechRecognitionResultListLike = { length: number;[index: number]: SpeechRecognitionResultLike }
type SpeechRecognitionEventLike = { resultIndex: number; results: SpeechRecognitionResultListLike }
type SpeechRecognitionErrorEventLike = { error: string }

interface SpeechRecognitionLike {
    continuous: boolean
    interimResults: boolean
    lang: string
    onresult: ((event: SpeechRecognitionEventLike) => void) | null
    onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
    onend: (() => void) | null
    start: () => void
    stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

declare global {
    interface Window {
        SpeechRecognition?: SpeechRecognitionConstructor
        webkitSpeechRecognition?: SpeechRecognitionConstructor
        _activeRecognition?: SpeechRecognitionLike
    }
}

interface UseChatManagerOptions {
    selectedModel: string
    selectedProvider: string
    language: string
    selectedPersona?: { id: string, name: string, description: string, prompt: string } | null
    appSettings?: AppSettings
    autoReadEnabled: boolean
    handleSpeak: (id: string, text: string) => void
    formatChatError: (err: CatchError) => string
    t: (key: string) => string
    activeWorkspacePath?: string
    projectId?: string
}

export function useChatManager(options: UseChatManagerOptions) {
    const {
        selectedModel,
        selectedProvider,
        language,
        selectedPersona,
        appSettings,
        autoReadEnabled,
        handleSpeak,
        formatChatError,
        t
    } = options

    const [chats, setChats] = useState<Chat[]>([])
    const [currentChatId, setCurrentChatId] = useState<string | null>(null)
    const [isListening, setIsListeningActive] = useState<boolean>(false)
    const [streamingStates, setStreamingStates] = useState<Record<string, { content: string, reasoning: string, speed: number | null }>>({})
    const [searchTerm, setSearchTerm] = useState('')
    const [input, setInput] = useState('')
    const [folders, setFolders] = useState<Folder[]>([])
    const [prompts, setPrompts] = useState<Prompt[]>([])
    const [contextTokens] = useState(0)

    const streamingContent = useMemo(() => currentChatId ? streamingStates[currentChatId]?.content || '' : '', [currentChatId, streamingStates])
    const streamingReasoning = useMemo(() => currentChatId ? streamingStates[currentChatId]?.reasoning || '' : '', [currentChatId, streamingStates])
    const streamingSpeed = useMemo(() => currentChatId ? streamingStates[currentChatId]?.speed || null : null, [currentChatId, streamingStates])

    const currentChat = chats.find(c => c.id === currentChatId)
    const isLoading = useMemo(() => {
        if (!currentChatId) return false
        return !!currentChat?.isGenerating || !!streamingStates[currentChatId]
    }, [currentChatId, currentChat?.isGenerating, streamingStates])

    const messages = useMemo(() => currentChat?.messages || [], [currentChat])

    const displayMessages = useMemo(() => {
        if (!searchTerm) return messages
        return messages.filter(m => {
            const content = typeof m.content === 'string' ? m.content : ''
            return content.toLowerCase().includes(searchTerm.toLowerCase())
        })
    }, [messages, searchTerm])

    // Load initial chats and folders
    useEffect(() => {
        const load = async () => {
            const allChats = await window.electron.db.getAllChats()
            // Load messages for each chat
            const chatsWithMessages = await Promise.all(
                (allChats as Chat[]).map(async (chat) => {
                    try {
                        const messages = await window.electron.db.getMessages(chat.id)
                        return { ...chat, messages: (messages || []) as Message[] }
                    } catch (error) {
                        console.error(`Failed to load messages for chat ${chat.id}:`, error)
                        return { ...chat, messages: [] }
                    }
                })
            )
            setChats(chatsWithMessages)
            const allFolders = await window.electron.db.getFolders()
            setFolders(allFolders as Folder[])
            const allPrompts = await window.electron.db.getPrompts()
            setPrompts(allPrompts as Prompt[])
        }
        load()

        const removeStatusListener = window.electron.on('chat:generation-status', (_event, ...args: IpcValue[]) => {
            const data = (args[0] && typeof args[0] === 'object') ? args[0] as { chatId?: string; isGenerating?: boolean } : {}
            setChats(prev => prev.map(c => c.id === data.chatId ? { ...c, isGenerating: data.isGenerating } : c))
        })
        return () => removeStatusListener()
    }, [])

    const getSmartContext = (messages: Message[]) => {
        return messages.slice(-15) // Simple context window for now
    }

    const generateResponse = async (chatId: string, userMessage: Message, retryModel?: string) => {
        // Initialize streaming state for this chat
        setStreamingStates(prev => ({ ...prev, [chatId]: { content: '', reasoning: '', speed: null } }))

        const assistantId = generateId()
        let finalContent = ''
        let finalReasoning = ''

        try {
            const allTools: ToolDefinition[] = await window.electron.getToolDefinitions()
            const tools = allTools.filter((t) =>
                t.function.name === 'generate_image' && selectedProvider === 'antigravity'
            )

            const dbRefChat = chats.find(c => c.id === chatId)
            const smartContext = getSmartContext([...(dbRefChat?.messages || []), userMessage])

            const chatMessages = smartContext.map((msg: Message) => {
                let content = msg.content
                const text = typeof msg.content === 'string' ? msg.content : ''

                if (msg.images && msg.images.length > 0) {
                    const contentParts: Array<{ type: string, text?: string, image_url?: { url: string } }> = []
                    if (text) contentParts.push({ type: 'text', text })
                    for (const img of msg.images) contentParts.push({ type: 'image_url', image_url: { url: img } })
                    content = contentParts
                }
                return { ...msg, content }
            })
            const activeModel = retryModel || selectedModel
            const currentProvider = selectedProvider

            const modelSettings = appSettings?.modelSettings || {}
            const modelConfig = modelSettings[selectedModel] || {}
            const systemPrompt = modelConfig.systemPrompt || getSystemPrompt(language as 'tr' | 'en', selectedPersona?.prompt, selectedProvider, activeModel)
            const systemMessage: Message = { role: 'system', content: systemPrompt, id: generateId(), timestamp: new Date() }
            const allMessages = [systemMessage, ...chatMessages]

            const modelPresets = appSettings?.presets || []
            const preset = modelPresets.find((p) => p.id === modelConfig.presetId)
            const presetOptions = preset ? {
                temperature: preset.temperature,
                top_p: preset.topP,
                frequency_penalty: preset.frequencyPenalty,
                presence_penalty: preset.presencePenalty,
                max_tokens: preset.maxTokens
            } : {}

            const requestStartTime = performance.now()
            const fullOptions = { ...presetOptions, projectRoot: options.activeWorkspacePath }
            const stream = chatStream(allMessages, activeModel, tools, currentProvider, fullOptions, chatId, options.projectId)

            const streamStartTime = performance.now()
            let finalSources: string[] = []
            let lastSaveTime = Date.now()
            const SAVE_INTERVAL = 2000 // Save every 2 seconds
            
            // Create a temporary assistant message for streaming and save it immediately
            const tempAssistantMsg: Message = {
                id: assistantId, role: 'assistant', content: '', 
                timestamp: new Date(), provider: currentProvider, model: activeModel
            }
            
            // Save empty message immediately so it exists in the database
            try {
                await window.electron.db.addMessage({
                    id: assistantId, chatId, role: 'assistant', content: '', 
                    timestamp: Date.now(), provider: currentProvider, model: activeModel
                })
            } catch (error) {
                console.error('[generateResponse] Failed to create initial message:', error)
            }
            
            // Add temporary message to chat for display
            setChats(prev => prev.map(c => 
                c.id === chatId ? { ...c, messages: [...c.messages, tempAssistantMsg] } : c
            ))
            
            for await (const chunk of stream) {
                if (chunk.type === 'metadata') {
                    finalSources = chunk.sources || []
                    setStreamingStates(prev => ({
                        ...prev,
                        [chatId]: { ...prev[chatId], sources: finalSources }
                    }))
                    continue
                }

                if (chunk.type === 'content') {
                    finalContent += chunk.content
                    const elapsed = (performance.now() - streamStartTime) / 1000
                    const speed = elapsed > 0.5 ? (finalContent.length / 4) / elapsed : null

                    setStreamingStates(prev => ({
                        ...prev,
                        [chatId]: { ...prev[chatId], content: finalContent, speed }
                    }))
                    
                    // Periodically save streaming content
                    const now = Date.now()
                    if (now - lastSaveTime >= SAVE_INTERVAL && finalContent.length > 0) {
                        lastSaveTime = now
                        try {
                            // Update the temporary message in database
                            await window.electron.db.updateMessage(assistantId, {
                                content: finalContent,
                                reasoning: finalReasoning || undefined
                            })
                        } catch (error) {
                            console.error('[generateResponse] Failed to save streaming content:', error)
                        }
                    }
                } else if (chunk.type === 'reasoning') {
                    finalReasoning += chunk.content
                    setStreamingStates(prev => ({
                        ...prev,
                        [chatId]: { ...prev[chatId], reasoning: finalReasoning }
                    }))
                } else if (chunk.type === 'error') {
                    throw new Error(chunk.content)
                }
            }

            const responseTime = Math.round(performance.now() - requestStartTime)
            const assistantTs = Date.now()
            const assistantMsg: Message = {
                id: assistantId, role: 'assistant', content: finalContent, reasoning: finalReasoning || undefined,
                timestamp: new Date(assistantTs), provider: currentProvider, model: activeModel, responseTime,
                sources: finalSources
            }

            // Update the message with final content (it was already created at the start)
            await window.electron.db.updateMessage(assistantId, {
                content: finalContent,
                reasoning: finalReasoning || undefined,
                responseTime,
                sources: finalSources
            })

            setChats(prev => prev.map(c => {
                if (c.id === chatId) {
                    let title = c.title
                    const textContent = typeof finalContent === 'string' ? finalContent : ''
                    if (c.messages.length <= 1 && textContent) title = textContent.split('\n')[0].replace(/[#*`]/g, '').trim().slice(0, 50) || t('sidebar.newChat')
                    // Update the temporary message with final content
                    return { 
                        ...c, 
                        title, 
                        messages: c.messages.map(m => m.id === assistantId ? assistantMsg : m), 
                        isGenerating: false 
                    }
                }
                return c
            }))
        } catch (e) {
            console.error('[generateResponse] Error:', e)
            const errText = formatChatError(e as CatchError)
            const errMsg: Message = { id: generateId(), role: 'assistant', content: `${t('common.error')}: ${errText}`, timestamp: new Date() }
            setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, errMsg] } : c))
        } finally {
            // Clear streaming state for this chat as it's now in the 'messages' array
            setStreamingStates(prev => {
                const newState = { ...prev }
                delete newState[chatId]
                return newState
            })
            if (autoReadEnabled && finalContent) handleSpeak(assistantId, finalContent)
        }
    }

    const handleSend = async (customInput?: string) => {
        const content = customInput || input
        if (!content.trim()) return
        if (!selectedModel) return
        if (isLoading) return

        // Set loading immediately so UI responds
        // Set generating immediately in UI
        setChats(prev => prev.map(c => c.id === currentChatId ? { ...c, isGenerating: true } : c))
        setInput('')
        let chatId = currentChatId
        if (!chatId) {
            const newChatId = generateId()
            const timestamp = Date.now()
            const newChatDb = {
                id: newChatId,
                title: content.slice(0, 50),
                model: selectedModel,
                backend: selectedProvider as string,
                createdAt: timestamp,
                updatedAt: timestamp,
                isGenerating: true
            }
            await window.electron.db.createChat(newChatDb)
            const newChatUi: Chat = { ...newChatDb, messages: [], createdAt: new Date(timestamp), updatedAt: new Date(timestamp), isGenerating: true }
            setChats(prev => [newChatUi, ...prev])
            chatId = newChatId
            setCurrentChatId(chatId)
        }

        const timestamp = Date.now()
        const userMessage: Message = { id: generateId(), role: 'user', content, timestamp: new Date(timestamp) }
        await window.electron.db.addMessage({ ...userMessage, chatId: chatId!, timestamp, provider: selectedProvider, model: selectedModel })
        setChats(prev => prev.map((c: Chat) => c.id === chatId ? { ...c, messages: [...c.messages, userMessage], title: c.messages.length === 0 ? content.slice(0, 50) : c.title } : c))

        await generateResponse(chatId!, userMessage)
    }

    const createNewChat = () => {
        setCurrentChatId(null)
        setInput('')
    }

    const deleteChat = async (id: string) => {
        try {
            await window.electron.db.deleteChat(id)
            setChats(prev => prev.filter(c => c.id !== id))
            if (currentChatId === id) createNewChat()
        } catch (error) {
            console.error('Failed to delete chat:', error)
        }
    }

    const clearMessages = async () => {
        if (!currentChatId) return
        try {
            await window.electron.db.deleteMessages(currentChatId)
            setChats(prev => prev.map(c => c.id === currentChatId ? { ...c, messages: [] } : c))
        } catch (error) {
            console.error('Failed to clear messages:', error)
        }
    }

    const stopGeneration = async () => {
        try {
            await window.electron.abortChat()
            setStreamingStates({}) // Clear all active streams on abort
        } catch (e) { console.error(e) }
    }

    const createFolder = async (name: string, color?: string) => {
        try {
            const newFolder = await window.electron.db.createFolder(name, color)
            setFolders(prev => [...prev, newFolder as Folder])
            return newFolder as Folder
        } catch (error) {
            console.error('Failed to create folder:', error)
            return null
        }
    }

    const updateFolder = async (id: string, updates: Partial<Folder>) => {
        try {
            await window.electron.db.updateFolder(id, updates)
            setFolders(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f))
        } catch (error) {
            console.error('Failed to update folder:', error)
        }
    }

    const deleteFolder = async (id: string) => {
        try {
            await window.electron.db.deleteFolder(id)
            setFolders(prev => prev.filter(f => f.id !== id))
            // Also update chats that were in this folder
            setChats(prev => prev.map(c => c.folderId === id ? { ...c, folderId: undefined } : c))
        } catch (error) {
            console.error('Failed to delete folder:', error)
        }
    }

    const moveChatToFolder = async (chatId: string, folderId: string | null) => {
        try {
            // Update the chat in the database
            await window.electron.db.updateChat(chatId, { folderId })
            // Update local state
            setChats(prev => prev.map(c => c.id === chatId ? { ...c, folderId: folderId || undefined } : c))
        } catch (error) {
            console.error('Failed to move chat to folder:', error)
        }
    }

    const addMessage = async (chatId: string, role: string, content: string) => {
        try {
            const messageObj = { role, content, timestamp: Date.now() }
            await window.electron.db.addMessage({ ...messageObj, chatId })
            const uiMessage: Message = { ...messageObj, id: generateId(), timestamp: new Date(messageObj.timestamp), role: role as 'user' | 'assistant' | 'system' }
            setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, uiMessage] } : c))
        } catch (error) {
            console.error('Failed to add message:', error)
        }
    }

    const createPrompt = async (title: string, content: string, tags: string[] = []) => {
        try {
            const newPrompt = await window.electron.db.createPrompt(title, content, tags)
            setPrompts(prev => [...prev, newPrompt as Prompt])
        } catch (error) {
            console.error('Failed to create prompt:', error)
        }
    }

    const deletePrompt = async (id: string) => {
        try {
            await window.electron.db.deletePrompt(id)
            setPrompts(prev => prev.filter(p => p.id !== id))
        } catch (error) {
            console.error('Failed to delete prompt:', error)
        }
    }

    const updatePrompt = async (id: string, updates: Partial<Prompt>) => {
        try {
            await window.electron.db.updatePrompt(id, updates)
            setPrompts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
        } catch (error) {
            console.error('Failed to update prompt:', error)
        }
    }

    const startListening = () => {
        const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition
        if (!SpeechRecognitionCtor) {
            console.error('Speech recognition not supported')
            return
        }

        const recognition = new SpeechRecognitionCtor()
        recognition.continuous = true
        recognition.interimResults = false
        recognition.lang = language || 'tr-TR'

        recognition.onresult = (event: SpeechRecognitionEventLike) => {
            let finalTranscript = ''
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript
                }
            }
            if (finalTranscript) {
                setInput(prev => (prev.trim() ? `${prev} ${finalTranscript}` : finalTranscript))
            }
        }

        recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
            console.error('Speech recognition error:', event.error)
            setIsListeningActive(false)
        }

        recognition.onend = () => {
            setIsListeningActive(false)
        }

        try {
            recognition.start()
            setIsListeningActive(true)
            window._activeRecognition = recognition
        } catch (err) {
            console.error('Failed to start recognition:', err)
            setIsListeningActive(false)
        }
    }

    const stopListening = () => {
        if (window._activeRecognition) {
            window._activeRecognition.stop()
            delete window._activeRecognition
            setIsListeningActive(false)
        }
    }

    const updateChat = async (id: string, updates: Partial<Chat>) => {
        try {
            await window.electron.db.updateChat(id, updates)
            setChats(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
        } catch (error) {
            console.error('Failed to update chat:', error)
        }
    }

    const togglePin = async (id: string, isPinned: boolean) => {
        await updateChat(id, { isPinned })
    }

    const toggleFavorite = async (id: string, isFavorite: boolean) => {
        await updateChat(id, { isFavorite })
    }

    const [attachments, setAttachments] = useState<Attachment[]>([])

    const processFile = async (file: File) => {
        const id = generateId()
        const newAttachment: Attachment = {
            id,
            name: file.name,
            type: file.type.split('/')[0] as 'image' | 'file',
            size: file.size,
            status: 'uploading'
        }
        setAttachments(prev => [...prev, newAttachment])

        try {
            const content = await file.text()
            setAttachments(prev => prev.map(a => a.id === id ? { ...a, status: 'ready', content } : a))
        } catch {
            setAttachments(prev => prev.map(a => a.id === id ? { ...a, status: 'error' } : a))
        }
    }

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index))
    }

    return {
        chats, setChats, currentChatId, setCurrentChatId, messages, displayMessages,
        searchTerm, setSearchTerm, input, setInput, isLoading, streamingContent,
        streamingReasoning, streamingSpeed, contextTokens,
        handleSend, stopGeneration, createNewChat, deleteChat, clearMessages,
        folders, createFolder, updateFolder, deleteFolder, moveChatToFolder, addMessage,
        prompts, createPrompt, deletePrompt, updatePrompt,
        isListening,
        startListening,
        stopListening,
        updateChat,
        togglePin,
        toggleFavorite,
        attachments,
        setAttachments,
        processFile,
        removeAttachment
    }
}
