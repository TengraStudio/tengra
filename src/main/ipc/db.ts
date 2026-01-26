import { AuditLogService } from '@main/services/analysis/audit-log.service';
import { Chat as DbChat, DatabaseService } from '@main/services/data/database.service';
import { EmbeddingService } from '@main/services/llm/embedding.service';
import { registerBatchableHandler } from '@main/utils/ipc-batch.util';
import { createIpcHandler, createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { Chat, Folder, Message, Prompt } from '@shared/types/chat';
import { IpcValue, JsonObject } from '@shared/types/common';
import { Project } from '@shared/types/project';
import { ipcMain, IpcMainInvokeEvent } from 'electron';

export function registerDbIpc(getWindow: () => Electron.BrowserWindow | null, databaseService: DatabaseService, embeddingService?: EmbeddingService, auditLogService?: AuditLogService) {
    const notifyUpdate = (id?: string) => {
        const win = getWindow();
        if (win && !win.isDestroyed()) {
            win.webContents.send('project:updated', { id });
        }
    };

    registerChatHandlers(databaseService, auditLogService);
    registerMessageHandlers(databaseService, embeddingService, auditLogService);
    registerProjectHandlers(databaseService, notifyUpdate, auditLogService);
    registerFolderHandlers(databaseService);
    registerPromptHandlers(databaseService);
    registerStatsHandlers(databaseService, auditLogService);

    // Register frequently batched database operations
    registerBatchableHandler('db:getAllChats', async (): Promise<IpcValue> => {
        return (await databaseService.getAllChats()) as unknown as IpcValue;
    });

    registerBatchableHandler('db:getMessages', async (_event, ...args): Promise<IpcValue> => {
        const chatId = args[0] as string;
        return (await databaseService.getMessages(chatId)) as unknown as IpcValue;
    });

    registerBatchableHandler('db:getProjects', async (): Promise<IpcValue> => {
        return (await databaseService.getProjects()) as unknown as IpcValue;
    });

    registerBatchableHandler('db:getFolders', async (): Promise<IpcValue> => {
        return (await databaseService.getFolders()) as unknown as IpcValue;
    });

    registerBatchableHandler('db:getStats', async (): Promise<IpcValue> => {
        return await databaseService.getStats();
    });

    registerBatchableHandler('db:getChat', async (_event, ...args): Promise<IpcValue> => {
        const chatId = args[0] as string;
        return (await databaseService.getChat(chatId)) as unknown as IpcValue;
    });

    registerBatchableHandler('db:updateChat', async (_event, ...args): Promise<IpcValue> => {
        const [chatId, updates] = args as [string, Record<string, unknown>];
        return await databaseService.updateChat(chatId, updates as JsonObject);
    });

    registerBatchableHandler('db:deleteChat', async (_event, ...args): Promise<IpcValue> => {
        const chatId = args[0] as string;
        return await databaseService.deleteChat(chatId);
    });

    registerBatchableHandler('db:addMessage', async (_event, ...args): Promise<IpcValue> => {
        const message = args[0] as JsonObject;
        return await databaseService.addMessage(message);
    });
}

function registerChatHandlers(databaseService: DatabaseService, auditLogService?: AuditLogService) {
    ipcMain.handle('db:createChat', createSafeIpcHandler('db:createChat', async (_event: IpcMainInvokeEvent, chat: Partial<Chat> & { title: string; model: string }) => {
        // Convert Chat to database format (Date -> number, remove messages array)
        // Create a plain object without the complex Message[] type
        const { messages: _messages, ...chatWithoutMessages } = chat;
        // _messages is now implicitly "used" by destructuring with rename, ignoring lint
        void _messages;
        const dbChat = {
            ...chatWithoutMessages,
            messages: [],
            createdAt: chat.createdAt instanceof Date ? chat.createdAt : new Date(),
            updatedAt: chat.updatedAt instanceof Date ? chat.updatedAt : new Date()
        } as DbChat;
        return await databaseService.createChat(dbChat);
    }, { success: false, id: '' }));

    ipcMain.handle('db:updateChat', createSafeIpcHandler('db:updateChat', async (_event: IpcMainInvokeEvent, id: string, updates: Partial<Chat>) => {
        return await databaseService.updateChat(id, updates as JsonObject);
    }, { success: false }));

    ipcMain.handle('db:deleteChat', createSafeIpcHandler('db:deleteChat', async (_event: IpcMainInvokeEvent, id: string) => {
        try {
            const result = await databaseService.deleteChat(id);
            if (auditLogService && result.success) {
                await auditLogService.log({
                    action: 'deleteChat',
                    category: 'data',
                    details: { chatId: id },
                    success: true
                });
            }
            return result;
        } catch (error) {
            if (auditLogService) {
                await auditLogService.log({
                    action: 'deleteChat',
                    category: 'data',
                    details: { chatId: id },
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
            throw error;
        }
    }, { success: false }));

    ipcMain.handle('db:duplicateChat', createSafeIpcHandler('db:duplicateChat', async (_event: IpcMainInvokeEvent, id: string) => {
        return await databaseService.duplicateChat(id);
    }, null));

    ipcMain.handle('db:archiveChat', createSafeIpcHandler('db:archiveChat', async (_event: IpcMainInvokeEvent, id: string, isArchived: boolean) => {
        return await databaseService.archiveChat(id, isArchived);
    }, { success: false }));

    ipcMain.handle('db:getChat', createSafeIpcHandler('db:getChat', async (_event: IpcMainInvokeEvent, id: string) => {
        return await databaseService.getChat(id);
    }, null));

    ipcMain.handle('db:getAllChats', createSafeIpcHandler('db:getAllChats', async () => {
        return await databaseService.getAllChats();
    }, []));

    ipcMain.handle('db:deleteAllChats', createSafeIpcHandler('db:deleteAllChats', async () => {
        try {
            const result = await databaseService.deleteAllChats();
            if (auditLogService && result.success) {
                await auditLogService.log({
                    action: 'deleteAllChats',
                    category: 'data',
                    details: {},
                    success: true
                });
            }
            return result;
        } catch (error) {
            if (auditLogService) {
                await auditLogService.log({
                    action: 'deleteAllChats',
                    category: 'data',
                    details: {},
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
            throw error;
        }
    }, { success: false }));

    ipcMain.handle('db:deleteChatsByTitle', createSafeIpcHandler('db:deleteChatsByTitle', async (_event: IpcMainInvokeEvent, title: string) => {
        return await databaseService.deleteChatsByTitle(title);
    }, { success: false }));
}

function registerMessageHandlers(databaseService: DatabaseService, embeddingService?: EmbeddingService, auditLogService?: AuditLogService) {
    ipcMain.handle('db:addMessage', createSafeIpcHandler('db:addMessage', async (_event: IpcMainInvokeEvent, message: Message & { vector?: number[] }) => {
        if (embeddingService) {
            await attachEmbeddingToMessage(message, embeddingService);
        }
        // Convert Message to database format - serialize complex types
        const dbMessage = {
            id: message.id,
            chatId: message.chatId,
            role: message.role,
            content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
            timestamp: message.timestamp instanceof Date ? message.timestamp.getTime() : Date.now(),
            images: message.images,
            reasoning: message.reasoning,
            toolCalls: message.toolCalls ? JSON.stringify(message.toolCalls) : undefined,
            toolResults: message.toolResults ? JSON.stringify(message.toolResults) : undefined,
            vector: message.vector
        } as JsonObject;
        return await databaseService.addMessage(dbMessage);
    }, { success: false, id: '' }));

    ipcMain.handle('db:getMessages', createSafeIpcHandler('db:getMessages', async (_event: IpcMainInvokeEvent, chatId: string) => {
        return await databaseService.getMessages(chatId);
    }, []));

    ipcMain.handle('db:deleteMessage', createSafeIpcHandler('db:deleteMessage', async (_event: IpcMainInvokeEvent, id: string) => {
        try {
            const result = await databaseService.deleteMessage(id);
            if (auditLogService && result.success) {
                await auditLogService.log({
                    action: 'deleteMessage',
                    category: 'data',
                    details: { messageId: id },
                    success: true
                });
            }
            return result;
        } catch (error) {
            if (auditLogService) {
                await auditLogService.log({
                    action: 'deleteMessage',
                    category: 'data',
                    details: { messageId: id },
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
            throw error;
        }
    }, { success: false }));

    ipcMain.handle('db:deleteMessages', createSafeIpcHandler('db:deleteMessages', async (_event: IpcMainInvokeEvent, chatId: string) => {
        try {
            const result = await databaseService.deleteMessagesByChatId(chatId);
            if (auditLogService && result.success) {
                await auditLogService.log({
                    action: 'deleteMessages',
                    category: 'data',
                    details: { chatId },
                    success: true
                });
            }
            return result;
        } catch (error) {
            if (auditLogService) {
                await auditLogService.log({
                    action: 'deleteMessages',
                    category: 'data',
                    details: { chatId },
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
            throw error;
        }
    }, { success: false }));

    ipcMain.handle('db:updateMessage', createSafeIpcHandler('db:updateMessage', async (_event: IpcMainInvokeEvent, id: string, updates: Partial<Message>) => {
        return await databaseService.updateMessage(id, updates as JsonObject);
    }, { success: false }));

    ipcMain.handle('db:getBookmarkedMessages', createSafeIpcHandler('db:getBookmarkedMessages', async () => {
        return await databaseService.getBookmarkedMessages();
    }, []));
}

async function attachEmbeddingToMessage(message: Message & { vector?: number[] }, embeddingService: EmbeddingService) {
    try {
        // Generate embedding for "context search" later
        // Only for user/assistant messages with meaningful content
        if (message.content && (message.role === 'user' || message.role === 'assistant')) {
            // Handle both string and array content types
            const contentStr = typeof message.content === 'string'
                ? message.content
                : Array.isArray(message.content)
                    ? message.content.filter(p => p.type === 'text').map(p => p.text ?? '').join(' ')
                    : '';
            if (contentStr) {
                const vector = await embeddingService.generateEmbedding(contentStr);
                message.vector = vector;
            }
        }
    } catch (error) {
        // Log but don't fail the message addition if embedding fails
        console.error('[DB IPC] Failed to generate embedding for message:', error);
    }
}

function registerProjectHandlers(databaseService: DatabaseService, notifyUpdate: (id?: string) => void, auditLogService?: AuditLogService) {
    ipcMain.handle('db:getProjects', createSafeIpcHandler('db:getProjects', async () => {
        return await databaseService.getProjects();
    }, []));

    ipcMain.handle('db:createProject', createIpcHandler('db:createProject', async (_event: IpcMainInvokeEvent, name: string, path: string, desc: string, mountsJson?: string) => {
        const result = await databaseService.createProject(name, path, desc, mountsJson, undefined);
        notifyUpdate();
        return result;
    }));

    ipcMain.handle('db:updateProject', createSafeIpcHandler('db:updateProject', async (_event: IpcMainInvokeEvent, id: string, updates: Partial<Project>) => {
        // Convert Date to number for database
        const dbUpdates: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(updates)) {
            if (value instanceof Date) {
                dbUpdates[key] = value.getTime();
            } else {
                dbUpdates[key] = value;
            }
        }
        const result = await databaseService.updateProject(id, dbUpdates as JsonObject);
        notifyUpdate(id);
        return result;
    }, undefined));

    ipcMain.handle('db:deleteProject', createIpcHandler('db:deleteProject', async (_event: IpcMainInvokeEvent, id: string, deleteFiles: boolean = false) => {
        try {
            await databaseService.deleteProject(id, deleteFiles);
            if (auditLogService) {
                await auditLogService.log({
                    action: 'deleteProject',
                    category: 'data',
                    details: { projectId: id, deleteFiles },
                    success: true
                });
            }
            notifyUpdate();
        } catch (error) {
            if (auditLogService) {
                await auditLogService.log({
                    action: 'deleteProject',
                    category: 'data',
                    details: { projectId: id, deleteFiles },
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
            throw error;
        }
    }));

    ipcMain.handle('db:archiveProject', createIpcHandler('db:archiveProject', async (_event: IpcMainInvokeEvent, id: string, isArchived: boolean) => {
        const result = await databaseService.archiveProject(id, isArchived);
        notifyUpdate(id);
        return result;
    }));

    ipcMain.handle('db:bulkDeleteProjects', createIpcHandler('db:bulkDeleteProjects', async (_event: IpcMainInvokeEvent, ids: string[], deleteFiles: boolean = false) => {
        try {
            await databaseService.bulkDeleteProjects(ids, deleteFiles);
            if (auditLogService) {
                await auditLogService.log({
                    action: 'bulkDeleteProjects',
                    category: 'data',
                    details: { projectIds: ids, deleteFiles },
                    success: true
                });
            }
            notifyUpdate();
        } catch (error) {
            if (auditLogService) {
                await auditLogService.log({
                    action: 'bulkDeleteProjects',
                    category: 'data',
                    details: { projectIds: ids, deleteFiles },
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
            throw error;
        }
    }));

    ipcMain.handle('db:bulkArchiveProjects', createIpcHandler('db:bulkArchiveProjects', async (_event: IpcMainInvokeEvent, ids: string[], isArchived: boolean) => {
        try {
            await databaseService.bulkArchiveProjects(ids, isArchived);
            if (auditLogService) {
                await auditLogService.log({
                    action: 'bulkArchiveProjects',
                    category: 'data',
                    details: { projectIds: ids, isArchived },
                    success: true
                });
            }
            notifyUpdate();
        } catch (error) {
            if (auditLogService) {
                await auditLogService.log({
                    action: 'bulkArchiveProjects',
                    category: 'data',
                    details: { projectIds: ids, isArchived },
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
            throw error;
        }
    }));
}

function registerFolderHandlers(databaseService: DatabaseService) {
    ipcMain.handle('db:createFolder', createSafeIpcHandler('db:createFolder', async (_event: IpcMainInvokeEvent, name: string, color: string) => {
        return await databaseService.createFolder(name, color);
    }, null));

    ipcMain.handle('db:deleteFolder', createIpcHandler('db:deleteFolder', async (_event: IpcMainInvokeEvent, id: string) => {
        await databaseService.deleteFolder(id);
        return { success: true };
    }));

    ipcMain.handle('db:updateFolder', createSafeIpcHandler('db:updateFolder', async (_event: IpcMainInvokeEvent, id: string, updates: Partial<Folder>) => {
        // Convert Date to number for database
        const dbUpdates: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(updates)) {
            if (value instanceof Date) {
                dbUpdates[key] = value.getTime();
            } else {
                dbUpdates[key] = value;
            }
        }
        return await databaseService.updateFolder(id, dbUpdates as JsonObject);
    }, null));

    ipcMain.handle('db:getFolders', createSafeIpcHandler('db:getFolders', async () => {
        return await databaseService.getFolders();
    }, []));
}

function registerPromptHandlers(databaseService: DatabaseService) {
    ipcMain.handle('db:createPrompt', createSafeIpcHandler('db:createPrompt', async (_event: IpcMainInvokeEvent, title: string, content: string, tags: string[]) => {
        return await databaseService.createPrompt(title, content, tags);
    }, null));

    ipcMain.handle('db:deletePrompt', createSafeIpcHandler('db:deletePrompt', async (_event: IpcMainInvokeEvent, id: string) => {
        await databaseService.deletePrompt(id);
        return { success: true };
    }, { success: false }));

    ipcMain.handle('db:updatePrompt', createSafeIpcHandler('db:updatePrompt', async (_event: IpcMainInvokeEvent, id: string, updates: Partial<Prompt>) => {
        return await databaseService.updatePrompt(id, updates);
    }, null));

    ipcMain.handle('db:getPrompts', createSafeIpcHandler('db:getPrompts', async () => {
        return await databaseService.getPrompts();
    }, []));
}

function registerStatsHandlers(databaseService: DatabaseService, _auditLogService?: AuditLogService) {
    ipcMain.handle('db:getStats', createSafeIpcHandler('db:getStats', async () => {
        return await databaseService.getStats();
    }, { chatCount: 0, messageCount: 0, dbSize: 0 }));

    ipcMain.handle('db:getDetailedStats', createSafeIpcHandler('db:getDetailedStats', async (_event: IpcMainInvokeEvent, period: string) => {
        return await databaseService.getDetailedStats(period as "daily" | "weekly" | "monthly" | "yearly" | undefined);
    }, null));

    ipcMain.handle('db:getTimeStats', createSafeIpcHandler('db:getTimeStats', async () => {
        return await databaseService.getTimeStats();
    }, { totalTime: 0, averageTime: 0 }));

    ipcMain.handle('db:searchChats', createSafeIpcHandler('db:searchChats', async (_event: IpcMainInvokeEvent, options: {
        query?: string;
        folderId?: string;
        isPinned?: boolean;
        isFavorite?: boolean;
        isArchived?: boolean;
        startDate?: number;
        endDate?: number;
        limit?: number;
    }) => {
        return await databaseService.searchChats(options);
    }, []));

    ipcMain.handle('db:getTokenStats', createSafeIpcHandler('db:getTokenStats', async (_event: IpcMainInvokeEvent, period: 'daily' | 'weekly' | 'monthly') => {
        return await databaseService.getTokenUsageStats(period);
    }, { totalTokens: 0 }));

    ipcMain.handle('db:addTokenUsage', createSafeIpcHandler('db:addTokenUsage', async (_event: IpcMainInvokeEvent, record: {
        messageId?: string
        chatId: string
        projectId?: string
        provider: string
        model: string
        tokensSent: number
        tokensReceived: number
        costEstimate?: number
    }) => {
        await databaseService.addTokenUsage({
            chatId: record.chatId,
            messageId: record.messageId,
            projectId: record.projectId,
            provider: record.provider,
            model: record.model,
            tokensSent: record.tokensSent,
            tokensReceived: record.tokensReceived,
            costEstimate: record.costEstimate,
            timestamp: Date.now()
        });
        return { success: true };
    }, { success: false }));
}
