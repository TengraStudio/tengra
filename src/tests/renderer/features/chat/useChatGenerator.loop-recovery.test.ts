import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Chat, ChatStreamRequest, Message } from '@/types';
import { CatchError } from '@/types/common';

const mockChatStream = vi.fn();
const mockGetToolDefinitions = vi.fn();
const mockExecuteTools = vi.fn();
const mockAddMessage = vi.fn();
const mockUpdateMessage = vi.fn();
const mockAbortChat = vi.fn();

vi.mock('@/lib/chat-stream', () => ({
    chatStream: (request: ChatStreamRequest) => mockChatStream(request),
}));

vi.mock('@/lib/identity', () => ({
    getSystemPrompt: () => 'system prompt',
}));

vi.mock('@/lib/utils', () => {
    let idCounter = 0;
    return {
        generateId: () => `generated-loop-${++idCounter}`,
    };
});

import { useChatGenerator } from '@/features/chat/hooks/useChatGenerator';

const createSystemInfoToolTurnStream = async function* () {
    yield {
        type: 'tool_calls' as const,
        tool_calls: [{
            id: 'tool-call-system',
            type: 'function' as const,
            function: {
                name: 'get_system_info',
                arguments: '{}',
            },
        }],
    };
};

const createDirectoryToolTurnStream = async function* () {
    yield {
        type: 'tool_calls' as const,
        tool_calls: [{
            id: 'tool-call-1',
            type: 'function' as const,
            function: {
                name: 'list_directory',
                arguments: JSON.stringify({ path: '%USERPROFILE%/Desktop' }),
            },
        }],
    };
};

const createFinalAnswerStream = async function* () {
    yield { content: 'Masaustunuzde 8 oge var.' };
};

const createLowSignalAnswerStream = async function* () {
    yield { content: 'Masaustunuzdeki dosyalari kontrol ediyorum.' };
};

const createInitialChat = (): Chat => ({
    id: 'chat-1',
    title: 'Desktop count',
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
    content: 'Masaustumde kac adet dosya var?',
    timestamp: new Date('2026-03-09T10:00:01.000Z'),
});

describe('useChatGenerator loop recovery', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetToolDefinitions.mockResolvedValue([
            {
                type: 'function',
                function: {
                    name: 'get_system_info',
                    description: 'Get system info',
                    parameters: {
                        type: 'object',
                        properties: {},
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'list_directory',
                    description: 'List directory contents',
                    parameters: {
                        type: 'object',
                        properties: { path: { type: 'string' } },
                    },
                },
            },
        ]);
        mockAddMessage.mockResolvedValue(undefined);
        mockUpdateMessage.mockResolvedValue({ success: true });

        Object.defineProperty(window, 'electron', {
            configurable: true,
            writable: true,
            value: {
                getToolDefinitions: mockGetToolDefinitions,
                executeTools: mockExecuteTools,
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

    it('allows extended answer-recovery turns after duplicate tool reuse without re-executing the same tool', async () => {
        mockChatStream
            .mockImplementationOnce(() => createSystemInfoToolTurnStream())
            .mockImplementationOnce(() => createDirectoryToolTurnStream())
            .mockImplementationOnce(() => createDirectoryToolTurnStream())
            .mockImplementationOnce(() => createDirectoryToolTurnStream())
            .mockImplementationOnce(() => createDirectoryToolTurnStream())
            .mockImplementationOnce(() => createDirectoryToolTurnStream())
            .mockImplementationOnce(() => createFinalAnswerStream());
        mockExecuteTools.mockImplementation((toolName: string) => {
            if (toolName === 'get_system_info') {
                return Promise.resolve({
                    toolCallId: 'tool-call-system',
                    name: 'get_system_info',
                    success: true,
                    result: { homeDir: '%USERPROFILE%' },
                });
            }

            return Promise.resolve({
                toolCallId: 'tool-call-1',
                name: 'list_directory',
                success: true,
                result: {
                    path: '%USERPROFILE%/Desktop',
                    complete: true,
                    entryCount: 8,
                    fileCount: 8,
                    directoryCount: 0,
                    entries: [{ name: 'file.txt', isDirectory: false }],
                },
            });
        });

        const { result } = renderHook(() => {
            const [chats, setChats] = useState<Chat[]>([createInitialChat()]);
            const chatGenerator = useChatGenerator({
                chats,
                setChats,
                selectedModel: 'model-a',
                selectedProvider: 'codex',
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
            await result.current.generateResponse('chat-1', createUserMessage());
        });

        expect(mockExecuteTools).toHaveBeenCalledTimes(2);
        expect(mockChatStream).toHaveBeenCalledTimes(7);
        expect(result.current.chats[0]?.messages[0]).toEqual(
            expect.objectContaining({
                role: 'assistant',
                content: 'Masaustunuzde 8 oge var.',
            })
        );
    });

    it('requests one more synthesis turn when the model stops at low-signal in-progress text after tool evidence', async () => {
        mockChatStream
            .mockImplementationOnce(() => createSystemInfoToolTurnStream())
            .mockImplementationOnce(() => createDirectoryToolTurnStream())
            .mockImplementationOnce(() => createLowSignalAnswerStream())
            .mockImplementationOnce(() => createFinalAnswerStream());
        mockExecuteTools.mockImplementation((toolName: string) => {
            if (toolName === 'get_system_info') {
                return Promise.resolve({
                    toolCallId: 'tool-call-system',
                    name: 'get_system_info',
                    success: true,
                    result: { homeDir: '%USERPROFILE%' },
                });
            }

            return Promise.resolve({
                toolCallId: 'tool-call-1',
                name: 'list_directory',
                success: true,
                result: {
                    path: '%USERPROFILE%/Desktop',
                    complete: true,
                    entryCount: 8,
                    fileCount: 8,
                    directoryCount: 0,
                    entries: [{ name: 'file.txt', isDirectory: false }],
                },
            });
        });

        const { result } = renderHook(() => {
            const [chats, setChats] = useState<Chat[]>([createInitialChat()]);
            const chatGenerator = useChatGenerator({
                chats,
                setChats,
                selectedModel: 'model-a',
                selectedProvider: 'codex',
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
            await result.current.generateResponse('chat-1', createUserMessage());
        });

        expect(mockExecuteTools).toHaveBeenCalledTimes(2);
        expect(mockChatStream).toHaveBeenCalledTimes(4);
        expect(result.current.chats[0]?.messages[0]).toEqual(
            expect.objectContaining({
                role: 'assistant',
                content: 'Masaustunuzde 8 oge var.',
            })
        );
    });
});
