/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */


import { ToolDefinition } from '@shared/types';
import type { JsonValue } from '@shared/types/common';

/**
 * Role of the message sender.
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool' | 'function';

/**
 * A content part for structured messages (e.g. text + image).
 */
export interface ContentPart {
    type: 'text' | 'image_url' | 'image';
    text?: string;
    image_url?: { url: string };
    source?: {
        type: 'base64';
        media_type: string;
        data: string;
    };
}

/**
 * Represents a tool call within a message.
 */
export interface ToolCall {
    [key: string]: JsonValue | undefined;
    id: string;
    type: 'function';
    function: {
        [key: string]: JsonValue | undefined;
        name: string;
        arguments: string;
    };
}

/**
 * Standard chat message interface.
 */
export interface ChatMessage {
    role: MessageRole;
    content: string | ContentPart[];
    name?: string;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
    // For reasoning models
    images?: string[]; // Legacy/Convenience field for some internal logic
}

/**
 * Options for chat completion requests.
 */
export interface ChatOptions {
    model: string;
    temperature?: number;
    stream?: boolean;
    tools?: ToolDefinition[];
}
/**
 * Standardized response format for OpenAI-compatible chat completions.
 */
export interface OpenAIResponse {
    content: string;
    role: string;
    tool_calls?: ToolCall[] | undefined;
    promptTokens?: number | undefined;
    completionTokens?: number | undefined;
    totalTokens?: number | undefined;
    reasoning_content?: string | undefined;
    images?: string[] | undefined;
    variants?: Array<{
        content: string;
        role: string;
        model?: string;
    }> | undefined;
}
