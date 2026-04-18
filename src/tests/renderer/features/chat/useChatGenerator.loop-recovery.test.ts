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

        expect(mockExecuteTools).toHaveBeenCalledTimes(1);
        expect(mockChatStream).toHaveBeenCalledTimes(3);
        expect(result.current.chats[0]?.messages[0]).toEqual(
            expect.objectContaining({
                role: 'assistant',
                content: 'Masaustunuzde 8 oge var.',
            })
        );
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
            const [chats, setChats] = useState<Chat[]>([createInitialChat()]);
            const chatGenerator = useChatGenerator({
                chats,
                setChats,
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

        const assistantMessage = result.current.chats[0]?.messages[0];
        expect(assistantMessage?.content).toContain('izin hatasi aldim');
        expect(assistantMessage?.content).not.toContain('Toplanan kanitlar:');
    });
});
