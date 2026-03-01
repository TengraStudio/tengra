/**
 * QUALITY-061: Regression – Typed chat preload stream payloads.
 *
 * Validates that the ChatBridge interface exposes exactly the expected
 * typed methods and that stream payload shapes stay aligned between
 * the preload bridge and renderer-side expectations.
 */
import { Message, ToolDefinition } from '@shared/types/chat';
import { JsonObject } from '@shared/types/common';
import { IpcRendererEvent } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Electron mock ────────────────────────────────────────────────────────────

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

import { ChatBridge, createChatBridge } from '@main/preload/domains/chat.preload';
import { ipcRenderer } from 'electron';

// ── Compile-time type assertions ────────────────────────────────────────────

/**
 * Utility types for static (compile-time) schema alignment checks.
 * If the bridge signature drifts from the expected shape the file
 * will fail to compile, catching regressions before tests even run.
 */
type IsExact<T, U> = [T] extends [U] ? ([U] extends [T] ? true : false) : false;

/** Expected shape of chatStream params – mirrors ChatBridge['chatStream'] arg. */
interface ExpectedChatStreamParams {
    messages: Message[];
    model: string;
    tools?: ToolDefinition[];
    provider: string;
    optionsJson?: JsonObject;
    chatId: string;
    projectId?: string;
    systemMode?: string;
}

/** Expected shape of chatStream return value. */
interface ExpectedChatStreamResult {
    success: boolean;
    error?: string;
}

/** Expected shape of the stream chunk the callback receives. */
interface ExpectedStreamChunk {
    chatId: string;
    content?: string;
    reasoning?: string;
    done?: boolean;
    type?: 'error' | 'metadata';
    sources?: string[];
}

// Static checks – these produce compile errors if the bridge drifts.
type _AssertParamsMatch = IsExact<
    Parameters<ChatBridge['chatStream']>[0],
    ExpectedChatStreamParams
> extends true ? true : never;

type _AssertResultMatch = IsExact<
    Awaited<ReturnType<ChatBridge['chatStream']>>,
    ExpectedChatStreamResult
> extends true ? true : never;

type _AssertAbortParam = IsExact<
    Parameters<ChatBridge['abortChat']>[0],
    string
> extends true ? true : never;

type _AssertOnStreamReturnsUnsub = IsExact<
    ReturnType<ChatBridge['onStreamChunk']>,
    () => void
> extends true ? true : never;

// Force usage so TS doesn't elide the checks.
const _staticParamsCheck: _AssertParamsMatch = true;
const _staticResultCheck: _AssertResultMatch = true;
const _staticAbortCheck: _AssertAbortParam = true;
const _staticUnsubCheck: _AssertOnStreamReturnsUnsub = true;
void _staticParamsCheck;
void _staticResultCheck;
void _staticAbortCheck;
void _staticUnsubCheck;

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildMessage(overrides: Partial<Message> = {}): Message {
    return {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date(),
        ...overrides,
    };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('QUALITY-061 – ChatBridge typed methods & stream payload alignment', () => {
    let bridge: ChatBridge;

    beforeEach(() => {
        vi.clearAllMocks();
        mockInvoke.mockResolvedValue({ success: true });
        bridge = createChatBridge(ipcRenderer);
    });

    // ── Bridge surface area ─────────────────────────────────────────────

    describe('bridge exposes correct typed methods', () => {
        it('should expose exactly chatStream, onStreamChunk, abortChat', () => {
            const keys = Object.keys(bridge).sort();
            expect(keys).toEqual(['abortChat', 'chatStream', 'onStreamChunk']);
        });

        it('chatStream should be a function', () => {
            expect(typeof bridge.chatStream).toBe('function');
        });

        it('onStreamChunk should be a function', () => {
            expect(typeof bridge.onStreamChunk).toBe('function');
        });

        it('abortChat should be a function', () => {
            expect(typeof bridge.abortChat).toBe('function');
        });
    });

    // ── Stream payload type alignment ───────────────────────────────────

    describe('stream payload types match renderer expectations', () => {
        it('chatStream should resolve with { success, error? } shape', async () => {
            mockInvoke.mockResolvedValue({ success: true });
            const result = await bridge.chatStream({
                messages: [buildMessage()],
                model: 'llama3',
                provider: 'ollama',
                chatId: 'c-1',
            });

            expect(result).toHaveProperty('success');
            expect(typeof result.success).toBe('boolean');
        });

        it('chatStream error response should carry string error', async () => {
            mockInvoke.mockResolvedValue({ success: false, error: 'rate limited' });
            const result = await bridge.chatStream({
                messages: [buildMessage()],
                model: 'llama3',
                provider: 'ollama',
                chatId: 'c-1',
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('rate limited');
        });

        it('onStreamChunk callback receives chunk with required chatId', () => {
            const callback = vi.fn();
            bridge.onStreamChunk(callback);

            const listener = mockOn.mock.calls[0][1] as (
                event: IpcRendererEvent,
                chunk: ExpectedStreamChunk,
            ) => void;
            listener({} as IpcRendererEvent, { chatId: 'c-1', content: 'hi' });

            const received = callback.mock.calls[0][0] as ExpectedStreamChunk;
            expect(received.chatId).toBe('c-1');
            expect(typeof received.chatId).toBe('string');
        });

        it('stream chunk optional fields default to undefined', () => {
            const callback = vi.fn();
            bridge.onStreamChunk(callback);

            const listener = mockOn.mock.calls[0][1] as (
                event: IpcRendererEvent,
                chunk: ExpectedStreamChunk,
            ) => void;
            listener({} as IpcRendererEvent, { chatId: 'c-1' });

            const received = callback.mock.calls[0][0] as ExpectedStreamChunk;
            expect(received.content).toBeUndefined();
            expect(received.reasoning).toBeUndefined();
            expect(received.done).toBeUndefined();
            expect(received.type).toBeUndefined();
            expect(received.sources).toBeUndefined();
        });

        it('abortChat sends correct IPC channel and payload shape', () => {
            bridge.abortChat('c-42');

            expect(mockSend).toHaveBeenCalledTimes(1);
            expect(mockSend).toHaveBeenCalledWith('chat:cancel', { chatId: 'c-42' });
        });
    });

    // ── Schema alignment: params forwarded faithfully ───────────────────

    describe('schema alignment – params forwarded without mutation', () => {
        it('should forward tools array without transformation', async () => {
            const tools: ToolDefinition[] = [
                { type: 'function', function: { name: 'read_file', description: 'Read a file' } },
                { type: 'function', function: { name: 'search', parameters: { type: 'object' } } },
            ];

            await bridge.chatStream({
                messages: [buildMessage()],
                model: 'gpt-4',
                provider: 'openai',
                chatId: 'c-1',
                tools,
            });

            const forwarded = mockInvoke.mock.calls[0][1] as ExpectedChatStreamParams;
            expect(forwarded.tools).toStrictEqual(tools);
        });

        it('should forward optionsJson without mutation', async () => {
            const optionsJson: JsonObject = {
                temperature: 0.5,
                top_p: 0.9,
                stop: null,
            };

            await bridge.chatStream({
                messages: [buildMessage()],
                model: 'claude-3',
                provider: 'anthropic',
                chatId: 'c-2',
                optionsJson,
            });

            const forwarded = mockInvoke.mock.calls[0][1] as ExpectedChatStreamParams;
            expect(forwarded.optionsJson).toStrictEqual(optionsJson);
        });

        it('should forward multipart content messages', async () => {
            const msg: Message = {
                id: 'm-1',
                role: 'user',
                content: [
                    { type: 'text', text: 'What is this?' },
                    { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } },
                ],
                timestamp: new Date(),
            };

            await bridge.chatStream({
                messages: [msg],
                model: 'gpt-4o',
                provider: 'openai',
                chatId: 'c-3',
            });

            const forwarded = mockInvoke.mock.calls[0][1] as ExpectedChatStreamParams;
            expect(forwarded.messages[0].content).toEqual(msg.content);
        });

        it('should forward systemMode string as-is', async () => {
            await bridge.chatStream({
                messages: [buildMessage()],
                model: 'llama3',
                provider: 'ollama',
                chatId: 'c-4',
                systemMode: 'agent',
            });

            const forwarded = mockInvoke.mock.calls[0][1] as ExpectedChatStreamParams;
            expect(forwarded.systemMode).toBe('agent');
        });
    });

    // ── Unsubscribe lifecycle ───────────────────────────────────────────

    describe('onStreamChunk unsubscribe lifecycle', () => {
        it('should return a callable unsubscribe function', () => {
            const unsub = bridge.onStreamChunk(vi.fn());
            expect(typeof unsub).toBe('function');
        });

        it('unsubscribe should remove the same listener reference', () => {
            const unsub = bridge.onStreamChunk(vi.fn());
            const registeredListener = mockOn.mock.calls[0][1];

            unsub();

            expect(mockRemoveListener).toHaveBeenCalledWith(
                'ollama:streamChunk',
                registeredListener,
            );
        });

        it('multiple subscriptions should be independently removable', () => {
            const unsub1 = bridge.onStreamChunk(vi.fn());
            const unsub2 = bridge.onStreamChunk(vi.fn());

            const listener1 = mockOn.mock.calls[0][1];
            const listener2 = mockOn.mock.calls[1][1];

            unsub1();
            expect(mockRemoveListener).toHaveBeenCalledWith('ollama:streamChunk', listener1);

            unsub2();
            expect(mockRemoveListener).toHaveBeenCalledWith('ollama:streamChunk', listener2);
            expect(mockRemoveListener).toHaveBeenCalledTimes(2);
        });
    });
});
