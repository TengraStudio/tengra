import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { DatabaseService } from '../services/data/database.service'
import { EmbeddingService } from '../services/llm/embedding.service'
import { createIpcHandler, createSafeIpcHandler } from '../utils/ipc-wrapper.util'

export function registerDbIpc(databaseService: DatabaseService, embeddingService?: EmbeddingService) {
    ipcMain.handle('db:createChat', createSafeIpcHandler('db:createChat', async (_event: IpcMainInvokeEvent, chat: any) => {
        return await databaseService.createChat(chat)
    }, { success: false }))
    
    ipcMain.handle('db:updateChat', createSafeIpcHandler('db:updateChat', async (_event: IpcMainInvokeEvent, id: string, updates: any) => {
        return await databaseService.updateChat(id, updates)
    }, { success: false }))
    
    ipcMain.handle('db:deleteChat', createSafeIpcHandler('db:deleteChat', async (_event: IpcMainInvokeEvent, id: string) => {
        return await databaseService.deleteChat(id)
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
    
    ipcMain.handle('db:searchChats', createSafeIpcHandler('db:searchChats', async (_event: IpcMainInvokeEvent, query: string) => {
        return await databaseService.searchChats(query)
    }, []))
    ipcMain.handle('db:addMessage', createSafeIpcHandler('db:addMessage', async (_event: IpcMainInvokeEvent, message: any) => {
        if (embeddingService) {
            try {
                // Generate embedding for "context search" later
                // Only for user/assistant messages with meaningful content
                if (message.content && (message.role === 'user' || message.role === 'assistant')) {
                    const vector = await embeddingService.generateEmbedding(message.content)
                    message.vector = vector
                }
            } catch (error) {
                // Log but don't fail the message addition if embedding fails
                console.error('[DB IPC] Failed to generate embedding for message:', error)
            }
        }
        return await databaseService.addMessage(message)
    }, { success: false }))
    
    ipcMain.handle('db:getMessages', createSafeIpcHandler('db:getMessages', async (_event: IpcMainInvokeEvent, chatId: string) => {
        return await databaseService.getChatMessages(chatId)
    }, []))
    
    ipcMain.handle('db:getStats', createSafeIpcHandler('db:getStats', async () => {
        return await databaseService.getStats()
    }, { chatCount: 0, messageCount: 0, dbSize: 0 }))
    
    ipcMain.handle('db:getDetailedStats', createSafeIpcHandler('db:getDetailedStats', async (_event: IpcMainInvokeEvent, period: string) => {
        return await databaseService.getDetailedStats(period)
    }, null))
    
    ipcMain.handle('db:getProjects', createSafeIpcHandler('db:getProjects', async () => {
        return await databaseService.getProjects()
    }, []))
    
    ipcMain.handle('db:createProject', createIpcHandler('db:createProject', async (_event: IpcMainInvokeEvent, name: string, path: string, desc: string, mounts: any) => {
        return await databaseService.createProject(name, path, desc, mounts)
    }))
    
    ipcMain.handle('db:updateProject', createSafeIpcHandler('db:updateProject', async (_event: IpcMainInvokeEvent, id: string, updates: any) => {
        return await databaseService.updateProject(id, updates)
    }, undefined))
    
    ipcMain.handle('db:deleteProject', createIpcHandler('db:deleteProject', async (_event: IpcMainInvokeEvent, id: string) => {
        return await databaseService.deleteProject(id)
    }))
    
    ipcMain.handle('db:archiveProject', createIpcHandler('db:archiveProject', async (_event: IpcMainInvokeEvent, id: string, isArchived: boolean) => {
        return await databaseService.archiveProject(id, isArchived)
    }))
    
    ipcMain.handle('db:deleteMessage', createSafeIpcHandler('db:deleteMessage', async (_event: IpcMainInvokeEvent, id: string) => {
        return await databaseService.deleteMessage(id)
    }, { success: false }))
    
    ipcMain.handle('db:deleteMessages', createSafeIpcHandler('db:deleteMessages', async (_event: IpcMainInvokeEvent, chatId: string) => {
        return await databaseService.deleteMessages(chatId)
    }, { success: false }))
    
    ipcMain.handle('db:updateMessage', createSafeIpcHandler('db:updateMessage', async (_event: IpcMainInvokeEvent, id: string, updates: any) => {
        return await databaseService.updateMessage(id, updates)
    }, { success: false }))
    
    ipcMain.handle('db:deleteAllChats', createSafeIpcHandler('db:deleteAllChats', async () => {
        return await databaseService.deleteAllChats()
    }, { success: false }))
    
    ipcMain.handle('db:deleteChatsByTitle', createSafeIpcHandler('db:deleteChatsByTitle', async (_event: IpcMainInvokeEvent, title: string) => {
        return await databaseService.deleteChatsByTitle(title)
    }, { success: false }))

    // Folders
    ipcMain.handle('db:createFolder', createSafeIpcHandler('db:createFolder', async (_event: IpcMainInvokeEvent, name: string, color: string) => {
        return await databaseService.createFolder(name, color)
    }, null))
    
    ipcMain.handle('db:deleteFolder', createSafeIpcHandler('db:deleteFolder', async (_event: IpcMainInvokeEvent, id: string) => {
        return await databaseService.deleteFolder(id)
    }, { success: false }))
    
    ipcMain.handle('db:updateFolder', createSafeIpcHandler('db:updateFolder', async (_event: IpcMainInvokeEvent, id: string, updates: any) => {
        return await databaseService.updateFolder(id, updates)
    }, null))
    
    ipcMain.handle('db:getFolders', createSafeIpcHandler('db:getFolders', async () => {
        return await databaseService.getAllFolders()
    }, []))

    // Prompts
    ipcMain.handle('db:createPrompt', createSafeIpcHandler('db:createPrompt', async (_event: IpcMainInvokeEvent, title: string, content: string, tags: string[]) => {
        return await databaseService.createPrompt(title, content, tags)
    }, null))
    
    ipcMain.handle('db:deletePrompt', createSafeIpcHandler('db:deletePrompt', async (_event: IpcMainInvokeEvent, id: string) => {
        return await databaseService.deletePrompt(id)
    }, { success: false }))
    
    ipcMain.handle('db:updatePrompt', createSafeIpcHandler('db:updatePrompt', async (_event: IpcMainInvokeEvent, id: string, updates: any) => {
        return await databaseService.updatePrompt(id, updates)
    }, null))
    
    ipcMain.handle('db:getPrompts', createSafeIpcHandler('db:getPrompts', async () => {
        return await databaseService.getPrompts()
    }, []))

    ipcMain.handle('db:getTimeStats', createSafeIpcHandler('db:getTimeStats', async () => {
        return await databaseService.getTimeStats()
    }, { totalOnlineTime: 0, totalCodingTime: 0, projectCodingTime: {} }))
}
