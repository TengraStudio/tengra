import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IpcMainInvokeEvent } from 'electron';
import { registerChatIpc } from '@main/ipc/chat';

// Mock Electron ipcMain
const ipcMainHandlers = new Map<string, Function>();

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel, handler) => {
            ipcMainHandlers.set(channel, handler);
        }),
        removeHandler: vi.fn()
    }
}));

// Mock IPC Wrapper to avoid transitive dependency issues with error.util
vi.mock('@main/utils/ipc-wrapper.util', () => ({
    createIpcHandler: (_name: string, handler: Function) => async (...args: any[]) => {
        try {
            const result = await handler(...args);
            return { success: true, data: result };
        } catch (error: any) {
            return { success: false, error: error.message || 'Unknown Error' };
        }
    }
}));

// Mock Services
const mockSettingsService = { getSettings: vi.fn().mockReturnValue({}) };
const mockCopilotService = { chat: vi.fn(), streamChat: vi.fn() };
const mockLLMService = { chatOpenAI: vi.fn(), chatOpenAIStream: vi.fn() };
const mockProxyService = { getProxyKey: vi.fn().mockReturnValue('dummy-key') };
const mockCodeIntelligenceService = { queryIndexedSymbols: vi.fn().mockResolvedValue([]) };

const mockContextRetrievalService = { retrieveContext: vi.fn().mockResolvedValue({ contextString: '', sources: [] }) };

describe('Chat IPC Integration', () => {
    beforeEach(() => {
        ipcMainHandlers.clear();
        vi.clearAllMocks();
    });

    const initIPC = () => {
        registerChatIpc({
            settingsService: mockSettingsService as any,
            copilotService: mockCopilotService as any,
            llmService: mockLLMService as any,
            proxyService: mockProxyService as any,
            codeIntelligenceService: mockCodeIntelligenceService as any,
            contextRetrievalService: mockContextRetrievalService as any
        });
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

        mockLLMService.chatOpenAI.mockResolvedValue({
            content: 'Response',
            reasoning: 'Reason',
            images: [],
            role: 'assistant'
        });

        const result = await handler?.({} as IpcMainInvokeEvent, [{ role: 'user', content: 'test' }], 'gpt-4o', [], 'openai', 'proj-1');

        expect(mockLLMService.chatOpenAI).toHaveBeenCalled();
        expect(result).toMatchObject({
            success: true,
            data: {
                content: 'Response',
                role: 'assistant'
            }
        });
    });

    it('should route chat:openai (copilot provider) to CopilotService', async () => {
        initIPC();
        const handler = ipcMainHandlers.get('chat:openai');

        mockCopilotService.chat.mockResolvedValue({
            content: 'Copilot Response'
        });

        const result = await handler?.({} as IpcMainInvokeEvent, [{ role: 'user', content: 'test' }], 'gpt-4o', [], 'copilot', 'proj-1');

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

        mockLLMService.chatOpenAI.mockRejectedValue(new Error('Simulated Fail'));

        const result = await handler?.({} as IpcMainInvokeEvent, [{ role: 'user', content: 'test' }], 'gpt-4o', [], 'openai', 'proj-1');

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

        const result = await handler?.({} as IpcMainInvokeEvent, [{ role: 'user', content: 'test' }], 'gpt-4o');

        expect(mockCopilotService.chat).toHaveBeenCalled();
        expect(result).toMatchObject({
            success: true,
            data: {
                content: 'Legacy',
                role: 'assistant'
            }
        });
    });
});
