/**
 * Handles message format conversion between different LLM providers.
 */
export class MessageNormalizer {
    /**
     * Converts generic message objects into OpenAI-compatible format.
     */
    static normalizeOpenAIMessages(messages: any[], model?: string): any[] {
        if (!Array.isArray(messages)) return messages;

        // Gemini 3 Thinking models (high/low) usually don't support multimodal input in history
        const shouldStripImages = model && (
            model.includes('gemini-3-pro-high') ||
            model.includes('gemini-3-pro-low')
        );

        return messages.map((message) => {
            if (!message || typeof message !== 'object') return message;
            if (Array.isArray(message.content)) {
                if (shouldStripImages) {
                    const textParts = message.content.filter((p: any) => p.type === 'text');
                    return textParts.length > 0 ? { ...message, content: textParts } : { ...message, content: '' };
                }
                return message;
            }

            const images = Array.isArray(message.images) ? message.images.filter(Boolean) : [];

            if (shouldStripImages || images.length === 0) {
                return {
                    ...message,
                    content: message.content,
                    images: undefined
                };
            }

            const parts: any[] = [];
            const text = typeof message.content === 'string' ? message.content : (message.content == null ? '' : String(message.content));
            if (text.trim()) parts.push({ type: 'text', text });
            for (const img of images) {
                const url = typeof img === 'string' && img.startsWith('data:image/') ? img : `data:image/jpeg;base64,${img}`;
                parts.push({ type: 'image_url', image_url: { url } });
            }
            const { images: _ignored, content: _content, ...rest } = message;
            return { ...rest, content: parts };
        }).filter(msg => {
            if (!msg) return false;
            if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) return true;
            if (typeof msg.content === 'string' && msg.content.trim() !== '') return true;
            if (Array.isArray(msg.content) && msg.content.length > 0) return true;
            return false;
        });
    }

    /**
     * Adapts messages for Anthropic's API format.
     */
    static normalizeAnthropicMessages(messages: any[]): any[] {
        if (!Array.isArray(messages)) return messages;
        return messages.filter(m => m.role !== 'system').map((message) => {
            if (!message || typeof message !== 'object') return message;
            const images = Array.isArray(message.images) ? message.images.filter(Boolean) : [];
            if (images.length === 0) return { role: message.role, content: message.content };

            const content: any[] = [];
            if (message.content) content.push({ type: 'text', text: message.content });
            for (const img of images) {
                const base64 = typeof img === 'string' && img.includes(',') ? img.split(',')[1] : img;
                const mediaType = typeof img === 'string' && img.includes('image/png') ? 'image/png' : 'image/jpeg';
                content.push({
                    type: 'image',
                    source: {
                        type: 'base64',
                        media_type: mediaType,
                        data: base64
                    }
                });
            }
            return { role: message.role, content };
        });
    }

    /**
     * Adapts messages for Google's Gemini API format.
     */
    static normalizeGeminiMessages(messages: any[]): any[] {
        if (!Array.isArray(messages)) return messages;
        return messages.map((message) => {
            if (!message || typeof message !== 'object') return message;
            const role = message.role === 'assistant' ? 'model' : 'user';
            const images = Array.isArray(message.images) ? message.images.filter(Boolean) : [];

            const parts: any[] = [];
            if (message.content) parts.push({ text: message.content });
            for (const img of images) {
                const base64 = typeof img === 'string' && img.includes(',') ? img.split(',')[1] : img;
                const mimeType = typeof img === 'string' && img.includes('image/png') ? 'image/png' : 'image/jpeg';
                parts.push({
                    inline_data: {
                        mime_type: mimeType,
                        data: base64
                    }
                });
            }
            return { role, parts };
        });
    }
}
