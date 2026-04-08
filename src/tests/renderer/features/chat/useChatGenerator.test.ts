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
const mockLogError = vi.fn();

vi.mock('@/lib/chat-stream', () => ({
    chatStream: (request: ChatStreamRequest) => mockChatStream(request),
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

const createToolTurnStream = async function* () {
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
    yield { content: 'Masaustunde 8 oge var.' };
};

const createSameToolTurnStream = async function* () {
    yield {
        type: 'tool_calls' as const,
        tool_calls: [{
            id: 'tool-call-repeated',
            type: 'function' as const,
            function: {
                name: 'get_system_info',
                arguments: '{}',
            },
        }],
    };
};

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

const createPrimitiveArgsToolTurnStream = async function* () {
    yield {
        type: 'tool_calls' as const,
        tool_calls: [{
            id: 'tool-call-primitive',
            type: 'function' as const,
            function: {
                name: 'get_system_info',
                arguments: '""',
            },
        }],
    };
};

const createExecuteCommandToolTurnStream = async function* () {
    yield {
        type: 'tool_calls' as const,
        tool_calls: [{
            id: 'tool-call-command',
            type: 'function' as const,
            function: {
                name: 'execute_command',
                arguments: JSON.stringify({ command: 'Get-ChildItem' }),
            },
        }],
    };
};

const createWriteFileToolTurnStream = async function* () {
    yield {
        type: 'tool_calls' as const,
        tool_calls: [{
            id: 'tool-call-write-file',
            type: 'function' as const,
            function: {
                name: 'write_file',
                arguments: JSON.stringify({ path: 'todo-app/app/page.tsx', content: 'export default function Page() { return null; }' }),
            },
        }],
    };
};

const createSplitToolTurnStream = async function* () {
    yield {
        type: 'tool_calls' as const,
        tool_calls: [{
            id: 'tool-call-1',
            index: 0,
            type: 'function' as const,
            function: {
                name: 'list_directory',
                arguments: '',
            },
        }],
    };
    yield {
        type: 'tool_calls' as const,
        tool_calls: [{
            id: 'tool-call-1',
            index: 0,
            type: 'function' as const,
            function: {
                name: '',
                arguments: JSON.stringify({ path: '%USERPROFILE%/Desktop' }),
            },
        }],
    };
};

const createInvalidToolTurnStream = async function* () {
    yield {
        type: 'tool_calls' as const,
        tool_calls: [{
            id: '',
            type: 'function' as const,
            function: {
                name: '',
                arguments: JSON.stringify({ path: '%USERPROFILE%/Desktop' }),
            },
        }],
    };
};

const createInvalidToolWithTextTurnStream = async function* () {
    yield { content: 'Dizini kontrol ediyorum...' };
    yield {
        type: 'tool_calls' as const,
        tool_calls: [{
            id: '',
            type: 'function' as const,
            function: {
                name: '',
                arguments: JSON.stringify({ path: '%USERPROFILE%/Desktop' }),
            },
        }],
    };
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

const setupChatGeneratorTestMocks = () => {
    vi.clearAllMocks();
    mockChatStream.mockImplementation(() => createChunkStream());
    mockGetToolDefinitions.mockResolvedValue([]);
    mockAddMessage.mockResolvedValue(undefined);
    mockUpdateMessage.mockResolvedValue({ success: true });

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
};

describe('useChatGenerator - Streaming', () => {
    beforeEach(setupChatGeneratorTestMocks);

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
});

describe('useChatGenerator - Image Generation', () => {
    beforeEach(setupChatGeneratorTestMocks);

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
            expect.any(String),
            'chat-1'
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

    it('handles empty generate_image tool responses without crashing', async () => {
        mockExecuteTools.mockResolvedValue(undefined);

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

        expect(result.current.chats[0]?.messages[0]?.content).toContain('chat.error');
        expect(mockLogError).toHaveBeenCalled();
    });
});

describe('useChatGenerator - Tool Logic', () => {
    beforeEach(setupChatGeneratorTestMocks);

    it('enables tools for explicit local project creation requests outside agent mode', async () => {
        mockGetToolDefinitions.mockResolvedValue([{
            type: 'function',
            function: {
                name: 'write_file',
                description: 'Writes files',
                parameters: {
                    type: 'object',
                    properties: {
                        path: { type: 'string' },
                        content: { type: 'string' },
                    },
                    required: ['path', 'content'],
                },
            },
        }]);
        mockChatStream
            .mockImplementationOnce(() => createWriteFileToolTurnStream())
            .mockImplementationOnce(() => createFinalAnswerStream());
        mockExecuteTools.mockResolvedValue({
            toolCallId: 'tool-call-write-file',
            name: 'write_file',
            success: true,
            result: {
                success: true,
                displaySummary: 'Wrote 47 bytes to C:/workspace/todo-app/app/page.tsx',
            },
        });

        const { result } = renderHook(() => {
            const [chats, setChats] = useState<Chat[]>([createInitialChat()]);
            const chatGenerator = useChatGenerator({
                chats,
                setChats,
                selectedModel: 'model-a',
                selectedProvider: 'copilot',
                language: 'tr',
                t: (key: string) => key,
                handleSpeak: vi.fn(),
                autoReadEnabled: false,
                formatChatError: (err: CatchError) =>
                    err instanceof Error ? err.message : String(err ?? ''),
                systemMode: 'fast',
                activeWorkspacePath: 'C:/workspace',
            });

            return {
                ...chatGenerator,
                chats,
            };
        });

        await act(async () => {
            await result.current.generateResponse('chat-1', {
                ...createUserMessage(),
                content: 'projects klasörüne bir NextJS todo app oluştur',
            });
        });

        expect(mockGetToolDefinitions).toHaveBeenCalledTimes(1);
        expect(mockChatStream).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                tools: expect.arrayContaining([
                    expect.objectContaining({ function: expect.objectContaining({ name: 'write_file' }) }),
                ]),
                options: expect.objectContaining({ agentToolsEnabled: true }),
            })
        );
        expect(mockExecuteTools).toHaveBeenCalledWith(
            'write_file',
            { path: 'todo-app/app/page.tsx', content: 'export default function Page() { return null; }' },
            'tool-call-write-file',
            'chat-1'
        );
    });

    it('merges split tool call chunks before executing tools', async () => {
        mockGetToolDefinitions.mockResolvedValue([{
            type: 'function',
            function: {
                name: 'list_directory',
                description: 'Lists files',
                parameters: {
                    type: 'object',
                    properties: {
                        path: { type: 'string' },
                    },
                    required: ['path'],
                },
            },
        }]);
        mockChatStream
            .mockImplementationOnce(() => createSplitToolTurnStream())
            .mockImplementationOnce(() => createFinalAnswerStream());
        mockExecuteTools.mockResolvedValue({
            toolCallId: 'tool-call-1',
            name: 'list_directory',
            success: true,
            result: [{ name: 'file.txt', isDirectory: false }],
        });

        const { result } = renderHook(() => {
            const [chats, setChats] = useState<Chat[]>([createInitialChat()]);
            const chatGenerator = useChatGenerator({
                chats,
                setChats,
                selectedModel: 'model-a',
                selectedProvider: 'copilot',
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
                content: 'Masaustumde kac adet dosya var?',
            });
        });

        expect(mockExecuteTools).toHaveBeenCalledWith(
            'list_directory',
            { path: '%USERPROFILE%/Desktop' },
            'tool-call-1',
            'chat-1'
        );
    });

    it('normalizes primitive tool arguments to an empty object', async () => {
        mockGetToolDefinitions.mockResolvedValue([{
            type: 'function',
            function: {
                name: 'get_system_info',
                description: 'Gets system info',
                parameters: {
                    type: 'object',
                    properties: {},
                },
            },
        }]);
        mockChatStream
            .mockImplementationOnce(() => createPrimitiveArgsToolTurnStream())
            .mockImplementationOnce(() => createFinalAnswerStream());
        mockExecuteTools.mockResolvedValue({
            toolCallId: 'tool-call-primitive',
            name: 'get_system_info',
            success: true,
            result: { platform: 'win32' },
        });

        const { result } = renderHook(() => {
            const [chats, setChats] = useState<Chat[]>([createInitialChat()]);
            const chatGenerator = useChatGenerator({
                chats,
                setChats,
                selectedModel: 'model-a',
                selectedProvider: 'copilot',
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
                content: 'Sistem bilgini soyle',
            });
        });

        expect(mockExecuteTools).toHaveBeenCalledWith(
            'get_system_info',
            {},
            'tool-call-primitive',
            'chat-1'
        );
    });

    it('injects active workspace path as cwd for execute_command when missing', async () => {
        mockGetToolDefinitions.mockResolvedValue([{
            type: 'function',
            function: {
                name: 'execute_command',
                description: 'Runs shell command',
                parameters: {
                    type: 'object',
                    properties: {
                        command: { type: 'string' },
                        cwd: { type: 'string' },
                    },
                },
            },
        }]);
        mockChatStream
            .mockImplementationOnce(() => createExecuteCommandToolTurnStream())
            .mockImplementationOnce(() => createFinalAnswerStream());
        mockExecuteTools.mockResolvedValue({
            toolCallId: 'tool-call-command',
            name: 'execute_command',
            success: true,
            result: 'ok',
        });

        const { result } = renderHook(() => {
            const [chats, setChats] = useState<Chat[]>([createInitialChat()]);
            const chatGenerator = useChatGenerator({
                chats,
                setChats,
                selectedModel: 'model-a',
                selectedProvider: 'copilot',
                language: 'tr',
                t: (key: string) => key,
                handleSpeak: vi.fn(),
                autoReadEnabled: false,
                formatChatError: (err: CatchError) =>
                    err instanceof Error ? err.message : String(err ?? ''),
                systemMode: 'agent',
                activeWorkspacePath: 'C:/workspace/tengra',
            });

            return {
                ...chatGenerator,
                chats,
            };
        });

        await act(async () => {
            await result.current.generateResponse('chat-1', {
                ...createUserMessage(),
                content: 'calistir',
            });
        });

        expect(mockExecuteTools).toHaveBeenCalledWith(
            'execute_command',
            { command: 'Get-ChildItem', cwd: 'C:/workspace/tengra' },
            'tool-call-command',
            'chat-1'
        );
    });
});

describe('useChatGenerator - Validation', () => {
    beforeEach(setupChatGeneratorTestMocks);

    it('does not execute malformed tool calls missing id and function name', async () => {
        mockGetToolDefinitions.mockResolvedValue([
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
        mockChatStream.mockImplementationOnce(() => createInvalidToolTurnStream());

        const { result } = renderHook(() => {
            const [chats, setChats] = useState<Chat[]>([createInitialChat()]);
            const chatGenerator = useChatGenerator({
                chats,
                setChats,
                selectedModel: 'model-a',
                selectedProvider: 'copilot',
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
                content: 'Masaustumdeki dosyalari listele',
            });
        });

        expect(mockExecuteTools).not.toHaveBeenCalled();
        expect(result.current.chats[0]?.messages[0]?.content).toContain('chat.error');
    });

    it('falls back to streamed text when malformed tool calls arrive with content', async () => {
        mockGetToolDefinitions.mockResolvedValue([
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
        mockChatStream.mockImplementationOnce(() => createInvalidToolWithTextTurnStream());

        const { result } = renderHook(() => {
            const [chats, setChats] = useState<Chat[]>([createInitialChat()]);
            const chatGenerator = useChatGenerator({
                chats,
                setChats,
                selectedModel: 'model-a',
                selectedProvider: 'copilot',
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
                content: 'Masaustumdeki dosyalari listele',
            });
        });

        expect(mockExecuteTools).not.toHaveBeenCalled();
        expect(result.current.chats[0]?.messages[0]?.content).toContain('Dizini kontrol ediyorum...');
    });

    it('continues tool loop with synthetic tool error outputs when tool execution fails', async () => {
        mockGetToolDefinitions.mockResolvedValue([
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
        mockChatStream
            .mockImplementationOnce(() => createToolTurnStream())
            .mockImplementationOnce(() => createFinalAnswerStream());
        mockExecuteTools.mockRejectedValue(new Error('Tool backend unavailable'));

        const { result } = renderHook(() => {
            const [chats, setChats] = useState<Chat[]>([createInitialChat()]);
            const chatGenerator = useChatGenerator({
                chats,
                setChats,
                selectedModel: 'model-a',
                selectedProvider: 'copilot',
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
                content: 'Masaustumdeki dosyalari listele',
            });
        });

        expect(mockExecuteTools).toHaveBeenCalledTimes(1);
        expect(mockChatStream).toHaveBeenCalledTimes(2);
        expect(result.current.chats[0]?.messages[0]?.content).toContain('Masaustunde 8 oge var.');
    });
});

describe('useChatGenerator - Efficiency & Rebinds', () => {
    beforeEach(setupChatGeneratorTestMocks);

    it('reuses duplicate tool calls without executing them again', async () => {
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
        ]);
        mockChatStream
            .mockImplementationOnce(() => createSameToolTurnStream())
            .mockImplementationOnce(() => createSameToolTurnStream())
            .mockImplementationOnce(() => createFinalAnswerStream());
        mockExecuteTools.mockResolvedValue({
            toolCallId: 'tool-call-repeated',
            name: 'get_system_info',
            success: true,
            result: { platform: 'win32' },
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
            await result.current.generateResponse('chat-1', {
                ...createUserMessage(),
                content: 'Sistemi kontrol et',
            });
        });

        expect(mockExecuteTools).toHaveBeenCalledTimes(1);
        expect(mockChatStream).toHaveBeenCalledTimes(3);
        const repeatedFollowUpRequest = mockChatStream.mock.calls[2]?.[0] as ChatStreamRequest;
        const repeatedReminder = repeatedFollowUpRequest.messages[repeatedFollowUpRequest.messages.length - 1];
        const repeatedReminderContent = typeof repeatedReminder?.content === 'string'
            ? repeatedReminder.content
            : '';
        const assistantMessagesWithToolCalls = repeatedFollowUpRequest.messages.filter(
            message => message.role === 'assistant' && Array.isArray(message.toolCalls)
        );
        expect(repeatedReminderContent).toContain('already executed earlier in this turn');
        expect(assistantMessagesWithToolCalls.every(message => (message.toolCalls?.length ?? 0) <= 1)).toBe(true);
        expect(result.current.chats[0]?.messages[0]?.content).not.toContain('chat.error');
        expect(result.current.chats[0]?.messages[0]?.toolCalls).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: 'tool-call-repeated' }),
            ])
        );
    });

    it('rebinds repeated tool results to the new tool call id without re-executing the duplicate', async () => {
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
        mockChatStream
            .mockImplementationOnce(() => createSystemInfoToolTurnStream())
            .mockImplementationOnce(() => createToolTurnStream())
            .mockImplementationOnce(() => createToolTurnStream())
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
                result: [{ name: 'file.txt', isDirectory: false }],
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
            await result.current.generateResponse('chat-1', {
                ...createUserMessage(),
                content: 'Masaustumde hangi dosyalar var?',
            });
        });

        expect(mockExecuteTools).toHaveBeenCalledTimes(2);
        expect(mockChatStream).toHaveBeenCalledTimes(4);

        const finalAnswerRequest = mockChatStream.mock.calls[3]?.[0] as ChatStreamRequest;
        const repeatedToolOutputs = finalAnswerRequest.messages.filter(message => (
            message.role === 'tool'
            && typeof message.content === 'string'
            && message.content.includes('"_reused":true')
        ));
        expect(repeatedToolOutputs).toHaveLength(1);
        expect(repeatedToolOutputs[0]?.toolCallId?.startsWith('tool-call-1')).toBe(true);
        expect(typeof repeatedToolOutputs[0]?.content === 'string' && repeatedToolOutputs[0].content.includes('file.txt')).toBe(true);
    });

    it('keeps internal tool turns out of visible chat state', async () => {
        mockChatStream
            .mockImplementationOnce(() => createToolTurnStream())
            .mockImplementationOnce(() => createFinalAnswerStream());
        mockExecuteTools.mockResolvedValue({
            toolCallId: 'tool-call-1',
            name: 'list_directory',
            success: true,
            result: [{ name: 'file.txt', isDirectory: false }],
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
                content: 'Masaustumde kac adet dosya var?',
            });
        });

        expect(mockChatStream).toHaveBeenCalledTimes(2);
        expect(result.current.chats[0]?.messages).toHaveLength(1);
        expect(result.current.chats[0]?.messages[0]).toEqual(
            expect.objectContaining({
                role: 'assistant',
                content: 'Masaustunde 8 oge var.',
            })
        );
        expect(result.current.chats[0]?.messages.some(message => message.role === 'system' || message.role === 'tool')).toBe(false);
    });

    it('shows in-flight progress text while a tool call is still running', async () => {
        mockChatStream
            .mockImplementationOnce(() => createToolTurnStream())
            .mockImplementationOnce(() => createFinalAnswerStream());

        let resolveToolExecution: ((value: unknown) => void) | null = null;
        const pendingToolExecution = new Promise<unknown>(resolve => {
            resolveToolExecution = resolve;
        });
        mockExecuteTools.mockImplementationOnce(() => pendingToolExecution);

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

        let generationPromise: Promise<void> | null = null;
        await act(async () => {
            generationPromise = result.current.generateResponse('chat-1', {
                ...createUserMessage(),
                content: 'Masaustumde neler var?',
            });
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(result.current.chats[0]?.messages[0]?.content).toContain('Using tool:');

        await act(async () => {
            resolveToolExecution?.({
                success: true,
                result: [{ name: 'file.txt', isDirectory: false }],
            });
            if (generationPromise) {
                await generationPromise;
            }
        });

        expect(result.current.chats[0]?.messages[0]?.content).toContain('Masaustunde 8 oge var.');
    });
});

describe('useChatGenerator - Permission & Plan Tools', () => {
    beforeEach(setupChatGeneratorTestMocks);

    it('does not expose planning tools in standard chat agent mode', async () => {
        mockGetToolDefinitions.mockResolvedValue([
            {
                type: 'function',
                function: {
                    name: 'propose_plan',
                    description: 'plan',
                    parameters: { type: 'object', properties: {} },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'list_directory',
                    description: 'list',
                    parameters: { type: 'object', properties: {} },
                },
            },
        ]);

        const { result } = renderHook(() => {
            const [chats, setChats] = useState<Chat[]>([createInitialChat()]);
            const chatGenerator = useChatGenerator({
                chats,
                setChats,
                selectedModel: 'model-a',
                selectedProvider: 'antigravity',
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

        expect(mockChatStream).toHaveBeenCalledWith(expect.objectContaining({
            tools: [
                expect.objectContaining({
                    function: expect.objectContaining({ name: 'list_directory' }),
                }),
            ],
        }));
        expect(mockChatStream.mock.calls[0][0].tools).not.toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    function: expect.objectContaining({ name: 'propose_plan' }),
                }),
            ])
        );
    });
});
