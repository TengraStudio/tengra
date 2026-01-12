import { useState, useEffect, useMemo } from 'react'
import { generateId } from '@/lib/utils'
import { Chat, Message, AppSettings } from '@/types'
import { CatchError, IpcValue } from '../../../../shared/types/common'
import { usePromptManager } from './usePromptManager.ts'
import { useChatCRUD } from './useChatCRUD.ts'
import { useFolderManager } from './useFolderManager.ts'
import { useAttachments } from './useAttachments.ts'

import { useSpeechRecognition } from './useSpeechRecognition.ts'
import { useChatGenerator } from './useChatGenerator.ts'

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

    const streamingContent = useMemo(() => {
        const state = currentChatId ? streamingStates[currentChatId] : undefined
        return state ? state.content : ''
    }, [currentChatId, streamingStates])
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
        if (!currentChatId) { return false }
        return Boolean(currentChat?.isGenerating) || Boolean(streamingStates[currentChatId])
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
            await window.electron.db.createChat(newChatDb)
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
        removeAttachment,
        t,
        handleSpeak
    }
}
