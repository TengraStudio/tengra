export interface Attachment {
    id: string
    name: string
    type: 'image' | 'video' | 'file' | 'text' | 'application'
    size: number
    status: 'uploading' | 'ready' | 'error'
    preview?: string
    file?: File
    content?: string
    error?: string
}

export interface ToolResult {
    toolCallId: string
    name: string
    result: any
    isImage?: boolean
    success?: boolean
    error?: string
}

export interface Message {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp: Date
    images?: string[]
    reasoning?: string
    toolCalls?: any[]
    toolResults?: ToolResult[] | string // Can be string in DB
    isPinned?: boolean
    isBookmarked?: boolean
    provider?: string
    model?: string
    responseTime?: number
    rating?: 1 | -1 | 0
    reactions?: string[]
    sources?: string[]
}

export interface Chat {
    id: string
    title: string
    model: string
    backend?: string // Added for compatibility
    messages: Message[]
    createdAt: Date
    updatedAt: Date
    isPinned?: boolean
    isArchived?: boolean
    isFavorite?: boolean
    folderId?: string
    isGenerating?: boolean // Transient state for UI
}

export interface Folder {
    id: string
    name: string
    createdAt: Date
    updatedAt: Date
}

export interface Prompt {
    id: string
    title: string
    content: string
    tags: string[]
    createdAt: number
    updatedAt: number
}

export interface Toast {
    id: string
    message: string
    type: 'info' | 'success' | 'error' | 'warning'
}

// Merged above
