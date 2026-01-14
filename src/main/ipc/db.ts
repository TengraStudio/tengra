import { AuditLogService } from '@main/services/audit-log.service'
import { DatabaseService } from '@main/services/data/database.service'
import { EmbeddingService } from '@main/services/llm/embedding.service'
import { createIpcHandler, createSafeIpcHandler } from '@main/utils/ipc-wrapper.util'
import { Chat, Folder, Message, Prompt } from '@shared/types/chat'
import { JsonObject } from '@shared/types/common'
import { Project } from '@shared/types/project'
import { WorkspaceMount } from '@shared/types/workspace'
import { ipcMain, IpcMainInvokeEvent } from 'electron'

export function registerDbIpc(databaseService: DatabaseService, embeddingService?: EmbeddingService, auditLogService?: AuditLogService) {
    ipcMain.handle('db:createChat', createSafeIpcHandler('db:createChat', async (_event: IpcMainInvokeEvent, chat: Partial<Chat> & { title: string; model: string }) => {
        // Convert Chat to database format (Date -> number, remove messages array)
        // Create a plain object without the complex Message[] type
        const { messages: _messages, ...chatWithoutMessages } = chat
        const dbChat = {
            ...chatWithoutMessages,
            createdAt: chat.createdAt instanceof Date ? chat.createdAt.getTime() : Date.now(),
            updatedAt: chat.updatedAt instanceof Date ? chat.updatedAt.getTime() : Date.now()
        } as JsonObject
        return await databaseService.createChat(dbChat)
    }, { success: false, id: '' }))

    ipcMain.handle('db:updateChat', createSafeIpcHandler('db:updateChat', async (_event: IpcMainInvokeEvent, id: string, updates: Partial<Chat>) => {
        return await databaseService.updateChat(id, updates as JsonObject)
    }, { success: false }))

    ipcMain.handle('db:deleteChat', createSafeIpcHandler('db:deleteChat', async (_event: IpcMainInvokeEvent, id: string) => {
        try {
            const result = await databaseService.deleteChat(id)
            if (auditLogService && result.success) {
                await auditLogService.log({
                    action: 'deleteChat',
                    category: 'data',
                    details: { chatId: id },
                    success: true
                })
            }
            return result
        } catch (error) {
            if (auditLogService) {
                await auditLogService.log({
                    action: 'deleteChat',
                    category: 'data',
                    details: { chatId: id },
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                })
            }
            throw error
        }
    }, { success: false }))

    ipcMain.handle('db:duplicateChat', createSafeIpcHandler('db:duplicateChat', async (_event: IpcMainInvokeEvent, id: string) => {
        return await databaseService.duplicateChat(id)
    }, null))

    ipcMain.handle('db:archiveChat', createSafeIpcHandler('db:archiveChat', async (_event: IpcMainInvokeEvent, id: string, isArchived: boolean) => {
        return await databaseService.archiveChat(id, isArchived)
    }, { success: false }))

    ipcMain.handle('db:getChat', createSafeIpcHandler('db:getChat', async (_event: IpcMainInvokeEvent, id: string) => {
        return await databaseService.getChat(id)
    }, null))

    ipcMain.handle('db:getAllChats', createSafeIpcHandler('db:getAllChats', async () => {
        return await databaseService.getAllChats()
    }, []))

    ipcMain.handle('db:addMessage', createSafeIpcHandler('db:addMessage', async (_event: IpcMainInvokeEvent, message: Message & { vector?: number[] }) => {
        if (embeddingService) {
            try {
                // Generate embedding for "context search" later
                // Only for user/assistant messages with meaningful content
                if (message.content && (message.role === 'user' || message.role === 'assistant')) {
                    // Handle both string and array content types
                    const contentStr = typeof message.content === 'string'
                        ? message.content
                        : Array.isArray(message.content)
                            ? message.content.filter(p => p.type === 'text').map(p => p.text || '').join(' ')
                            : ''
                    if (contentStr) {
                        const vector = await embeddingService.generateEmbedding(contentStr)
                        message.vector = vector
                    }
                }
            } catch (error) {
                // Log but don't fail the message addition if embedding fails
                console.error('[DB IPC] Failed to generate embedding for message:', error)
            }
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
        } as JsonObject
        return await databaseService.addMessage(dbMessage)
    }, { success: false, id: '' }))

    ipcMain.handle('db:getMessages', createSafeIpcHandler('db:getMessages', async (_event: IpcMainInvokeEvent, chatId: string) => {
        return await databaseService.getMessages(chatId)
    }, []))

    ipcMain.handle('db:getStats', createSafeIpcHandler('db:getStats', async () => {
        return await databaseService.getStats()
    }, { chatCount: 0, messageCount: 0, dbSize: 0 }))

    ipcMain.handle('db:getDetailedStats', createSafeIpcHandler('db:getDetailedStats', async (_event: IpcMainInvokeEvent, period: string) => {
        return await databaseService.getDetailedStats(period as "daily" | "weekly" | "monthly" | "yearly" | undefined)
    }, null))

    ipcMain.handle('db:getProjects', createSafeIpcHandler('db:getProjects', async () => {
        return await databaseService.getProjects()
    }, []))

    ipcMain.handle('db:createProject', createIpcHandler('db:createProject', async (_event: IpcMainInvokeEvent, name: string, path: string, desc: string, mounts: WorkspaceMount[]) => {
        return await databaseService.createProject(name, path, desc, JSON.stringify(mounts), undefined)
    }))

    ipcMain.handle('db:updateProject', createSafeIpcHandler('db:updateProject', async (_event: IpcMainInvokeEvent, id: string, updates: Partial<Project>) => {
        // Convert Date to number for database
        const dbUpdates: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(updates)) {
            if (value instanceof Date) {
                dbUpdates[key] = value.getTime()
            } else {
                dbUpdates[key] = value
            }
        }
        return await databaseService.updateProject(id, dbUpdates as JsonObject)
    }, undefined))

    ipcMain.handle('db:deleteProject', createIpcHandler('db:deleteProject', async (_event: IpcMainInvokeEvent, id: string) => {
        try {
            await databaseService.deleteProject(id)
            if (auditLogService) {
                await auditLogService.log({
                    action: 'deleteProject',
                    category: 'data',
                    details: { projectId: id },
                    success: true
                })
            }
        } catch (error) {
            if (auditLogService) {
                await auditLogService.log({
                    action: 'deleteProject',
                    category: 'data',
                    details: { projectId: id },
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                })
            }
            throw error
        }
    }))

    ipcMain.handle('db:archiveProject', createIpcHandler('db:archiveProject', async (_event: IpcMainInvokeEvent, id: string, isArchived: boolean) => {
        return await databaseService.archiveProject(id, isArchived)
    }))

    ipcMain.handle('db:deleteMessage', createSafeIpcHandler('db:deleteMessage', async (_event: IpcMainInvokeEvent, id: string) => {
        try {
            const result = await databaseService.deleteMessage(id)
            if (auditLogService && result.success) {
                await auditLogService.log({
                    action: 'deleteMessage',
                    category: 'data',
                    details: { messageId: id },
                    success: true
                })
            }
            return result
        } catch (error) {
            if (auditLogService) {
                await auditLogService.log({
                    action: 'deleteMessage',
                    category: 'data',
                    details: { messageId: id },
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                })
            }
            throw error
        }
    }, { success: false }))

    ipcMain.handle('db:deleteMessages', createSafeIpcHandler('db:deleteMessages', async (_event: IpcMainInvokeEvent, chatId: string) => {
        try {
            const result = await databaseService.deleteMessagesByChatId(chatId)
            if (auditLogService && result.success) {
                await auditLogService.log({
                    action: 'deleteMessages',
                    category: 'data',
                    details: { chatId },
                    success: true
                })
            }
            return result
        } catch (error) {
            if (auditLogService) {
                await auditLogService.log({
                    action: 'deleteMessages',
                    category: 'data',
                    details: { chatId },
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                })
            }
            throw error
        }
    }, { success: false }))

    ipcMain.handle('db:updateMessage', createSafeIpcHandler('db:updateMessage', async (_event: IpcMainInvokeEvent, id: string, updates: Partial<Message>) => {
        return await databaseService.updateMessage(id, updates as JsonObject)
    }, { success: false }))

    ipcMain.handle('db:deleteAllChats', createSafeIpcHandler('db:deleteAllChats', async () => {
        try {
            const result = await databaseService.deleteAllChats()
            if (auditLogService && result.success) {
                await auditLogService.log({
                    action: 'deleteAllChats',
                    category: 'data',
                    details: {},
                    success: true
                })
            }
            return result
        } catch (error) {
            if (auditLogService) {
                await auditLogService.log({
                    action: 'deleteAllChats',
                    category: 'data',
                    details: {},
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                })
            }
            throw error
        }
    }, { success: false }))

    ipcMain.handle('db:deleteChatsByTitle', createSafeIpcHandler('db:deleteChatsByTitle', async (_event: IpcMainInvokeEvent, title: string) => {
        return await databaseService.deleteChatsByTitle(title)
    }, { success: false }))

    // Folders
    ipcMain.handle('db:createFolder', createSafeIpcHandler('db:createFolder', async (_event: IpcMainInvokeEvent, name: string, color: string) => {
        return await databaseService.createFolder(name, color)
    }, null))

    ipcMain.handle('db:deleteFolder', createIpcHandler('db:deleteFolder', async (_event: IpcMainInvokeEvent, id: string) => {
        await databaseService.deleteFolder(id)
        return { success: true }
    }))

    ipcMain.handle('db:updateFolder', createSafeIpcHandler('db:updateFolder', async (_event: IpcMainInvokeEvent, id: string, updates: Partial<Folder>) => {
        // Convert Date to number for database
        const dbUpdates: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(updates)) {
            if (value instanceof Date) {
                dbUpdates[key] = value.getTime()
            } else {
                dbUpdates[key] = value
            }
        }
        return await databaseService.updateFolder(id, dbUpdates as JsonObject)
    }, null))

    ipcMain.handle('db:getFolders', createSafeIpcHandler('db:getFolders', async () => {
        return await databaseService.getFolders()
    }, []))

    // Prompts
    ipcMain.handle('db:createPrompt', createSafeIpcHandler('db:createPrompt', async (_event: IpcMainInvokeEvent, title: string, content: string, tags: string[]) => {
        return await databaseService.createPrompt(title, content, tags)
    }, null))

    ipcMain.handle('db:deletePrompt', createSafeIpcHandler('db:deletePrompt', async (_event: IpcMainInvokeEvent, id: string) => {
        await databaseService.deletePrompt(id)
        return { success: true }
    }, { success: false }))

    ipcMain.handle('db:updatePrompt', createSafeIpcHandler('db:updatePrompt', async (_event: IpcMainInvokeEvent, id: string, updates: Partial<Prompt>) => {
        return await databaseService.updatePrompt(id, updates)
    }, null))

    ipcMain.handle('db:getPrompts', createSafeIpcHandler('db:getPrompts', async () => {
        return await databaseService.getPrompts()
    }, []))

    ipcMain.handle('db:getTimeStats', createSafeIpcHandler('db:getTimeStats', async () => {
        return await databaseService.getTimeStats()
    }, { totalOnlineTime: 0, totalCodingTime: 0, projectCodingTime: {} }))

    // Bookmarked messages
    ipcMain.handle('db:getBookmarkedMessages', createSafeIpcHandler('db:getBookmarkedMessages', async () => {
        return await databaseService.getBookmarkedMessages()
    }, []))

    // Search chats with filters
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
        return await databaseService.searchChats(options)
    }, []))
}
