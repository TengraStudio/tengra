export interface Message {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    images?: string[]
    toolCalls?: ToolCall[]
    toolResults?: ToolResult[]
    timestamp: Date
    provider?: string
    model?: string
    isPinned?: boolean
    reactions?: string[]
}

export interface ToolCall {
    id: string
    name: string
    arguments: any
}

export interface ToolResult {
    toolCallId: string
    name: string
    result: any
    isImage?: boolean
    error?: any
}

export interface Chat {
    id: string
    title: string
    messages: Message[]
    model?: string
    backend?: 'ollama' | 'llama.cpp' | 'openai' | 'anthropic' | 'claude' | 'gemini' | 'groq' | 'antigravity' | 'copilot'
    createdAt: Date
    updatedAt?: Date
    isPinned?: boolean
    isArchived?: boolean
    isFavorite?: boolean
    folderId?: string
}

export interface Folder {
    id: string
    name: string
    createdAt: number
    updatedAt: number
}

export interface Attachment {
    file: File
    preview?: string
    content?: string
    type: 'image' | 'text' | 'other'
}

export interface Toast {
    id: string
    message: string
    type: 'success' | 'error' | 'info'
}
