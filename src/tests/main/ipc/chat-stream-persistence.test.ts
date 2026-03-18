import { registerSessionConversationIpc } from '@main/ipc/session-conversation';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
const mockDatabaseService = {
    addTokenUsage: vi.fn(),
    addMessage: vi.fn(),
    system: { addTokenUsage: vi.fn() },
    chats: { addMessage: vi.fn() }
};

describe('Chat stream persistence', () => {
    const mockEvent = {
        sender: {
            id: 1,
            isDestroyed: vi.fn().mockReturnValue(false),
            send: vi.fn()
        }
    } as const;

    beforeEach(() => {
        ipcMainHandlers.clear();
        vi.clearAllMocks();
        registerSessionConversationIpc({
            getMainWindow: () => ({ webContents: { id: 1 } } as never),
            settingsService: mockSettingsService as never,
            copilotService: mockCopilotService as never,
            llmService: mockLLMService as never,
            proxyService: mockProxyService as never,
            codeIntelligenceService: mockCodeIntelligenceService as never,
            contextRetrievalService: mockContextRetrievalService as never,
            databaseService: mockDatabaseService as never,
        });
    });

    it('persists streamed proxy responses with numeric timestamps', async () => {
        const handler = ipcMainHandlers.get('session:conversation:stream');
        mockLLMService.chatStream.mockReturnValue((async function* () {
            yield { content: '{"name":"generate_image"}' };
        })());

        const result = await handler!(mockEvent, {
            messages: [{ role: 'user', content: 'selam' }],
            model: 'llama3.1:8b',
            tools: [],
            provider: 'ollama',
            optionsJson: {},
            chatId: 'chat-1',
            workspaceId: 'proj-1',
            systemMode: 'agent'
        });

        expect(result).toMatchObject({ success: true });
        expect(mockDatabaseService.chats.addMessage).toHaveBeenCalledWith(expect.objectContaining({
            chatId: 'chat-1',
            role: 'assistant',
            content: '{"name":"generate_image"}',
            timestamp: expect.any(Number)
        }));
    });
});


