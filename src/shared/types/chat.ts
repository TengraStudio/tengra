import { JsonObject, JsonValue } from '@/types/common';

export interface Attachment {
    id: string
    name: string
    type: 'image' | 'video' | 'audio' | 'file' | 'text' | 'application'
    size: number
    status: 'uploading' | 'ready' | 'error'
    mimeType?: string | undefined
    preview?: string | undefined
    file?: File | undefined
    content?: string | undefined
    error?: string | undefined
}

export interface ToolCall {
    id: string
    index?: number
    type: 'function'
    function: {
        name: string
        arguments: string
    }
}

export interface ToolDefinition {
    type: 'function';
    function: {
        name: string;
        description?: string | undefined;
        parameters?: JsonObject | undefined;
    };
}

export interface ToolResult {
    toolCallId: string
    name: string
    result: JsonValue
    isImage?: boolean | undefined
    success?: boolean | undefined
    error?: string | undefined
}

export interface TextContent {
    type: 'text';
    text: string;
}

export interface ImageContent {
    type: 'image_url';
    image_url: {
        url: string;
        detail?: 'auto' | 'low' | 'high';
    };
}

export type MessageContentPart = TextContent | ImageContent;

export interface MessageVariant {
    id: string
    content: string
    model?: string
    provider?: string
    timestamp: Date
    label?: string // e.g. "Draft 1", "Creative", "Concise"
    isSelected?: boolean
}

export interface Message {
    id: string
    chatId?: string | undefined // Reference to parent chat
    role: 'user' | 'assistant' | 'system' | 'tool'
    content: string | MessageContentPart[]
    timestamp: Date
    images?: string[] | undefined
    reasoning?: string | undefined
    toolCalls?: ToolCall[] | undefined
    toolCallId?: string | undefined
    toolResults?: ToolResult[] | string | undefined // Can be string in DB
    isPinned?: boolean | undefined
    isBookmarked?: boolean | undefined
    provider?: string | undefined
    model?: string | undefined
    responseTime?: number | undefined
    rating?: 1 | -1 | 0 | undefined
    reactions?: string[] | undefined
    sources?: string[] | undefined
    variants?: MessageVariant[] | undefined // Alternative responses
    attachments?: Attachment[] | undefined
}

export interface Chat {
    id: string
    title: string
    model: string
    backend?: string | undefined // Added for compatibility
    messages: Message[]
    createdAt: Date
    updatedAt: Date
    isPinned?: boolean | undefined
    isArchived?: boolean | undefined
    isFavorite?: boolean | undefined
    folderId?: string | undefined
    workspaceId?: string | undefined
    metadata?: JsonObject | undefined
    isGenerating?: boolean | undefined // Transient state for UI
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

export type SystemMode = 'thinking' | 'agent' | 'fast' | 'architect';

export interface ChatRequest {
    messages: Message[]
    model: string
    tools?: ToolDefinition[]
    provider?: string
    options?: JsonObject
    workspaceId?: string
    systemMode?: SystemMode
}

export interface ChatStreamRequest extends ChatRequest {
    chatId?: string
}

export type ChatErrorKind = 'provider_unavailable' | 'quota_exhausted' | 'timeout' | 'generic';

export interface ChatError {
    kind: ChatErrorKind;
    message: string;
    resetsAt?: number | null;
    model?: string | null;
}
