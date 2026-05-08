/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
    [key: string]: JsonValue | undefined
    id: string
    index?: number
    type: 'function'
    function: {
        [key: string]: JsonValue | undefined
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
    [key: string]: JsonValue | undefined
    toolCallId: string
    name: string
    result: JsonValue
    isImage?: boolean | undefined
    success?: boolean | undefined
    error?: string | undefined
    errorType?: 'permission' | 'timeout' | 'unknown' | string | undefined
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
    status?: 'completed' | 'interrupted'
    error?: string
}

export interface ChatRecoveryMetadata {
    interruptedToolCallIds?: string[]
    interruptedToolNames?: string[]
}

export interface Message {
    [key: string]: unknown;
    id: string
    chatId?: string | undefined // Reference to parent chat
    role: 'user' | 'assistant' | 'system' | 'tool'
    content: string | MessageContentPart[]
    timestamp: Date
    images?: string[] | undefined
    reasoning?: string | undefined
    reasonings?: string[] | undefined // Multiple reasoning segments
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
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;
    metadata?: JsonObject | undefined;
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
    color?: string | undefined;
    createdAt: number | Date;
    updatedAt: number | Date;
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
    accountId?: string
}

export interface ChatStreamRequest extends ChatRequest {
    chatId?: string
    assistantId?: string
    streamId?: string
}

export type ChatErrorKind =
    | 'provider_unavailable'
    | 'quota_exhausted'
    | 'capacity_exhausted'
    | 'rate_limited'
    | 'timeout'
    | 'auth'
    | 'permission_denied'
    | 'generic';

export interface ChatError {
    kind: ChatErrorKind;
    message: string;
    resetsAt?: number | null;
    model?: string | null;
    code?: number | null;
    reason?: string | null;
    retryable?: boolean;
}

export interface SearchChatsOptions {
    query?: string;
    folderId?: string;
    isPinned?: boolean;
    isFavorite?: boolean;
    isArchived?: boolean;
    startDate?: number;
    endDate?: number;
    limit?: number;
}

