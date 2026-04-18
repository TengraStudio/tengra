/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import path from 'path';

import { appLogger } from '@main/logging/logger';
import { AuditLogService } from '@main/services/analysis/audit-log.service';
import { Chat as DbChat, DatabaseService, Folder as DbFolder, Prompt as DbPrompt, SearchChatsOptions as DbSearchOptions } from '@main/services/data/database.service';
import { EmbeddingService } from '@main/services/llm/embedding.service';
import { registerBatchableHandler } from '@main/utils/ipc-batch.util';
import { serializeToIpc, validatedAs, validatedToJsonObject } from '@main/utils/ipc-serializer.util';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { withOperationGuard } from '@main/utils/operation-wrapper.util';
import { DB_CHANNELS } from '@shared/constants/ipc-channels';
import { DetailedStatsSchema, StatsPeriodSchema, TokenStatsSchema } from '@shared/schemas/statistics.schema';
import { Chat, Folder, Message, Prompt } from '@shared/types/chat';
import { JsonObject } from '@shared/types/common';
import { DbTokenStats } from '@shared/types/db-api';
import { Workspace } from '@shared/types/workspace';
import { BrowserWindow, ipcMain, IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';

// --- Schemas ---

const IdSchema = z.string().min(1);
const IdsSchema = z.array(IdSchema).max(50);

const ChatSchema = z.object({
    id: z.string().optional(),
    title: z.string().min(1),
    model: z.string().min(1),
    folderId: z.string().optional(),
    isPinned: z.boolean().optional(),
    isFavorite: z.boolean().optional(),
    isArchived: z.boolean().optional(),
    createdAt: z.union([z.date(), z.number(), z.string()]).optional(),
    updatedAt: z.union([z.date(), z.number(), z.string()]).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

const MessageContentPartSchema = z.object({
    type: z.string(),
    text: z.string().optional(),
    image_url: z.object({ url: z.string() }).optional(),
}).passthrough();

const ToolCallSchema = z.object({
    id: z.string(),
    type: z.literal('function'),
    function: z.object({
        name: z.string(),
        arguments: z.string(),
    }),
}).passthrough();

const ToolResultSchema = z.object({
    tool_call_id: z.string(),
    content: z.string(),
}).passthrough();

const MessageSchema = z.object({
    id: z.string().optional(),
    chatId: z.string().min(1),
    role: z.enum(['user', 'assistant', 'system', 'tool']),
    content: z.union([z.string(), z.array(MessageContentPartSchema)]),
    timestamp: z.union([z.date(), z.number()]).optional(),
    images: z.array(z.string()).optional(),
    reasoning: z.string().optional(),
    toolCalls: z.array(ToolCallSchema).optional(),
    toolResults: z.array(ToolResultSchema).optional(),
    vector: z.array(z.number()).optional(),
}).passthrough();

const SearchChatsOptionsSchema = z.object({
    query: z.string().optional(),
    folderId: z.string().optional(),
    isPinned: z.boolean().optional(),
    isFavorite: z.boolean().optional(),
    isArchived: z.boolean().optional(),
    startDate: z.number().optional(),
    endDate: z.number().optional(),
    limit: z.number().int().optional(),
}).optional();

const TokenUsageRecordSchema = z.object({
    messageId: z.string().optional(),
    chatId: z.string().min(1),
    workspaceId: z.string().optional(),
    provider: z.string().min(1),
    model: z.string().min(1),
    tokensSent: z.number().int().nonnegative(),
    tokensReceived: z.number().int().nonnegative(),
    costEstimate: z.number().optional(),
});

const WorkspaceSchema = z.object({
    id: z.string().optional(),
    title: z.string().min(1),
    path: z.string().min(1),
    description: z.string().optional().nullable(),
    logo: z.string().optional().nullable(),
    mounts: z.union([z.string(), z.array(z.unknown())]).optional(),
    councilConfig: z.unknown().optional(),
    createdAt: z.number().optional(),
    updatedAt: z.number().optional(),
    status: z.enum(['active', 'archived', 'draft']).optional(),
});

type SenderValidator = (event: IpcMainEvent | IpcMainInvokeEvent) => void;

/**
 * Registers all database-related IPC handlers
 */
export function registerDbIpc(
    getMainWindow: () => BrowserWindow | null,
    databaseService: DatabaseService,
    embeddingService: EmbeddingService,
    auditLogService?: AuditLogService,
    allowedFileRoots?: Set<string>
) {
    const validateSender: SenderValidator = (event) => {
        const win = getMainWindow();
        if (event.sender.id !== win?.webContents.id) {
            appLogger.warn('Security', `Unauthorized database operation attempt from sender ${event.sender.id}`);
            throw new Error('Unauthorized database operation');
        }
    };

    appLogger.debug('DatabaseIPC', 'Registering database IPC handlers');

    registerBatchHandlers(databaseService, validateSender);
    registerChatHandlers(databaseService, validateSender, auditLogService);
    registerWorkspaceHandlers(databaseService, validateSender, allowedFileRoots);
    registerFolderHandlers(databaseService, validateSender);
    registerUsageHandlers(databaseService, validateSender);
    registerPromptHandlers(databaseService, validateSender);
    registerStatsHandlers(databaseService, validateSender, auditLogService);

    if (embeddingService) {
        registerVectorHandlers(databaseService, embeddingService, validateSender);
    }
}

/**
 * Registers batch-optimized IPC handlers
 */
function registerBatchHandlers(databaseService: DatabaseService, validateSender: SenderValidator) {
    registerBatchableHandler('db:getAllChats', createValidatedIpcHandler('db:getAllChats', async (event) => {
        validateSender(event);
        return serializeToIpc(await databaseService.chats.getAllChats());
    }, { defaultValue: [] }));

    registerBatchableHandler('db:getChatById', createValidatedIpcHandler('db:getChatById', async (event, id: string) => {
        validateSender(event);
        return serializeToIpc(await databaseService.chats.getChat(id));
    }, {
        defaultValue: null,
        argsSchema: z.tuple([IdSchema])
    }));

    registerBatchableHandler('db:getMessages', createValidatedIpcHandler('db:getMessages', async (event, chatId: string) => {
        validateSender(event);
        return serializeToIpc(await databaseService.chats.getMessages(chatId));
    }, {
        defaultValue: [],
        argsSchema: z.tuple([IdSchema])
    }));

    registerBatchableHandler('db:updateChat', createValidatedIpcHandler('db:updateChat', async (event, chatId: string, updates: Partial<Chat>) => {
        validateSender(event);
        return await withOperationGuard('db', () => databaseService.chats.updateChat(chatId, validatedAs<Partial<DbChat>>({ ...updates })));
    }, {
        defaultValue: { success: false },
        argsSchema: z.tuple([IdSchema, z.record(z.string(), z.unknown())])
    }) as never);

    registerBatchableHandler('db:deleteChat', createValidatedIpcHandler('db:deleteChat', async (event, chatId: string) => {
        validateSender(event);
        await withOperationGuard('db', () => databaseService.chats.deleteChat(chatId));
        return { success: true };
    }, {
        defaultValue: { success: false },
        argsSchema: z.tuple([IdSchema])
    }) as never);

    registerBatchableHandler('db:addMessage', createValidatedIpcHandler('db:addMessage', async (event, message: Message) => {
        validateSender(event);
        const result = await withOperationGuard('db', () => databaseService.chats.addMessage(validatedToJsonObject({ ...message })));
        return result;
    }, {
        defaultValue: { success: false, id: '' },
        argsSchema: z.tuple([MessageSchema])
    }) as never);

    registerBatchableHandler('db:updateMessage', createValidatedIpcHandler('db:updateMessage', async (event, messageId: string, updates: Partial<Message>) => {
        validateSender(event);
        return await withOperationGuard('db', () => databaseService.chats.updateMessage(messageId, validatedToJsonObject({ ...updates })));
    }, {
        defaultValue: { success: false },
        argsSchema: z.tuple([IdSchema, z.record(z.string(), z.unknown())])
    }) as never);
}

/**
 * Registers IPC handlers for chat CRUD operations.
 */
function registerChatHandlers(databaseService: DatabaseService, validateSender: SenderValidator, _auditLogService?: AuditLogService) {
    ipcMain.handle('db:createChat', createValidatedIpcHandler('db:createChat', async (event, chat: Chat) => {
        validateSender(event);
        return await withOperationGuard('db', () => databaseService.chats.createChat(validatedAs<DbChat>({ ...chat })));
    }, {
        defaultValue: null,
        argsSchema: z.tuple([ChatSchema])
    }));

    ipcMain.handle('db:pinChat', createValidatedIpcHandler('db:pinChat', async (event, id: string, isPinned: boolean) => {
        validateSender(event);
        await databaseService.chats.updateChat(id, { isPinned });
        return { success: true };
    }, {
        defaultValue: { success: false },
        argsSchema: z.tuple([IdSchema, z.boolean()])
    }));

    ipcMain.handle('db:favoriteChat', createValidatedIpcHandler('db:favoriteChat', async (event, id: string, isFavorite: boolean) => {
        validateSender(event);
        await databaseService.chats.updateChat(id, { isFavorite });
        return { success: true };
    }, {
        defaultValue: { success: false },
        argsSchema: z.tuple([IdSchema, z.boolean()])
    }));

    ipcMain.handle('db:archiveChat', createValidatedIpcHandler('db:archiveChat', async (event, id: string, isArchived: boolean) => {
        validateSender(event);
        await databaseService.chats.updateChat(id, validatedAs<Partial<DbChat>>({ metadata: { isArchived } }));
        return { success: true };
    }, {
        defaultValue: { success: false },
        argsSchema: z.tuple([IdSchema, z.boolean()])
    }));

    ipcMain.handle('db:updateChatTitle', createValidatedIpcHandler('db:updateChatTitle', async (event, id: string, title: string) => {
        validateSender(event);
        await databaseService.chats.updateChat(id, { title });
        return { success: true };
    }, {
        defaultValue: { success: false },
        argsSchema: z.tuple([IdSchema, z.string().min(1)])
    }));

    ipcMain.handle('db:deleteMessages', createValidatedIpcHandler('db:deleteMessages', async (event, chatId: string) => {
        validateSender(event);
        return await withOperationGuard('db', () => databaseService.deleteMessagesByChatId(chatId));
    }, {
        defaultValue: { success: false },
        argsSchema: z.tuple([IdSchema])
    }));

    ipcMain.handle('db:searchChats', createValidatedIpcHandler('db:searchChats', async (event, options?: z.infer<typeof SearchChatsOptionsSchema>) => {
        validateSender(event);
        return await databaseService.chats.searchChats(options as DbSearchOptions);
    }, {
        defaultValue: [],
        argsSchema: z.tuple([SearchChatsOptionsSchema])
    }));

    ipcMain.handle('db:clearHistory', createValidatedIpcHandler('db:clearHistory', async (event) => {
        validateSender(event);
        await withOperationGuard('db', () => databaseService.chats.deleteAllChats());
        return { success: true };
    }, { defaultValue: { success: false } }));

    ipcMain.handle('db:deleteAllChats', createValidatedIpcHandler('db:deleteAllChats', async (event) => {
        validateSender(event);
        await withOperationGuard('db', () => databaseService.deleteAllChats());
        return { success: true };
    }, { defaultValue: { success: false } }));

    ipcMain.handle('db:deleteChatsByTitle', createValidatedIpcHandler('db:deleteChatsByTitle', async (event, title: string) => {
        validateSender(event);
        return await withOperationGuard('db', () => databaseService.deleteChatsByTitle(title));
    }, {
        defaultValue: { success: false },
        argsSchema: z.tuple([z.string().min(1)])
    }));

    ipcMain.handle('db:bulkDeleteChats', createValidatedIpcHandler('db:bulkDeleteChats', async (event, ids: string[]) => {
        validateSender(event);
        await withOperationGuard('db', () => databaseService.bulkDeleteChats(ids));
        return { success: true };
    }, {
        defaultValue: { success: false },
        argsSchema: z.tuple([IdsSchema])
    }));

    ipcMain.handle('db:bulkArchiveChats', createValidatedIpcHandler('db:bulkArchiveChats', async (event, ids: string[], isArchived: boolean) => {
        validateSender(event);
        await withOperationGuard('db', () => databaseService.bulkArchiveChats(ids, isArchived));
        return { success: true };
    }, {
        defaultValue: { success: false },
        argsSchema: z.tuple([IdsSchema, z.boolean()])
    }));
}

/**
 * Registers IPC handlers for workspace-related operations.
 */
function registerWorkspaceHandlers(
    databaseService: DatabaseService,
    validateSender: (event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) => void,
    allowedFileRoots?: Set<string>
) {
    const normalizePathKey = (value: string): string => value.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
    const addWorkspaceAllowedRoots = (workspace: Workspace): void => {
        if (!allowedFileRoots) {
            return;
        }

        if (typeof workspace.path === 'string' && workspace.path.trim().length > 0) {
            allowedFileRoots.add(path.resolve(workspace.path));
        }

        if (!Array.isArray(workspace.mounts)) {
            return;
        }

        for (const mount of workspace.mounts) {
            if (mount.type !== 'local' || typeof mount.rootPath !== 'string' || mount.rootPath.trim().length === 0) {
                continue;
            }
            allowedFileRoots.add(path.resolve(mount.rootPath));
        }
    };

    const extractMountDescriptors = (workspace: Workspace): Array<{ key: string; type: 'local' | 'ssh' }> => {
        if (Array.isArray(workspace.mounts) && workspace.mounts.length > 0) {
            return workspace.mounts
                .map(mount => {
                    if (mount.type === 'ssh') {
                        const host = mount.ssh?.host?.toLowerCase() ?? '';
                        const user = mount.ssh?.username?.toLowerCase() ?? '';
                        const port = mount.ssh?.port ?? 22;
                        return {
                            key: `ssh:${user}@${host}:${port}:${normalizePathKey(mount.rootPath)}`,
                            type: 'ssh' as const
                        };
                    }
                    return {
                        key: `local:${normalizePathKey(mount.rootPath)}`,
                        type: 'local' as const
                    };
                });
        }
        return [{
            key: `local:${normalizePathKey(workspace.path)}`,
            type: 'local'
        }];
    };

    const getDuplicateWorkspaceMessage = (type: 'local' | 'ssh'): string =>
        type === 'ssh'
            ? 'A workspace already exists for this remote path.'
            : 'A workspace already exists for this local directory.';

    ipcMain.handle('db:createWorkspace', createValidatedIpcHandler('db:createWorkspace', async (event, workspace: Workspace) => {
        validateSender(event);
        const existingWorkspaces = await databaseService.getWorkspaces();
        const existingMountKeys = new Set<string>();
        for (const existingWorkspace of existingWorkspaces) {
            for (const descriptor of extractMountDescriptors(existingWorkspace)) {
                existingMountKeys.add(descriptor.key);
            }
        }

        for (const descriptor of extractMountDescriptors(workspace)) {
            if (existingMountKeys.has(descriptor.key)) {
                throw new Error(getDuplicateWorkspaceMessage(descriptor.type));
            }
        }

        const createdWorkspace = await withOperationGuard('db', () => databaseService.createWorkspace(
            workspace.title,
            workspace.path,
            workspace.description,
            workspace.mounts ? JSON.stringify(workspace.mounts) : undefined,
            workspace.councilConfig ? JSON.stringify(workspace.councilConfig) : undefined
        ));
        addWorkspaceAllowedRoots(createdWorkspace);
        event.sender.send(DB_CHANNELS.WORKSPACE_UPDATED_EVENT, { id: createdWorkspace.id });
        return createdWorkspace;
    }, {
        argsSchema: z.tuple([WorkspaceSchema]),
        responseSchema: WorkspaceSchema
    }));

    ipcMain.handle('db:getWorkspaces', createValidatedIpcHandler('db:getWorkspaces', async (event) => {
        validateSender(event);
        const workspaces = await databaseService.getWorkspaces();
        for (const workspace of workspaces) {
            addWorkspaceAllowedRoots(workspace);
        }
        return workspaces;
    }, {
        defaultValue: [],
        argsSchema: z.tuple([]),
        responseSchema: z.array(WorkspaceSchema)
    }));

    ipcMain.handle('db:getWorkspaceById', createValidatedIpcHandler('db:getWorkspaceById', async (event, id: string) => {
        validateSender(event);
        const workspace = await databaseService.getWorkspace(id);
        if (workspace) {
            addWorkspaceAllowedRoots(workspace);
        }
        return workspace;
    }, {
        defaultValue: null,
        argsSchema: z.tuple([IdSchema]),
        responseSchema: WorkspaceSchema.nullable()
    }));

    ipcMain.handle('db:updateWorkspace', createValidatedIpcHandler('db:updateWorkspace', async (event, id: string, updates: Partial<Workspace>) => {
        validateSender(event);
        const updatedWorkspace = await withOperationGuard('db', () => databaseService.workspaces.updateWorkspace(id, updates as JsonObject));
        if (updatedWorkspace) {
            addWorkspaceAllowedRoots(updatedWorkspace);
        }
        event.sender.send(DB_CHANNELS.WORKSPACE_UPDATED_EVENT, { id });
        return updatedWorkspace;
    }, {
        defaultValue: null,
        argsSchema: z.tuple([IdSchema, z.record(z.string(), z.unknown())]),
        responseSchema: WorkspaceSchema.nullable()
    }));

    ipcMain.handle('db:deleteWorkspace', createValidatedIpcHandler('db:deleteWorkspace', async (event, id: string, deleteFiles: boolean = false) => {
        validateSender(event);
        await withOperationGuard('db', () => databaseService.workspaces.deleteWorkspace(id, deleteFiles));
        event.sender.send(DB_CHANNELS.WORKSPACE_UPDATED_EVENT, { id });
        return { success: true };
    }, {
        defaultValue: { success: false },
        argsSchema: z.tuple([IdSchema, z.boolean().optional()])
    }));

    ipcMain.handle('db:archiveWorkspace', createValidatedIpcHandler('db:archiveWorkspace', async (event, id: string, isArchived: boolean) => {
        validateSender(event);
        await withOperationGuard('db', () => databaseService.archiveWorkspace(id, isArchived));
        event.sender.send(DB_CHANNELS.WORKSPACE_UPDATED_EVENT, { id });
        return { success: true };
    }, {
        defaultValue: { success: false },
        argsSchema: z.tuple([IdSchema, z.boolean()])
    }));

    ipcMain.handle('db:bulkDeleteWorkspaces', createValidatedIpcHandler('db:bulkDeleteWorkspaces', async (event, ids: string[], deleteFiles: boolean = false) => {
        validateSender(event);
        await withOperationGuard('db', () => databaseService.bulkDeleteWorkspaces(ids, deleteFiles));
        event.sender.send(DB_CHANNELS.WORKSPACE_UPDATED_EVENT, {});
        return { success: true };
    }, {
        defaultValue: { success: false },
        argsSchema: z.tuple([IdsSchema, z.boolean().optional()])
    }));

    ipcMain.handle('db:bulkArchiveWorkspaces', createValidatedIpcHandler('db:bulkArchiveWorkspaces', async (event, ids: string[], isArchived: boolean) => {
        validateSender(event);
        await withOperationGuard('db', () => databaseService.bulkArchiveWorkspaces(ids, isArchived));
        event.sender.send(DB_CHANNELS.WORKSPACE_UPDATED_EVENT, {});
        return { success: true };
    }, {
        defaultValue: { success: false },
        argsSchema: z.tuple([IdsSchema, z.boolean()])
    }));
}

/**
 * Registers IPC handlers for folder organization.
 */
function registerFolderHandlers(databaseService: DatabaseService, validateSender: (event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) => void) {
    ipcMain.handle('db:createFolder', createValidatedIpcHandler('db:createFolder', async (event, folder: { name: string; color?: string }) => {
        validateSender(event);
        return await withOperationGuard('db', () => databaseService.system.createFolder(folder.name, folder.color));
    }, {
        defaultValue: null,
        argsSchema: z.tuple([z.object({ name: z.string().min(1), color: z.string().optional() })])
    }));

    ipcMain.handle('db:getFolders', createValidatedIpcHandler('db:getFolders', async (event) => {
        validateSender(event);
        return await databaseService.system.getFolders();
    }, { defaultValue: [] }));

    ipcMain.handle('db:updateFolder', createValidatedIpcHandler('db:updateFolder', async (event, id: string, updates: Partial<Folder>) => {
        validateSender(event);
        return await withOperationGuard('db', () => databaseService.system.updateFolder(id, validatedAs<Partial<DbFolder>>({ ...updates })));
    }, {
        defaultValue: null,
        argsSchema: z.tuple([IdSchema, z.record(z.string(), z.unknown())])
    }));

    ipcMain.handle('db:deleteFolder', createValidatedIpcHandler('db:deleteFolder', async (event, id: string) => {
        validateSender(event);
        await withOperationGuard('db', () => databaseService.system.deleteFolder(id));
        return { success: true };
    }, {
        defaultValue: { success: false },
        argsSchema: z.tuple([IdSchema])
    }));

    ipcMain.handle('db:moveChatToFolder', createValidatedIpcHandler('db:moveChatToFolder', async (event, chatId: string, folderId: string | null) => {
        validateSender(event);
        await databaseService.chats.updateChat(chatId, validatedAs<Partial<DbChat>>({ folderId: folderId ?? undefined }));
        return { success: true };
    }, {
        defaultValue: { success: false },
        argsSchema: z.tuple([IdSchema, z.string().nullable()])
    }));
}

/**
 * Registers IPC handlers for token usage and analytics tracking.
 */
function registerUsageHandlers(databaseService: DatabaseService, validateSender: (event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) => void) {
    ipcMain.handle('db:recordUsage', createValidatedIpcHandler('db:recordUsage', async (event, usage: z.infer<typeof TokenUsageRecordSchema>) => {
        validateSender(event);
        await withOperationGuard('db', () => databaseService.system.addTokenUsage(usage));
        return { success: true };
    }, {
        defaultValue: { success: false },
        argsSchema: z.tuple([TokenUsageRecordSchema])
    }));

    ipcMain.handle('db:getUsageStats', createValidatedIpcHandler('db:getUsageStats', async (event, period: 'daily' | 'weekly' | 'monthly') => {
        validateSender(event);
        return await databaseService.system.getTokenUsageStats(period);
    }, {
        defaultValue: { totalSent: 0, totalReceived: 0, totalCost: 0, timeline: [], byProvider: {}, byModel: {} } as DbTokenStats,
        argsSchema: z.tuple([z.enum(['daily', 'weekly', 'monthly'])])
    }));
}

/**
 * Registers IPC handlers for vector search and message embeddings.
 */
function registerVectorHandlers(databaseService: DatabaseService, embeddingService: EmbeddingService, validateSender: (event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) => void) {
    ipcMain.handle('db:searchSimilarMessages', createValidatedIpcHandler('db:searchSimilarMessages', async (event, query: string, _limit?: number) => {
        validateSender(event);
        await embeddingService.generateEmbedding(query);
        // Fallback to empty if not implemented in repo yet
        return [];
    }, {
        defaultValue: [],
        argsSchema: z.tuple([z.string().min(1), z.number().int().optional()])
    }));

    ipcMain.handle('db:updateMessageVector', createValidatedIpcHandler('db:updateMessageVector', async (event, messageId: string, vector: number[]) => {
        validateSender(event);
        await databaseService.chats.updateMessage(messageId, { vector });
        return { success: true };
    }, {
        defaultValue: { success: false },
        argsSchema: z.tuple([IdSchema, z.array(z.number())])
    }));
}

/**
 * Registers IPC handlers for prompt template operations.
 */
function registerPromptHandlers(databaseService: DatabaseService, validateSender: (event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) => void) {
    ipcMain.handle('db:createPrompt', createValidatedIpcHandler('db:createPrompt', async (event, title: string, content: string, tags: string[]) => {
        validateSender(event);
        return await withOperationGuard('db', () => databaseService.system.createPrompt(title, content, tags));
    }, {
        defaultValue: null,
        argsSchema: z.tuple([z.string().min(1), z.string().min(1), z.array(z.string())])
    }));

    ipcMain.handle('db:deletePrompt', createValidatedIpcHandler('db:deletePrompt', async (event, id: string) => {
        validateSender(event);
        await withOperationGuard('db', () => databaseService.system.deletePrompt(id));
        return { success: true };
    }, {
        defaultValue: { success: false },
        argsSchema: z.tuple([IdSchema])
    }));

    ipcMain.handle('db:updatePrompt', createValidatedIpcHandler('db:updatePrompt', async (event, id: string, updates: Partial<Prompt>) => {
        validateSender(event);
        return await withOperationGuard('db', () => databaseService.system.updatePrompt(id, validatedAs<Partial<DbPrompt>>({ ...updates })));
    }, {
        defaultValue: null,
        argsSchema: z.tuple([IdSchema, z.record(z.string(), z.unknown())])
    }));

    ipcMain.handle('db:getPrompts', createValidatedIpcHandler('db:getPrompts', async (event) => {
        validateSender(event);
        return await databaseService.system.getPrompts();
    }, { defaultValue: [] }));
}

/**
 * Registers IPC handlers for statistics and analytics.
 */
function registerStatsHandlers(databaseService: DatabaseService, validateSender: (event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) => void, _auditLogService?: AuditLogService) {
    ipcMain.handle('db:getDetailedStats', createValidatedIpcHandler('db:getDetailedStats', async (event, period?: string) => {
        validateSender(event);
        return await databaseService.system.getDetailedStats(period || 'daily');
    }, {
        defaultValue: null,
        argsSchema: z.tuple([StatsPeriodSchema.optional()]),
        responseSchema: DetailedStatsSchema.nullable()
    }));



    ipcMain.handle('db:getProviderStats', createValidatedIpcHandler('db:getProviderStats', async (event) => {
        validateSender(event);
        // Return default empty stats object instead of array to match DbTokenStats interface
        return {
            totalSent: 0,
            totalReceived: 0,
            totalCost: 0,
            timeline: [],
            byProvider: {},
            byModel: {}
        };
    }, {
        defaultValue: { totalSent: 0, totalReceived: 0, totalCost: 0, timeline: [], byProvider: {}, byModel: {} } as DbTokenStats,
        argsSchema: z.tuple([]),
        responseSchema: TokenStatsSchema
    }));
}
