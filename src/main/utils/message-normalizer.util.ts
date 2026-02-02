import { ChatMessage } from '@main/types/llm.types';
import { Message } from '@shared/types/chat';
import {
    AnthropicContentBlock,
    AnthropicMessage,
    OpenAIContentPart,
    OpenAIMessage
} from '@shared/types/llm-provider-types';

type OpenCodeContentPart =
    | { type: 'input_text'; text: string }
    | { type: 'input_image'; image_url: { url: string } }

/**
 * Handles message format conversion between different LLM providers.
 */
export class MessageNormalizer {
    /**
     * Converts generic message objects into OpenAI-compatible format.
     */
    static normalizeOpenAIMessages(messages: Array<Message | ChatMessage>, model?: string): OpenAIMessage[] {
        if (!Array.isArray(messages)) { return []; }

        const shouldStripImages = this.shouldStripImagesForModel(model);
        const openAIMessages: OpenAIMessage[] = [];

        for (const message of messages) {
            const isArrayContent = Array.isArray(message.content);
            if (isArrayContent) {
                openAIMessages.push(this.normalizeArrayContent(message, shouldStripImages));
            } else {
                openAIMessages.push(this.normalizeSimpleContent(message, shouldStripImages));
            }
        }

        return openAIMessages.filter(m => this.isValidOpenAIMessage(m));
    }

    private static shouldStripImagesForModel(model?: string): boolean {
        return !!model && (
            model.includes('gemini-3-pro-high') ||
            model.includes('gemini-3-pro-low')
        );
    }

    private static normalizeArrayContent(message: Message | ChatMessage, shouldStripImages: boolean): OpenAIMessage {
        type NormalizableContentPart = {
            type: string
            text?: string
            image_url?: { url: string }
            source?: { type: 'base64'; media_type: string; data: string }
        }

        const contentParts: OpenAIContentPart[] = (message.content as NormalizableContentPart[])
            .map((part) => {
                if (part.type === 'text' && typeof part.text === 'string') {
                    return { type: 'text' as const, text: part.text };
                }
                if (part.type === 'image_url' && part.image_url?.url) {
                    return { type: 'image_url' as const, image_url: { url: part.image_url.url } };
                }
                if (part.type === 'image' && part.source?.data) {
                    const mediaType = part.source.media_type || 'image/png';
                    return { type: 'image_url' as const, image_url: { url: `data:${mediaType};base64,${part.source.data}` } };
                }
                return null;
            })
            .filter((part): part is OpenAIContentPart => part !== null);

        if (shouldStripImages) {
            const text = contentParts.filter((p) => p.type === 'text').map((p) => (p as { text: string }).text).join('');
            return {
                role: message.role as OpenAIMessage['role'],
                content: text
            };
        }

        return {
            role: message.role as OpenAIMessage['role'],
            content: contentParts,
            tool_calls: (message as Message).toolCalls,
            tool_call_id: (message as Message).toolCallId
        };
    }

    private static normalizeSimpleContent(message: Message | ChatMessage, shouldStripImages: boolean): OpenAIMessage {
        const images = Array.isArray(message.images) ? message.images.filter((img): img is string => !!img) : [];

        if (shouldStripImages || images.length === 0) {
            const textContent = typeof message.content === 'string' ? message.content : '';
            return {
                role: message.role as OpenAIMessage['role'],
                content: textContent,
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
            role: message.role as OpenAIMessage['role'],
            content: parts,
            tool_calls: (message as Message).toolCalls,
            tool_call_id: (message as Message).toolCallId
        };
    }

    private static addImagesToOpenAIParts(parts: OpenAIContentPart[], images: string[]): void {
        for (const img of images) {
            const url = typeof img === 'string' && img.startsWith('data:image/') ? img : `data:image/jpeg;base64,${img}`;
            parts.push({ type: 'image_url' as const, image_url: { url } });
        }
    }

    private static isValidOpenAIMessage(m: OpenAIMessage): boolean {
        if (m.role === 'tool') { return true; }
        if (Array.isArray(m.tool_calls) && m.tool_calls.length > 0) { return true; }
        if (typeof m.content === 'string' && m.content.trim() !== '') { return true; }
        if (Array.isArray(m.content) && m.content.length > 0) { return true; }
        return false;
    }

    /**
     * Adapts messages for Anthropic's API format.
     */
    static normalizeAnthropicMessages(messages: Array<Message | ChatMessage>): AnthropicMessage[] {
        if (!Array.isArray(messages)) { return []; }
        return messages.filter(m => m.role !== 'system').map((message) => {
            return this.normalizeAnthropicMessage(message);
        }) as AnthropicMessage[];
    }

    private static normalizeAnthropicMessage(message: Message | ChatMessage): AnthropicMessage {
        const imageArray = Array.isArray(message.images) ? message.images : [];
        const images = imageArray.filter((img): img is string => !!img);
        if (images.length === 0) {
            const textContent = typeof message.content === 'string' ? message.content : '';
            return { role: message.role as 'user' | 'assistant', content: textContent };
        }

        const content: AnthropicContentBlock[] = [];
        if (message.content && typeof message.content === 'string') {
            content.push({ type: 'text' as const, text: message.content });
        }
        this.addImagesToAnthropicContent(content, images);
        return { role: message.role as 'user' | 'assistant', content };
    }

    private static addImagesToAnthropicContent(content: AnthropicContentBlock[], images: string[]): void {
        for (const img of images) {
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
     */
    static normalizeOpenCodeResponsesMessages(messages: Array<Message | ChatMessage>): Array<{ role: 'user' | 'assistant'; content: OpenCodeContentPart[] }> {
        if (!Array.isArray(messages)) { return []; }
        return messages.map(msg => {
            const role = (msg.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant';
            const contentParts: OpenCodeContentPart[] = [];
            this.addContentToOpenCodeParts(contentParts, msg.content, role);

            return {
                role,
                content: contentParts
            };
        }).filter(m => m.content.length > 0);
    }

    private static addContentToOpenCodeParts(parts: OpenCodeContentPart[], content: string | Message['content'], role: 'user' | 'assistant'): void {
        const text = typeof content === 'string' ? content : '';
        const textType = role === 'assistant' ? 'output_text' : 'input_text';

        if (text) {
            parts.push({ type: textType as 'input_text', text });
        } else if (Array.isArray(content)) {
            this.processOpenCodeArrayContent(parts, content, textType);
        }
    }

    private static processOpenCodeArrayContent(parts: OpenCodeContentPart[], content: { type: string; text?: string; image_url?: { url: string } }[], textType: string): void {
        for (const part of content) {
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
