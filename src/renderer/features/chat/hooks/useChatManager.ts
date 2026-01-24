import { useAttachments } from '@renderer/features/chat/hooks/useAttachments'
import { useChatCRUD } from '@renderer/features/chat/hooks/useChatCRUD'
import { useChatGenerator } from '@renderer/features/chat/hooks/useChatGenerator'
import { useFolderManager } from '@renderer/features/chat/hooks/useFolderManager'
import { usePromptManager } from '@renderer/features/chat/hooks/usePromptManager'
import { useSpeechRecognition } from '@renderer/features/chat/hooks/useSpeechRecognition'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { generateId } from '@/lib/utils'
import { AppSettings, Chat, Message } from '@/types'
import { CatchError, IpcValue } from '@/types/common'

interface SelectedModelInfo {
    provider: string
    model: string
}

interface UseChatManagerOptions {
    selectedModel: string
    selectedProvider: string
    selectedModels?: SelectedModelInfo[]
    language: string
    selectedPersona?: { id: string, name: string, description: string, prompt: string } | null | undefined
    appSettings?: AppSettings | undefined
    autoReadEnabled: boolean
    handleSpeak: (id: string, text: string) => void
    formatChatError: (err: CatchError) => string
    t: (key: string) => string
    activeWorkspacePath?: string | undefined
    projectId?: string | undefined
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
    const [searchTerm, setSearchTerm] = useState('')
    const [input, setInput] = useState('')
    const [contextTokens] = useState(0)

    const { prompts, createPrompt, deletePrompt, updatePrompt } = usePromptManager()

    const [systemMode, setSystemMode] = useState<'thinking' | 'agent' | 'fast'>('agent')

    const { streamingStates, generateResponse, stopGeneration } = useChatGenerator({
        chats, setChats, appSettings, selectedModel, selectedProvider,
        selectedModels: options.selectedModels,
        language, selectedPersona, activeWorkspacePath: options.activeWorkspacePath,
        projectId: options.projectId, t, handleSpeak, autoReadEnabled, formatChatError,
        systemMode
    })

    const {
        folders,
        loadFolders,
        createFolder,
        updateFolder,
        deleteFolder: baseDeleteFolder
    } = useFolderManager()

    const { isListening, startListening, stopListening } = useSpeechRecognition(language, (text) => {
        setInput(prev => (prev.trim() ? `${prev} ${text} ` : text))
    })

    const {
        createNewChat, deleteChat, clearMessages, deleteFolder, moveChatToFolder,
        addMessage, updateChat, togglePin, toggleFavorite
    } = useChatCRUD({
        currentChatId, setCurrentChatId, setChats, setInput, baseDeleteFolder
    })


    const streamingReasoning = useMemo(() => {
        const state = currentChatId ? streamingStates[currentChatId] : undefined
        return state ? state.reasoning : ''
    }, [currentChatId, streamingStates])
    const streamingSpeed = useMemo(() => {
        const state = currentChatId ? streamingStates[currentChatId] : undefined
        return state ? state.speed : null
    }, [currentChatId, streamingStates])

    const currentChat = chats.find(c => c.id === currentChatId)
    const isLoading = useMemo(() => {
        if (!currentChatId) {
            return false
        }
        const isGenerating = Boolean(currentChat?.isGenerating)
        const isStreaming = Boolean(streamingStates[currentChatId])
        return isGenerating || isStreaming
    }, [currentChatId, currentChat?.isGenerating, streamingStates])

    const messages = useMemo(() => currentChat?.messages ?? [], [currentChat])

    const displayMessages = useMemo(() => {
        if (!searchTerm) { return messages }
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
            setChats(allChats as Chat[])
            await loadFolders()
        }
        void load()

        const removeStatusListener = window.electron.on('chat:generation-status', (_event, ...args: IpcValue[]) => {
            const data = (args[0] && typeof args[0] === 'object') ? args[0] as { chatId?: string; isGenerating?: boolean } : {}
            setChats(prev => prev.map(c => c.id === data.chatId ? { ...c, isGenerating: data.isGenerating } : c))
        })
        return () => { removeStatusListener() }
        return () => { removeStatusListener() }
    }, [loadFolders])

    // Lazy load messages for current active chat
    useEffect(() => {
        if (!currentChatId) { return }

        // Check if we already have messages for this chat (length > 0)
        // Note: New empty chats might have 0 messages, but they usually don't exist in DB yet or are just created.
        // We can optimize by checking a flag like 'messagesLoaded'.
        // For now, if messages array is missing or empty, try to fetch.
        // But wait, what if it's a TRULY empty chat? getMessages returns [].
        // Ideally we should use a `loaded` flag.
        // Since we don't have that in types yet, we'll fetch if messages are undefined.
        // The getAllChats returns chats which MIGHT have messages as undefined if the type allows optional.
        // Our Chat type says messages: Message[].
        // But DB return might not have it.

        const targetChat = chats.find(c => c.id === currentChatId)
        if (targetChat && (!targetChat.messages || targetChat.messages.length === 0)) {
            // We generally assume that if it's in the list and empty, we might need to check DB.
            // To avoid infinite loops for empty chats, we can trust the 'addMessage' flow updates them.
            // But here we want to fetch if we haven't fetched yet.
            // Since we can't distinguish "not loaded" from "empty", we will always try fetch once if empty?
            // No, that loops.
            // Let's modify the load logic to set messages = undefined initially if possible, or use a side map.
            // Actually, simpler: define a `messagesLoaded` set or look at how `getAllChats` behaves.
            // getAllChats likely returns objects without `messages` property if not joined.
            // Let's assume we need to fetch.

            const fetchMessages = async () => {
                try {
                    // Lazy loading messages
                    const messages = await window.electron.db.getMessages(currentChatId)
                    setChats(prev => prev.map(c =>
                        c.id === currentChatId
                            ? { ...c, messages: messages as Message[] }
                            : c
                    ))
                } catch (e) {
                    console.error(`Failed to load messages for ${currentChatId}`, e)
                }
            }
            void fetchMessages()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentChatId])


    const handleSend = useCallback(async (customInput?: string) => {
        const content = customInput ?? input
        if (!content.trim()) { return }
        if (!selectedModel) { return }
        if (isLoading) { return }

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
            const createResult = await window.electron.db.createChat(newChatDb)
            if (!createResult.success) {
                console.error('[useChatManager] Failed to create chat:', createResult)
                setChats(prev => prev.map(c => c.id === currentChatId ? { ...c, isGenerating: false } : c))
                return
            }
            const newChatUi: Chat = { ...newChatDb, messages: [], createdAt: new Date(timestamp), updatedAt: new Date(timestamp), isGenerating: true }
            setChats(prev => [newChatUi, ...prev])
            chatId = newChatId
            setCurrentChatId(chatId)
        }

        const timestamp = Date.now()
        const userMessage: Message = { id: generateId(), role: 'user', content, timestamp: new Date(timestamp) }
        // Ensure chatId is not null by creating if needed (logic above ensures it)
        if (!chatId) {
            throw new Error('Chat ID creation failed') // Sentinel, should not happen
        }
        const validChatId = chatId
        await window.electron.db.addMessage({ ...userMessage, chatId: validChatId, timestamp, provider: selectedProvider, model: selectedModel })
        setChats(prev => prev.map((c: Chat) => c.id === validChatId ? { ...c, messages: [...c.messages, userMessage], title: c.messages.length === 0 ? content.slice(0, 50) : c.title } : c))

        void generateResponse(validChatId, userMessage)
    }, [input, selectedModel, isLoading, currentChatId, selectedProvider, generateResponse, setChats])


    const { attachments, setAttachments, processFile, removeAttachment } = useAttachments()

    return useMemo(() => ({
        chats, setChats, currentChatId, setCurrentChatId, messages, displayMessages,
        searchTerm, setSearchTerm, input, setInput, isLoading,
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
        removeAttachment,
        t,
        handleSpeak,
        systemMode,
        setSystemMode
    }), [
        chats, currentChatId, messages, displayMessages,
        searchTerm, input, isLoading,
        streamingReasoning, streamingSpeed, contextTokens,
        handleSend, stopGeneration, createNewChat, deleteChat, clearMessages,
        folders, createFolder, updateFolder, deleteFolder, moveChatToFolder, addMessage,
        prompts, createPrompt, deletePrompt, updatePrompt,
        isListening, startListening, stopListening,
        updateChat, togglePin, toggleFavorite,
        attachments, setAttachments, processFile, removeAttachment,
        t, handleSpeak, systemMode
    ])
}
