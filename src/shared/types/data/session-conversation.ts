/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { ChatRequest, ChatStreamRequest, ToolCall } from '../ai/chat';
import type { JsonObject } from '../common';

export interface SessionConversationCompleteResult {
    content: string;
    role: 'assistant';
    toolCalls?: ToolCall[];
    reasoning?: string;
    images?: string[];
    sources?: string[];
    metadata?: JsonObject;
}

export interface SessionConversationStreamStartResult {
    success: boolean;
    queued?: boolean;
    data?: { queued?: boolean };
    error?: { message: string; code?: string };
}

export interface SessionConversationStreamChunk {
    chatId?: string;
    streamId?: string;
    content?: string;
    reasoning?: string;
    done?: boolean;
    type?: 'error' | 'metadata' | 'tool_calls' | 'content' | 'reasoning' | 'images';
    sources?: string[];
    toolCalls?: ToolCall[];
    tool_calls?: ToolCall[];
    error?: string;
}

export interface SessionConversationGenerationStatus {
    chatId?: string;
    isGenerating?: boolean;
}

export interface SessionConversationApi {
    complete: (request: ChatRequest) => Promise<SessionConversationCompleteResult>;
    stream: (request: ChatStreamRequest) => Promise<SessionConversationStreamStartResult>;
    abort: (chatId: string) => void;
    onStreamChunk: (
        callback: (chunk: SessionConversationStreamChunk) => void
    ) => () => void;
    onGenerationStatus: (
        callback: (data: SessionConversationGenerationStatus) => void
    ) => () => void;
}

