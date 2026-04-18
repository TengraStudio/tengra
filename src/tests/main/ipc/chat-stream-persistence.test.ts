/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
            llmService: mockLLMService as never,
            proxyService: mockProxyService as never,
            codeIntelligenceService: mockCodeIntelligenceService as never,
            contextRetrievalService: mockContextRetrievalService as never,
            localeService: mockLocaleService as never,
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
        expect(mockDatabaseService.addMessage).toHaveBeenCalledWith(expect.objectContaining({
            chatId: 'chat-1',
            role: 'assistant',
            content: '{"name":"generate_image"}',
            timestamp: expect.any(Number)
        }));
    });

    it('merges streamed tool calls across chunks before persistence', async () => {
        const handler = ipcMainHandlers.get('session:conversation:stream');
        mockLLMService.chatStream.mockReturnValue((async function* () {
            yield { content: 'islem basladi' };
            yield {
                tool_calls: [{
                    id: 'call-1',
                    type: 'function',
                    function: { name: 'execute_command', arguments: '{"command":"pwd"}' }
                }]
            };
            yield {
                tool_calls: [{
                    id: 'call-2',
                    type: 'function',
                    function: { name: 'list_directory', arguments: '{"path":"%USERPROFILE%\\\\Desktop"}' }
                }]
            };
        })());

        const result = await handler!(mockEvent, {
            messages: [{ role: 'user', content: 'araçlari calistir' }],
            model: 'llama3.1:8b',
            tools: [],
            provider: 'ollama',
            optionsJson: {},
            chatId: 'chat-2',
            workspaceId: 'proj-1',
            systemMode: 'agent'
        });

        const addMessageCalls = mockDatabaseService.addMessage.mock.calls;
        const persistedRecord = addMessageCalls[addMessageCalls.length - 1]?.[0] as {
            toolCalls?: Array<{ id: string }>
        };

        expect(result).toMatchObject({ success: true });
        expect(persistedRecord.toolCalls).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'call-1' }),
            expect.objectContaining({ id: 'call-2' }),
        ]));
        expect(persistedRecord.toolCalls).toHaveLength(2);
    });
});


