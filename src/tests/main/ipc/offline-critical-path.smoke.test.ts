/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { registerFilesIpc } from '@main/ipc/files';
import { registerMemoryIpc } from '@main/ipc/memory';
import { registerOllamaIpc } from '@main/ipc/ollama';
import { registerSessionConversationIpc } from '@main/ipc/session-conversation';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ipcMainHandlers = new Map<string, (...args: TestValue[]) => Promise<TestValue>>();

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: TestValue[]) => TestValue | Promise<TestValue>) => {
            ipcMainHandlers.set(channel, async (...args: TestValue[]) => Promise.resolve(handler(...args)));
        }),
        removeHandler: vi.fn(),
        on: vi.fn(),
        removeListener: vi.fn(),
    },
    dialog: {
        showOpenDialog: vi.fn(),
        showSaveDialog: vi.fn(),
    },
    BrowserWindow: {
        getAllWindows: vi.fn(() => []),
    },
    app: {
        getPath: vi.fn(() => 'C:\\mock-user-data'),
    },
}));

describe('Offline critical path smoke', () => {
    beforeEach(() => {
        ipcMainHandlers.clear();
        vi.clearAllMocks();
    });

    it('keeps local model, workspace, chat, and memory usable when network is unavailable', async () => {
        const senderId = 1;
        const mainWindow = {
            webContents: {
                id: senderId,
                send: vi.fn(),
            },
            isDestroyed: vi.fn(() => false),
        };
        const mockEvent = {
            sender: {
                id: senderId,
                send: vi.fn(),
                isDestroyed: vi.fn(() => false),
            },
        };

        const fileSystemService = {
            updateAllowedRoots: vi.fn(),
            listDirectory: vi.fn(async () => ({ success: true, data: ['README.md'] })),
            fileExists: vi.fn(async () => ({ exists: true })),
            readFile: vi.fn(async () => ({ success: true, content: '# local' })),
            readImage: vi.fn(async () => ({ success: true, data: '' })),
            writeFileWithTracking: vi.fn(async () => ({ success: true })),
            writeFile: vi.fn(async () => ({ success: true })),
            createDirectory: vi.fn(async () => ({ success: true })),
            deleteFile: vi.fn(async () => ({ success: true })),
            deleteDirectory: vi.fn(async () => ({ success: true })),
            moveFile: vi.fn(async () => ({ success: true })),
            searchFiles: vi.fn(async () => ({ success: true, data: [] })),
            searchFilesStream: vi.fn(async () => ({ success: true })),
        };
        const memoryService = {
            getAllMemories: vi.fn(async () => ({ facts: [], episodes: [], entities: [] })),
            forgetFact: vi.fn(async () => true),
            removeEntityFact: vi.fn(async () => true),
            rememberFact: vi.fn(async () => ({ id: 'fact-1' })),
            setEntityFact: vi.fn(async () => ({ id: 'entity-1' })),
            recallRelevantFacts: vi.fn(async () => [{ id: 'f-1', content: 'local fact' }]),
            recallEpisodes: vi.fn(async () => [{ id: 'e-1', summary: 'offline session' }]),
        };
        const llmService = {
            chat: vi.fn(async () => ({ content: 'local answer', role: 'assistant', images: [], reasoning: '' })),
            chatStream: vi.fn(),
            chatOpenAI: vi.fn(),
            chatOpenAIStream: vi.fn(),
            chatOpenCode: vi.fn(),
            chatOpenCodeStream: vi.fn(),
        };
        const options = {
            getMainWindow: () => mainWindow,
            settingsService: { getSettings: vi.fn(() => ({ ollama: { url: 'http://localhost:11434' } })) },
            copilotService: { chat: vi.fn(), streamChat: vi.fn() },
            llmService,
            proxyService: { getProxyKey: vi.fn(async () => { throw new Error('network unavailable'); }) },
            localeService: { getLocalePack: vi.fn(() => ({ locale: 'en' })) },
            codeIntelligenceService: { queryIndexedSymbols: vi.fn(async () => []) },
            contextRetrievalService: { retrieveContext: vi.fn(async () => ({ contextString: '', sources: [] })) },
            databaseService: {
                addTokenUsage: vi.fn(),
                addMessage: vi.fn(),
                system: { addTokenUsage: vi.fn() },
                chats: { addMessage: vi.fn() },
            },
        };
        const localAIService = {
            checkCudaSupport: vi.fn(async () => ({ hasCuda: false })),
            ollamaChat: vi.fn(async () => ({ message: { content: 'local response', role: 'assistant' } })),
        };
        const ollamaHealthService = {
            getStatus: vi.fn(() => ({ online: true, lastCheck: new Date() })),
            forceCheck: vi.fn(async () => ({ online: true, lastCheck: new Date() })),
            on: vi.fn(),
        };

        registerFilesIpc(() => mainWindow as never, fileSystemService as never, new Set<string>());
        registerMemoryIpc(() => mainWindow as never, memoryService as never);
        registerSessionConversationIpc(options as never);
        registerOllamaIpc({
            getMainWindow: () => mainWindow as never,
            localAIService: localAIService as never,
            settingsService: options.settingsService as never,
            llmService: llmService as never,
            ollamaHealthService: ollamaHealthService as never,
        });

        const isRunning = await ipcMainHandlers.get('ollama:isRunning')?.(mockEvent);
        const workspaceResult = await ipcMainHandlers.get('files:listDirectory')?.(mockEvent, 'C:\\workspace');
        const chatResult = await ipcMainHandlers.get('session:conversation:complete')?.(mockEvent, {
            messages: [{ role: 'user', content: 'hello from offline mode' }],
            model: 'llama3',
            tools: [],
            provider: 'ollama',
            workspaceId: 'workspace-1',
        });
        const memoryResult = await ipcMainHandlers.get('memory:search')?.(mockEvent, 'local fact');

        expect(isRunning).toBe(true);
        expect(workspaceResult).toMatchObject({ success: true });
        expect(chatResult).toMatchObject({ success: true, data: { content: 'local answer' } });
        expect(memoryResult).toMatchObject({
            facts: [{ id: 'f-1', content: 'local fact' }],
            episodes: [{ id: 'e-1', summary: 'offline session' }],
        });
        expect(fileSystemService.listDirectory).toHaveBeenCalledWith('C:\\workspace');
        expect(memoryService.recallRelevantFacts).toHaveBeenCalledWith('local fact', 10);
        expect(options.proxyService.getProxyKey).not.toHaveBeenCalled();
    });
});


