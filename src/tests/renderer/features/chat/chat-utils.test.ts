import { describe, expect, it } from 'vitest';

import {
    formatMessageContent,
    getPresetOptions,
    processStreamChunk,
    StreamChunk,
} from '@/features/chat/hooks/utils';
import type { AppSettings, Message } from '@/types';

describe('formatMessageContent', () => {
    it('returns string content when no images', () => {
        const msg = { content: 'Hello world', role: 'user' } as Message;
        expect(formatMessageContent(msg)).toBe('Hello world');
    });

    it('returns multipart content when images are present', () => {
        const msg = {
            content: 'Look at this',
            images: ['data:image/png;base64,abc'],
            role: 'user',
        } as Message;
        const result = formatMessageContent(msg);
        expect(Array.isArray(result)).toBe(true);
        const parts = result as Array<{ type: string }>;
        expect(parts).toHaveLength(2);
        expect(parts[0]).toEqual({ type: 'text', text: 'Look at this' });
        expect(parts[1]).toEqual({
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,abc' },
        });
    });

    it('returns only image parts when content is empty', () => {
        const msg = {
            content: '',
            images: ['img1', 'img2'],
            role: 'user',
        } as Message;
        const result = formatMessageContent(msg) as Array<{ type: string }>;
        expect(result).toHaveLength(2);
        expect(result.every((p) => p.type === 'image_url')).toBe(true);
    });
});

describe('getPresetOptions', () => {
    const settings: AppSettings = {
        ollama: { url: 'http://localhost:11434' },
        embeddings: { provider: 'none' },
        general: {
            language: 'en',
            theme: 'dark',
            resolution: '1920x1080',
            fontSize: 14,

        },
        presets: [
            {
                id: 'p1',
                name: 'Preset 1',
                temperature: 0.7,
                topP: 0.9,
                frequencyPenalty: 0.1,
                presencePenalty: 0.2,
                maxTokens: 2048,
            },
        ],
    };

    it('returns preset options when matching preset found', () => {
        const result = getPresetOptions(settings, { presetId: 'p1' });
        expect(result).toEqual({
            temperature: 0.7,
            top_p: 0.9,
            frequency_penalty: 0.1,
            presence_penalty: 0.2,
            max_tokens: 2048,
        });
    });

    it('returns empty object when no preset matches', () => {
        expect(getPresetOptions(settings, { presetId: 'missing' })).toEqual({});
    });

    it('returns empty object when settings is undefined', () => {
        expect(getPresetOptions(undefined, { presetId: 'p1' })).toEqual({});
    });
});

describe('processStreamChunk', () => {
    const baseCurrent = { content: '', reasoning: '', sources: [], images: [], toolCalls: [] };
    const startTime = performance.now();

    it('handles content chunk', () => {
        const chunk: StreamChunk = { type: 'content', content: 'Hello' };
        const result = processStreamChunk(chunk, baseCurrent, startTime);
        expect(result.updated).toBe(true);
        expect(result.newContent).toBe('Hello');
    });

    it('handles error chunk', () => {
        const chunk: StreamChunk = { type: 'error', content: 'Something failed' };
        const result = processStreamChunk(chunk, baseCurrent, startTime);
        expect(result.updated).toBe(true);
        expect(result.streamError).toBe('Something failed');
    });

    it('handles error chunk with no content', () => {
        const chunk: StreamChunk = { type: 'error' };
        const result = processStreamChunk(chunk, baseCurrent, startTime);
        expect(result.streamError).toBe('Stream error');
    });

    it('handles reasoning chunk by appending', () => {
        const current = { ...baseCurrent, reasoning: 'Step 1. ' };
        const chunk: StreamChunk = { type: 'reasoning', content: 'Step 2.' };
        const result = processStreamChunk(chunk, current, startTime);
        expect(result.newReasoning).toBe('Step 1. Step 2.');
    });

    it('handles metadata chunk', () => {
        const chunk: StreamChunk = { type: 'metadata', sources: ['src1', 'src2'] };
        const result = processStreamChunk(chunk, baseCurrent, startTime);
        expect(result.newSources).toEqual(['src1', 'src2']);
    });

    it('handles images chunk by merging', () => {
        const current = { ...baseCurrent, images: ['img1'] };
        const chunk: StreamChunk = { type: 'images', images: ['img2'] };
        const result = processStreamChunk(chunk, current, startTime);
        expect(result.newImages).toEqual(['img1', 'img2']);
    });

    it('handles tool_calls chunk', () => {
        const toolCalls = [{ id: 't1', type: 'function' as const, function: { name: 'fn', arguments: '{}' } }];
        const chunk: StreamChunk = { type: 'tool_calls', tool_calls: toolCalls };
        const result = processStreamChunk(chunk, baseCurrent, startTime);
        expect(result.newToolCalls).toEqual(toolCalls);
    });

    it('merges partial tool call chunks by preserving function name', () => {
        const firstChunk: StreamChunk = {
            type: 'tool_calls',
            tool_calls: [{
                id: 't1',
                index: 0,
                type: 'function' as const,
                function: { name: 'list_directory', arguments: '' },
            }],
        };
        const firstResult = processStreamChunk(firstChunk, baseCurrent, startTime);

        const secondChunk: StreamChunk = {
            type: 'tool_calls',
            tool_calls: [{
                id: 't1',
                index: 0,
                type: 'function' as const,
                function: { name: '', arguments: '{"path":"C:/Users/agnes/Desktop"}' },
            }],
        };
        const secondResult = processStreamChunk(secondChunk, {
            ...baseCurrent,
            toolCalls: firstResult.newToolCalls ?? [],
        }, startTime);

        expect(secondResult.newToolCalls).toEqual([{
            id: 't1',
            index: 0,
            type: 'function',
            function: {
                name: 'list_directory',
                arguments: '{"path":"C:/Users/agnes/Desktop"}',
            },
        }]);
    });

    it('preserves an existing synthesized tool call id across later partial chunks', () => {
        const firstChunk: StreamChunk = {
            type: 'tool_calls',
            tool_calls: [{
                id: '',
                index: 0,
                type: 'function' as const,
                function: { name: 'get_system_info', arguments: '' },
            }],
        };
        const firstResult = processStreamChunk(firstChunk, baseCurrent, startTime);

        const secondChunk: StreamChunk = {
            type: 'tool_calls',
            tool_calls: [{
                id: '',
                index: 0,
                type: 'function' as const,
                function: { name: '', arguments: '{}' },
            }],
        };
        const secondResult = processStreamChunk(secondChunk, {
            ...baseCurrent,
            toolCalls: firstResult.newToolCalls ?? [],
        }, startTime);

        expect(secondResult.newToolCalls?.[0]?.id).toBe('get_system_info-0');
    });

    it('returns updated false for unknown chunk type with no content', () => {
        const chunk: StreamChunk = { type: 'unknown_type' };
        const result = processStreamChunk(chunk, baseCurrent, startTime);
        expect(result.updated).toBe(false);
    });

    it('treats typeless chunk with content as content chunk', () => {
        const chunk: StreamChunk = { content: 'implicit content' };
        const result = processStreamChunk(chunk, baseCurrent, startTime);
        expect(result.updated).toBe(true);
        expect(result.newContent).toBe('implicit content');
    });

    it('appends content to existing content', () => {
        const current = { ...baseCurrent, content: 'Hello ' };
        const chunk: StreamChunk = { type: 'content', content: 'world' };
        const result = processStreamChunk(chunk, current, startTime - 5000);
        expect(result.newContent).toBe('Hello world');
        expect(result.speed).toBeTypeOf('number');
    });
});
