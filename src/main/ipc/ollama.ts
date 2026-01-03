import { ipcMain } from 'electron'
import { OllamaService } from '../services/ollama.service'
import { SettingsService } from '../services/settings.service'
import { CopilotService } from '../services/copilot.service'
import { OpenAIService } from '../services/openai.service'
import { ToolExecutor } from '../tools/tool-executor'

export function registerOllamaIpc(options: {
    ollamaService: OllamaService
    settingsService: SettingsService
    copilotService: CopilotService
    openaiService: OpenAIService
    toolExecutor: ToolExecutor
}) {
    const {
        ollamaService,
        settingsService,
        copilotService,
        openaiService,
        toolExecutor
    } = options

    ipcMain.handle('ollama:tags', async () => {
        return ollamaService.getModels()
    })

    ipcMain.handle('ollama:getModels', async () => {
        return await ollamaService.getModels()
    })

    ipcMain.handle('ollama:isRunning', async () => {
        return await ollamaService.isOllamaRunning()
    })

    ipcMain.handle('ollama:chat', async (_event, messages, model) => {
        return await ollamaService.chat(messages, model)
    })

    ipcMain.handle('ollama:chatStream', async (event, messages, model, tools) => {
        const settings = settingsService.getSettings()

        // Check if this is a cloud model (GPT, Claude, Gemini, etc.)
        const cloudModelPrefixes = ['gpt-', 'claude-', 'gemini-', 'o1-', 'o3-', 'copilot-', 'github-']
        const isCloudModel = cloudModelPrefixes.some(prefix => model.toLowerCase().startsWith(prefix))

        // PRIORITY 1: Native Copilot
        const copilotToken = settings.copilot?.token || settings.github?.token;

        if (copilotToken && isCloudModel) {
            const dynamicTools = toolExecutor.getToolDefinitions()
            console.log(`[Main] Routing ${model} to Native Copilot with ${dynamicTools.length} tools`)
            try {
                // Ensure copilot service has the correct token
                copilotService.setGithubToken(copilotToken)

                let currentMessages = [...messages]
                let maxToolLoops = 10 // Prevent infinite loops

                while (maxToolLoops > 0) {
                    maxToolLoops--

                    const stream = await copilotService.streamChat(currentMessages, model, dynamicTools)
                    if (!stream) {
                        throw new Error('No stream returned from Copilot')
                    }

                    const reader = stream.getReader()
                    const decoder = new TextDecoder()
                    let fullContent = ''
                    let buffer = ''
                    let toolCalls: any[] = []

                    while (true) {
                        const { done, value } = await reader.read()
                        if (done) break

                        buffer += decoder.decode(value, { stream: true })
                        const lines = buffer.split('\n')
                        buffer = lines.pop() || ''

                        for (const line of lines) {
                            const trimmed = line.trim()
                            if (!trimmed || !trimmed.startsWith('data:')) continue

                            const data = trimmed.slice(5).trim()
                            if (data === '[DONE]') continue

                            try {
                                const json = JSON.parse(data)
                                const choices = json.choices || json.data?.choices
                                const delta = choices?.[0]?.delta

                                // Handle regular content
                                if (delta?.content) {
                                    fullContent += delta.content
                                    event.sender.send('ollama:streamChunk', delta.content)
                                }

                                // Handle tool calls (streaming format)
                                if (delta?.tool_calls) {
                                    for (const tc of delta.tool_calls) {
                                        if (tc.index !== undefined) {
                                            if (!toolCalls[tc.index]) {
                                                toolCalls[tc.index] = { id: '', type: 'function', function: { name: '', arguments: '' } }
                                            }
                                            if (tc.id) toolCalls[tc.index].id = tc.id
                                            if (tc.function?.name) toolCalls[tc.index].function.name += tc.function.name
                                            if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments
                                        }
                                    }
                                }
                            } catch {
                                // Skip malformed JSON
                            }
                        }
                    }

                    reader.releaseLock()

                    // Filter out empty tool calls
                    toolCalls = toolCalls.filter(tc => tc && tc.function?.name)

                    // If no tool calls, we're done
                    if (toolCalls.length === 0) {
                        return { content: fullContent, role: 'assistant' }
                    }

                    // Execute tool calls
                    console.log(`[Main] Copilot requested ${toolCalls.length} tool call(s)`)
                    event.sender.send('ollama:streamChunk', '\n\n§Y"õ *AraÇõ ÇõalŽñYtŽñrŽñlŽñyor...*\n')

                    // Add assistant message with tool calls
                    currentMessages.push({
                        role: 'assistant',
                        content: fullContent || null,
                        tool_calls: toolCalls
                    })

                    // Execute each tool and add results
                    for (const toolCall of toolCalls) {
                        try {
                            const args = JSON.parse(toolCall.function.arguments || '{}')
                            console.log(`[Main] Executing tool: ${toolCall.function.name}`, args)

                            const result = await toolExecutor.execute(toolCall.function.name, args)

                            currentMessages.push({
                                role: 'tool',
                                tool_call_id: toolCall.id,
                                content: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
                            })
                        } catch (toolError: any) {
                            currentMessages.push({
                                role: 'tool',
                                tool_call_id: toolCall.id,
                                content: `Error: ${toolError.message}`
                            })
                        }
                    }

                    // Continue the loop to get the final response
                }

                return { error: 'Max tool loops exceeded' }
            } catch (error: any) {
                console.error('[Main] Copilot Stream Error:', error)
                // Fall through to proxy or return error
                if (!settings.proxy?.enabled) {
                    return { error: error.message }
                }
                console.log('[Main] Falling back to Proxy...')
            }
        }

        // PRIORITY 2: Proxy (if enabled and it's a cloud model)
        if (settings.proxy?.enabled && isCloudModel) {
            console.log(`[Main] Routing ${model} to Proxy: ${settings.proxy.url}`)
            try {
                let fullContent = ''
                for await (const chunk of openaiService.streamChat(messages, model)) {
                    fullContent += chunk
                    event.sender.send('ollama:streamChunk', chunk)
                }
                return { content: fullContent, role: 'assistant' }
            } catch (error: any) {
                console.error('[Main] Proxy Stream Error:', error)
                return { error: error.message }
            }
        }

        // PRIORITY 3: Local Ollama
        console.log(`[Main] Routing ${model} to Ollama`)
        return await ollamaService.chatStream(messages, model, tools, (chunk) => {
            event.sender.send('ollama:streamChunk', chunk)
        })
    })

    ipcMain.handle('ollama:getLibraryModels', async () => {
        return await ollamaService.getLibraryModels()
    })
}
