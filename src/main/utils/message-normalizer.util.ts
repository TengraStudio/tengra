import { ChatMessage } from '@main/types/llm.types';
import { Message } from '@shared/types/chat';
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
type OpenCodeInputImage = { type: 'input_image'; image_url: { url: string } };
type OpenCodeContentPart = OpenCodeInputText | OpenCodeInputImage;

type NormalizableContentPart = {
    type: string;
    text?: string;
    image_url?: { url: string };
    source?: { type: 'base64'; media_type: string; data: string };
};

/**
 * Handles message format conversion between different LLM providers.
 * Ensures compatibility across OpenAI, Anthropic, and OpenCode formats.
 */
export class MessageNormalizer {
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

        return {
            role: message.role as OpenAIMessage['role'],
            content: contentParts,
            tool_calls: (message as Message).toolCalls,
            tool_call_id: (message as Message).toolCallId
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
        if (m.role === 'tool') { return true; }
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
            const role = (msg.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant';
            const contentParts: OpenCodeContentPart[] = [];
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
    private static addContentToOpenCodeParts(parts: OpenCodeContentPart[], content: string | Message['content'] | unknown[], role: 'user' | 'assistant'): void {
        const text = typeof content === 'string' ? content : '';
        const textType = role === 'assistant' ? 'output_text' : 'input_text';

        if (text) {
            parts.push({ type: textType as 'input_text', text });
        } else if (Array.isArray(content)) {
            // Safe cast assuming compatible structure; validated in loop
            this.processOpenCodeArrayContent(parts, content as NormalizableContentPart[], textType);
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
