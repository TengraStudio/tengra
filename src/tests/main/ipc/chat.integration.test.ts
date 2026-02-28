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
        handle: vi.fn((channel, handler) => {
            ipcMainHandlers.set(channel, handler);
        }),
        removeHandler: vi.fn(),
        on: vi.fn(),
        removeListener: vi.fn()
    }
}));

// Mock IPC Wrapper to avoid transitive dependency issues with error.util
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


// Mock Services
const mockSettingsService = { getSettings: vi.fn().mockReturnValue({}) };
const mockCopilotService = { chat: vi.fn(), streamChat: vi.fn() };
const mockLLMService = {
    chat: vi.fn(),  // Used by handleOpenAIChat line 208
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

describe('Chat IPC Integration', () => {
    const mockEvent = {
        sender: {
            id: 1,
            isDestroyed: vi.fn().mockReturnValue(false),
            send: vi.fn()
        }
    } as never;

    beforeEach(() => {
        ipcMainHandlers.clear();
        vi.clearAllMocks();
        mockEvent.sender.isDestroyed.mockReturnValue(false);
    });


    const initIPC = (overrides?: Record<string, unknown>) => {
        registerChatIpc({
            getMainWindow: () => null,
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
        messages: [{ role: 'user', content: 'test' }],
        model: 'gpt-4o',
        tools: [],
        provider: 'openai',
        optionsJson: {},
        chatId: 'chat-1',
        projectId: 'proj-1',
        systemMode: 'architect',
        ...(overrides ?? {})
    });

    const getCancelHandler = (): ((_: unknown, payload: { chatId: string }) => void) | undefined => {
        const calls = vi.mocked(ipcMain.on).mock.calls;
        const call = calls.find(entry => entry[0] === 'chat:cancel');
        return call?.[1] as ((_: unknown, payload: { chatId: string }) => void) | undefined;
    };

    it('should register expected handlers', () => {
        initIPC();
        expect(ipcMainHandlers.has('chat:openai')).toBe(true);
        expect(ipcMainHandlers.has('chat:stream')).toBe(true);
        expect(ipcMainHandlers.has('chat:copilot')).toBe(true);
    });

    it('should route chat:openai to LLMService (default)', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('chat:openai');

        mockLLMService.chat.mockResolvedValue({
            content: 'Response',
            reasoning: 'Reason',
            images: [],
            role: 'assistant'
        });

        const result = await handler?.(mockEvent, {
            messages: [{ role: 'user', content: 'test' }],
            model: 'gpt-4o',
            tools: [],
            provider: 'openai',
            projectId: 'proj-1'
        });


        expect(mockLLMService.chat).toHaveBeenCalled();
        expect(result).toMatchObject({
            success: true,
            data: {
                content: 'Response',
                role: 'assistant'
            }
        });
    });

    it('should accept tengra systemMode values in chat:openai payload', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('chat:openai');

        mockLLMService.chat.mockResolvedValue({
            content: 'Response',
            reasoning: '',
            images: [],
            role: 'assistant'
        });

        const result = await handler?.(mockEvent, {
            messages: [{ role: 'user', content: 'test' }],
            model: 'gpt-4o',
            tools: [],
            provider: 'openai',
            projectId: 'proj-1',
            systemMode: 'thinking'
        });

        expect(result).toMatchObject({
            success: true,
            data: {
                content: 'Response',
                role: 'assistant'
            }
        });
    });

    it('should reject legacy positional args for chat:openai', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('chat:openai');

        const result = await handler?.(
            mockEvent,
            [{ role: 'user', content: 'test' }],
            'gpt-4o',
            [],
            'openai',
            'proj-1'
        );

        expect(result).toMatchObject({ success: false });
    });

    it('should reject deprecated systemMode values in chat:openai payload', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('chat:openai');

        const result = await handler?.(mockEvent, {
            messages: [{ role: 'user', content: 'test' }],
            model: 'gpt-4o',
            tools: [],
            provider: 'openai',
            projectId: 'proj-1',
            systemMode: 'default'
        });

        expect(result).toMatchObject({ success: false });
    });

    it('should route chat:openai (copilot provider) to CopilotService', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('chat:openai');

        mockCopilotService.chat.mockResolvedValue({
            content: 'Copilot Response'
        });

        const result = await handler?.(mockEvent, {
            messages: [{ role: 'user', content: 'test' }],
            model: 'gpt-4o',
            tools: [],
            provider: 'copilot',
            projectId: 'proj-1'
        });


        expect(mockCopilotService.chat).toHaveBeenCalled();
        expect(result).toMatchObject({
            success: true,
            data: {
                content: 'Copilot Response',
                role: 'assistant'
            }
        });
    });

    it('should handle errors in chat:openai', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('chat:openai');

        mockLLMService.chat.mockRejectedValue(new Error('Simulated Fail'));

        const result = await handler?.(mockEvent, {
            messages: [{ role: 'user', content: 'test' }],
            model: 'gpt-4o',
            tools: [],
            provider: 'openai',
            projectId: 'proj-1'
        });


        // The IPC wrapper usually catches errors and returns { success: false, error: ... }
        // BUT checking chat.ts: ipcMain.handle('chat:openai', createIpcHandler(...))
        // createIpcHandler standardizes the response.
        expect(result).toEqual({
            success: false,
            error: 'Simulated Fail'
        });
    });

    it('should route chat:copilot legacy handler', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('chat:copilot');

        mockCopilotService.chat.mockResolvedValue({ content: 'Legacy' });

        const result = await handler?.(mockEvent, [{ role: 'user', content: 'test' }], 'gpt-4o');


        expect(mockCopilotService.chat).toHaveBeenCalled();
        expect(result).toMatchObject({
            success: true,
            data: {
                content: 'Legacy',
                role: 'assistant'
            }
        });
    });

    it('should reject legacy positional args for chat:stream', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('chat:stream');

        const result = await handler?.(
            mockEvent,
            [{ role: 'user', content: 'test' }],
            'gpt-4o',
            [],
            'copilot',
            {},
            'chat-1',
            'proj-1',
            'architect'
        );

        expect(result).toMatchObject({ success: false });
    });

    it('should reject missing chatId in object payload for chat:stream', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('chat:stream');
        const payload = createStreamRequest();
        const payloadWithoutChatId = { ...payload } as Record<string, unknown>;
        delete payloadWithoutChatId.chatId;
        const result = await handler?.(mockEvent, payloadWithoutChatId);

        expect(result).toMatchObject({ success: false });
    });

    it('should accept object payload for chat:stream and emit chunks', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('chat:stream');
        mockLLMService.chatStream.mockReturnValue((async function* () {
            yield { content: 'Hello' };
        })());

        const result = await handler?.(mockEvent, createStreamRequest());

        expect(result).toMatchObject({ success: true });
        expect(mockEvent.sender.send).toHaveBeenCalledWith(
            'ollama:streamChunk',
            expect.objectContaining({ chatId: 'chat-1', content: 'Hello' })
        );
        expect(mockEvent.sender.send).toHaveBeenCalledWith(
            'ollama:streamChunk',
            expect.objectContaining({ chatId: 'chat-1', done: true })
        );
    });

    it('should accept chat:stream with systemMode thinking', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('chat:stream');
        mockLLMService.chatStream.mockReturnValue((async function* () { })());

        const result = await handler?.(mockEvent, createStreamRequest({ systemMode: 'thinking' }));

        expect(result).toMatchObject({ success: true });
    });

    it('should accept chat:stream with systemMode agent', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('chat:stream');
        mockLLMService.chatStream.mockReturnValue((async function* () { })());

        const result = await handler?.(mockEvent, createStreamRequest({ systemMode: 'agent' }));

        expect(result).toMatchObject({ success: true });
    });

    it('should accept chat:stream with systemMode fast', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('chat:stream');
        mockLLMService.chatStream.mockReturnValue((async function* () { })());

        const result = await handler?.(mockEvent, createStreamRequest({ systemMode: 'fast' }));

        expect(result).toMatchObject({ success: true });
    });

    it('should reject deprecated systemMode values for chat:stream', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('chat:stream');

        const result = await handler?.(mockEvent, createStreamRequest({ systemMode: 'default' }));

        expect(result).toMatchObject({ success: false });
    });

    it('should emit error and done when chat stream throws', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('chat:stream');
        mockLLMService.chatStream.mockReturnValue((async function* () {
            throw new Error('stream exploded');
            yield null;
        })());

        const result = await handler?.(mockEvent, createStreamRequest());

        expect(result).toMatchObject({ success: true });
        expect(mockEvent.sender.send).toHaveBeenCalledWith(
            'ollama:streamChunk',
            expect.objectContaining({ type: 'error', content: expect.stringContaining('stream exploded') })
        );
        expect(mockEvent.sender.send).toHaveBeenCalledWith(
            'ollama:streamChunk',
            expect.objectContaining({ chatId: 'chat-1', done: true })
        );
    });

    it('should emit rate-limit error and done when token wait fails', async () => {
        mockRateLimitService.waitForToken.mockRejectedValue(new Error('limit reached'));
        initIPC({ rateLimitService: mockRateLimitService });
        const handler = ipcMainHandlers.get('chat:stream');

        const result = await handler?.(mockEvent, createStreamRequest());

        expect(result).toMatchObject({ success: true });
        expect(mockEvent.sender.send).toHaveBeenCalledWith(
            'ollama:streamChunk',
            expect.objectContaining({ type: 'error', content: expect.stringContaining('Rate limit exceeded') })
        );
        expect(mockEvent.sender.send).toHaveBeenCalledWith(
            'ollama:streamChunk',
            expect.objectContaining({ chatId: 'chat-1', done: true })
        );
        expect(mockLLMService.chatStream).not.toHaveBeenCalled();
    });

    it('should return before cancel listener registration on rate-limit failure', async () => {
        mockRateLimitService.waitForToken.mockRejectedValue(new Error('limit reached'));
        initIPC({ rateLimitService: mockRateLimitService });
        const handler = ipcMainHandlers.get('chat:stream');

        await handler?.(mockEvent, createStreamRequest());

        expect(ipcMain.on).not.toHaveBeenCalledWith('chat:cancel', expect.any(Function));
        expect(ipcMain.removeListener).not.toHaveBeenCalledWith('chat:cancel', expect.any(Function));
    });

    it('should stream without calling waitForToken when rateLimitService is not configured', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('chat:stream');
        mockLLMService.chatStream.mockReturnValue((async function* () { })());

        await handler?.(mockEvent, createStreamRequest());

        expect(mockRateLimitService.waitForToken).not.toHaveBeenCalled();
        expect(mockLLMService.chatStream).toHaveBeenCalled();
    });

    it('should forward reasoningEffort to llmService.chatStream options', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('chat:stream');
        mockLLMService.chatStream.mockReturnValue((async function* () { })());

        await handler?.(mockEvent, createStreamRequest({ optionsJson: { reasoningEffort: 'high' } }));

        expect(mockLLMService.chatStream).toHaveBeenCalled();
        expect(mockLLMService.chatStream.mock.calls[0][4]).toEqual(
            expect.objectContaining({ reasoningEffort: 'high' })
        );
    });

    it('should ignore non-string reasoningEffort values', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('chat:stream');
        mockLLMService.chatStream.mockReturnValue((async function* () { })());

        await handler?.(mockEvent, createStreamRequest({ optionsJson: { reasoningEffort: 42 } }));

        expect(mockLLMService.chatStream).toHaveBeenCalled();
        expect(mockLLMService.chatStream.mock.calls[0][4]).toEqual(
            expect.objectContaining({ reasoningEffort: undefined })
        );
    });

    it('should forward systemMode to llmService.chatStream options', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('chat:stream');
        mockLLMService.chatStream.mockReturnValue((async function* () { })());

        await handler?.(mockEvent, createStreamRequest({ systemMode: 'agent' }));

        expect(mockLLMService.chatStream).toHaveBeenCalled();
        expect(mockLLMService.chatStream.mock.calls[0][4]).toEqual(
            expect.objectContaining({ systemMode: 'agent' })
        );
    });

    it('should register and remove chat:cancel listener for stream lifecycle', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('chat:stream');
        mockLLMService.chatStream.mockReturnValue((async function* () { })());

        await handler?.(mockEvent, createStreamRequest());

        expect(ipcMain.on).toHaveBeenCalledWith('chat:cancel', expect.any(Function));
        expect(ipcMain.removeListener).toHaveBeenCalledWith('chat:cancel', expect.any(Function));
    });

    it('should avoid sending stream chunks when sender is destroyed', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('chat:stream');
        mockEvent.sender.isDestroyed.mockReturnValue(true);
        mockLLMService.chatStream.mockReturnValue((async function* () {
            yield { content: 'Hidden' };
        })());

        const result = await handler?.(mockEvent, createStreamRequest());

        expect(result).toMatchObject({ success: true });
        expect(mockEvent.sender.send).not.toHaveBeenCalled();
    });

    it('should call rateLimitService waitForToken before streaming', async () => {
        initIPC({ rateLimitService: mockRateLimitService });
        const handler = ipcMainHandlers.get('chat:stream');
        mockRateLimitService.waitForToken.mockResolvedValue(undefined);
        mockLLMService.chatStream.mockReturnValue((async function* () { })());

        await handler?.(mockEvent, createStreamRequest());

        expect(mockRateLimitService.waitForToken).toHaveBeenCalledWith('chat:stream');
        expect(mockLLMService.chatStream).toHaveBeenCalled();
    });

    it('should emit error and done when copilot stream startup fails', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('chat:stream');
        mockCopilotService.streamChat.mockResolvedValue(null);

        const result = await handler?.(mockEvent, createStreamRequest({ provider: 'copilot' }));

        expect(result).toMatchObject({ success: true });
        expect(mockEvent.sender.send).toHaveBeenCalledWith(
            'ollama:streamChunk',
            expect.objectContaining({ type: 'error', content: expect.stringContaining('Failed to start Copilot stream') })
        );
        expect(mockEvent.sender.send).toHaveBeenCalledWith(
            'ollama:streamChunk',
            expect.objectContaining({ chatId: 'chat-1', done: true })
        );
    });

    it('should route opencode stream provider successfully', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('chat:stream');
        mockLLMService.chatOpenCodeStream.mockReturnValue((async function* () { })());

        const result = await handler?.(mockEvent, createStreamRequest({ provider: 'opencode' }));

        expect(result).toMatchObject({ success: true });
        expect(mockLLMService.chatOpenCodeStream).toHaveBeenCalled();
    });

    it('should keep projectRoot undefined when projectId is provided', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('chat:stream');
        mockLLMService.chatStream.mockReturnValue((async function* () { })());

        await handler?.(mockEvent, createStreamRequest({ projectId: 'proj-1' }));

        expect(mockLLMService.chatStream).toHaveBeenCalled();
        expect(mockLLMService.chatStream.mock.calls[0][4]).toEqual(
            expect.objectContaining({ projectRoot: undefined })
        );
    });

    it('should set runtime projectRoot when projectId is omitted', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('chat:stream');
        mockLLMService.chatStream.mockReturnValue((async function* () { })());

        await handler?.(mockEvent, createStreamRequest({ projectId: undefined }));

        expect(mockLLMService.chatStream).toHaveBeenCalled();
        expect(mockLLMService.chatStream.mock.calls[0][4]).toEqual(
            expect.objectContaining({ projectRoot: expect.stringContaining('runtime') })
        );
    });

    it('should emit done without error chunk on AbortError', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('chat:stream');
        mockLLMService.chatStream.mockReturnValue((async function* () {
            const abortError = new Error('aborted');
            abortError.name = 'AbortError';
            throw abortError;
            yield null;
        })());

        const result = await handler?.(mockEvent, createStreamRequest());
        const hasErrorChunk = mockEvent.sender.send.mock.calls.some((call: unknown[]) => {
            const channel = call[0] as string;
            const payload = call[1] as Record<string, unknown>;
            return channel === 'ollama:streamChunk' && payload?.type === 'error';
        });

        expect(result).toMatchObject({ success: true });
        expect(hasErrorChunk).toBe(false);
        expect(mockEvent.sender.send).toHaveBeenCalledWith(
            'ollama:streamChunk',
            expect.objectContaining({ chatId: 'chat-1', done: true })
        );
    });

    it('should abort active stream when cancel event matches chatId', async () => {
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
                cancelHandler({}, { chatId: 'chat-1' });
            }
            if (options.signal?.aborted) {
                const abortError = new Error('aborted');
                abortError.name = 'AbortError';
                throw abortError;
            }
            yield { content: 'unexpected-content' };
        });

        const result = await handler?.(mockEvent, createStreamRequest());
        const hasUnexpectedContent = mockEvent.sender.send.mock.calls.some((call: unknown[]) => {
            const payload = call[1] as Record<string, unknown>;
            return payload?.content === 'unexpected-content';
        });

        expect(result).toMatchObject({ success: true });
        expect(hasUnexpectedContent).toBe(false);
        expect(mockEvent.sender.send).toHaveBeenCalledWith(
            'ollama:streamChunk',
            expect.objectContaining({ chatId: 'chat-1', done: true })
        );
    });

    it('should continue stream when cancel event targets different chatId', async () => {
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
                cancelHandler({}, { chatId: 'other-chat' });
            }
            if (options.signal?.aborted) {
                const abortError = new Error('aborted');
                abortError.name = 'AbortError';
                throw abortError;
            }
            yield { content: 'kept-content' };
        });

        const result = await handler?.(mockEvent, createStreamRequest());

        expect(result).toMatchObject({ success: true });
        expect(mockEvent.sender.send).toHaveBeenCalledWith(
            'ollama:streamChunk',
            expect.objectContaining({ chatId: 'chat-1', content: 'kept-content' })
        );
    });
});

