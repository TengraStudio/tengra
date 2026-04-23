/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ChatMessage } from '@main/types/llm.types';
import { Message } from '@shared/types/chat';
import { JsonObject } from '@shared/types/common';
import {
    AnthropicContentBlock,
    AnthropicMessage,
    OpenAIContentPart,
    OpenAIMessage
} from '@shared/types/llm-provider-types';

const MAX_MESSAGES = 1000;
const MAX_CONTENT_PARTS = 100;
const MAX_IMAGES = 20;

type OpenCodeInputText = { type: 'input_text'; text: string };
type OpenCodeOutputText = { type: 'output_text'; text: string };
type OpenCodeInputImage = { type: 'input_image'; image_url: { url: string } };
type OpenCodeFunctionCall = { type: 'function_call'; call_id: string; name: string; arguments: string; thought_signature?: string };
type OpenCodeFunctionCallOutput = { type: 'function_call_output'; call_id: string; output: string };
type OpenCodeContentPart =
    | OpenCodeInputText
    | OpenCodeOutputText
    | OpenCodeInputImage
    | OpenCodeFunctionCall
    | OpenCodeFunctionCallOutput;

type NormalizableContentPart = {
    type: string;
    text?: string;
    image_url?: { url: string };
    source?: { type: 'base64'; media_type: string; data: string };
};

type ToolCallLike = NonNullable<Message['toolCalls']>[number];

/**
 * Handles message format conversion between different LLM providers.
 * Ensures compatibility across OpenAI, Anthropic, and OpenCode formats.
 */
export class MessageNormalizer {
    private static sanitizeToolCalls(toolCalls: Message['toolCalls'] | ChatMessage['tool_calls']): ChatMessage['tool_calls'] {
        if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
            return undefined;
        }

        const normalizedToolCalls = toolCalls
            .map((toolCall, index) => {
                const functionName = typeof toolCall.function?.name === 'string'
                    ? toolCall.function.name.trim()
                    : '';
                if (functionName.length === 0) {
                    return null;
                }

                const rawArguments = toolCall.function.arguments;
                const serializedArguments = typeof rawArguments === 'string'
                    ? rawArguments
                    : JSON.stringify(rawArguments ?? {});

                return {
                    ...toolCall,
                    id: this.resolveToolCallId(toolCall, index),
                    function: {
                        ...toolCall.function,
                        name: functionName,
                        arguments: serializedArguments,
                    },
                };
            })
            .filter((toolCall): toolCall is NonNullable<typeof toolCall> => toolCall !== null);

        return normalizedToolCalls.length > 0 ? normalizedToolCalls : undefined;
    }

    private static resolveToolCallId(toolCall: ToolCallLike, index: number): string {
        if (typeof toolCall.id === 'string' && toolCall.id.trim().length > 0) {
            return toolCall.id;
        }

        const functionName = typeof toolCall.function?.name === 'string' && toolCall.function?.name.trim().length > 0
            ? toolCall.function.name.trim()
            : 'tool';
        return `${functionName}-${index}`;
    }

    private static sanitizeToolCallId(message: Message | ChatMessage): string | undefined {
        const rendererToolCallId = (message as Message).toolCallId;
        if (typeof rendererToolCallId === 'string' && rendererToolCallId.trim().length > 0) {
            return rendererToolCallId;
        }
        const mainToolCallId = (message as ChatMessage).tool_call_id;
        if (typeof mainToolCallId === 'string' && mainToolCallId.trim().length > 0) {
            return mainToolCallId;
        }
        return undefined;
    }
    /**
     * Converts generic message objects into OpenAI-compatible format.
     * Enforces a maximum limit on the number of messages processed.
     *
     * @param messages - The array of messages to normalize.
     * @param model - Optional model identifier for model-specific adjustments.
     * @returns An array of OpenAI-compatible messages.
     */
    static normalizeOpenAIMessages(messages: Array<Message | ChatMessage>, model?: string): OpenAIMessage[] {
        if (!Array.isArray(messages)) { return []; }

        const shouldStripImages = this.shouldStripImagesForModel(model);
        const openAIMessages: OpenAIMessage[] = [];
        const count = Math.min(messages.length, MAX_MESSAGES);

        for (let i = 0; i < count; i++) {
            const message = messages[i];
            const isArrayContent = Array.isArray(message.content);
            if (isArrayContent) {
                openAIMessages.push(this.normalizeArrayContent(message, shouldStripImages));
            } else {
                openAIMessages.push(this.normalizeSimpleContent(message, shouldStripImages));
            }
        }

        return openAIMessages.filter(m => this.isValidOpenAIMessage(m));
    }

    /**
     * Checks if images should be stripped for a specific model.
     *
     * @param model - The model identifier.
     * @returns True if images should be removed, false otherwise.
     */
    private static shouldStripImagesForModel(model?: string): boolean {
        return !!model && (
            model.includes('gemini-3-pro-high') ||
            model.includes('gemini-3-pro-low')
        );
    }

    /**
     * Normalizes a message with array content.
     *
     * @param message - The message with array content.
     * @param shouldStripImages - Whether to remove image parts.
     * @returns An OpenAI-compatible message.
     */
    private static normalizeArrayContent(message: Message | ChatMessage, shouldStripImages: boolean): OpenAIMessage {
        // Enforce NASA Rule 2: Upper bound on content parts
        const rawContent = message.content as NormalizableContentPart[];
        const limit = Math.min(rawContent.length, MAX_CONTENT_PARTS);
        const contentParts: OpenAIContentPart[] = [];

        for (let i = 0; i < limit; i++) {
            const part = rawContent[i];
            if (part.type === 'text' && typeof part.text === 'string') {
                contentParts.push({ type: 'text' as const, text: part.text });
            } else if (part.type === 'image_url' && part.image_url?.url) {
                contentParts.push({ type: 'image_url' as const, image_url: { url: part.image_url.url } });
            } else if (part.type === 'image' && part.source?.data) {
                const mediaType = part.source.media_type || 'image/png';
                contentParts.push({ type: 'image_url' as const, image_url: { url: `data:${mediaType};base64,${part.source.data}` } });
            }
        }

        if (shouldStripImages) {
            const text = contentParts
                .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
                .map((p) => p.text)
                .join('');
            return {
                role: message.role as OpenAIMessage['role'],
                content: text
            };
        }

        const role = message.role as OpenAIMessage['role'];
        return {
            role,
            content: contentParts,
            ...(role === 'assistant'
                ? { tool_calls: this.sanitizeToolCalls((message as Message).toolCalls ?? (message as ChatMessage).tool_calls) }
                : {}),
            ...(role === 'tool'
                ? { tool_call_id: this.sanitizeToolCallId(message) }
                : {})
        };
    }

    /**
     * Normalizes a message with simple (string) content, potentially attaching side-channel images.
     *
     * @param message - The message object.
     * @param shouldStripImages - Whether to include images.
     * @returns An OpenAI-compatible message.
     */
    private static normalizeSimpleContent(message: Message | ChatMessage, shouldStripImages: boolean): OpenAIMessage {
        const images = Array.isArray(message.images) ? message.images.filter((img): img is string => !!img) : [];
        const role = message.role as OpenAIMessage['role'];
        const toolCallId = this.sanitizeToolCallId(message);
        const toolCalls = this.sanitizeToolCalls((message as Message).toolCalls ?? (message as ChatMessage).tool_calls);

        if (shouldStripImages || images.length === 0) {
            const textContent = typeof message.content === 'string' ? message.content : '';
            return {
                role,
                content: textContent,
                ...(role === 'assistant' ? { tool_calls: toolCalls } : {}),
                ...(role === 'tool' ? { tool_call_id: toolCallId } : {}),
            };
        }

        const parts: OpenAIContentPart[] = [];
        const text = typeof message.content === 'string' ? message.content : String(message.content);
        const trimmedText = text.trim();

        if (trimmedText) {
            parts.push({ type: 'text' as const, text });
        }

        this.addImagesToOpenAIParts(parts, images);

        return {
            role,
            content: parts,
            ...(role === 'assistant' ? { tool_calls: toolCalls } : {}),
            ...(role === 'tool' ? { tool_call_id: toolCallId } : {})
        };
    }

    /**
     * Adds image parts to the OpenAI content array.
     *
     * @param parts - The target content parts array.
     * @param images - The list of image strings (URL or base64).
     */
    private static addImagesToOpenAIParts(parts: OpenAIContentPart[], images: string[]): void {
        const limit = Math.min(images.length, MAX_IMAGES);
        for (let i = 0; i < limit; i++) {
            const img = images[i];
            const url = typeof img === 'string' && img.startsWith('data:image/') ? img : `data:image/jpeg;base64,${img}`;
            parts.push({ type: 'image_url' as const, image_url: { url } });
        }
    }

    /**
     * Validates if the message is structurally valid for OpenAI API.
     *
     * @param m - The OpenAI message to validate.
     * @returns True if valid, false otherwise.
     */
    private static isValidOpenAIMessage(m: OpenAIMessage): boolean {
        if (m.role === 'tool') {
            if (typeof m.tool_call_id !== 'string' || m.tool_call_id.trim().length === 0) {
                return false;
            }
            return typeof m.content === 'string';
        }
        if (Array.isArray(m.tool_calls) && m.tool_calls.length > 0) { return true; }
        if (typeof m.content === 'string' && m.content.trim() !== '') { return true; }
        if (Array.isArray(m.content) && m.content.length > 0) { return true; }
        return false;
    }

    /**
     * Adapts messages for Anthropic's API format.
     *
     * @param messages - The source messages.
     * @returns An array of Anthropic-compatible messages.
     */
    static normalizeAnthropicMessages(messages: Array<Message | ChatMessage>): AnthropicMessage[] {
        if (!Array.isArray(messages)) { return []; }
        const result: AnthropicMessage[] = [];
        const limit = Math.min(messages.length, MAX_MESSAGES);

        for (let i = 0; i < limit; i++) {
            const message = messages[i];
            if (message.role === 'system') {
                continue;
            }
            
            // Handle tool role messages (tool results)
            if (message.role === 'tool') {
                const toolCallId = this.sanitizeToolCallId(message);
                if (!toolCallId) {
                    continue;
                }
                const toolOutput = typeof message.content === 'string' ? message.content : '';
                // Anthropic requires tool results in a user message with tool_result blocks
                result.push({
                    role: 'user',
                    content: [{
                        type: 'tool_result' as const,
                        tool_use_id: toolCallId,
                        content: toolOutput
                    }]
                });
                continue;
            }
            
            result.push(this.normalizeAnthropicMessage(message));
        }
        return result;
    }

    /**
     * Normalizes a single message for Anthropic.
     *
     * @param message - The generic message.
     * @returns The Anthropic message.
     */
    private static normalizeAnthropicMessage(message: Message | ChatMessage): AnthropicMessage {
        const imageArray = Array.isArray(message.images) ? message.images : [];
        const images = imageArray.filter((img): img is string => !!img);
        const content: AnthropicContentBlock[] = [];
        
        // For assistant messages with tool calls, add tool_use blocks
        if (message.role === 'assistant') {
            const toolCalls = (message as Message).toolCalls || (message as ChatMessage).tool_calls;
            if (Array.isArray(toolCalls) && toolCalls.length > 0) {
                for (const tc of toolCalls) {
                    const funcName = tc.function?.name;
                    if (!funcName) { continue; }
                    
                    let inputObj: JsonObject = {};
                    try {
                        const args = tc.function.arguments;
                        inputObj = typeof args === 'string' ? JSON.parse(args) as JsonObject : (args as JsonObject ?? {});
                    } catch {
                        inputObj = {};
                    }
                    
                    content.push({
                        type: 'tool_use' as const,
                        id: tc.id || `tool_${Date.now()}`,
                        name: funcName,
                        input: inputObj
                    });
                }
            }
        }
        
        // Add text content
        if (message.content && typeof message.content === 'string') {
            content.push({ type: 'text' as const, text: message.content });
        }
        
        // Add images
        if (images.length > 0) {
            this.addImagesToAnthropicContent(content, images);
        }
        
        // If no content blocks, add empty text to avoid API error
        if (content.length === 0) {
            content.push({ type: 'text' as const, text: '' });
        }
        
        return { role: message.role as 'user' | 'assistant', content };
    }

    /**
     * Adds images to Anthropic content blocks.
     *
     * @param content - The target content array.
     * @param images - The list of image strings.
     */
    private static addImagesToAnthropicContent(content: AnthropicContentBlock[], images: string[]): void {
        const limit = Math.min(images.length, MAX_IMAGES);
        for (let i = 0; i < limit; i++) {
            const img = images[i];
            const base64 = typeof img === 'string' && img.includes(',') ? img.split(',')[1] : img;
            const mediaType = typeof img === 'string' && img.includes('image/png') ? 'image/png' : 'image/jpeg';
            content.push({
                type: 'image' as const,
                source: {
                    type: 'base64' as const,
                    media_type: mediaType as 'image/png' | 'image/jpeg',
                    data: base64
                }
            });
        }
    }

    /**
     * Adapts messages for OpenCode's /responses API format.
     *
     * @param messages - The source messages.
     * @returns An array suitable for OpenCode API.
     */
    static normalizeOpenCodeResponsesMessages(messages: Array<Message | ChatMessage>): Array<{ role: 'user' | 'assistant'; content: OpenCodeContentPart[] }> {
        if (!Array.isArray(messages)) { return []; }
        const result: Array<{ role: 'user' | 'assistant'; content: OpenCodeContentPart[] }> = [];
        const limit = Math.min(messages.length, MAX_MESSAGES);

        for (let i = 0; i < limit; i++) {
            const msg = messages[i];
            if (msg.role === 'tool') {
                const toolCallId = this.sanitizeToolCallId(msg);
                if (!toolCallId) {
                    continue;
                }
                const toolOutput = typeof msg.content === 'string'
                    ? msg.content
                    : '';
                result.push({
                    role: 'user',
                    content: [{
                        type: 'function_call_output',
                        call_id: toolCallId,
                        output: toolOutput
                    }]
                });
                continue;
            }
            const role = (msg.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant';
            const contentParts: OpenCodeContentPart[] = [];
            const assistantToolCalls = (msg as Message).toolCalls;
            if (msg.role === 'assistant' && Array.isArray(assistantToolCalls) && assistantToolCalls.length > 0) {
                this.addAssistantToolCallsToOpenCodeParts(contentParts, assistantToolCalls);
            }
            this.addContentToOpenCodeParts(contentParts, msg.content, role);

            if (contentParts.length > 0) {
                result.push({ role, content: contentParts });
            }
        }

        return result;
    }

    /**
     * Adds content to OpenCode parts array.
     *
     * @param parts - The target parts array.
     * @param content - The content (string or array).
     * @param role - The role of the message sender.
     */
    private static addContentToOpenCodeParts(parts: OpenCodeContentPart[], content: string | Message['content'] | RuntimeValue[], role: 'user' | 'assistant'): void {
        const text = typeof content === 'string' ? content : '';
        const textType = role === 'assistant' ? 'output_text' : 'input_text';

        if (text) {
            parts.push({ type: textType as 'input_text' | 'output_text', text });
        } else if (Array.isArray(content)) {
            // Safe cast assuming compatible structure; validated in loop
            this.processOpenCodeArrayContent(parts, content as NormalizableContentPart[], textType);
        }
    }

    private static addAssistantToolCallsToOpenCodeParts(parts: OpenCodeContentPart[], toolCalls: NonNullable<Message['toolCalls']>): void {
        const limit = Math.min(toolCalls.length, MAX_CONTENT_PARTS);
        for (let i = 0; i < limit; i++) {
            const toolCall = toolCalls[i];
            const callId = this.resolveToolCallId(toolCall, i);
            if (callId.trim().length === 0 || toolCall.function.name.trim().length === 0) {
                continue;
            }
            parts.push({
                type: 'function_call',
                call_id: callId,
                name: toolCall.function.name,
                arguments: toolCall.function.arguments,
                thought_signature: (toolCall.function as { thought_signature?: string }).thought_signature
            });
        }
    }

    /**
     * Processes array content for OpenCode format.
     *
     * @param parts - The target parts array.
     * @param content - The content parts.
     * @param textType - The text type identifier ('input_text' or 'output_text').
     */
    private static processOpenCodeArrayContent(parts: OpenCodeContentPart[], content: NormalizableContentPart[], textType: string): void {
        const limit = Math.min(content.length, MAX_CONTENT_PARTS);
        for (let i = 0; i < limit; i++) {
            const part = content[i];
            if (part.type === 'text' && part.text) {
                parts.push({ type: textType as 'input_text', text: part.text });
            }
            if (part.type === 'image_url' && part.image_url?.url) {
                // Images are typically input only
                parts.push({ type: 'input_image', image_url: { url: part.image_url.url } });
            }
        }
    }
}
