import { useState, useEffect, useMemo } from 'react'
import { generateId } from '@/lib/utils'
import { Chat, Message, AppSettings } from '@/types'
import { CatchError, IpcValue } from '@/types/common'
import { usePromptManager } from '@renderer/features/chat/hooks/usePromptManager'
import { useChatCRUD } from '@renderer/features/chat/hooks/useChatCRUD'
import { useFolderManager } from '@renderer/features/chat/hooks/useFolderManager'
import { useAttachments } from '@renderer/features/chat/hooks/useAttachments'

import { useSpeechRecognition } from '@renderer/features/chat/hooks/useSpeechRecognition'
import { useChatGenerator } from '@renderer/features/chat/hooks/useChatGenerator'

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
    const [searchTerm, setSearchTerm] = useState('')
    const [input, setInput] = useState('')
    const [contextTokens] = useState(0)

    const { prompts, createPrompt, deletePrompt, updatePrompt } = usePromptManager()

    const { streamingStates, generateResponse, stopGeneration } = useChatGenerator({
        chats, setChats, appSettings, selectedModel, selectedProvider, language,
        selectedPersona, activeWorkspacePath: options.activeWorkspacePath, projectId: options.projectId,
        t, handleSpeak, autoReadEnabled, formatChatError
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
            console.debug('[useChatManager:isLoading] currentChatId is null, returning false');
            return false
        }
        const isGenerating = Boolean(currentChat?.isGenerating)
        const isStreaming = Boolean(streamingStates[currentChatId])
        console.debug(`[useChatManager:isLoading] chatId=${currentChatId}, isGenerating=${isGenerating}, isStreaming=${isStreaming}`);
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
            const chatsWithMessages = await Promise.all(
                (allChats as Chat[]).map(async (chat) => {
                    try {
                        const messages = await window.electron.db.getMessages(chat.id)
                        return { ...chat, messages: messages as Message[] }
                    } catch (error) {
                        console.error(`Failed to load messages for chat ${chat.id}: `, error)
                        return { ...chat, messages: [] }
                    }
                })
            )
            setChats(chatsWithMessages)
            await loadFolders()
        }
        void load()

        const removeStatusListener = window.electron.on('chat:generation-status', (_event, ...args: IpcValue[]) => {
            const data = (args[0] && typeof args[0] === 'object') ? args[0] as { chatId?: string; isGenerating?: boolean } : {}
            setChats(prev => prev.map(c => c.id === data.chatId ? { ...c, isGenerating: data.isGenerating } : c))
        })
        return () => { removeStatusListener() }
    }, [loadFolders])


    const handleSend = async (customInput?: string) => {
        console.log('[useChatManager] handleSend called', { customInput, input, selectedModel, currentChatId, isLoading })
        const content = customInput ?? input
        if (!content.trim()) { console.log('[useChatManager] Empty content, returning'); return }
        if (!selectedModel) { console.log('[useChatManager] No model selected, returning'); return }
        if (isLoading) { console.log('[useChatManager] Already loading, returning'); return }

        // Set loading immediately so UI responds
        // Set generating immediately in UI
        setChats(prev => prev.map(c => c.id === currentChatId ? { ...c, isGenerating: true } : c))
        setInput('')
        let chatId = currentChatId
        if (!chatId) {
            console.log('[useChatManager] Creating new chat...')
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
            console.log('[useChatManager] Calling createChat with:', newChatDb)
            const createResult = await window.electron.db.createChat(newChatDb)
            console.log('[useChatManager] createChat result:', createResult)
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
    }


    const { attachments, setAttachments, processFile, removeAttachment } = useAttachments()

    return {
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
        handleSpeak
    }
}
