/**
 * Regression tests for chat:stream IPC handler lifecycle.
 * Covers: start → chunks → done, cancellation, error handling, rate limiting.
 */
import { registerChatIpc } from '@main/ipc/chat';
import { ipcMain } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Electron ipcMain
const ipcMainHandlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('electron', () => ({
    app: {
        getPath: vi.fn().mockReturnValue('C:\\mock-user-data')
    },
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
            ipcMainHandlers.set(channel, handler);
        }),
        removeHandler: vi.fn(),
        on: vi.fn(),
        removeListener: vi.fn()
    }
}));

vi.mock('@main/utils/ipc-wrapper.util', () => ({
    createIpcHandler: (_name: string, handler: (...args: unknown[]) => unknown) => async (event: unknown, ...args: unknown[]) => {
        try {
            const result = await handler(event, ...args);
            return { success: true, data: result };
        } catch (error: unknown) {
            return { success: false, error: (error instanceof Error ? error.message : 'Unknown Error') };
        }
    },
    createValidatedIpcHandler: (
        _name: string,
        handler: (...args: unknown[]) => unknown,
        options?: { argsSchema?: { parse: (args: unknown[]) => unknown[] }; defaultValue?: unknown }
    ) => async (event: unknown, ...args: unknown[]) => {
        try {
            const parsedArgs = options?.argsSchema ? options.argsSchema.parse(args) : args;
            const result = await handler(event, ...(parsedArgs as unknown[]));
            return { success: true, data: result };
        } catch (error: unknown) {
            if (options && Object.prototype.hasOwnProperty.call(options, 'defaultValue')) {
                return options.defaultValue;
            }
            return { success: false, error: (error instanceof Error ? error.message : 'Validation failed') };
        }
    }
}));

// Mock services
const mockSettingsService = { getSettings: vi.fn().mockReturnValue({}) };
const mockCopilotService = { chat: vi.fn(), streamChat: vi.fn() };
const mockLLMService = {
    chat: vi.fn(),
    chatStream: vi.fn(),
    chatOpenAI: vi.fn(),
    chatOpenAIStream: vi.fn(),
    chatOpenCode: vi.fn(),
    chatOpenCodeStream: vi.fn()
};
const mockProxyService = { getProxyKey: vi.fn().mockReturnValue('dummy-key') };
const mockCodeIntelligenceService = { queryIndexedSymbols: vi.fn().mockResolvedValue([]) };
const mockContextRetrievalService = { retrieveContext: vi.fn().mockResolvedValue({ contextString: '', sources: [] }) };
const mockRateLimitService = { waitForToken: vi.fn() };
const mockDatabaseService = {
    addTokenUsage: vi.fn(),
    addMessage: vi.fn(),
    system: { addTokenUsage: vi.fn() },
    chats: { addMessage: vi.fn() }
};

describe('Chat Stream Lifecycle (Regression)', () => {
    const mockEvent = {
        sender: {
            id: 1,
            isDestroyed: vi.fn().mockReturnValue(false),
            send: vi.fn()
        }
    } as never;

    const typedEvent = mockEvent as unknown as {
        sender: {
            id: number;
            isDestroyed: ReturnType<typeof vi.fn>;
            send: ReturnType<typeof vi.fn>;
        };
    };

    beforeEach(() => {
        ipcMainHandlers.clear();
        vi.clearAllMocks();
        typedEvent.sender.isDestroyed.mockReturnValue(false);
    });

    const mockMainWindow = {
        webContents: { id: 1 }
    };

    const initIPC = (overrides?: Record<string, unknown>) => {
        registerChatIpc({
            getMainWindow: () => mockMainWindow as never,
            settingsService: mockSettingsService as never,
            copilotService: mockCopilotService as never,
            llmService: mockLLMService as never,
            proxyService: mockProxyService as never,
            codeIntelligenceService: mockCodeIntelligenceService as never,
            contextRetrievalService: mockContextRetrievalService as never,
            databaseService: mockDatabaseService as never,
            ...(overrides ?? {})
        });
    };

    const createStreamRequest = (overrides?: Record<string, unknown>) => ({
        messages: [{ role: 'user', content: 'Hello AI' }],
        model: 'gpt-4o',
        tools: [],
        provider: 'openai',
        optionsJson: {},
        chatId: 'stream-test-1',
        projectId: 'proj-1',
        systemMode: 'architect',
        ...(overrides ?? {})
    });

    const getStreamChunkCalls = (): Record<string, unknown>[] => {
        return typedEvent.sender.send.mock.calls
            .filter((call: unknown[]) => call[0] === 'ollama:streamChunk')
            .map((call: unknown[]) => call[1] as Record<string, unknown>);
    };

    const getCancelHandler = (): ((_: unknown, payload: { chatId: string }) => void) | undefined => {
        const calls = vi.mocked(ipcMain.on).mock.calls;
        const call = calls.find(entry => entry[0] === 'chat:cancel');
        return call?.[1] as ((_: unknown, payload: { chatId: string }) => void) | undefined;
    };

    // ─── Full Lifecycle: start → chunks → done ───────────────────────

    describe('stream start → chunks → done lifecycle', () => {
        it('should emit multiple chunks in order then done', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('chat:stream');
            mockLLMService.chatStream.mockReturnValue((async function* () {
                yield { content: 'chunk-1' };
                yield { content: 'chunk-2' };
                yield { content: 'chunk-3' };
            })());

            const result = await handler?.(mockEvent, createStreamRequest());

            expect(result).toMatchObject({ success: true });
            const chunks = getStreamChunkCalls();
            const contentChunks = chunks.filter(c => c.content !== undefined && !c.done);
            const doneChunks = chunks.filter(c => c.done === true);

            expect(contentChunks).toHaveLength(3);
            expect(contentChunks[0]).toMatchObject({ chatId: 'stream-test-1', content: 'chunk-1' });
            expect(contentChunks[1]).toMatchObject({ chatId: 'stream-test-1', content: 'chunk-2' });
            expect(contentChunks[2]).toMatchObject({ chatId: 'stream-test-1', content: 'chunk-3' });
            expect(doneChunks).toHaveLength(1);
            expect(doneChunks[0]).toMatchObject({ chatId: 'stream-test-1', done: true });
        });

        it('should emit done even when stream yields zero chunks', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('chat:stream');
            mockLLMService.chatStream.mockReturnValue((async function* () { /* empty */ })());

            await handler?.(mockEvent, createStreamRequest());

            const chunks = getStreamChunkCalls();
            expect(chunks.some(c => c.done === true)).toBe(true);
        });

        it('should emit chunks with reasoning content', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('chat:stream');
            mockLLMService.chatStream.mockReturnValue((async function* () {
                yield { content: 'answer', reasoning: 'because logic' };
            })());

            await handler?.(mockEvent, createStreamRequest());

            const chunks = getStreamChunkCalls();
            expect(chunks).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ chatId: 'stream-test-1', content: 'answer' })
                ])
            );
        });

        it('should register cancel listener before streaming and remove after', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('chat:stream');
            mockLLMService.chatStream.mockReturnValue((async function* () {
                yield { content: 'data' };
            })());

            await handler?.(mockEvent, createStreamRequest());

            expect(ipcMain.on).toHaveBeenCalledWith('chat:cancel', expect.any(Function));
            expect(ipcMain.removeListener).toHaveBeenCalledWith('chat:cancel', expect.any(Function));
        });
    });

    // ─── Cancellation mid-stream ─────────────────────────────────────

    describe('cancellation mid-stream', () => {
        it('should abort stream when cancel event matches chatId', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('chat:stream');
            mockLLMService.chatStream.mockImplementation(async function* (
                _messages: unknown,
                _model: unknown,
                _tools: unknown,
                _provider: unknown,
                options: { signal?: AbortSignal }
            ) {
                yield { content: 'before-cancel' };
                const cancelHandler = getCancelHandler();
                if (cancelHandler) {
                    cancelHandler({}, { chatId: 'stream-test-1' });
                }
                if (options.signal?.aborted) {
                    const err = new Error('aborted');
                    err.name = 'AbortError';
                    throw err;
                }
                yield { content: 'after-cancel-should-not-appear' };
            });

            await handler?.(mockEvent, createStreamRequest());

            const chunks = getStreamChunkCalls();
            const hasAfterCancel = chunks.some(c => c.content === 'after-cancel-should-not-appear');
            expect(hasAfterCancel).toBe(false);
            expect(chunks.some(c => c.done === true)).toBe(true);
        });

        it('should not emit error chunk on AbortError (user cancellation)', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('chat:stream');
            mockLLMService.chatStream.mockReturnValue((async function* () {
                const err = new Error('aborted');
                err.name = 'AbortError';
                throw err;
                yield null;
            })());

            await handler?.(mockEvent, createStreamRequest());

            const chunks = getStreamChunkCalls();
            const errorChunks = chunks.filter(c => c.type === 'error');
            expect(errorChunks).toHaveLength(0);
            expect(chunks.some(c => c.done === true)).toBe(true);
        });

        it('should not abort when cancel targets a different chatId', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('chat:stream');
            mockLLMService.chatStream.mockImplementation(async function* (
                _messages: unknown,
                _model: unknown,
                _tools: unknown,
                _provider: unknown,
                options: { signal?: AbortSignal }
            ) {
                const cancelHandler = getCancelHandler();
                if (cancelHandler) {
                    cancelHandler({}, { chatId: 'different-chat' });
                }
                if (options.signal?.aborted) {
                    const err = new Error('aborted');
                    err.name = 'AbortError';
                    throw err;
                }
                yield { content: 'still-streaming' };
            });

            await handler?.(mockEvent, createStreamRequest());

            const chunks = getStreamChunkCalls();
            expect(chunks.some(c => c.content === 'still-streaming')).toBe(true);
        });
    });

    // ─── Error handling ──────────────────────────────────────────────

    describe('error handling', () => {
        it('should emit error chunk and done when provider throws', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('chat:stream');
            mockLLMService.chatStream.mockReturnValue((async function* () {
                throw new Error('Provider unavailable: connection refused');
                yield null;
            })());

            await handler?.(mockEvent, createStreamRequest());

            const chunks = getStreamChunkCalls();
            const errorChunks = chunks.filter(c => c.type === 'error');
            expect(errorChunks).toHaveLength(1);
            expect(errorChunks[0].content).toContain('Provider unavailable');
            expect(chunks.some(c => c.done === true)).toBe(true);
        });

        it('should emit error chunk when stream throws mid-generation', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('chat:stream');
            mockLLMService.chatStream.mockReturnValue((async function* () {
                yield { content: 'partial-data' };
                throw new Error('Timeout: request exceeded 30s');
            })());

            await handler?.(mockEvent, createStreamRequest());

            const chunks = getStreamChunkCalls();
            expect(chunks.some(c => c.content === 'partial-data')).toBe(true);
            expect(chunks.some(c => c.type === 'error')).toBe(true);
            expect(chunks.some(c => c.done === true)).toBe(true);
        });

        it('should not send chunks when sender is destroyed', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('chat:stream');
            typedEvent.sender.isDestroyed.mockReturnValue(true);
            mockLLMService.chatStream.mockReturnValue((async function* () {
                yield { content: 'ghost-data' };
            })());

            await handler?.(mockEvent, createStreamRequest());

            expect(typedEvent.sender.send).not.toHaveBeenCalled();
        });

        it('should emit error for copilot provider when streamChat returns null', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('chat:stream');
            mockCopilotService.streamChat.mockResolvedValue(null);

            await handler?.(mockEvent, createStreamRequest({ provider: 'copilot' }));

            const chunks = getStreamChunkCalls();
            expect(chunks.some(c => c.type === 'error' && (c.content as string).includes('Copilot stream'))).toBe(true);
            expect(chunks.some(c => c.done === true)).toBe(true);
        });
    });

    // ─── Rate limiting ───────────────────────────────────────────────

    describe('rate limiting', () => {
        it('should emit rate-limit error and done without starting stream', async () => {
            mockRateLimitService.waitForToken.mockRejectedValue(new Error('quota exhausted'));
            initIPC({ rateLimitService: mockRateLimitService });
            const handler = ipcMainHandlers.get('chat:stream');

            await handler?.(mockEvent, createStreamRequest());

            const chunks = getStreamChunkCalls();
            expect(chunks.some(c => c.type === 'error' && (c.content as string).includes('Rate limit'))).toBe(true);
            expect(chunks.some(c => c.done === true)).toBe(true);
            expect(mockLLMService.chatStream).not.toHaveBeenCalled();
        });

        it('should not register cancel listener when rate-limited', async () => {
            mockRateLimitService.waitForToken.mockRejectedValue(new Error('quota exhausted'));
            initIPC({ rateLimitService: mockRateLimitService });
            const handler = ipcMainHandlers.get('chat:stream');

            await handler?.(mockEvent, createStreamRequest());

            expect(ipcMain.on).not.toHaveBeenCalledWith('chat:cancel', expect.any(Function));
        });

        it('should proceed to stream after successful rate-limit check', async () => {
            mockRateLimitService.waitForToken.mockResolvedValue(undefined);
            initIPC({ rateLimitService: mockRateLimitService });
            const handler = ipcMainHandlers.get('chat:stream');
            mockLLMService.chatStream.mockReturnValue((async function* () {
                yield { content: 'allowed' };
            })());

            await handler?.(mockEvent, createStreamRequest());

            expect(mockRateLimitService.waitForToken).toHaveBeenCalledWith('chat:stream');
            expect(mockLLMService.chatStream).toHaveBeenCalled();
            const chunks = getStreamChunkCalls();
            expect(chunks.some(c => c.content === 'allowed')).toBe(true);
        });

        it('should skip rate-limit check when rateLimitService is not configured', async () => {
            initIPC(); // no rateLimitService
            const handler = ipcMainHandlers.get('chat:stream');
            mockLLMService.chatStream.mockReturnValue((async function* () { })());

            await handler?.(mockEvent, createStreamRequest());

            expect(mockRateLimitService.waitForToken).not.toHaveBeenCalled();
            expect(mockLLMService.chatStream).toHaveBeenCalled();
        });
    });

    // ─── Provider routing in stream ──────────────────────────────────

    describe('provider routing', () => {
        it('should route opencode provider to chatOpenCodeStream', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('chat:stream');
            mockLLMService.chatOpenCodeStream.mockReturnValue((async function* () {
                yield { content: 'opencode-reply' };
            })());

            await handler?.(mockEvent, createStreamRequest({ provider: 'opencode' }));

            expect(mockLLMService.chatOpenCodeStream).toHaveBeenCalled();
        });

        it('should route copilot provider to copilotService.streamChat', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('chat:stream');
            const mockStream = (async function* () {
                yield new TextEncoder().encode('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n');
            })();
            mockCopilotService.streamChat.mockResolvedValue(mockStream);

            await handler?.(mockEvent, createStreamRequest({ provider: 'copilot' }));

            expect(mockCopilotService.streamChat).toHaveBeenCalled();
        });

        it('should route default providers to llmService.chatStream', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('chat:stream');
            mockLLMService.chatStream.mockReturnValue((async function* () { })());

            await handler?.(mockEvent, createStreamRequest({ provider: 'ollama' }));

            expect(mockLLMService.chatStream).toHaveBeenCalled();
        });
    });

    // ─── Input validation ────────────────────────────────────────────

    describe('input validation', () => {
        it('should reject payload missing chatId', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('chat:stream');
            const payload = createStreamRequest();
            const incomplete = { ...payload } as Record<string, unknown>;
            delete incomplete.chatId;

            const result = await handler?.(mockEvent, incomplete);

            expect(result).toMatchObject({ success: false });
        });

        it('should reject legacy positional arguments', async () => {
            initIPC();
            const handler = ipcMainHandlers.get('chat:stream');

            const result = await handler?.(
                mockEvent,
                [{ role: 'user', content: 'test' }],
                'gpt-4o',
                [],
                'openai',
                {},
                'chat-1',
                'proj-1',
                'architect'
            );

            expect(result).toMatchObject({ success: false });
        });
    });
});
