import { Message } from '../../shared/types/chat';
import { ChatMessage } from '../types/llm.types';
import {
    OpenAIMessage,
    AnthropicMessage,
    AnthropicContentBlock,

    OpenAIContentPart
} from '../../shared/types/llm-provider-types';

/**
 * Handles message format conversion between different LLM providers.
 */
export class MessageNormalizer {
    /**
     * Converts generic message objects into OpenAI-compatible format.
     */
    static normalizeOpenAIMessages(messages: Array<Message | ChatMessage>, model?: string): OpenAIMessage[] {
        if (!Array.isArray(messages)) return [];

        // Gemini 3 Thinking models (high/low) usually don't support multimodal input in history
        const shouldStripImages = !!model && (
            model.includes('gemini-3-pro-high') ||
            model.includes('gemini-3-pro-low')
        );

        const openAIMessages: OpenAIMessage[] = [];

        type NormalizableContentPart = {
            type: string
            text?: string
            image_url?: { url: string }
            source?: { type: 'base64'; media_type: string; data: string }
        }

        for (const message of messages) {
            if (!message || typeof message !== 'object') {
                openAIMessages.push({ role: 'user', content: '' });
                continue;
            }

            if (Array.isArray(message.content)) {
                const contentParts: OpenAIContentPart[] = (message.content as NormalizableContentPart[])
                    .map((part) => {
                        if (part.type === 'text' && typeof part.text === 'string') {
                            return { type: 'text', text: part.text }
                        }
                        if (part.type === 'image_url' && part.image_url?.url) {
                            return { type: 'image_url', image_url: { url: part.image_url.url } }
                        }
                        if (part.type === 'image' && part.source?.data) {
                            const mediaType = part.source.media_type || 'image/png'
                            return { type: 'image_url', image_url: { url: `data:${mediaType};base64,${part.source.data}` } }
                        }
                        return null
                    })
                    .filter((part): part is OpenAIContentPart => part !== null)

                if (shouldStripImages) {
                    const text = contentParts.filter((p) => p.type === 'text').map((p) => p.text).join('')
                    openAIMessages.push({
                        role: message.role as OpenAIMessage['role'],
                        content: text
                    })
                } else {
                    openAIMessages.push({
                        role: message.role as OpenAIMessage['role'],
                        content: contentParts
                    })
                }
                continue;
            }

            const images = Array.isArray(message.images) ? message.images.filter((img): img is string => !!img) : [];

            if (shouldStripImages || images.length === 0) {
                openAIMessages.push({
                    role: message.role as OpenAIMessage['role'],
                    content: message.content || '',
                });
                continue;
            }

            const parts: OpenAIContentPart[] = [];
            const text = typeof message.content === 'string' ? message.content : (message.content == null ? '' : String(message.content));
            if (text.trim()) parts.push({ type: 'text', text });
            for (const img of images) {
                const url = typeof img === 'string' && img.startsWith('data:image/') ? img : `data:image/jpeg;base64,${img}`;
                parts.push({ type: 'image_url', image_url: { url } });
            }

            openAIMessages.push({
                role: message.role as OpenAIMessage['role'],
                content: shouldStripImages ? text : parts
            });
        }

        return openAIMessages.filter(m => {
            if (!m) return false;
            // Safe check for valid messages
            if (Array.isArray(m.tool_calls) && m.tool_calls.length > 0) return true;
            if (typeof m.content === 'string' && m.content.trim() !== '') return true;
            if (Array.isArray(m.content) && m.content.length > 0) return true;
            return false;
        });
    }

    /**
     * Adapts messages for Anthropic's API format.
     */
    static normalizeAnthropicMessages(messages: Array<Message | ChatMessage>): AnthropicMessage[] {
        if (!Array.isArray(messages)) return [];
        return messages.filter(m => m.role !== 'system').map((message) => {
            if (!message || typeof message !== 'object') return { role: 'user', content: '' };
            const images = Array.isArray(message.images) ? message.images.filter((img): img is string => !!img) : [];
            if (images.length === 0) return { role: message.role as 'user' | 'assistant', content: message.content || '' };

            const content: AnthropicContentBlock[] = [];
            if (message.content && typeof message.content === 'string') {
                content.push({ type: 'text' as const, text: message.content });
            }
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
            return { role: message.role as 'user' | 'assistant', content };
        }) as AnthropicMessage[];
    }


}
