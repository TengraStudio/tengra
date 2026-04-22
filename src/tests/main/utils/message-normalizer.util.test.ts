/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { MessageNormalizer } from '@main/utils/message-normalizer.util';
import type { AnthropicContentBlock, OpenAIContentPart } from '@shared/types/llm-provider-types';
import { describe, expect, it } from 'vitest';

interface OpenAIMessageWithImages {
    images?: string[];
}

describe('MessageNormalizer', () => {
    describe('normalizeOpenAIMessages', () => {
        it('should strip images for Gemini 3 Thinking models', () => {
            const messages = [
                { role: 'user', content: 'hello', images: ['base64data'] }
            ];
            const normalized = MessageNormalizer.normalizeOpenAIMessages(messages as never, 'gemini-3-pro-high');
            expect((normalized[0] as OpenAIMessageWithImages).images).toBeUndefined();
            expect(normalized[0]!.content).toBe('hello');
        });

        it('should format images correctly for OpenAI', () => {
            const messages = [
                { role: 'user', content: 'look', images: ['base64data'] }
            ];
            const normalized = MessageNormalizer.normalizeOpenAIMessages(messages as never, 'gpt-4o');
            const contentValue = normalized[0]!.content;
            expect(Array.isArray(contentValue)).toBe(true);
            if (!Array.isArray(contentValue)) {
                throw new Error('Expected OpenAI content array');
            }
            const content = contentValue as OpenAIContentPart[];
            expect(content[0]).toEqual({ type: 'text', text: 'look' });
            expect(content[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,base64data' } });
        });

        it('should preserve tool calls for assistant messages with empty string content', () => {
            const messages = [
                {
                    role: 'assistant',
                    content: '',
                    toolCalls: [{
                        id: '',
                        type: 'function' as const,
                        function: {
                            name: 'list_directory',
                            arguments: '{"path":"C:/Users/mockuser/Desktop"}',
                        },
                    }],
                },
            ];
            const normalized = MessageNormalizer.normalizeOpenAIMessages(messages as never, 'gpt-4o');
            expect(normalized[0]?.tool_calls).toEqual([{
                id: 'list_directory-0',
                type: 'function',
                function: {
                    name: 'list_directory',
                    arguments: '{"path":"C:/Users/mockuser/Desktop"}',
                },
            }]);
        });

        it('should map assistant tool calls and tool outputs for OpenCode responses input', () => {
            const normalized = MessageNormalizer.normalizeOpenCodeResponsesMessages([
                {
                    id: 'assistant-1',
                    role: 'assistant',
                    content: '',
                    timestamp: new Date(),
                    toolCalls: [{
                        id: 'tool-0',
                        type: 'function',
                        function: {
                            name: 'list_directory',
                            arguments: '{"path":"C:/Users/mockuser/Desktop"}',
                        },
                    }],
                },
                {
                    id: 'tool-msg-1',
                    role: 'tool',
                    content: '{"entries":["a","b"]}',
                    toolCallId: 'tool-0',
                    timestamp: new Date(),
                },
            ]);

            expect(normalized).toEqual([
                {
                    role: 'assistant',
                    content: [{
                        type: 'function_call',
                        call_id: 'tool-0',
                        name: 'list_directory',
                        arguments: '{"path":"C:/Users/mockuser/Desktop"}',
                    }],
                },
                {
                    role: 'user',
                    content: [{
                        type: 'function_call_output',
                        call_id: 'tool-0',
                        output: '{"entries":["a","b"]}',
                    }],
                },
            ]);
        });

        it('should reject tool role messages without tool_call_id in OpenAI normalization', () => {
            const normalized = MessageNormalizer.normalizeOpenAIMessages([
                {
                    id: 'tool-1',
                    role: 'tool',
                    content: '{"ok":true}',
                    timestamp: new Date(),
                },
            ]);
            expect(normalized).toEqual([]);
        });

        it('should reject assistant tool calls with empty function names', () => {
            const normalized = MessageNormalizer.normalizeOpenAIMessages([
                {
                    id: 'assistant-1',
                    role: 'assistant',
                    content: '',
                    timestamp: new Date(),
                    toolCalls: [{
                        id: '',
                        type: 'function' as const,
                        function: {
                            name: '   ',
                            arguments: '{"path":"C:/Users"}',
                        },
                    }],
                },
            ]);
            expect(normalized).toEqual([]);
        });
    });

    describe('normalizeAnthropicMessages', () => {
        it('should filter system messages', () => {
            const messages = [
                { role: 'system', content: 'sys' },
                { role: 'user', content: 'hi' }
            ];
            const normalized = MessageNormalizer.normalizeAnthropicMessages(messages as never);
            expect(normalized).toHaveLength(1);
            expect(normalized[0]!.role).toBe('user');
        });

        it('should format images for Anthropic', () => {
            const messages = [
                { role: 'user', content: 'hi', images: ['base64data'] }
            ];
            const normalized = MessageNormalizer.normalizeAnthropicMessages(messages as never);
            const contentValue = normalized[0]!.content;
            expect(Array.isArray(contentValue)).toBe(true);
            if (!Array.isArray(contentValue)) {
                throw new Error('Expected Anthropic content array');
            }
            const content = contentValue as AnthropicContentBlock[];
            expect(content[1]).toEqual({
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
