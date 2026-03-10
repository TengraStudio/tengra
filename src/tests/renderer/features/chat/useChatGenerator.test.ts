import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Chat, Message } from '@/types';
import { CatchError } from '@/types/common';

const mockChatStream = vi.fn();
const mockGetToolDefinitions = vi.fn();
const mockExecuteTools = vi.fn();
const mockAddMessage = vi.fn();
const mockUpdateMessage = vi.fn();
const mockAbortChat = vi.fn();
const mockLogError = vi.fn();

vi.mock('@/lib/chat-stream', () => ({
    chatStream: (request: unknown) => mockChatStream(request),
}));

vi.mock('@/lib/identity', () => ({
    getSystemPrompt: () => 'system prompt',
}));

vi.mock('@/lib/utils', () => {
    let idCounter = 0;
    return {
        generateId: () => `generated-${++idCounter}`,
    };
});

import { useChatGenerator } from '@/features/chat/hooks/useChatGenerator';

const createChunkStream = async function* () {
    yield { content: 'Hello back' };
};

const createInitialChat = (): Chat => ({
    id: 'chat-1',
    title: 'Ping',
    messages: [],
    createdAt: new Date('2026-03-09T10:00:00.000Z'),
    updatedAt: new Date('2026-03-09T10:00:00.000Z'),
    isGenerating: true,
    model: 'model-a',
    backend: 'ollama',
});

const createUserMessage = (): Message => ({
    id: 'user-1',
    role: 'user',
    content: 'Ping',
    timestamp: new Date('2026-03-09T10:00:01.000Z'),
});

describe('useChatGenerator', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockChatStream.mockImplementation(() => createChunkStream());
        mockGetToolDefinitions.mockResolvedValue([]);
        mockAddMessage.mockResolvedValue(undefined);
        mockUpdateMessage.mockResolvedValue(undefined);

        Object.defineProperty(window, 'electron', {
            configurable: true,
            writable: true,
            value: {
                getToolDefinitions: mockGetToolDefinitions,
                executeTools: mockExecuteTools,
                log: {
                    error: mockLogError,
                },
                db: {
                    addMessage: mockAddMessage,
                    updateMessage: mockUpdateMessage,
                },
                session: {
                    conversation: {
                        abort: mockAbortChat,
                    },
                },
            },
        });
    });

    it('streams the first turn with the latest user message and clears generating state', async () => {
        const { result } = renderHook(() => {
            const [chats, setChats] = useState<Chat[]>([createInitialChat()]);
            const chatGenerator = useChatGenerator({
                chats,
                setChats,
                selectedModel: 'model-a',
                selectedProvider: 'ollama',
                language: 'en',
                t: (key: string) => key,
                handleSpeak: vi.fn(),
                autoReadEnabled: false,
                formatChatError: (err: CatchError) =>
                    err instanceof Error ? err.message : String(err ?? ''),
                systemMode: 'fast',
            });

            return {
                ...chatGenerator,
                chats,
            };
        });

        await act(async () => {
            await result.current.generateResponse('chat-1', createUserMessage());
        });

        expect(mockChatStream).toHaveBeenCalledTimes(1);
        expect(mockChatStream).toHaveBeenCalledWith(
            expect.objectContaining({
                chatId: 'chat-1',
                messages: expect.arrayContaining([
                    expect.objectContaining({ role: 'system', content: 'system prompt' }),
                    expect.objectContaining({ role: 'user', content: 'Ping' }),
                ]),
            })
        );

        expect(result.current.chats[0]?.isGenerating).toBe(false);
        expect(result.current.chats[0]?.messages[0]).toEqual(
            expect.objectContaining({
                role: 'assistant',
                content: 'Hello back',
                model: 'model-a',
            })
        );
    });

    it('routes explicit image requests through generate_image instead of chatStream', async () => {
        mockExecuteTools.mockResolvedValue({
            toolCallId: 'tool-1',
            name: 'generate_image',
            success: true,
            result: { images: ['safe-file://generated-image.png'] },
        });

        const { result } = renderHook(() => {
            const [chats, setChats] = useState<Chat[]>([createInitialChat()]);
            const chatGenerator = useChatGenerator({
                chats,
                setChats,
                selectedModel: 'model-a',
                selectedProvider: 'ollama',
                language: 'tr',
                t: (key: string) => key,
                handleSpeak: vi.fn(),
                autoReadEnabled: false,
                formatChatError: (err: CatchError) =>
                    err instanceof Error ? err.message : String(err ?? ''),
                systemMode: 'agent',
            });

            return {
                ...chatGenerator,
                chats,
            };
        });

        await act(async () => {
            await result.current.generateResponse('chat-1', {
                ...createUserMessage(),
                content: 'Bir görsel oluştur',
            });
        });

        expect(mockChatStream).not.toHaveBeenCalled();
        expect(mockExecuteTools).toHaveBeenCalledWith(
            'generate_image',
            { prompt: 'Bir görsel oluştur', count: 1 },
            expect.any(String)
        );
        expect(result.current.chats[0]?.isGenerating).toBe(false);
        expect(result.current.chats[0]?.messages[0]).toEqual(
            expect.objectContaining({
                role: 'assistant',
                images: ['safe-file://generated-image.png'],
                content: '',
            })
        );
    });
});
