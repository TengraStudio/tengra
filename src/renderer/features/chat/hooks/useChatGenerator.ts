import { processChatStream } from '@renderer/features/chat/hooks/process-stream'
import { formatMessageContent, getPresetOptions } from '@renderer/features/chat/hooks/utils'
import { useState } from 'react'

import { chatStream } from '@/lib/chat-stream'
import { getSystemPrompt } from '@/lib/identity'
import { generateId } from '@/lib/utils'
import { AppSettings, Chat, Message, ToolDefinition } from '@/types'
import { CatchError } from '@/types/common'

interface SelectedModelInfo {
    provider: string
    model: string
}

interface UseChatGeneratorProps {
    chats: Chat[]
    setChats: React.Dispatch<React.SetStateAction<Chat[]>>
    appSettings?: AppSettings | undefined
    selectedModel: string
    selectedProvider: string
    selectedModels?: SelectedModelInfo[]
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
        chats, setChats, appSettings, selectedModel, selectedProvider, selectedModels,
        language, selectedPersona, activeWorkspacePath, projectId, t, handleSpeak,
        autoReadEnabled, formatChatError
    } = props

    const [streamingStates, setStreamingStates] = useState<Record<string, {
        content?: string,
        reasoning?: string,
        speed?: number | null,
        sources?: string[] | undefined,
        variants?: Record<number, { content: string, reasoning: string }>
    }>>({})

    const generateResponse = async (chatId: string, userMessage: Message, retryModel?: string) => {
        setStreamingStates(prev => ({ ...prev, [chatId]: { content: '', reasoning: '', speed: null } }))
        const assistantId = generateId()
        const activeModel = retryModel ?? selectedModel

        // Determine which models to use - if multi-model selected and no retry, use all
        const modelsToUse: SelectedModelInfo[] = (!retryModel && selectedModels && selectedModels.length > 1)
            ? selectedModels
            : [{ provider: selectedProvider, model: activeModel }]

        const isMultiModel = modelsToUse.length > 1

        try {
            const allTools: ToolDefinition[] = await window.electron.getToolDefinitions()

            // For multi-model responses, create placeholder message first
            const tempMsg: Message = {
                id: assistantId,
                role: 'assistant',
                content: '',
                timestamp: new Date(),
                provider: modelsToUse[0].provider,
                model: modelsToUse[0].model,
                variants: isMultiModel ? modelsToUse.map((m, idx) => ({
                    id: `${assistantId}-v${idx}`,
                    content: '',
                    model: m.model,
                    provider: m.provider,
                    timestamp: new Date(),
                    label: m.model,
                    isSelected: idx === 0
                })) : undefined
            }
            setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, tempMsg] } : c))
            void window.electron.db.addMessage({ ...tempMsg, chatId, timestamp: Date.now() })

            if (isMultiModel) {
                // Multi-model: generate responses in parallel
                await generateMultiModelResponse(
                    chatId, assistantId, userMessage, modelsToUse, allTools
                )
            } else {
                // Single model: use existing stream logic
                const tools = allTools.filter((tDefinition) => {
                    if (selectedProvider === 'opencode') { return true }
                    return tDefinition.function.name === 'generate_image' && selectedProvider === 'antigravity'
                })

                const { allMessages, presetOptions } = prepareMessages({
                    chatId, chats, userMessage, appSettings, selectedModel: activeModel,
                    selectedProvider, language, selectedPersona
                })

                const fullOptions = { ...presetOptions, projectRoot: activeWorkspacePath }
                const stream = chatStream({
                    messages: allMessages,
                    model: activeModel,
                    tools,
                    provider: selectedProvider,
                    options: fullOptions,
                    chatId,
                    projectId
                })
                const streamStartTime = performance.now()

                await processChatStream({
                    stream, chatId, assistantId, setStreamingStates, setChats, streamStartTime,
                    activeModel, selectedProvider, t, autoReadEnabled, handleSpeak
                })
            }
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

    const generateMultiModelResponse = async (
        chatId: string,
        assistantId: string,
        userMessage: Message,
        models: SelectedModelInfo[],
        allTools: ToolDefinition[]
    ) => {
        const streamStartTime = performance.now()
        const results: Array<{ model: string; provider: string; content: string; reasoning?: string; error?: string }> = []

        // Create promises for all model responses
        const promises = models.map(async (modelInfo, index) => {
            try {
                const tools = allTools.filter((tDefinition) => {
                    if (modelInfo.provider === 'opencode') { return true }
                    return tDefinition.function.name === 'generate_image' && modelInfo.provider === 'antigravity'
                })

                const { allMessages, presetOptions } = prepareMessages({
                    chatId, chats, userMessage, appSettings, selectedModel: modelInfo.model,
                    selectedProvider: modelInfo.provider, language, selectedPersona
                })

                const fullOptions = { ...presetOptions, projectRoot: activeWorkspacePath }

                // Use non-streaming chatOpenAI for multi-model (simpler to aggregate)
                const response = await window.electron.chatOpenAI({
                    messages: allMessages,
                    model: modelInfo.model,
                    tools,
                    provider: modelInfo.provider,
                    options: fullOptions
                })

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const responseData = response as { content?: string; reasoning?: string } | any
                results[index] = {
                    model: modelInfo.model,
                    provider: modelInfo.provider,
                    content: (responseData?.content as string) || '',
                    reasoning: responseData?.reasoning as string | undefined
                }

                // Update streaming state with this model's response
                setStreamingStates(prev => {
                    const state = prev[chatId] ?? { content: '', reasoning: '', speed: null, variants: {} }
                    const variants = { ...state.variants }
                    variants[index] = { content: response.content || '', reasoning: response.reasoning || '' }

                    return {
                        ...prev,
                        [chatId]: {
                            ...state,
                            content: index === 0 ? response.content || '' : state.content,
                            reasoning: index === 0 ? response.reasoning : state.reasoning,
                            variants
                        }
                    }
                })

                // Update chat message with this variant's content
                setChats(prev => prev.map(c => {
                    if (c.id !== chatId) { return c }
                    return {
                        ...c,
                        messages: c.messages.map(m => {
                            if (m.id !== assistantId) { return m }
                            const updatedVariants = [...(m.variants || [])]
                            if (updatedVariants[index]) {
                                updatedVariants[index] = {
                                    ...updatedVariants[index],
                                    content: response.content || '',
                                }
                            }
                            return {
                                ...m,
                                content: index === 0 ? response.content || '' : m.content,
                                reasoning: index === 0 ? response.reasoning : m.reasoning,
                                variants: updatedVariants.length > 0 ? updatedVariants : undefined
                            }
                        })
                    }
                }))

            } catch (e) {
                const errText = formatChatError(e as CatchError)
                results[index] = {
                    model: modelInfo.model,
                    provider: modelInfo.provider,
                    content: `${t('common.error')}: ${errText}`,
                    error: errText
                }
            }
        })

        // Wait for all responses
        await Promise.all(promises)

        // Build final message with all variants
        const responseTime = Math.round(performance.now() - streamStartTime)
        const finalVariants = results.map((r, idx) => ({
            id: `${assistantId}-v${idx}`,
            content: r.content,
            model: r.model,
            provider: r.provider,
            timestamp: new Date(),
            label: r.model,
            isSelected: idx === 0
        }))

        const finalContent = results[0]?.content || ''
        const finalReasoning = results[0]?.reasoning

        // Generate smart title from first response
        let generatedTitle = ''
        if (finalContent) {
            generatedTitle = finalContent.split('\n')[0].replace(/[#*`]/g, '').trim().slice(0, 50) || t('sidebar.newChat')
        }

        // Update chat with final state
        setChats(prev => prev.map(c => {
            if (c.id !== chatId) { return c }
            const shouldUpdateTitle = c.messages.length <= 2 && generatedTitle
            return {
                ...c,
                title: shouldUpdateTitle ? generatedTitle : c.title,
                messages: c.messages.map(m => {
                    if (m.id !== assistantId) { return m }
                    return {
                        ...m,
                        content: finalContent,
                        reasoning: finalReasoning,
                        responseTime,
                        variants: finalVariants.length > 1 ? finalVariants : undefined
                    }
                }),
                isGenerating: false
            }
        }))

        // Save to database
        await window.electron.db.updateMessage(assistantId, {
            content: finalContent,
            reasoning: finalReasoning,
            responseTime,
            variants: finalVariants.length > 1 ? finalVariants : undefined
        })

        if (autoReadEnabled && finalContent) {
            handleSpeak(assistantId, finalContent)
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
