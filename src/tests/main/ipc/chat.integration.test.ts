import { registerSessionConversationIpc } from '@main/ipc/session-conversation';
import { ipcMain } from 'electron';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

interface MockIpcEvent {
    sender: {
        id: number;
        isDestroyed: Mock<() => boolean>;
        send: Mock<(channel: string, ...args: TestValue[]) => void>;
    };
}


// Mock Electron ipcMain
const ipcMainHandlers = new Map<string, (...args: TestValue[]) => Promise<TestValue>>();

vi.mock('electron', () => ({
    app: {
        getPath: vi.fn().mockReturnValue('C:\\mock-user-data')
    },
    ipcMain: {
        handle: vi.fn((channel, handler) => {
            ipcMainHandlers.set(channel, async (...args: TestValue[]) => Promise.resolve(handler(...args)));
        }),
        removeHandler: vi.fn(),
        on: vi.fn(),
        removeListener: vi.fn()
    }
}));

// Mock IPC Wrapper to avoid transitive dependency issues with error.util

// Mock Services
const mockSettingsService = { getSettings: vi.fn().mockReturnValue({}) };
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
const mockLocaleService = { getLocalePack: vi.fn().mockReturnValue(undefined) };
const mockDatabaseService = {
    addTokenUsage: vi.fn(),
    addMessage: vi.fn(),
    system: { addTokenUsage: vi.fn() },
    chats: { addMessage: vi.fn() }
};
const mockMainWindow = {
    webContents: { id: 1 }
};

describe('Session conversation IPC integration', () => {
    const mockEvent: MockIpcEvent = {
        sender: {
            id: 1,
            isDestroyed: vi.fn().mockReturnValue(false),
            send: vi.fn()
        }
    };

    beforeEach(() => {
        ipcMainHandlers.clear();
        vi.clearAllMocks();
        mockEvent.sender.isDestroyed.mockReturnValue(false);
    });


    const initIPC = (overrides?: Record<string, TestValue>) => {
        registerSessionConversationIpc({
            getMainWindow: () => mockMainWindow as never,
            settingsService: mockSettingsService as never,
            llmService: mockLLMService as never,
            proxyService: mockProxyService as never,
            codeIntelligenceService: mockCodeIntelligenceService as never,
            contextRetrievalService: mockContextRetrievalService as never,
            localeService: mockLocaleService as never,
            databaseService: mockDatabaseService as never,
            ...(overrides ?? {})
        });
    };

    const createStreamRequest = (overrides?: Record<string, TestValue>) => ({
        messages: [{ role: 'user', content: 'test' }],
        model: 'gpt-4o',
        tools: [],
        provider: 'openai',
        optionsJson: {},
        chatId: 'chat-1',
        workspaceId: 'proj-1',
        systemMode: 'architect',
        ...(overrides ?? {})
    });

    const getCancelHandler = (): ((_: TestValue, payload: { chatId: string }) => void) | undefined => {
        const calls = vi.mocked(ipcMain.on).mock.calls;
        const call = calls.find(entry => entry[0] === 'session:conversation:cancel');
        return call?.[1] as ((_: TestValue, payload: { chatId: string }) => void) | undefined;
    };

    it('should register expected handlers', () => {
        initIPC();
        expect(ipcMainHandlers.has('session:conversation:complete')).toBe(true);
        expect(ipcMainHandlers.has('session:conversation:stream')).toBe(true);
    });

    it('should route session:conversation:complete to LLMService (default)', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('session:conversation:complete');

        mockLLMService.chat.mockResolvedValue({
            content: 'Response',
            reasoning: 'Reason',
            images: [],
            role: 'assistant'
        });

        const result = await handler!(mockEvent, {
            messages: [{ role: 'user', content: 'test' }],
            model: 'gpt-4o',
            tools: [],
            provider: 'openai',
            workspaceId: 'proj-1'
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

    it('should accept tengra systemMode values in session:conversation:complete payload', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('session:conversation:complete');

        mockLLMService.chat.mockResolvedValue({
            content: 'Response',
            reasoning: '',
            images: [],
            role: 'assistant'
        });

        const result = await handler!(mockEvent, {
            messages: [{ role: 'user', content: 'test' }],
            model: 'gpt-4o',
            tools: [],
            provider: 'openai',
            workspaceId: 'proj-1',
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

    it('should reject legacy positional args for session:conversation:complete', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('session:conversation:complete');

        const result = await handler!(
            mockEvent,
            [{ role: 'user', content: 'test' }],
            'gpt-4o',
            [],
            'openai',
            'proj-1'
        );

        expect(result).toMatchObject({ success: false });
    });

    it('should reject deprecated systemMode values in session:conversation:complete payload', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('session:conversation:complete');

        const result = await handler!(mockEvent, {
            messages: [{ role: 'user', content: 'test' }],
            model: 'gpt-4o',
            tools: [],
            provider: 'openai',
            workspaceId: 'proj-1',
            systemMode: 'default'
        });

        expect(result).toMatchObject({ success: false });
    });

    it('should route session:conversation:complete (copilot provider) through LLMService', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('session:conversation:complete');

        mockLLMService.chat.mockResolvedValue({
            content: 'Copilot Response'
        });

        const result = await handler!(mockEvent, {
            messages: [{ role: 'user', content: 'test' }],
            model: 'gpt-4o',
            tools: [],
            provider: 'copilot',
            workspaceId: 'proj-1'
        });

        expect(mockLLMService.chat).toHaveBeenCalledWith(
            expect.any(Array),
            'gpt-4o',
            [],
            'copilot',
            expect.any(Object)
        );
        expect(result).toMatchObject({
            success: true,
            data: {
                content: 'Copilot Response',
                role: 'assistant'
            }
        });
    });

    it('should handle errors in session:conversation:complete', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('session:conversation:complete');

        mockLLMService.chat.mockRejectedValue(new Error('Simulated Fail'));

        const result = await handler!(mockEvent, {
            messages: [{ role: 'user', content: 'test' }],
            model: 'gpt-4o',
            tools: [],
            provider: 'openai',
            workspaceId: 'proj-1'
        });


        // The IPC wrapper usually catches errors and returns { success: false, error: ... }
        // BUT checking session-conversation.ts: ipcMain.handle('session:conversation:complete', createIpcHandler(...))
        // createValidatedIpcHandler returns structured error object when wrapResponse is true
        expect(result).toEqual({
            success: false,
            error: {
                message: 'Simulated Fail',
                code: 'IPC_HANDLER_ERROR'
            }
        });
    });

    it('should reject legacy positional args for session:conversation:stream', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('session:conversation:stream');

        const result = await handler!(
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

    it('should reject missing chatId in object payload for session:conversation:stream', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('session:conversation:stream');
        const payload = createStreamRequest();
        const payloadWithoutChatId = { ...payload } as Record<string, TestValue>;
        delete payloadWithoutChatId.chatId;
        const result = await handler!(mockEvent, payloadWithoutChatId);

        expect(result).toMatchObject({ success: false });
    });

    it('should accept object payload for session:conversation:stream and emit chunks', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('session:conversation:stream');
        mockLLMService.chatStream.mockReturnValue((async function* () {
            yield { content: 'Hello' };
        })());

        const result = await handler!(mockEvent, createStreamRequest());

        expect(result).toMatchObject({ success: true });
        expect(mockEvent.sender.send).toHaveBeenCalledWith(
            'session:conversation:stream-chunk',
            expect.objectContaining({ chatId: 'chat-1', content: 'Hello' })
        );
        expect(mockEvent.sender.send).toHaveBeenCalledWith(
            'session:conversation:stream-chunk',
            expect.objectContaining({ chatId: 'chat-1', done: true })
        );
    });

    it('should accept session:conversation:stream with systemMode thinking', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('session:conversation:stream');
        mockLLMService.chatStream.mockReturnValue((async function* () { })());

        const result = await handler!(mockEvent, createStreamRequest({ systemMode: 'thinking' }));

        expect(result).toMatchObject({ success: true });
    });

    it('should accept session:conversation:stream with systemMode agent', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('session:conversation:stream');
        mockLLMService.chatStream.mockReturnValue((async function* () { })());

        const result = await handler!(mockEvent, createStreamRequest({ systemMode: 'agent' }));

        expect(result).toMatchObject({ success: true });
    });

    it('should accept session:conversation:stream with systemMode fast', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('session:conversation:stream');
        mockLLMService.chatStream.mockReturnValue((async function* () { })());

        const result = await handler!(mockEvent, createStreamRequest({ systemMode: 'fast' }));

        expect(result).toMatchObject({ success: true });
    });

    it('should reject deprecated systemMode values for session:conversation:stream', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('session:conversation:stream');

        const result = await handler!(mockEvent, createStreamRequest({ systemMode: 'default' }));

        expect(result).toMatchObject({ success: false });
    });

    it('should emit error and done when chat stream throws', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('session:conversation:stream');
        mockLLMService.chatStream.mockReturnValue((async function* () {
            throw new Error('stream exploded');
            yield null;
        })());

        const result = await handler!(mockEvent, createStreamRequest());

        expect(result).toMatchObject({ success: true });
        expect(mockEvent.sender.send).toHaveBeenCalledWith(
            'session:conversation:stream-chunk',
            expect.objectContaining({ type: 'error', content: expect.stringContaining('stream exploded') })
        );
        expect(mockEvent.sender.send).toHaveBeenCalledWith(
            'session:conversation:stream-chunk',
            expect.objectContaining({ chatId: 'chat-1', done: true })
        );
    });

    it('should forward reasoningEffort to llmService.chatStream options', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('session:conversation:stream');
        mockLLMService.chatStream.mockReturnValue((async function* () { })());

        await handler!(mockEvent, createStreamRequest({ optionsJson: { reasoningEffort: 'high' } }));

        expect(mockLLMService.chatStream).toHaveBeenCalled();
        expect(mockLLMService.chatStream.mock.calls[0][4]).toEqual(
            expect.objectContaining({ reasoningEffort: 'high' })
        );
    });

    it('should ignore non-string reasoningEffort values', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('session:conversation:stream');
        mockLLMService.chatStream.mockReturnValue((async function* () { })());

        await handler!(mockEvent, createStreamRequest({ optionsJson: { reasoningEffort: 42 } }));

        expect(mockLLMService.chatStream).toHaveBeenCalled();
        expect(mockLLMService.chatStream.mock.calls[0][4]).toEqual(
            expect.objectContaining({ reasoningEffort: undefined })
        );
    });

    it('should forward systemMode to llmService.chatStream options', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('session:conversation:stream');
        mockLLMService.chatStream.mockReturnValue((async function* () { })());

        await handler!(mockEvent, createStreamRequest({ systemMode: 'agent' }));

        expect(mockLLMService.chatStream).toHaveBeenCalled();
        expect(mockLLMService.chatStream.mock.calls[0][4]).toEqual(
            expect.objectContaining({ systemMode: 'agent' })
        );
    });

    it('should register and remove session:conversation:cancel listener for stream lifecycle', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('session:conversation:stream');
        mockLLMService.chatStream.mockReturnValue((async function* () { })());

        await handler!(mockEvent, createStreamRequest());

        expect(ipcMain.on).toHaveBeenCalledWith('session:conversation:cancel', expect.any(Function));
        expect(ipcMain.removeListener).toHaveBeenCalledWith('session:conversation:cancel', expect.any(Function));
    });

    it('should avoid sending stream chunks when sender is destroyed', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('session:conversation:stream');
        mockEvent.sender.isDestroyed.mockReturnValue(true);
        mockLLMService.chatStream.mockReturnValue((async function* () {
            yield { content: 'Hidden' };
        })());

        const result = await handler!(mockEvent, createStreamRequest());

        expect(result).toMatchObject({ success: true });
        expect(mockEvent.sender.send).not.toHaveBeenCalled();
    });

    it('should stream copilot provider through llmService.chatStream', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('session:conversation:stream');
        mockLLMService.chatStream.mockReturnValue((async function* () {
            yield { content: 'copilot-stream' };
        })());

        const result = await handler!(mockEvent, createStreamRequest({ provider: 'copilot' }));

        expect(result).toMatchObject({ success: true });
        expect(mockLLMService.chatStream).toHaveBeenCalledWith(
            expect.any(Array),
            'gpt-4o',
            [],
            'copilot',
            expect.objectContaining({
                workspaceRoot: undefined,
            })
        );
        expect(mockEvent.sender.send).toHaveBeenCalledWith(
            'session:conversation:stream-chunk',
            expect.objectContaining({ chatId: 'chat-1', content: 'copilot-stream' })
        );
    });

    it('should route opencode stream provider successfully', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('session:conversation:stream');
        mockLLMService.chatOpenCodeStream.mockReturnValue((async function* () { })());

        const result = await handler!(mockEvent, createStreamRequest({ provider: 'opencode' }));

        expect(result).toMatchObject({ success: true });
        expect(mockLLMService.chatOpenCodeStream).toHaveBeenCalled();
    });

    it('should keep workspaceRoot undefined when workspaceId is provided', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('session:conversation:stream');
        mockLLMService.chatStream.mockReturnValue((async function* () { })());

        await handler!(mockEvent, createStreamRequest({ workspaceId: 'proj-1' }));

        expect(mockLLMService.chatStream).toHaveBeenCalled();
        expect(mockLLMService.chatStream.mock.calls[0][4]).toEqual(
            expect.objectContaining({ workspaceRoot: undefined })
        );
    });

    it('should set runtime workspaceRoot when workspaceId is omitted', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('session:conversation:stream');
        mockLLMService.chatStream.mockReturnValue((async function* () { })());

        await handler!(mockEvent, createStreamRequest({ workspaceId: undefined }));

        expect(mockLLMService.chatStream).toHaveBeenCalled();
        expect(mockLLMService.chatStream.mock.calls[0][4]).toEqual(
            expect.objectContaining({ workspaceRoot: expect.stringContaining('runtime') })
        );
    });

    it('should emit done without error chunk on AbortError', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('session:conversation:stream');
        mockLLMService.chatStream.mockReturnValue((async function* () {
            const abortError = new Error('aborted');
            abortError.name = 'AbortError';
            throw abortError;
            yield null;
        })());

        const result = await handler!(mockEvent, createStreamRequest());
        const hasErrorChunk = mockEvent.sender.send.mock.calls.some((call: TestValue[]) => {
            const channel = call[0] as string;
            const payload = call[1] as Record<string, TestValue>;
            return channel === 'session:conversation:stream-chunk' && payload?.type === 'error';
        });

        expect(result).toMatchObject({ success: true });
        expect(hasErrorChunk).toBe(false);
        expect(mockEvent.sender.send).toHaveBeenCalledWith(
            'session:conversation:stream-chunk',
            expect.objectContaining({ chatId: 'chat-1', done: true })
        );
    });

    it('should abort active stream when cancel event matches chatId', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('session:conversation:stream');
        mockLLMService.chatStream.mockImplementation(async function* (
            _messages: TestValue,
            _model: TestValue,
            _tools: TestValue,
            _provider: TestValue,
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

        const result = await handler!(mockEvent, createStreamRequest());
        const hasUnexpectedContent = mockEvent.sender.send.mock.calls.some((call: TestValue[]) => {
            const payload = call[1] as Record<string, TestValue>;
            return payload?.content === 'unexpected-content';
        });

        expect(result).toMatchObject({ success: true });
        expect(hasUnexpectedContent).toBe(false);
        expect(mockEvent.sender.send).toHaveBeenCalledWith(
            'session:conversation:stream-chunk',
            expect.objectContaining({ chatId: 'chat-1', done: true })
        );
    });

    it('should continue stream when cancel event targets different chatId', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('session:conversation:stream');
        mockLLMService.chatStream.mockImplementation(async function* (
            _messages: TestValue,
            _model: TestValue,
            _tools: TestValue,
            _provider: TestValue,
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

        const result = await handler!(mockEvent, createStreamRequest());

        expect(result).toMatchObject({ success: true });
        expect(mockEvent.sender.send).toHaveBeenCalledWith(
            'session:conversation:stream-chunk',
            expect.objectContaining({ chatId: 'chat-1', content: 'kept-content' })
        );
    });
});



