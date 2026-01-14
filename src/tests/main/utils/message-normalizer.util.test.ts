import { describe, it, expect } from 'vitest';
import { MessageNormalizer } from '@main/utils/message-normalizer.util';

describe('MessageNormalizer', () => {
    describe('normalizeOpenAIMessages', () => {
        it('should strip images for Gemini 3 Thinking models', () => {
            const messages = [
                { role: 'user', content: 'hello', images: ['base64data'] }
            ];
            const normalized = MessageNormalizer.normalizeOpenAIMessages(messages as any, 'gemini-3-pro-high');
            expect((normalized[0] as any).images).toBeUndefined();
            expect(normalized[0].content).toBe('hello');
        });

        it('should format images correctly for OpenAI', () => {
            const messages = [
                { role: 'user', content: 'look', images: ['base64data'] }
            ];
            const normalized = MessageNormalizer.normalizeOpenAIMessages(messages as any, 'gpt-4o');
            expect(Array.isArray(normalized[0].content)).toBe(true);
            const content = normalized[0].content as Array<any>;
            expect(content[0]).toEqual({ type: 'text', text: 'look' });
            expect(content[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,base64data' } });
        });
    });

    describe('normalizeAnthropicMessages', () => {
        it('should filter system messages', () => {
            const messages = [
                { role: 'system', content: 'sys' },
                { role: 'user', content: 'hi' }
            ];
            const normalized = MessageNormalizer.normalizeAnthropicMessages(messages as any);
            expect(normalized).toHaveLength(1);
            expect(normalized[0].role).toBe('user');
        });

        it('should format images for Anthropic', () => {
            const messages = [
                { role: 'user', content: 'hi', images: ['base64data'] }
            ];
            const normalized = MessageNormalizer.normalizeAnthropicMessages(messages as any);
            expect((normalized[0].content as any)[1]).toEqual({
                type: 'image',
                source: {
                    type: 'base64',
                    media_type: 'image/jpeg',
                    data: 'base64data'
                }
            });
        });
    });


});
