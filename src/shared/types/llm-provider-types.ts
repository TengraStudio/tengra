/**
 * Strict type definitions for LLM Provider APIs.
 * Used to eliminate 'any' casts in normalization layers.
 */

import { JsonObject } from '@/types/common';

// --- OpenAI Types ---

export interface OpenAIContentPartText {
    type: 'text';
    text: string;
}

export interface OpenAIContentPartImage {
    type: 'image_url';
    image_url: { url: string };
}

export type OpenAIContentPart = OpenAIContentPartText | OpenAIContentPartImage;

export interface OpenAIToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}

export interface OpenAIMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null | OpenAIContentPart[];
    tool_calls?: OpenAIToolCall[];
    tool_call_id?: string;
    reasoning_content?: string; // DeepSeek/Reasoning models
    reasoning?: string; // Alternate reasoning field
    images?: Array<string | OpenAIContentPartImage>; // Some providers return images here
}

export interface OpenAIUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

export interface OpenAIChoice {
    index: number;
    message: OpenAIMessage;
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'function_call' | null;
}

export interface OpenAIChatCompletion {
    id: string;
    object: 'chat.completion';
    created: number;
    model: string;
    choices: OpenAIChoice[];
    usage?: OpenAIUsage;
    system_fingerprint?: string;
}

// --- Anthropic Types ---

export interface AnthropicMessage {
    role: 'user' | 'assistant';
    content: string | AnthropicContentBlock[];
}

export interface AnthropicContentBlock {
    type: 'text' | 'image' | 'tool_use' | 'tool_result';
    text?: string;
    id?: string;
    name?: string; // for tool_use
    input?: JsonObject; // for tool_use
    tool_use_id?: string; // for tool_result
    content?: string | AnthropicContentBlock[]; // for tool_result
    is_error?: boolean; // for tool_result
    source?: {
        type: 'base64';
        media_type: string;
        data: string;
    };
}

export interface AnthropicUsage {
    input_tokens: number;
    output_tokens: number;
}

export interface AnthropicMessageResponse {
    id: string;
    type: 'message';
    role: 'assistant';
    content: AnthropicContentBlock[];
    model: string;
    stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null;
    stop_sequence: string | null;
    usage: AnthropicUsage;
}

// --- Ollama Types ---

export interface OllamaChatResponse {
    model: string;
    created_at: string;
    message?: {
        role: string;
        content: string;
        images?: string[];
    };
    response?: string; // Legacy/Generate format
    done: boolean;
    total_duration?: number;
    load_duration?: number;
    prompt_eval_count?: number;
    eval_count?: number;
    eval_duration?: number;
}

export interface ThinkingConfig {
    budget_tokens?: number;
    enabled?: boolean;
}
