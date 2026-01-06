import { useState, useEffect, useMemo } from 'react'
import { generateId } from '@/lib/utils'
import { chatStream } from '@/lib/chat-stream'
import { getSystemPrompt } from '@/lib/identity'
// ToolResult and Attachment are NOT in '@/shared/types/chat', removing import and using 'any' for now if needed or local interface
import { Chat, Message } from '@/types'

interface UseChatManagerOptions {
    selectedModel: string
    selectedProvider: string
    language: string
    selectedPersona?: { id: string, name: string, description: string, prompt: string } | null
    appSettings: any
    autoReadEnabled: boolean
    handleSpeak: (id: string, text: string) => void
    formatChatError: (err: unknown) => string
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
        formatChatError
    } = options

    const [chats, setChats] = useState<Chat[]>([])
    const [currentChatId, setCurrentChatId] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [streamingContent, setStreamingContent] = useState('')
    const [streamingReasoning, setStreamingReasoning] = useState('')
    const [streamingSpeed, setStreamingSpeed] = useState<number | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [input, setInput] = useState('')
    const [contextTokens] = useState(0)

    const currentChat = chats.find(c => c.id === currentChatId)
    const messages = useMemo(() => currentChat?.messages || [], [currentChat])

    const displayMessages = useMemo(() => {
        if (!searchTerm) return messages
        return messages.filter(m => m.content?.toLowerCase().includes(searchTerm.toLowerCase()))
    }, [messages, searchTerm])

    // Load initial chats
    useEffect(() => {
        const load = async () => {
            const all = await window.electron.db.getAllChats()
            setChats(all)
        }
        load()
    }, [])

    const getSmartContext = (messages: Message[]) => {
        return messages.slice(-15) // Simple context window for now
    }

    const generateResponse = async (chatId: string, userMessage: Message, retryModel?: string) => {
        setIsLoading(true); setStreamingContent(''); setStreamingReasoning(''); setStreamingSpeed(null)
        const assistantId = generateId()
        let finalContent = ''
        let finalReasoning = ''

        try {
            const allTools = await window.electron.getToolDefinitions()
            const tools = allTools.filter((t: any) =>
                t.function.name === 'generate_image' && selectedProvider === 'antigravity'
            )

            const dbRefChat = chats.find(c => c.id === chatId)
            const smartContext = getSmartContext([...(dbRefChat?.messages || []), userMessage])

            const chatMessages = smartContext.map((msg: any) => {
                if (msg.images && msg.images.length > 0) {
                    const contentParts: any[] = []
                    if (msg.content) contentParts.push({ type: 'text', text: msg.content })
                    for (const img of msg.images) contentParts.push({ type: 'image_url', image_url: { url: img } })
                    return { role: msg.role, content: contentParts }
                }
                return { role: msg.role, content: msg.content }
            })
            const activeModel = retryModel || selectedModel
            const currentProvider = selectedProvider

            const modelConfig = (appSettings as any)?.modelSettings?.[selectedModel] || {}
            const systemPrompt = modelConfig.systemPrompt || getSystemPrompt(language as 'tr' | 'en', selectedPersona?.prompt, selectedProvider, activeModel)
            const systemMessage = { role: 'system', content: systemPrompt }
            const allMessages = [systemMessage, ...chatMessages]

            const modelPresets = (appSettings as any)?.presets || []
            const preset = modelPresets.find((p: any) => p.id === modelConfig.presetId)
            const presetOptions = preset ? {
                temperature: preset.temperature,
                top_p: preset.topP,
                frequency_penalty: preset.frequencyPenalty,
                presence_penalty: preset.presencePenalty,
                max_tokens: preset.maxTokens
            } : {}

            const requestStartTime = performance.now()
            const stream = chatStream(allMessages, activeModel, tools, currentProvider, presetOptions)

            const streamStartTime = performance.now()

            for await (const chunk of stream) {
                if (chunk.type === 'content') {
                    finalContent += chunk.content
                    setStreamingContent(finalContent)
                    const elapsed = (performance.now() - streamStartTime) / 1000
                    if (elapsed > 0.5) setStreamingSpeed((finalContent.length / 4) / elapsed)
                } else if (chunk.type === 'reasoning') {
                    finalReasoning += chunk.content
                    setStreamingReasoning(finalReasoning)
                } else if (chunk.type === 'error') {
                    throw new Error(chunk.content)
                }
            }

            const responseTime = Math.round(performance.now() - requestStartTime)
            const assistantTs = Date.now()
            const assistantMsg: Message = {
                id: assistantId, role: 'assistant', content: finalContent, reasoning: finalReasoning || undefined,
                timestamp: new Date(assistantTs), provider: currentProvider, model: activeModel, responseTime
            }

            setChats(prev => prev.map(c => {
                if (c.id === chatId) {
                    let title = c.title
                    if (c.messages.length <= 1 && assistantMsg.content) title = assistantMsg.content.split('\n')[0].replace(/[#*`]/g, '').trim().slice(0, 50) || 'Yeni Sohbet'
                    return { ...c, title, messages: [...c.messages, assistantMsg] }
                }
                return c
            }))

            await window.electron.db.addMessage({
                id: assistantId, chatId, role: 'assistant', content: finalContent, timestamp: assistantTs,
                provider: currentProvider, model: activeModel, responseTime
            })
        } catch (e) {
            console.error('[generateResponse] Error:', e)
            const errText = formatChatError(e)
            const errMsg: Message = { id: generateId(), role: 'assistant', content: `Hata: ${errText}`, timestamp: new Date() }
            setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, errMsg] } : c))
        } finally {
            setIsLoading(false); setStreamingContent('')
            if (autoReadEnabled && finalContent) handleSpeak(assistantId, finalContent)
        }
    }

    const handleSend = async (customInput?: string) => {
        const content = customInput || input
        if (!content.trim()) return
        if (!selectedModel) return
        if (isLoading) return

        setInput('')
        let chatId = currentChatId
        if (!chatId) {
            const newChatId = generateId()
            const timestamp = Date.now()
            const newChatDb = {
                id: newChatId,
                title: content.slice(0, 50),
                model: selectedModel,
                backend: selectedProvider as any,
                createdAt: timestamp,
                updatedAt: timestamp
            }
            await window.electron.db.createChat(newChatDb)
            const newChatUi: Chat = { ...newChatDb, messages: [], createdAt: new Date(timestamp), updatedAt: new Date(timestamp) }
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
        setStreamingContent('')
        setStreamingReasoning('')
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
        try { await window.electron.abortChat(); setIsLoading(false); setStreamingContent('') } catch (e) { console.error(e) }
    }

    return {
        chats, setChats, currentChatId, setCurrentChatId, messages, displayMessages,
        searchTerm, setSearchTerm, input, setInput, isLoading, streamingContent,
        streamingReasoning, streamingSpeed, contextTokens,
        handleSend, stopGeneration, createNewChat, deleteChat, clearMessages
    }
}
