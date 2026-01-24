import { AppSettings, Message, ToolCall } from '@/types'

export interface StreamChunk {
    index?: number
    type?: string
    content?: string
    reasoning?: string
    sources?: string[]
    images?: string[]
    tool_calls?: ToolCall[]
    usage?: { prompt_tokens: number, completion_tokens: number, total_tokens: number }
}

export interface StreamChunkResult {
    updated: boolean
    newContent?: string
    newReasoning?: string
    newSources?: string[]
    newImages?: string[]
    newToolCalls?: ToolCall[]
    speed?: number | null
}

export const formatMessageContent = (msg: Message): Message['content'] => {
    let content = msg.content
    const text = typeof msg.content === 'string' ? msg.content : ''

    if (msg.images && msg.images.length > 0) {
        const contentParts: Array<{ type: string, text?: string, image_url?: { url: string } }> = []
        if (text) { contentParts.push({ type: 'text', text }) }
        for (const img of msg.images) { contentParts.push({ type: 'image_url', image_url: { url: img } }) }
        content = contentParts
    }
    return content
}

export const getPresetOptions = (appSettings: AppSettings | undefined, modelConfig: { presetId?: string }) => {
    const modelPresets = appSettings?.presets ?? []
    const preset = modelPresets.find((p) => p.id === modelConfig.presetId)
    return preset ? {
        temperature: preset.temperature,
        top_p: preset.topP,
        frequency_penalty: preset.frequencyPenalty,
        presence_penalty: preset.presencePenalty,
        max_tokens: preset.maxTokens
    } : {}
}

export const processStreamChunk = (
    chunk: StreamChunk,
    current: { content: string, reasoning: string, sources: string[], images?: string[] },
    streamStartTime: number
): StreamChunkResult => {
    if (chunk.type === 'metadata') {
        return { updated: true, newSources: chunk.sources ?? [] }
    }
    if (chunk.type === 'error') { throw new Error(chunk.content) }
    if (chunk.type === 'reasoning') {
        return { updated: true, newReasoning: current.reasoning + (chunk.content ?? '') }
    }
    if (chunk.type === 'images') {
        const currentImages = current.images ?? []
        const newImages = [...currentImages, ...(chunk.images ?? [])]
        return { updated: true, newImages }
    }
    if (chunk.type === 'tool_calls') {
        return { updated: true, newToolCalls: chunk.tool_calls }
    }
    if (chunk.type === 'content' || (!chunk.type && chunk.content)) {
        const newContent = current.content + (chunk.content ?? '')
        const elapsed = (performance.now() - streamStartTime) / 1000
        const speed = elapsed > 0.5 ? (newContent.length / 4) / elapsed : null
        return { updated: true, newContent, speed }
    }
    return { updated: false }
}
