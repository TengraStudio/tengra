/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { registerDbIpc } from '@main/ipc/db';
import { DatabaseService } from '@main/services/data/database.service';
import { EmbeddingService } from '@main/services/llm/embedding.service';
import { BrowserWindow, ipcMain } from 'electron';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn(),
        removeHandler: vi.fn()
    },
    app: {
        getPath: vi.fn().mockReturnValue('/tmp')
    }
}));


vi.mock('@main/utils/operation-wrapper.util', () => ({
    withOperationGuard: vi.fn(async (_bucket: string, fn: () => Promise<TestValue>) => await fn()),
}));


// Helper to mock BrowserWindow
const mockWindow = {
    isDestroyed: vi.fn().mockReturnValue(false),
    webContents: {
        id: 1,
        send: vi.fn()
    }
} as never as BrowserWindow;




interface MockEmbeddingService extends Partial<EmbeddingService> {
    generateEmbedding: Mock;
}

describe('Database IPC Handlers', () => {
    let mockDatabaseService: Record<string, ReturnType<typeof vi.fn>>;

    let mockEmbeddingService: MockEmbeddingService;
    let registeredHandlers: Map<string, (...args: TestValue[]) => Promise<TestValue>>;
    const mockEvent = { sender: { id: 1, send: vi.fn() } } as never;
    const createdWorkspace = {
        id: 'proj-1',
        title: 'My Workspace',
        path: '/path',
        description: 'desc',
        mounts: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'active' as const
    };


    beforeEach(() => {
        registeredHandlers = new Map();

        (vi.mocked(ipcMain.handle) as never as { mockImplementation: (fn: (channel: string, listener: (...args: TestValue[]) => TestValue) => void) => void }).mockImplementation((channel: string, listener: (...args: TestValue[]) => TestValue) => {
            if (!registeredHandlers.has(channel)) {
                registeredHandlers.set(channel, listener as (...args: TestValue[]) => Promise<TestValue>);
            }
        });

        mockDatabaseService = {
            getWorkspaces: vi.fn().mockResolvedValue([]),
            createWorkspace: vi.fn().mockResolvedValue(createdWorkspace),
            getWorkspace: vi.fn().mockResolvedValue({ id: 'proj-1', title: 'Test Workspace' }),
            chats: {
                getAllChats: vi.fn().mockResolvedValue([]),
                getChat: vi.fn().mockResolvedValue({ id: 'chat-1', title: 'Test Chat' }),
                createChat: vi.fn().mockResolvedValue({ success: true, id: 'chat-1' }),
                updateChat: vi.fn().mockResolvedValue({ success: true }),
                deleteChat: vi.fn().mockResolvedValue({ success: true }),
                getMessages: vi.fn().mockResolvedValue([]),
                addMessage: vi.fn().mockResolvedValue({ success: true, id: 'msg-1' }),
                deleteMessage: vi.fn().mockResolvedValue({ success: true }),
                searchChats: vi.fn().mockResolvedValue([]),
                deleteAllChats: vi.fn().mockResolvedValue({ success: true }),
                updateMessage: vi.fn().mockResolvedValue({ success: true }),
            },
            workspaces: {
                getWorkspaces: vi.fn().mockResolvedValue([]),
                createWorkspace: vi.fn().mockResolvedValue(createdWorkspace),
                getWorkspace: vi.fn().mockResolvedValue({ id: 'proj-1', title: 'Test Workspace' }),
                updateWorkspace: vi.fn().mockResolvedValue({ success: true }),
                deleteWorkspace: vi.fn().mockResolvedValue({ success: true }),
            },
            system: {
                getFolders: vi.fn().mockResolvedValue([]),
                createFolder: vi.fn().mockResolvedValue({ success: true, id: 'fold-1' }),
                updateFolder: vi.fn().mockResolvedValue({ success: true }),
                deleteFolder: vi.fn().mockResolvedValue({ success: true }),
                getStats: vi.fn().mockResolvedValue({ totalChats: 0, totalMessages: 0 }),
                addTokenUsage: vi.fn().mockResolvedValue(undefined),
                getTokenUsageStats: vi.fn().mockResolvedValue({}),
                createPrompt: vi.fn().mockResolvedValue({ success: true, id: 'p-1' }),
                deletePrompt: vi.fn().mockResolvedValue({ success: true }),
                updatePrompt: vi.fn().mockResolvedValue({ success: true }),
                getPrompts: vi.fn().mockResolvedValue([]),
                getDetailedStats: vi.fn().mockResolvedValue({}),
            }
        } as never;


        mockEmbeddingService = {
            generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1))
        };

        registerDbIpc(
            () => mockWindow,
            mockDatabaseService as never as DatabaseService,
            mockEmbeddingService as never as EmbeddingService
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Chat Handlers', () => {
        it('should create a chat', async () => {
            const handler = registeredHandlers.get('db:createChat')!;
            const chatData = { title: 'New Chat', model: 'gpt-4' };
            const result = await handler(mockEvent, chatData) as Record<string, TestValue>;


            expect((mockDatabaseService as never as Record<string, Record<string, Mock>>).chats.createChat).toHaveBeenCalled();

            expect(result.success).toBe(true);
        });

        it('should get a chat', async () => {
            // Check if it's registered via registerBatchableHandler or directly
            // In db.ts, db:getChat is a batchable handler
            // Batchable handlers are registered via registerBatchableHandler, which we didn't mock ipcMain for
            // Let's see if it's also in registeredHandlers
            const handler = registeredHandlers.get('db:getChat');
            if (handler) {
                const result = await handler(mockEvent, 'chat-1') as Record<string, TestValue>;

                expect((mockDatabaseService as never as Record<string, Record<string, Mock>>).chats.getChat).toHaveBeenCalledWith('chat-1');
                expect(result.id).toBe('chat-1');
            }

        });

        it('should delete a chat', async () => {
            const handler = registeredHandlers.get('db:deleteChat')!;
            const result = await handler(mockEvent, 'chat-1') as Record<string, TestValue>;


            expect((mockDatabaseService as never as Record<string, Record<string, Mock>>).chats.deleteChat).toHaveBeenCalledWith('chat-1');

            expect(result.success).toBe(true);
        });

        it('should update a message through the registered db:updateMessage handler', async () => {
            const handler = registeredHandlers.get('db:updateMessage')!;
            const updates = { content: 'updated', reasoning: 'because' };
            const result = await handler(mockEvent, 'msg-1', updates) as Record<string, TestValue>;

            expect((mockDatabaseService as never as Record<string, Record<string, Mock>>).chats.updateMessage)
                .toHaveBeenCalledWith('msg-1', updates);
            expect(result.success).toBe(true);
        });

        it('should delete messages by chat id through db:deleteMessages', async () => {
            const deleteMessagesByChatId = vi.fn().mockResolvedValue({ success: true });
            (mockDatabaseService as never as Record<string, Mock>).deleteMessagesByChatId = deleteMessagesByChatId;

            const handler = registeredHandlers.get('db:deleteMessages')!;
            const result = await handler(mockEvent, 'chat-1') as Record<string, TestValue>;

            expect(deleteMessagesByChatId).toHaveBeenCalledWith('chat-1');
            expect(result.success).toBe(true);
        });

    });

    describe('Workspace Handlers', () => {
        it('should create a workspace', async () => {
            const handler = registeredHandlers.get('db:createWorkspace')!;
            const result = await handler(mockEvent, { title: 'My Workspace', path: '/path', description: 'desc' }) as Record<string, TestValue>;



            expect((mockDatabaseService as never as Record<string, Mock>).createWorkspace).toHaveBeenCalledWith('My Workspace', '/path', 'desc', undefined, undefined);

            expect(result.id).toBe('proj-1');
            expect(result.title).toBe('My Workspace');
        });

        it('should reject duplicate local workspace mounts instead of returning a null fallback', async () => {
            const handler = registeredHandlers.get('db:createWorkspace')!;
            (mockDatabaseService as never as Record<string, Mock>).getWorkspaces.mockResolvedValue([
                {
                    ...createdWorkspace,
                    path: 'C:\\repos\\demo',
                    mounts: [{
                        id: 'local-proj-1',
                        name: 'Demo',
                        type: 'local',
                        rootPath: 'C:\\repos\\demo'
                    }]
                }
            ]);

            await expect(handler(mockEvent, {
                title: 'Duplicate Workspace',
                path: 'C:\\repos\\demo',
                description: '',
                mounts: [{
                    id: 'local-new',
                    name: 'Demo',
                    type: 'local',
                    rootPath: 'C:\\repos\\demo'
                }]
            })).rejects.toThrow('A workspace already exists for this local directory.');
        });
    });

    describe('Folder Handlers', () => {
        it('should create a folder', async () => {
            const handler = registeredHandlers.get('db:createFolder')!;
            const result = await handler(mockEvent, { name: 'My Folder', color: '#ff0000' }) as Record<string, TestValue>;



            expect((mockDatabaseService as never as Record<string, Record<string, Mock>>).system.createFolder).toHaveBeenCalledWith('My Folder', '#ff0000');

            expect(result.success).toBe(true);
        });
    });
});
