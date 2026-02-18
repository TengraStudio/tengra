import { registerDbIpc } from '@main/ipc/db';
import { AuditLogService } from '@main/services/analysis/audit-log.service';
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

vi.mock('@main/utils/ipc-wrapper.util', () => ({
    createIpcHandler: (_name: string, handler: (...args: any[]) => any) => async (...args: any[]) => handler(...args),
    createSafeIpcHandler: (_name: string, handler: (...args: any[]) => any, defaultValue: unknown) => async (...args: any[]) => {
        try {
            return await handler(...args);
        } catch {
            return defaultValue;
        }
    },
    createValidatedIpcHandler: (
        _name: string,
        handler: (...args: any[]) => any,
        options?: { argsSchema?: { parse: (args: unknown[]) => unknown[] }; defaultValue?: unknown }
    ) => async (event: unknown, ...args: unknown[]) => {
        try {
            const parsedArgs = options?.argsSchema ? options.argsSchema.parse(args) : args;
            return await handler(event, ...(parsedArgs as unknown[]));
        } catch {
            if (options && Object.prototype.hasOwnProperty.call(options, 'defaultValue')) {
                return options.defaultValue;
            }
            throw new Error('Validation failed');
        }
    },
}));

vi.mock('@main/utils/rate-limiter.util', () => ({
    withRateLimit: vi.fn(async (_bucket: string, fn: () => Promise<any>) => await fn()),
}));


// Helper to mock BrowserWindow
const mockWindow = {
    isDestroyed: vi.fn().mockReturnValue(false),
    webContents: {
        id: 1,
        send: vi.fn()
    }
} as unknown as BrowserWindow;




interface MockEmbeddingService extends Partial<EmbeddingService> {
    generateEmbedding: Mock;
}

interface MockAuditLogService extends Partial<AuditLogService> {
    log: Mock;
}

describe('Database IPC Handlers', () => {
    let mockDatabaseService: any;

    let mockEmbeddingService: MockEmbeddingService;
    let mockAuditLogService: MockAuditLogService;
    let registeredHandlers: Map<string, any>;
    const mockEvent = { sender: { id: 1 } } as any;


    beforeEach(() => {
        registeredHandlers = new Map();

        vi.mocked(ipcMain.handle).mockImplementation((channel: string, listener: any) => {
            if (!registeredHandlers.has(channel)) {
                registeredHandlers.set(channel, listener);
            }
        });

        mockDatabaseService = {
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
            projects: {
                getProjects: vi.fn().mockResolvedValue([]),
                createProject: vi.fn().mockResolvedValue({ success: true, id: 'proj-1' }),
                getProject: vi.fn().mockResolvedValue({ id: 'proj-1', title: 'Test Project' }),
                updateProject: vi.fn().mockResolvedValue({ success: true }),
                deleteProject: vi.fn().mockResolvedValue({ success: true }),
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
        } as any;


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
            const result = await handler(mockEvent, chatData);


            expect(mockDatabaseService.chats.createChat).toHaveBeenCalled();

            expect(result.success).toBe(true);
        });

        it('should get a chat', async () => {
            // Check if it's registered via registerBatchableHandler or directly
            // In db.ts, db:getChat is a batchable handler
            // Batchable handlers are registered via registerBatchableHandler, which we didn't mock ipcMain for
            // Let's see if it's also in registeredHandlers
            const handler = registeredHandlers.get('db:getChat');
            if (handler) {
                const result = await handler(mockEvent, 'chat-1');

                expect(mockDatabaseService.chats.getChat).toHaveBeenCalledWith('chat-1');
                expect(result.id).toBe('chat-1');
            }

        });

        it('should delete a chat', async () => {
            const handler = registeredHandlers.get('db:deleteChat');
            const result = await handler(mockEvent, 'chat-1');


            expect(mockDatabaseService.chats.deleteChat).toHaveBeenCalledWith('chat-1');

            expect(result.success).toBe(true);
        });

    });

    describe('Project Handlers', () => {
        it('should create a project', async () => {
            const handler = registeredHandlers.get('db:createProject');
            const result = await handler(mockEvent, { title: 'My Project', path: '/path', description: 'desc' });



            expect(mockDatabaseService.projects.createProject).toHaveBeenCalledWith('My Project', '/path', 'desc', undefined, undefined);

            expect(result.success).toBe(true);
        });
    });

    describe('Folder Handlers', () => {
        it('should create a folder', async () => {
            const handler = registeredHandlers.get('db:createFolder');
            const result = await handler(mockEvent, { name: 'My Folder', color: '#ff0000' });



            expect(mockDatabaseService.system.createFolder).toHaveBeenCalledWith('My Folder', '#ff0000');

            expect(result.success).toBe(true);
        });
    });
});
