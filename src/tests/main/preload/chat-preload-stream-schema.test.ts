/**
 * QUALITY-061: Regression coverage for typed chat preload stream payloads.
 * Ensures ChatBridge interface and renderer bridge stay schema-aligned.
 */
import { Message, ToolDefinition } from '@shared/types/chat';
import { JsonObject } from '@shared/types/common';
import { IpcRendererEvent } from 'electron';
import { beforeEach,describe, expect, it, vi } from 'vitest';

// ── Mock electron ────────────────────────────────────────────────────────────

const mockInvoke = vi.fn();
const mockOn = vi.fn();
const mockRemoveListener = vi.fn();
const mockSend = vi.fn();

vi.mock('electron', () => ({
    ipcRenderer: {
        invoke: (...args: unknown[]) => mockInvoke(...args),
        on: (...args: unknown[]) => mockOn(...args),
        removeListener: (...args: unknown[]) => mockRemoveListener(...args),
        send: (...args: unknown[]) => mockSend(...args),
    },
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// ── Import after mocks ──────────────────────────────────────────────────────

import { ChatBridge,createChatBridge } from '@main/preload/domains/chat.preload';
import { ipcRenderer } from 'electron';

// ── Stream chunk payload type (mirrors preload definition) ──────────────────

interface StreamChunkPayload {
    chatId: string;
    content?: string;
    reasoning?: string;
    done?: boolean;
    type?: 'error' | 'metadata';
    sources?: string[];
}

// ── Chat stream request payload type (mirrors preload definition) ───────────

interface ChatStreamParams {
    messages: Message[];
    model: string;
    tools?: ToolDefinition[];
    provider: string;
    optionsJson?: JsonObject;
    chatId: string;
    projectId?: string;
    systemMode?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildMinimalMessage(): Message {
    return {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date(),
    };
}

function buildStreamParams(overrides: Partial<ChatStreamParams> = {}): ChatStreamParams {
    return {
        messages: [buildMinimalMessage()],
        model: 'gpt-4',
        provider: 'openai',
        chatId: 'chat-1',
        ...overrides,
    };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('ChatBridge stream payload schema regression', () => {
    let bridge: ChatBridge;

    beforeEach(() => {
        vi.clearAllMocks();
        mockInvoke.mockResolvedValue({ success: true });
        bridge = createChatBridge(ipcRenderer);
    });

    // ── chatStream request payloads ─────────────────────────────────────

    describe('chatStream request schema', () => {
        it('should forward minimal required params via ipc.invoke', async () => {
            const params = buildStreamParams();
            await bridge.chatStream(params);

            expect(mockInvoke).toHaveBeenCalledWith('chat:stream', params);
            expect(mockInvoke).toHaveBeenCalledTimes(1);
        });

        it('should forward all optional fields when provided', async () => {
            const params = buildStreamParams({
                tools: [{ type: 'function', function: { name: 'search', description: 'Search web' } }],
                optionsJson: { temperature: 0.7 },
                projectId: 'proj-42',
                systemMode: 'thinking',
            });

            await bridge.chatStream(params);

            const invokedPayload = mockInvoke.mock.calls[0][1] as ChatStreamParams;
            expect(invokedPayload.tools).toHaveLength(1);
            expect(invokedPayload.optionsJson).toEqual({ temperature: 0.7 });
            expect(invokedPayload.projectId).toBe('proj-42');
            expect(invokedPayload.systemMode).toBe('thinking');
        });

        it('should return success/error shape from ipc.invoke', async () => {
            mockInvoke.mockResolvedValue({ success: false, error: 'model not found' });

            const result = await bridge.chatStream(buildStreamParams());

            expect(result).toEqual({ success: false, error: 'model not found' });
        });

        it('should accept messages with different roles', async () => {
            const messages: Message[] = [
                { id: '1', role: 'system', content: 'You are helpful', timestamp: new Date() },
                { id: '2', role: 'user', content: 'Hi', timestamp: new Date() },
                { id: '3', role: 'assistant', content: 'Hello!', timestamp: new Date() },
                { id: '4', role: 'tool', content: 'result', timestamp: new Date(), toolCallId: 'tc-1' },
            ];

            await bridge.chatStream(buildStreamParams({ messages }));

            const invokedPayload = mockInvoke.mock.calls[0][1] as ChatStreamParams;
            expect(invokedPayload.messages).toHaveLength(4);
        });
    });

    // ── onStreamChunk payloads ──────────────────────────────────────────

    describe('onStreamChunk payload schema', () => {
        it('should subscribe to ollama:streamChunk channel', () => {
            const callback = vi.fn();
            bridge.onStreamChunk(callback);

            expect(mockOn).toHaveBeenCalledWith('ollama:streamChunk', expect.any(Function));
        });

        it('should return an unsubscribe function that removes listener', () => {
            const callback = vi.fn();
            const unsubscribe = bridge.onStreamChunk(callback);

            unsubscribe();

            expect(mockRemoveListener).toHaveBeenCalledWith('ollama:streamChunk', expect.any(Function));
        });

        it('should relay content chunk to callback', () => {
            const callback = vi.fn();
            bridge.onStreamChunk(callback);

            const listener = mockOn.mock.calls[0][1] as (event: IpcRendererEvent, chunk: StreamChunkPayload) => void;
            const chunk: StreamChunkPayload = { chatId: 'chat-1', content: 'Hello' };
            listener({} as IpcRendererEvent, chunk);

            expect(callback).toHaveBeenCalledWith(chunk);
            expect(callback.mock.calls[0][0].chatId).toBe('chat-1');
            expect(callback.mock.calls[0][0].content).toBe('Hello');
        });

        it('should relay reasoning chunk to callback', () => {
            const callback = vi.fn();
            bridge.onStreamChunk(callback);

            const listener = mockOn.mock.calls[0][1] as (event: IpcRendererEvent, chunk: StreamChunkPayload) => void;
            const chunk: StreamChunkPayload = { chatId: 'chat-1', reasoning: 'Let me think...' };
            listener({} as IpcRendererEvent, chunk);

            expect(callback.mock.calls[0][0].reasoning).toBe('Let me think...');
        });

        it('should relay done signal', () => {
            const callback = vi.fn();
            bridge.onStreamChunk(callback);

            const listener = mockOn.mock.calls[0][1] as (event: IpcRendererEvent, chunk: StreamChunkPayload) => void;
            listener({} as IpcRendererEvent, { chatId: 'chat-1', done: true });

            expect(callback.mock.calls[0][0].done).toBe(true);
        });

        it('should relay error type chunk', () => {
            const callback = vi.fn();
            bridge.onStreamChunk(callback);

            const listener = mockOn.mock.calls[0][1] as (event: IpcRendererEvent, chunk: StreamChunkPayload) => void;
            const chunk: StreamChunkPayload = {
                chatId: 'chat-1',
                type: 'error',
                content: 'Connection lost',
            };
            listener({} as IpcRendererEvent, chunk);

            expect(callback.mock.calls[0][0].type).toBe('error');
        });

        it('should relay metadata type with sources', () => {
            const callback = vi.fn();
            bridge.onStreamChunk(callback);

            const listener = mockOn.mock.calls[0][1] as (event: IpcRendererEvent, chunk: StreamChunkPayload) => void;
            const chunk: StreamChunkPayload = {
                chatId: 'chat-1',
                type: 'metadata',
                sources: ['doc1.md', 'doc2.md'],
            };
            listener({} as IpcRendererEvent, chunk);

            expect(callback.mock.calls[0][0].type).toBe('metadata');
            expect(callback.mock.calls[0][0].sources).toEqual(['doc1.md', 'doc2.md']);
        });

        it('should relay full payload with all optional fields', () => {
            const callback = vi.fn();
            bridge.onStreamChunk(callback);

            const listener = mockOn.mock.calls[0][1] as (event: IpcRendererEvent, chunk: StreamChunkPayload) => void;
            const fullChunk: StreamChunkPayload = {
                chatId: 'chat-1',
                content: 'Some text',
                reasoning: 'Because...',
                done: false,
                type: 'metadata',
                sources: ['src.ts'],
            };
            listener({} as IpcRendererEvent, fullChunk);

            const received = callback.mock.calls[0][0] as StreamChunkPayload;
            expect(received).toEqual(fullChunk);
        });
    });

    // ── abortChat payload ───────────────────────────────────────────────

    describe('abortChat payload schema', () => {
        it('should send chat:cancel with chatId object', () => {
            bridge.abortChat('chat-99');

            expect(mockSend).toHaveBeenCalledWith('chat:cancel', { chatId: 'chat-99' });
        });
    });

    // ── Schema alignment: structural contract checks ────────────────────

    describe('schema alignment guards', () => {
        it('chatStream response must have success boolean', async () => {
            mockInvoke.mockResolvedValue({ success: true });
            const result = await bridge.chatStream(buildStreamParams());

            expect(typeof result.success).toBe('boolean');
        });

        it('chatStream response error field must be string or undefined', async () => {
            mockInvoke.mockResolvedValue({ success: false, error: 'fail' });
            const result = await bridge.chatStream(buildStreamParams());

            expect(typeof result.error === 'string' || result.error === undefined).toBe(true);
        });

        it('stream chunk chatId must always be a string', () => {
            const callback = vi.fn();
            bridge.onStreamChunk(callback);

            const listener = mockOn.mock.calls[0][1] as (event: IpcRendererEvent, chunk: StreamChunkPayload) => void;
            listener({} as IpcRendererEvent, { chatId: 'abc' });

            expect(typeof callback.mock.calls[0][0].chatId).toBe('string');
        });

        it('stream chunk type must be error or metadata when present', () => {
            const callback = vi.fn();
            bridge.onStreamChunk(callback);

            const listener = mockOn.mock.calls[0][1] as (event: IpcRendererEvent, chunk: StreamChunkPayload) => void;
            listener({} as IpcRendererEvent, { chatId: 'c1', type: 'error' });
            listener({} as IpcRendererEvent, { chatId: 'c2', type: 'metadata' });

            const validTypes = ['error', 'metadata'];
            expect(validTypes).toContain(callback.mock.calls[0][0].type);
            expect(validTypes).toContain(callback.mock.calls[1][0].type);
        });
    });
});
