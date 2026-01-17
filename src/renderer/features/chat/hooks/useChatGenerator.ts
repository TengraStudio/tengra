import { formatMessageContent, getPresetOptions, processStreamChunk } from '@renderer/features/chat/hooks/utils'
import { useState } from 'react'

import { chatStream } from '@/lib/chat-stream'
import { getSystemPrompt } from '@/lib/identity'
import { generateId } from '@/lib/utils'
import { AppSettings, Chat, Message, ToolDefinition } from '@/types'
import { CatchError } from '@/types/common'

interface UseChatGeneratorProps {
    chats: Chat[]
    setChats: React.Dispatch<React.SetStateAction<Chat[]>>
    appSettings?: AppSettings | undefined
    selectedModel: string
    selectedProvider: string
    language: string
    activeWorkspacePath?: string | undefined
    projectId?: string | undefined
    t: (key: string) => string
    handleSpeak: (id: string, content: string) => void
    autoReadEnabled: boolean
    formatChatError: (err: CatchError) => string
}

interface PrepareMessagesOptions {
    chatId: string
    chats: Chat[]
    userMessage: Message
    appSettings: AppSettings | undefined
    selectedModel: string
    selectedProvider: string
    language: string
    selectedPersona?: { id: string, name: string, description: string, prompt: string } | null | undefined
}

const prepareMessages = (options: PrepareMessagesOptions) => {
    const { chatId, chats, userMessage, appSettings, selectedModel, selectedProvider, language, selectedPersona } = options
    const dbRefChat = chats.find(c => c.id === chatId)
    const contextMessages = (dbRefChat?.messages ?? []).slice(-15)

    const chatMessages = [...contextMessages, userMessage].map((msg: Message) => ({
        ...msg,
        content: formatMessageContent(msg)
    }))

    const modelSettings = appSettings?.modelSettings ?? {}
    const modelConfig = modelSettings[selectedModel] ?? {}
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const systemPrompt = modelConfig.systemPrompt || getSystemPrompt(language as 'tr' | 'en', selectedPersona?.prompt, selectedProvider, selectedModel)
    const systemMessage: Message = { role: 'system', content: systemPrompt, id: generateId(), timestamp: new Date() }

    const presetOptions = getPresetOptions(appSettings, modelConfig)

    return { allMessages: [systemMessage, ...chatMessages], presetOptions }
}

export const useChatGenerator = (props: UseChatGeneratorProps & { selectedPersona?: { id: string, name: string, description: string, prompt: string } | null | undefined }) => {
    const {
        chats, setChats, appSettings, selectedModel, selectedProvider, language,
        selectedPersona, activeWorkspacePath, projectId, t, handleSpeak,
        autoReadEnabled, formatChatError
    } = props

    const [streamingStates, setStreamingStates] = useState<Record<string, { content?: string, reasoning?: string, speed?: number | null, sources?: string[] | undefined }>>({})

    const generateResponse = async (chatId: string, userMessage: Message, retryModel?: string) => {
        setStreamingStates(prev => ({ ...prev, [chatId]: { content: '', reasoning: '', speed: null } }))
        const assistantId = generateId()
        const activeModel = retryModel ?? selectedModel

        try {
            const allTools: ToolDefinition[] = await window.electron.getToolDefinitions()
            const tools = allTools.filter((tDefinition) => {
                if (selectedProvider === 'opencode') { return true }
                return tDefinition.function.name === 'generate_image' && selectedProvider === 'antigravity'
            })

            const { allMessages, presetOptions } = prepareMessages({
                chatId, chats, userMessage, appSettings, selectedModel: activeModel,
                selectedProvider, language, selectedPersona
            })

            const fullOptions = { ...presetOptions, projectRoot: activeWorkspacePath }
            console.log(`[useChatGenerator] Starting stream for chatId: ${chatId}`);
            const stream = chatStream(allMessages, activeModel, tools, selectedProvider, fullOptions, chatId, projectId)
            const streamStartTime = performance.now()

            // Initial placeholders
            const tempMsg: Message = { id: assistantId, role: 'assistant', content: '', timestamp: new Date(), provider: selectedProvider, model: activeModel }
            setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, tempMsg] } : c))

            // Should be awaited or voided
            void window.electron.db.addMessage({ ...tempMsg, chatId, timestamp: Date.now() })

            interface StreamResult { finalContent: string; finalReasoning: string; finalSources: string[] }

            const processStream = async (
                stream: AsyncGenerator<unknown, void, unknown>,
                chatId: string,
                assistantId: string,
                setStreamingStates: React.Dispatch<React.SetStateAction<Record<string, { content?: string, reasoning?: string, speed?: number | null, sources?: string[] | undefined }>>>,
                streamStartTime: number
            ): Promise<StreamResult> => {
                let finalContent = ''
                let finalReasoning = ''
                let finalSources: string[] = []
                let lastSaveTime = Date.now()
                let lastDbSaveTime = Date.now()

                console.log(`[useChatGenerator:processStream] Beginning iteration for chatId: ${chatId}`);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                for await (const chunk of stream as AsyncGenerator<any, void, unknown>) {
                    console.debug(`[useChatGenerator:processStream] Processing chunk for ${chatId}:`, chunk);
                    const current = { content: finalContent, reasoning: finalReasoning, sources: finalSources }
                    const result = processStreamChunk(chunk, current, streamStartTime)

                    if (result.updated) {
                        if (result.newSources) {
                            finalSources = result.newSources
                            setStreamingStates(prev => ({ ...prev, [chatId]: { ...prev[chatId], sources: finalSources } }))
                        }
                        if (result.newReasoning) {
                            finalReasoning = result.newReasoning
                            setStreamingStates(prev => ({ ...prev, [chatId]: { ...prev[chatId], reasoning: finalReasoning } }))
                        }
                        if (result.newContent !== undefined) {
                            finalContent = result.newContent
                            setStreamingStates(prev => {
                                const state = prev[chatId]
                                if (!state) { return prev }
                                return {
                                    ...prev,
                                    [chatId]: {
                                        ...state,
                                        content: finalContent,
                                        speed: result.speed ?? null
                                    }
                                }
                            })

                            // Update the main chats state so all UI components see the live progress
                            const now = Date.now()
                            if (now - lastSaveTime >= 100) { // Throttle updates to ~10fps for performance
                                lastSaveTime = now
                                setChats(prev => prev.map(c => c.id === chatId ? {
                                    ...c,
                                    messages: c.messages.map(m => m.id === assistantId ? { ...m, content: finalContent, reasoning: finalReasoning || undefined } : m)
                                } : c))
                            }

                            if (now - lastDbSaveTime >= 2000 && finalContent) {
                                lastDbSaveTime = now
                                void window.electron.db.updateMessage(assistantId, { content: finalContent, reasoning: finalReasoning || undefined })
                            }
                        }
                    }
                }
                return { finalContent, finalReasoning, finalSources }
            }

            const { finalContent, finalReasoning, finalSources } = await processStream(stream, chatId, assistantId, setStreamingStates, streamStartTime)

            const responseTime = Math.round(performance.now() - streamStartTime)
            const completedMsg: Message = {
                id: assistantId, role: 'assistant', content: finalContent, reasoning: finalReasoning || undefined,
                timestamp: new Date(), provider: selectedProvider, model: activeModel, responseTime, sources: finalSources
            }

            await window.electron.db.updateMessage(assistantId, { content: finalContent, reasoning: finalReasoning || undefined, responseTime, sources: finalSources })

            setChats(prev => prev.map(c => {
                if (c.id !== chatId) { return c }
                let title = c.title
                if (c.messages.length <= 1 && finalContent) {
                    title = finalContent.split('\n')[0].replace(/[#*`]/g, '').trim().slice(0, 50) || t('sidebar.newChat')
                }
                return { ...c, title, messages: c.messages.map(m => m.id === assistantId ? completedMsg : m), isGenerating: false }
            }))

            if (autoReadEnabled && finalContent) { handleSpeak(assistantId, finalContent) }

        } catch (e) {
            console.error('[generateResponse] Error:', e)
            const errText = formatChatError(e as CatchError)
            const errMsg: Message = { id: assistantId, role: 'assistant', content: `${t('common.error')}: ${errText}`, timestamp: new Date(), provider: selectedProvider, model: activeModel }
            setChats(prev => prev.map(c => {
                if (c.id !== chatId) { return c }
                return {
                    ...c,
                    messages: c.messages.map(m => m.id === assistantId ? errMsg : m),
                    isGenerating: false
                }
            }))
            void window.electron.db.updateMessage(assistantId, { content: errMsg.content })
        } finally {
            setStreamingStates(prev => { const s = { ...prev }; delete s[chatId]; return s })
        }
    }

    const stopGeneration = async () => {
        try {
            window.electron.abortChat()
            setStreamingStates({})
        } catch (e) {
            console.error(e)
        }
    }

    return {
        streamingStates,
        generateResponse,
        stopGeneration
    }
}
