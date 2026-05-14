/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatStreamChunk } from '@/lib/chat-stream';

/**
 * We mock the chatStream async generator so that tests can control
 * exactly which chunks are yielded and when.
 */

type ChunkListener = (chunk: ChatStreamChunk & { done?: boolean; chatId?: string }) => void;

let streamListener: ChunkListener | null = null;
const mockUnsubscribe = vi.fn();
const mockAbortChat = vi.fn();
const mockChatStream = vi.fn<() => Promise<{ success: boolean }>>();

// Provide window.electron stubs used by chat-stream.ts
Object.defineProperty(window, 'electron', {
    value: {
        session: {
            conversation: {
                stream: mockChatStream,
                abort: mockAbortChat,
                onStreamChunk: vi.fn((cb: ChunkListener) => {
                    streamListener = cb;
                    return mockUnsubscribe;
                }),
                onGenerationStatus: vi.fn(),
            },
        },
        getToolDefinitions: vi.fn().mockResolvedValue([]),
    },
    configurable: true,
    writable: true,
});

// Mock generateId to produce deterministic IDs
let idCounter = 0;
vi.mock('@/lib/utils', () => ({
    generateId: () => `id-${idCounter++}`,
}));

// Mock getSystemPrompt
vi.mock('@/lib/identity', () => ({
    getSystemPrompt: () => 'system-prompt',
}));

// Import after mocks are set up
import { useWorkspaceChatStream } from '@/features/workspace/hooks/useWorkspaceChatStream';

const DEFAULT_OPTIONS = {
    provider: 'ollama',
    model: 'llama3',
    language: 'en',
    workspaceId: 'proj-1',
};

function emitChunk(chunk: ChatStreamChunk & { done?: boolean; chatId?: string }): void {
    if (!streamListener) {
        throw new Error('No stream listener registered');
    }
    streamListener(chunk);
}

describe('useWorkspaceChatStream', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        idCounter = 0;
        streamListener = null;
        mockChatStream.mockResolvedValue({ success: true });
    });

    it('happy path: start → chunk → chunk → done accumulates message', async () => {
        const { result } = renderHook(() => useWorkspaceChatStream(DEFAULT_OPTIONS));

        await act(async () => {
            result.current.sendMessage('Hello');
        });

        expect(result.current.isStreaming).toBe(true);
        expect(result.current.messages).toHaveLength(2);
        expect(result.current.messages[0].role).toBe('user');
        expect(result.current.messages[0].content).toBe('Hello');
        expect(result.current.messages[1].role).toBe('assistant');

        await act(async () => {
            emitChunk({ content: 'Hi ' });
        });

        expect(result.current.messages[1].content).toBe('Hi ');

        await act(async () => {
            emitChunk({ content: 'there!' });
        });

        expect(result.current.messages[1].content).toBe('Hi there!');

        await act(async () => {
            emitChunk({ done: true });
        });

        expect(result.current.isStreaming).toBe(false);
        expect(result.current.messages[1].content).toBe('Hi there!');
    });

    it('cancel: start → chunk → cancel preserves partial message', async () => {
        const { result } = renderHook(() => useWorkspaceChatStream(DEFAULT_OPTIONS));

        await act(async () => {
            result.current.sendMessage('Tell me a story');
        });

        await act(async () => {
            emitChunk({ content: 'Once upon' });
        });

        expect(result.current.messages[1].content).toBe('Once upon');

        await act(async () => {
            result.current.stopStreaming();
        });

        expect(result.current.isStreaming).toBe(false);
        expect(mockAbortChat).toHaveBeenCalledOnce();
        expect(result.current.messages[1].content).toBe('Once upon');
    });

    it('error chunk: start → error event sets error in message', async () => {
        const { result } = renderHook(() => useWorkspaceChatStream(DEFAULT_OPTIONS));

        await act(async () => {
            result.current.sendMessage('Hi');
        });

        await act(async () => {
            emitChunk({ type: 'error', error: 'model not found' });
        });

        // Wait for the stream to finish processing
        await act(async () => {
            await new Promise(r => setTimeout(r, 10));
        });

        expect(result.current.isStreaming).toBe(false);
        expect(result.current.messages[1].content).toBe('Error: model not found');
    });

    it('provider unavailable: chatStream rejects immediately', async () => {
        mockChatStream.mockRejectedValueOnce(new Error('Provider unavailable'));

        const { result } = renderHook(() => useWorkspaceChatStream(DEFAULT_OPTIONS));

        await act(async () => {
            result.current.sendMessage('Hello');
        });

        // Wait for the rejection to propagate
        await act(async () => {
            await new Promise(r => setTimeout(r, 50));
        });

        expect(result.current.isStreaming).toBe(false);
        expect(result.current.messages[1].content).toContain('Provider unavailable');
    });

    it('multiple sequential messages: send, complete, send again', async () => {
        const { result } = renderHook(() => useWorkspaceChatStream(DEFAULT_OPTIONS));

        // First message
        await act(async () => {
            result.current.sendMessage('First');
        });

        await act(async () => {
            emitChunk({ content: 'Reply 1' });
        });

        await act(async () => {
            emitChunk({ done: true });
        });

        expect(result.current.isStreaming).toBe(false);
        expect(result.current.messages).toHaveLength(2);
        expect(result.current.messages[1].content).toBe('Reply 1');

        // Second message
        await act(async () => {
            result.current.sendMessage('Second');
        });

        expect(result.current.messages).toHaveLength(4);
        expect(result.current.messages[2].role).toBe('user');
        expect(result.current.messages[2].content).toBe('Second');
        expect(result.current.isStreaming).toBe(true);

        await act(async () => {
            emitChunk({ content: 'Reply 2' });
        });

        await act(async () => {
            emitChunk({ done: true });
        });

        expect(result.current.isStreaming).toBe(false);
        expect(result.current.messages[3].content).toBe('Reply 2');
    });

    it('ignores empty/whitespace-only messages', async () => {
        const { result } = renderHook(() => useWorkspaceChatStream(DEFAULT_OPTIONS));

        await act(async () => {
            result.current.sendMessage('   ');
        });

        expect(result.current.messages).toHaveLength(0);
        expect(mockChatStream).not.toHaveBeenCalled();
    });

    it('ignores send while already streaming', async () => {
        const { result } = renderHook(() => useWorkspaceChatStream(DEFAULT_OPTIONS));

        await act(async () => {
            result.current.sendMessage('First');
        });

        expect(result.current.isStreaming).toBe(true);

        await act(async () => {
            result.current.sendMessage('Second while streaming');
        });

        // Should still only have 2 messages (user + assistant from first send)
        expect(result.current.messages).toHaveLength(2);
    });

    it('error chunk after partial content appends error', async () => {
        const { result } = renderHook(() => useWorkspaceChatStream(DEFAULT_OPTIONS));

        await act(async () => {
            result.current.sendMessage('Hi');
        });

        await act(async () => {
            emitChunk({ content: 'Partial ' });
        });

        await act(async () => {
            emitChunk({ type: 'error', error: 'timeout' });
        });

        await act(async () => {
            await new Promise(r => setTimeout(r, 10));
        });

        expect(result.current.isStreaming).toBe(false);
        expect(result.current.messages[1].content).toBe('Partial \n\n[Error: timeout]');
    });

    it('accepts snake_case tool_calls chunks from stream bridge', async () => {
        const { chatStream } = await import('@/lib/chat-stream');
        const request = {
            messages: [],
            model: 'gpt-4o',
            provider: 'antigravity',
            tools: [],
            options: {},
            chatId: 'chat-tools',
            workspaceId: 'proj-1',
        };

        const chunks: Array<{ type?: string; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>; done?: boolean; chatId?: string }> = [];
        const consume = (async () => {
            for await (const chunk of chatStream(request)) {
                chunks.push(chunk as never);
            }
        })();

        await act(async () => {
            emitChunk({
                type: 'tool_calls',
                tool_calls: [
                    {
                        id: 'tc-1',
                        type: 'function',
                        function: { name: 'list_directory', arguments: '{"path":"/users"}' },
                    },
                ],
                chatId: 'chat-tools',
            } as never);
            emitChunk({ done: true, chatId: 'chat-tools' });
        });

        await consume;
        expect(chunks).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: 'tool_calls',
                    tool_calls: expect.arrayContaining([
                        expect.objectContaining({
                            id: 'tc-1',
                            function: expect.objectContaining({ name: 'list_directory' }),
                        }),
                    ]),
                }),
            ])
        );
    });
});

