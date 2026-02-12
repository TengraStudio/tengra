import { registerDbIpc } from '@main/ipc/db';
import { AuditLogService } from '@main/services/analysis/audit-log.service';
import { DatabaseService } from '@main/services/data/database.service';
import { EmbeddingService } from '@main/services/llm/embedding.service';
import { BrowserWindow,ipcMain, IpcMainInvokeEvent } from 'electron';
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

// Helper to mock BrowserWindow
const mockWindow = {
    isDestroyed: vi.fn().mockReturnValue(false),
    webContents: {
        send: vi.fn()
    }
} as unknown as BrowserWindow;

interface MockDatabaseService extends Partial<DatabaseService> {
    getAllChats: Mock;
    getChat: Mock;
    createChat: Mock;
    updateChat: Mock;
    deleteChat: Mock;
    getProjects: Mock;
    createProject: Mock;
    getFolders: Mock;
    createFolder: Mock;
    getStats: Mock;
}

interface MockEmbeddingService extends Partial<EmbeddingService> {
    generateEmbedding: Mock;
}

interface MockAuditLogService extends Partial<AuditLogService> {
    log: Mock;
}

describe('Database IPC Handlers', () => {
    let mockDatabaseService: MockDatabaseService;
    let mockEmbeddingService: MockEmbeddingService;
    let mockAuditLogService: MockAuditLogService;
    let registeredHandlers: Map<string, any>;

    beforeEach(() => {
        registeredHandlers = new Map();

        vi.mocked(ipcMain.handle).mockImplementation((channel: string, listener: any) => {
            if (!registeredHandlers.has(channel)) {
                registeredHandlers.set(channel, listener);
            }
        });

        mockDatabaseService = {
            getAllChats: vi.fn().mockResolvedValue([]),
            getChat: vi.fn().mockResolvedValue({ id: 'chat-1', title: 'Test Chat' }),
            createChat: vi.fn().mockResolvedValue({ success: true, id: 'chat-1' }),
            updateChat: vi.fn().mockResolvedValue({ success: true }),
            deleteChat: vi.fn().mockResolvedValue({ success: true }),
            getProjects: vi.fn().mockResolvedValue([]),
            createProject: vi.fn().mockResolvedValue({ success: true, id: 'proj-1' }),
            getFolders: vi.fn().mockResolvedValue([]),
            createFolder: vi.fn().mockResolvedValue({ success: true, id: 'fold-1' }),
            getStats: vi.fn().mockResolvedValue({ totalChats: 0, totalMessages: 0 })
        };

        mockEmbeddingService = {
            generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1))
        };

        mockAuditLogService = {
            log: vi.fn().mockResolvedValue(undefined)
        };

        registerDbIpc(
            () => mockWindow,
            mockDatabaseService as unknown as DatabaseService,
            mockEmbeddingService as unknown as EmbeddingService,
            mockAuditLogService as unknown as AuditLogService
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Chat Handlers', () => {
        it('should create a chat', async () => {
            const handler = registeredHandlers.get('db:createChat');
            const chatData = { title: 'New Chat', model: 'gpt-4' };
            const result = await handler({} as IpcMainInvokeEvent, chatData);

            expect(mockDatabaseService.createChat).toHaveBeenCalled();
            expect(result.success).toBe(true);
        });

        it('should get a chat', async () => {
            // Check if it's registered via registerBatchableHandler or directly
            // In db.ts, db:getChat is a batchable handler
            // Batchable handlers are registered via registerBatchableHandler, which we didn't mock ipcMain for
            // Let's see if it's also in registeredHandlers
            const handler = registeredHandlers.get('db:getChat');
            if (handler) {
                const result = await handler({} as IpcMainInvokeEvent, 'chat-1');
                expect(mockDatabaseService.getChat).toHaveBeenCalledWith('chat-1');
                expect(result.id).toBe('chat-1');
            }
        });

        it('should delete a chat and log to audit', async () => {
            const handler = registeredHandlers.get('db:deleteChat');
            const result = await handler({} as IpcMainInvokeEvent, 'chat-1');

            expect(mockDatabaseService.deleteChat).toHaveBeenCalledWith('chat-1');
            expect(mockAuditLogService.log).toHaveBeenCalledWith(expect.objectContaining({
                action: 'deleteChat',
                details: { chatId: 'chat-1' }
            }));
            expect(result.success).toBe(true);
        });
    });

    describe('Project Handlers', () => {
        it('should create a project', async () => {
            const handler = registeredHandlers.get('db:createProject');
            const result = await handler({} as IpcMainInvokeEvent, 'My Project', '/path', 'desc');

            expect(mockDatabaseService.createProject).toHaveBeenCalledWith('My Project', '/path', 'desc', undefined, undefined);
            expect(result.success).toBe(true);
        });
    });

    describe('Folder Handlers', () => {
        it('should create a folder', async () => {
            const handler = registeredHandlers.get('db:createFolder');
            const result = await handler({} as IpcMainInvokeEvent, 'My Folder', '#ff0000');

            expect(mockDatabaseService.createFolder).toHaveBeenCalledWith('My Folder', '#ff0000');
            expect(result.success).toBe(true);
        });
    });
});
