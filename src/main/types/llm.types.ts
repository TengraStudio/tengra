
import { ToolDefinition } from '../../shared/types';

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
    id: string;
    type: 'function';
    function: {
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
    tool_calls?: ToolCall[];
    completionTokens?: number;
    reasoning_content?: string;
    images?: string[];
}
