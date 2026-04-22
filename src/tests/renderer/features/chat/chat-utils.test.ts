/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, expect, it, vi } from 'vitest';

import { extractReasoning } from '@/features/chat/hooks/process-stream';
import {
    formatMessageContent,
    getPresetOptions,
    mergeToolCallHistory,
    mergeToolCalls,
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
        const result = processStreamChunk(chunk, baseCurrent, startTime, 'Stream error');
        expect(result.updated).toBe(true);
        expect(result.newContent).toBe('Hello');
    });

    it('handles error chunk', () => {
        const chunk: StreamChunk = { type: 'error', content: 'Something failed' };
        const result = processStreamChunk(chunk, baseCurrent, startTime, 'Stream error');
        expect(result.updated).toBe(true);
        expect(result.streamError).toBe('Something failed');
    });

    it('handles error chunk with no content', () => {
        const chunk: StreamChunk = { type: 'error' };
        const result = processStreamChunk(chunk, baseCurrent, startTime, 'Stream error');
        expect(result.streamError).toBe('Stream error');
    });

    it('handles reasoning chunk by appending', () => {
        const current = { ...baseCurrent, reasoning: 'Step 1. ' };
        const chunk: StreamChunk = { type: 'reasoning', content: 'Step 2.' };
        const result = processStreamChunk(chunk, current, startTime, 'Stream error');
        expect(result.newReasoning).toBe('Step 1. Step 2.');
    });

    it('handles reasoning chunk from reasoning field', () => {
        const current = { ...baseCurrent, reasoning: 'Step 1. ' };
        const chunk: StreamChunk = { type: 'reasoning', reasoning: 'Step 2.' };
        const result = processStreamChunk(chunk, current, startTime, 'Stream error');
        expect(result.newReasoning).toBe('Step 1. Step 2.');
    });

    it('handles metadata chunk', () => {
        const chunk: StreamChunk = { type: 'metadata', sources: ['src1', 'src2'] };
        const result = processStreamChunk(chunk, baseCurrent, startTime, 'Stream error');
        expect(result.newSources).toEqual(['src1', 'src2']);
    });

    it('handles images chunk by merging', () => {
        const current = { ...baseCurrent, images: ['img1'] };
        const chunk: StreamChunk = { type: 'images', images: ['img2'] };
        const result = processStreamChunk(chunk, current, startTime, 'Stream error');
        expect(result.newImages).toEqual(['img1', 'img2']);
    });

    it('handles tool_calls chunk', () => {
        const toolCalls = [{ id: 't1', type: 'function' as const, function: { name: 'fn', arguments: '{}' } }];
        const chunk: StreamChunk = { type: 'tool_calls', tool_calls: toolCalls };
        const result = processStreamChunk(chunk, baseCurrent, startTime, 'Stream error');
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
        const firstResult = processStreamChunk(firstChunk, baseCurrent, startTime, 'Stream error');

        const secondChunk: StreamChunk = {
            type: 'tool_calls',
            tool_calls: [{
                id: 't1',
                index: 0,
                type: 'function' as const,
                function: { name: '', arguments: '{"path":"C:/Users/mockuser/Desktop"}' },
            }],
        };
        const secondResult = processStreamChunk(secondChunk, {
            ...baseCurrent,
            toolCalls: firstResult.newToolCalls ?? [],
        }, startTime, 'Stream error');

        expect(secondResult.newToolCalls).toEqual([{
            id: 't1',
            index: 0,
            type: 'function',
            function: {
                name: 'list_directory',
                arguments: '{"path":"C:/Users/mockuser/Desktop"}',
            },
        }]);
    });

    it('ignores empty malformed tool call shells and survives missing function fields', () => {
        const emptyShellChunk = {
            type: 'tool_calls',
            tool_calls: [{ index: 0 }],
        } as unknown as StreamChunk;
        const emptyShellResult = processStreamChunk(emptyShellChunk, baseCurrent, startTime, 'Stream error');

        expect(emptyShellResult.newToolCalls).toEqual([]);

        const partialChunk = {
            type: 'tool_calls',
            tool_calls: [{
                id: 't1',
                index: 0,
                type: 'function',
                function: { name: 'run_command' },
            }],
        } as unknown as StreamChunk;
        const partialResult = processStreamChunk(partialChunk, baseCurrent, startTime, 'Stream error');

        expect(partialResult.newToolCalls).toEqual([{
            id: 't1',
            index: 0,
            type: 'function',
            function: {
                name: 'run_command',
                arguments: '',
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
        const firstResult = processStreamChunk(firstChunk, baseCurrent, startTime, 'Stream error');

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
        }, startTime, 'Stream error');

        expect(secondResult.newToolCalls?.[0]?.id).toBe('get_system_info-0');
    });

    it('uses per-turn fallback prefix for idless tool calls and keeps id stable across partial chunks', () => {
        const firstChunk: StreamChunk = {
            type: 'tool_calls',
            tool_calls: [{
                id: '',
                index: 0,
                type: 'function' as const,
                function: { name: 'execute_command', arguments: '' },
            }],
        };
        const firstResult = processStreamChunk(firstChunk, baseCurrent, startTime, 'Stream error', 'turn-x');

        const secondChunk: StreamChunk = {
            type: 'tool_calls',
            tool_calls: [{
                id: '',
                index: 0,
                type: 'function' as const,
                function: { name: '', arguments: '{"command":"echo ok"}' },
            }],
        };
        const secondResult = processStreamChunk(secondChunk, {
            ...baseCurrent,
            toolCalls: firstResult.newToolCalls ?? [],
        }, startTime, 'Stream error', 'turn-x');

        expect(secondResult.newToolCalls?.[0]?.id).toBe('turn-x-0');
    });

    it('returns updated false for unknown chunk type with no content', () => {
        const chunk: StreamChunk = { type: 'unknown_type' };
        const result = processStreamChunk(chunk, baseCurrent, startTime, 'Stream error');
        expect(result.updated).toBe(false);
    });

    it('treats typeless chunk with content as content chunk', () => {
        const chunk: StreamChunk = { content: 'implicit content' };
        const result = processStreamChunk(chunk, baseCurrent, startTime, 'Stream error');
        expect(result.updated).toBe(true);
        expect(result.newContent).toBe('implicit content');
    });

    it('appends content to existing content', () => {
        const current = { ...baseCurrent, content: 'Hello ' };
        const chunk: StreamChunk = { type: 'content', content: 'world' };
        const result = processStreamChunk(chunk, current, startTime - 5000, 'Stream error');
        expect(result.newContent).toBe('Hello world');
        expect(result.speed).toBeTypeOf('number');
    });
});

describe('mergeToolCalls', () => {
    it('does not collapse distinct turns by shared index when index matching is disabled', () => {
        const previousTurn = [{
            id: 'turn-a-0',
            index: 0,
            type: 'function' as const,
            function: { name: 'execute_command', arguments: '{"command":"dir"}' },
        }];
        const nextTurn = [{
            id: 'turn-b-0',
            index: 0,
            type: 'function' as const,
            function: { name: 'execute_command', arguments: '{"command":"npm -v"}' },
        }];

        const merged = mergeToolCalls(previousTurn, nextTurn, { allowIndexMatch: false });

        expect(merged).toHaveLength(2);
        expect(merged.map(call => call.id)).toEqual(['turn-a-0', 'turn-b-0']);
    });
});

describe('mergeToolCallHistory', () => {
    it('keeps both runs when the same explicit tool id is reused across turns', () => {
        const previousTurn = [{
            id: 'call_0',
            index: 0,
            type: 'function' as const,
            function: { name: 'execute_command', arguments: '{"command":"dir"}' },
        }];
        const nextTurn = [{
            id: 'call_0',
            index: 0,
            type: 'function' as const,
            function: { name: 'execute_command', arguments: '{"command":"npm -v"}' },
        }];

        const merged = mergeToolCallHistory(previousTurn, nextTurn);

        expect(merged).toHaveLength(2);
        expect(merged[0]?.id).toBe('call_0');
        expect(merged[1]?.id).toBe('call_0~1');
    });
});

describe('extractReasoning', () => {
    it('extracts reasoning from unclosed think tags during streaming', () => {
        const content = '<think>adim 1: analiz ediyorum';
        expect(extractReasoning(content, '')).toBe('adim 1: analiz ediyorum');
    });

    it('prefers explicit reasoning when provided', () => {
        const content = '<think>icerik icinden gelen reasoning</think>';
        expect(extractReasoning(content, 'provider reasoning')).toBe('provider reasoning');
    });

    it('preserves spacing when trim is disabled for streaming updates', () => {
        expect(extractReasoning('', 'Selam ', { trim: false })).toBe('Selam ');
    });

    it('ignores whitespace-only explicit reasoning and falls back to think tags', () => {
        const content = '<think>gercek dusunce</think>';
        expect(extractReasoning(content, '   ', { trim: false })).toBe('gercek dusunce');
    });

    it('does not duplicate prior turn content when stream already includes full content', async () => {
        const { processChatStream } = await import('@/features/chat/hooks/process-stream');
        Object.defineProperty(window, 'electron', {
            configurable: true,
            writable: true,
            value: {
                db: {
                    updateMessage: vi.fn().mockResolvedValue({ success: true }),
                },
            },
        });
        const setStreamingStates = vi.fn();
        const setChats = vi.fn();

        const stream = (async function* () {
            yield { type: 'content', content: 'Masaustunuzde 8 oge var.' };
        })();

        const result = await processChatStream({
            stream,
            chatId: 'chat-1',
            assistantId: 'assistant-1',
            intentClassification: {
                intent: 'single_lookup',
                confidence: 'high',
                systemMode: 'agent',
                requiresTooling: true,
                preferredMaxModelTurns: 4,
                preferredMaxToolTurns: 2,
            },
            setStreamingStates,
            setChats,
            streamStartTime: performance.now(),
            activeModel: 'model-a',
            selectedProvider: 'codex',
            t: (key: string) => key,
            autoReadEnabled: false,
            handleSpeak: vi.fn(),
            initialContent: 'Masaustunuzdeki dosyalari kontrol ediyorum.',
        });

        expect(result.finalContent).toBe('Masaustunuzde 8 oge var.');
    });

    it('preserves prior turn content when a tool-only stream emits no assistant text', async () => {
        const { processChatStream } = await import('@/features/chat/hooks/process-stream');
        Object.defineProperty(window, 'electron', {
            configurable: true,
            writable: true,
            value: {
                db: {
                    updateMessage: vi.fn().mockResolvedValue({ success: true }),
                },
            },
        });
        const setStreamingStates = vi.fn();
        const setChats = vi.fn();

        const stream = (async function* () {
            yield {
                type: 'tool_calls',
                tool_calls: [{
                    id: 'tool-call-1',
                    type: 'function' as const,
                    function: {
                        name: 'list_directory',
                        arguments: '{"path":"C:/Users/mockuser/Desktop"}',
                    },
                }],
            };
        })();

        const result = await processChatStream({
            stream,
            chatId: 'chat-1',
            assistantId: 'assistant-1',
            intentClassification: {
                intent: 'single_lookup',
                confidence: 'high',
                systemMode: 'agent',
                requiresTooling: true,
                preferredMaxModelTurns: 4,
                preferredMaxToolTurns: 2,
            },
            setStreamingStates,
            setChats,
            streamStartTime: performance.now(),
            activeModel: 'model-a',
            selectedProvider: 'codex',
            t: (key: string) => key,
            autoReadEnabled: false,
            handleSpeak: vi.fn(),
            initialContent: 'Masaustunuzdeki dosyalari kontrol ediyorum.',
        });

        expect(result.finalContent).toBe('Masaustunuzdeki dosyalari kontrol ediyorum.');
        expect(result.finalToolCalls).toEqual([
            expect.objectContaining({
                id: 'tool-call-1',
                function: expect.objectContaining({ name: 'list_directory' }),
            }),
        ]);
    });

    it('preserves inter-token spaces in streamed reasoning chunks', async () => {
        const { processChatStream } = await import('@/features/chat/hooks/process-stream');
        Object.defineProperty(window, 'electron', {
            configurable: true,
            writable: true,
            value: {
                db: {
                    updateMessage: vi.fn().mockResolvedValue({ success: true }),
                },
            },
        });
        const setStreamingStates = vi.fn();
        const setChats = vi.fn();

        const stream = (async function* () {
            yield { type: 'reasoning', reasoning: 'Selam' };
            yield { type: 'reasoning', reasoning: ' ' };
            yield { type: 'reasoning', reasoning: 'Nasil yardimci olabilirim?' };
        })();

        const result = await processChatStream({
            stream,
            chatId: 'chat-2',
            assistantId: 'assistant-2',
            intentClassification: {
                intent: 'single_lookup',
                confidence: 'high',
                systemMode: 'agent',
                requiresTooling: true,
                preferredMaxModelTurns: 4,
                preferredMaxToolTurns: 2,
            },
            setStreamingStates,
            setChats,
            streamStartTime: performance.now(),
            activeModel: 'model-a',
            selectedProvider: 'huggingface',
            t: (key: string) => key,
            autoReadEnabled: false,
            handleSpeak: vi.fn(),
        });

        expect(result.finalReasoning).toBe('Selam Nasil yardimci olabilirim?');
    });

    it('splits reasoning into separate segments when content interrupts thinking', async () => {
        const { processChatStream } = await import('@/features/chat/hooks/process-stream');
        Object.defineProperty(window, 'electron', {
            configurable: true,
            writable: true,
            value: {
                db: {
                    updateMessage: vi.fn().mockResolvedValue({ success: true }),
                },
            },
        });
        const setStreamingStates = vi.fn();
        const setChats = vi.fn();

        const stream = (async function* () {
            yield { type: 'reasoning', reasoning: 'Ilk dusunce.' };
            yield { type: 'content', content: 'Ara cevap. ' };
            yield { type: 'reasoning', reasoning: 'Ikinci dusunce.' };
            yield { type: 'content', content: 'Final cevap.' };
        })();

        const result = await processChatStream({
            stream,
            chatId: 'chat-3',
            assistantId: 'assistant-3',
            intentClassification: {
                intent: 'single_lookup',
                confidence: 'high',
                systemMode: 'agent',
                requiresTooling: true,
                preferredMaxModelTurns: 4,
                preferredMaxToolTurns: 2,
            },
            setStreamingStates,
            setChats,
            streamStartTime: performance.now(),
            activeModel: 'model-a',
            selectedProvider: 'antigravity',
            t: (key: string) => key,
            autoReadEnabled: false,
            handleSpeak: vi.fn(),
        });

        expect(result.finalContent).toBe('Ara cevap. Final cevap.');
        expect(result.finalReasonings).toEqual(['Ilk dusunce.', 'Ikinci dusunce.']);
    });

    it('does not duplicate cumulative think-tag reasoning within a single segment', async () => {
        const { processChatStream } = await import('@/features/chat/hooks/process-stream');
        Object.defineProperty(window, 'electron', {
            configurable: true,
            writable: true,
            value: {
                db: {
                    updateMessage: vi.fn().mockResolvedValue({ success: true }),
                },
            },
        });
        const setStreamingStates = vi.fn();
        const setChats = vi.fn();

        const stream = (async function* () {
            yield { type: 'content', content: '<think>Ilk' };
            yield { type: 'content', content: ' dusunce' };
            yield { type: 'content', content: ' genisliyor</think>Yanıt.' };
        })();

        const result = await processChatStream({
            stream,
            chatId: 'chat-4',
            assistantId: 'assistant-4',
            intentClassification: {
                intent: 'single_lookup',
                confidence: 'high',
                systemMode: 'agent',
                requiresTooling: true,
                preferredMaxModelTurns: 4,
                preferredMaxToolTurns: 2,
            },
            setStreamingStates,
            setChats,
            streamStartTime: performance.now(),
            activeModel: 'model-a',
            selectedProvider: 'antigravity',
            t: (key: string) => key,
            autoReadEnabled: false,
            handleSpeak: vi.fn(),
        });

        expect(result.finalReasoning).toBe('Ilk dusunce genisliyor');
        expect(result.finalReasonings).toEqual(['Ilk dusunce genisliyor']);
    });

    it('keeps only the new suffix when a new reasoning segment replays prior history', async () => {
        const { processChatStream } = await import('@/features/chat/hooks/process-stream');
        Object.defineProperty(window, 'electron', {
            configurable: true,
            writable: true,
            value: {
                db: {
                    updateMessage: vi.fn().mockResolvedValue({ success: true }),
                },
            },
        });
        const setStreamingStates = vi.fn();
        const setChats = vi.fn();

        const stream = (async function* () {
            yield { type: 'content', content: '<think>Ilk dusunce.</think>Ara cevap.' };
            yield {
                type: 'tool_calls',
                tool_calls: [{
                    id: 'tool-call-2',
                    type: 'function' as const,
                    function: {
                        name: 'list_directory',
                        arguments: '{"path":"C:/Users/mockuser/Desktop"}',
                    },
                }],
            };
            yield { type: 'content', content: '<think>Ilk dusunce.Ikinci' };
            yield { type: 'content', content: ' dusunce.</think>Final cevap.' };
        })();

        const result = await processChatStream({
            stream,
            chatId: 'chat-5',
            assistantId: 'assistant-5',
            intentClassification: {
                intent: 'single_lookup',
                confidence: 'high',
                systemMode: 'agent',
                requiresTooling: true,
                preferredMaxModelTurns: 4,
                preferredMaxToolTurns: 2,
            },
            setStreamingStates,
            setChats,
            streamStartTime: performance.now(),
            activeModel: 'model-a',
            selectedProvider: 'antigravity',
            t: (key: string) => key,
            autoReadEnabled: false,
            handleSpeak: vi.fn(),
        });

        expect(result.finalReasoning).toBe('Ikinci dusunce.');
        expect(result.finalReasonings).toEqual(['Ilk dusunce.', 'Ikinci dusunce.']);
    });

    it('does not append the Tengra safety limit message for long streamed responses', async () => {
        const { processChatStream } = await import('@/features/chat/hooks/process-stream');
        Object.defineProperty(window, 'electron', {
            configurable: true,
            writable: true,
            value: {
                db: {
                    updateMessage: vi.fn().mockResolvedValue({ success: true }),
                },
            },
        });
        const setStreamingStates = vi.fn();
        const setChats = vi.fn();
        const longChunk = 'a'.repeat(200500);

        const stream = (async function* () {
            yield { type: 'content', content: longChunk };
        })();

        const result = await processChatStream({
            stream,
            chatId: 'chat-6',
            assistantId: 'assistant-6',
            intentClassification: {
                intent: 'single_lookup',
                confidence: 'high',
                systemMode: 'agent',
                requiresTooling: false,
                preferredMaxModelTurns: 2,
                preferredMaxToolTurns: 0,
            },
            setStreamingStates,
            setChats,
            streamStartTime: performance.now(),
            activeModel: 'model-a',
            selectedProvider: 'antigravity',
            t: (key: string) => key,
            autoReadEnabled: false,
            handleSpeak: vi.fn(),
        });

        expect(result.finalContent).toHaveLength(200500);
        expect(result.finalContent).not.toContain('response exceeded Tengra safety limit');
    });
});
