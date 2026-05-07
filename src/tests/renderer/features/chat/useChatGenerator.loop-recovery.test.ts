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
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Chat, ChatStreamRequest, Message } from '@/types';
import { CatchError } from '@/types/common';

const mockChatStream = vi.fn();
const mockGetToolDefinitions = vi.fn();
const mockExecuteTools = vi.fn();
const mockAddMessage = vi.fn();
const mockUpdateMessage = vi.fn();
const mockUpdateChat = vi.fn();
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

const createSearchWebToolTurnStream = async function* () {
    yield {
        type: 'tool_calls' as const,
        tool_calls: [{
            id: 'tool-call-web',
            type: 'function' as const,
            function: {
                name: 'search_web',
                arguments: JSON.stringify({ query: 'latest release notes' }),
            },
        }],
    };
};

const createWriteToolTurnStream = async function* (
    id: string,
    path: string,
    heading: string
) {
    yield { content: heading };
    yield {
        type: 'tool_calls' as const,
        tool_calls: [{
            id,
            type: 'function' as const,
            function: {
                name: 'mcp__filesystem__write',
                arguments: JSON.stringify({ path, content: `content for ${path}` }),
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

const createMissingFolderToolTurnStream = async function* () {
    yield {
        type: 'tool_calls' as const,
        tool_calls: [{
            id: 'tool-call-missing-folder',
            type: 'function' as const,
            function: {
                name: 'list_directory',
                arguments: JSON.stringify({ path: 'C:\\Users\\agnes\\Desktop\\projeler' }),
            },
        }],
    };
};

const createPermissionFailureToolTurnStream = async function* () {
    yield {
        type: 'tool_calls' as const,
        tool_calls: [{
            id: 'tool-call-permission',
            type: 'function' as const,
            function: {
                name: 'read_file',
                arguments: JSON.stringify({ path: 'C:\\Windows\\System32\\config\\SAM' }),
            },
        }],
    };
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
        mockChatStream.mockReset();
        mockGetToolDefinitions.mockReset();
        mockExecuteTools.mockReset();
        mockAddMessage.mockReset();
        mockUpdateMessage.mockReset();
        mockUpdateChat.mockReset();
        mockAbortChat.mockReset();
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
            {
                type: 'function',
                function: {
                    name: 'search_web',
                    description: 'Search web',
                    parameters: {
                        type: 'object',
                        properties: { query: { type: 'string' } },
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'mcp__filesystem__write',
                    description: 'Write a file',
                    parameters: {
                        type: 'object',
                        properties: {
                            path: { type: 'string' },
                            content: { type: 'string' },
                        },
                        required: ['path', 'content'],
                    },
                },
            },
        ]);
        mockAddMessage.mockResolvedValue(undefined);
        mockUpdateMessage.mockResolvedValue({ success: true });
        mockUpdateChat.mockResolvedValue({ success: true });

        Object.defineProperty(window, 'electron', {
            configurable: true,
            writable: true,
            value: {
                getToolDefinitions: mockGetToolDefinitions,
                executeTools: mockExecuteTools,
                db: {
                    addMessage: mockAddMessage,
                    updateMessage: mockUpdateMessage,
                    updateChat: mockUpdateChat,
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
            const [chats] = useState<Chat[]>([createInitialChat()]);
            const chatGenerator = useChatGenerator({
                chats,
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
        expect(mockChatStream).toHaveBeenCalledTimes(5);
        expect(result.current.chats[0]?.messages[0]).toEqual(
            expect.objectContaining({
                role: 'assistant',
                content: expect.stringContaining('%USERPROFILE%/Desktop'),
            })
        );
    });

    it('requests one more synthesis turn when the model stops at low-signal in-progress text after tool evidence', async () => {
        mockChatStream
            .mockImplementationOnce(() => createDirectoryToolTurnStream())
            .mockImplementationOnce(() => createLowSignalAnswerStream())
            .mockImplementationOnce(() => createFinalAnswerStream());
        mockExecuteTools.mockImplementation(() => {
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
            const [chats] = useState<Chat[]>([createInitialChat()]);
            const chatGenerator = useChatGenerator({
                chats,
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

        expect(mockExecuteTools).toHaveBeenCalledTimes(1);
        expect(mockChatStream).toHaveBeenCalledTimes(3);
        expect(result.current.chats[0]?.messages[0]).toEqual(
            expect.objectContaining({
                role: 'assistant',
                content: 'Masaustunuzde 8 oge var.',
            })
        );
    });

    it('passes tool-call and tool-result messages to the next model turn', async () => {
        mockChatStream
            .mockImplementationOnce(() => createDirectoryToolTurnStream())
            .mockImplementationOnce(() => createFinalAnswerStream());
        mockExecuteTools.mockResolvedValue({
            toolCallId: 'tool-call-1',
            name: 'list_directory',
            success: true,
            result: {
                path: '%USERPROFILE%/Desktop',
                complete: true,
                entryCount: 8,
                entries: [{ name: 'file.txt', isDirectory: false }],
            },
        });

        const { result } = renderHook(() => {
            const [chats] = useState<Chat[]>([createInitialChat()]);
            const chatGenerator = useChatGenerator({
                chats,
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

        expect(mockChatStream).toHaveBeenCalledTimes(2);
        const secondRequest = mockChatStream.mock.calls[1]?.[0] as ChatStreamRequest | undefined;
        expect(secondRequest?.messages.some(message =>
            message.role === 'assistant'
            && message.toolCalls?.some(toolCall => toolCall.id === 'tool-call-1')
        )).toBe(true);
        expect(secondRequest?.messages.some(message =>
            message.role === 'tool'
            && message.toolCallId === 'tool-call-1'
            && typeof message.content === 'string'
            && message.content.includes('"entryCount":8')
        )).toBe(true);
    });

    it('does not stop agentic workflows after several same-family file writes with different arguments', async () => {
        mockChatStream
            .mockImplementationOnce(() => createWriteToolTurnStream(
                'write-package',
                'next-todo-app/package.json',
                'Creating the initial project package and dependency configuration for the Next.js task manager.'
            ))
            .mockImplementationOnce(() => createWriteToolTurnStream(
                'write-tsconfig',
                'next-todo-app/tsconfig.json',
                'TypeScript configuration:'
            ))
            .mockImplementationOnce(() => createWriteToolTurnStream(
                'write-next-config',
                'next-todo-app/next.config.js',
                'Next.js configuration:'
            ))
            .mockImplementationOnce(() => createWriteToolTurnStream(
                'write-tailwind-config',
                'next-todo-app/tailwind.config.ts',
                'Tailwind CSS configuration:'
            ))
            .mockImplementationOnce(() => createFinalAnswerStream());
        mockExecuteTools.mockImplementation((_toolName: string, _args: unknown, toolCallId: string) => Promise.resolve({
            toolCallId,
            name: 'mcp__filesystem__write',
            success: true,
            result: { success: true },
        }));

        const { result } = renderHook(() => {
            const [chats] = useState<Chat[]>([createInitialChat()]);
            const chatGenerator = useChatGenerator({
                chats,
                selectedModel: 'model-a',
                selectedProvider: 'codex',
                language: 'en',
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

        expect(mockExecuteTools).toHaveBeenCalledTimes(4);
        expect(mockExecuteTools.mock.calls.map(call => call[2])).toEqual([
            'write-package',
            'write-tsconfig',
            'write-next-config',
            'write-tailwind-config',
        ]);
        expect(mockChatStream).toHaveBeenCalledTimes(5);
        expect(result.current.chats[0]?.isGenerating).toBe(false);
        expect(mockUpdateChat).toHaveBeenLastCalledWith('chat-1', { isGenerating: false });
    });

    it('builds evidence-based fallback content instead of generic tool-loop limit text', async () => {
        mockChatStream
            .mockImplementationOnce(() => createSearchWebToolTurnStream())
            .mockImplementationOnce(() => createSearchWebToolTurnStream())
            .mockImplementationOnce(() => createSearchWebToolTurnStream())
            .mockImplementationOnce(() => createSearchWebToolTurnStream());
        mockExecuteTools.mockResolvedValue({
            toolCallId: 'tool-call-web',
            name: 'search_web',
            success: true,
            result: { hits: [{ title: 'v1.0' }] },
        });

        const { result } = renderHook(() => {
            const [chats] = useState<Chat[]>([createInitialChat()]);
            const chatGenerator = useChatGenerator({
                chats,
                selectedModel: 'model-a',
                selectedProvider: 'codex',
                language: 'en',
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

        expect(mockExecuteTools).toHaveBeenCalledTimes(1);
        expect(mockChatStream).toHaveBeenCalledTimes(4);
        const assistantMessage = result.current.chats[0]?.messages[0];
        expect(assistantMessage?.content).toContain('Based on the collected evidence:');
        expect(assistantMessage?.content).not.toContain('chat.toolLoop.limitReachedPreserved');
        expect(assistantMessage?.metadata).toEqual(expect.objectContaining({
            aiPresentation: expect.objectContaining({
                stage: 'answer_ready',
            }),
        }));
    });

    it('maps ENOENT failures to user-facing not-found messages', async () => {
        mockChatStream
            .mockImplementationOnce(() => createMissingFolderToolTurnStream())
            .mockImplementationOnce(() => createMissingFolderToolTurnStream())
            .mockImplementationOnce(() => createMissingFolderToolTurnStream())
            .mockImplementationOnce(() => createMissingFolderToolTurnStream());
        mockExecuteTools.mockResolvedValue({
            toolCallId: 'tool-call-missing-folder',
            name: 'list_directory',
            success: false,
            error: "ENOENT: no such file or directory, scandir 'C:\\Users\\agnes\\Desktop\\projeler'",
        });

        const { result } = renderHook(() => {
            const [chats] = useState<Chat[]>([createInitialChat()]);
            const chatGenerator = useChatGenerator({
                chats,
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

        const assistantMessage = result.current.chats[0]?.messages[0];
        expect(assistantMessage?.content).toContain('Istedigin kaynagi bulamadim');
        expect(assistantMessage?.content).toContain('C:\\Users\\agnes\\Desktop\\projeler');
        expect(assistantMessage?.content).not.toContain('Toplanan kanitlar:');
    });

    it('maps permission failures to user-facing permission guidance', async () => {
        mockChatStream
            .mockImplementationOnce(() => createPermissionFailureToolTurnStream())
            .mockImplementationOnce(() => createPermissionFailureToolTurnStream())
            .mockImplementationOnce(() => createPermissionFailureToolTurnStream())
            .mockImplementationOnce(() => createPermissionFailureToolTurnStream());
        mockExecuteTools.mockResolvedValue({
            toolCallId: 'tool-call-permission',
            name: 'read_file',
            success: false,
            error: "EACCES: permission denied, open 'C:\\Windows\\System32\\config\\SAM'",
        });

        const { result } = renderHook(() => {
            const [chats] = useState<Chat[]>([createInitialChat()]);
            const chatGenerator = useChatGenerator({
                chats,
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

        const assistantMessage = result.current.chats[0]?.messages[0];
        expect(assistantMessage?.content).toContain('izin hatasi aldim');
        expect(assistantMessage?.content).not.toContain('Toplanan kanitlar:');
    });
});


