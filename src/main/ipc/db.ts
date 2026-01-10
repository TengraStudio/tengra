import { ipcMain } from 'electron'
import { DatabaseService } from '../services/data/database.service'
import { EmbeddingService } from '../services/llm/embedding.service'
import { getErrorMessage } from '../../shared/utils/error.util'

export function registerDbIpc(databaseService: DatabaseService, embeddingService?: EmbeddingService) {
    ipcMain.handle('db:createChat', async (_event, chat) => {
        try { return await databaseService.createChat(chat) }
        catch (e) { console.error('[IPC] db:createChat failed:', getErrorMessage(e as Error)); return { success: false } }
    })
    ipcMain.handle('db:updateChat', async (_event, id, updates) => {
        try { return await databaseService.updateChat(id, updates) }
        catch (e) { console.error('[IPC] db:updateChat failed:', getErrorMessage(e as Error)); return { success: false } }
    })
    ipcMain.handle('db:deleteChat', async (_event, id) => {
        try { return await databaseService.deleteChat(id) }
        catch (e) { console.error('[IPC] db:deleteChat failed:', getErrorMessage(e as Error)); return { success: false } }
    })
    ipcMain.handle('db:duplicateChat', async (_event, id) => {
        try { return await databaseService.duplicateChat(id) }
        catch (e) { console.error('[IPC] db:duplicateChat failed:', getErrorMessage(e as Error)); return null }
    })
    ipcMain.handle('db:archiveChat', async (_event, id, isArchived) => {
        try { return await databaseService.archiveChat(id, isArchived) }
        catch (e) { console.error('[IPC] db:archiveChat failed:', getErrorMessage(e as Error)); return { success: false } }
    })
    ipcMain.handle('db:getChat', async (_event, id) => {
        try { return await databaseService.getChat(id) }
        catch (e) { console.error('[IPC] db:getChat failed:', getErrorMessage(e as Error)); return null }
    })
    ipcMain.handle('db:getAllChats', async () => {
        try { return await databaseService.getAllChats() }
        catch (e) { console.error('[IPC] db:getAllChats failed:', getErrorMessage(e as Error)); return [] }
    })
    ipcMain.handle('db:searchChats', async (_event, query) => {
        try { return await databaseService.searchChats(query) }
        catch (e) { console.error('[IPC] db:searchChats failed:', getErrorMessage(e as Error)); return [] }
    })
    ipcMain.handle('db:addMessage', async (_event, message) => {
        if (embeddingService) {
            try {
                // Generate embedding for "context search" later
                // Only for user/assistant messages with meaningful content
                if (message.content && (message.role === 'user' || message.role === 'assistant')) {
                    const vector = await embeddingService.generateEmbedding(message.content)
                    message.vector = vector
                }
            } catch (error) {
                console.error('[DB IPC] Failed to generate embedding for message:', getErrorMessage(error as Error))
            }
        }
        try {
            return await databaseService.addMessage(message)
        } catch (e) {
            console.error('[IPC] db:addMessage failed:', getErrorMessage(e as Error))
            return { success: false }
        }
    })
    ipcMain.handle('db:getMessages', async (_event, chatId) => {
        try { return await databaseService.getChatMessages(chatId) }
        catch (e) { console.error('[IPC] db:getMessages failed:', getErrorMessage(e as Error)); return [] }
    })
    ipcMain.handle('db:getStats', async () => {
        try { return await databaseService.getStats() }
        catch (e) { console.error('[IPC] db:getStats failed:', getErrorMessage(e as Error)); return { chatCount: 0, messageCount: 0, dbSize: 0 } }
    })
    ipcMain.handle('db:getDetailedStats', async (_event, period) => {
        try { return await databaseService.getDetailedStats(period) }
        catch (e) { console.error('[IPC] db:getDetailedStats failed:', getErrorMessage(e as Error)); return null }
    })
    ipcMain.handle('db:getProjects', async () => {
        try { return await databaseService.getProjects() }
        catch (e) { console.error('[IPC] db:getProjects failed:', getErrorMessage(e as Error)); return [] }
    })
    ipcMain.handle('db:createProject', async (_event, name, path, desc, mounts) => {
        try { return await databaseService.createProject(name, path, desc, mounts) }
        catch (e) { console.error('[IPC] db:createProject failed:', getErrorMessage(e as Error)); throw e }
    })
    ipcMain.handle('db:updateProject', async (_event, id, updates) => {
        try { return await databaseService.updateProject(id, updates) }
        catch (e) { console.error('[IPC] db:updateProject failed:', getErrorMessage(e as Error)); return undefined }
    })
    ipcMain.handle('db:deleteProject', async (_event, id) => {
        try { return await databaseService.deleteProject(id) }
        catch (e) { console.error('[IPC] db:deleteProject failed:', getErrorMessage(e as Error)) }
    })
    ipcMain.handle('db:archiveProject', async (_event, id, isArchived) => {
        try { return await databaseService.archiveProject(id, isArchived) }
        catch (e) { console.error('[IPC] db:archiveProject failed:', getErrorMessage(e as Error)) }
    })
    ipcMain.handle('db:deleteMessage', async (_event, id) => {
        try { return await databaseService.deleteMessage(id) }
        catch (e) { console.error('[IPC] db:deleteMessage failed:', getErrorMessage(e as Error)); return { success: false } }
    })
    ipcMain.handle('db:deleteMessages', async (_event, chatId) => {
        try { return await databaseService.deleteMessages(chatId) }
        catch (e) { console.error('[IPC] db:deleteMessages failed:', getErrorMessage(e as Error)); return { success: false } }
    })
    ipcMain.handle('db:updateMessage', async (_event, id, updates) => {
        try { return await databaseService.updateMessage(id, updates) }
        catch (e) { console.error('[IPC] db:updateMessage failed:', getErrorMessage(e as Error)); return { success: false } }
    })
    ipcMain.handle('db:deleteAllChats', async () => {
        try { return await databaseService.deleteAllChats() }
        catch (e) { console.error('[IPC] db:deleteAllChats failed:', getErrorMessage(e as Error)); return { success: false } }
    })
    ipcMain.handle('db:deleteChatsByTitle', async (_event, title) => {
        try { return await databaseService.deleteChatsByTitle(title) }
        catch (e) { console.error('[IPC] db:deleteChatsByTitle failed:', getErrorMessage(e as Error)); return { success: false } }
    })

    // Folders
    ipcMain.handle('db:createFolder', async (_event, name, color) => {
        try { return await databaseService.createFolder(name, color) }
        catch (e) { console.error('[IPC] db:createFolder failed:', getErrorMessage(e as Error)); return null }
    })
    ipcMain.handle('db:deleteFolder', async (_event, id) => {
        try { return await databaseService.deleteFolder(id) }
        catch (e) { console.error('[IPC] db:deleteFolder failed:', getErrorMessage(e as Error)); return { success: false } }
    })
    ipcMain.handle('db:updateFolder', async (_event, id, updates) => {
        try { return await databaseService.updateFolder(id, updates) }
        catch (e) { console.error('[IPC] db:updateFolder failed:', getErrorMessage(e as Error)); return null }
    })
    ipcMain.handle('db:getFolders', async () => {
        try { return await databaseService.getAllFolders() }
        catch (e) { console.error('[IPC] db:getFolders failed:', getErrorMessage(e as Error)); return [] }
    })

    // Prompts
    ipcMain.handle('db:createPrompt', async (_event, title, content, tags) => {
        try { return await databaseService.createPrompt(title, content, tags) }
        catch (e) { console.error('[IPC] db:createPrompt failed:', getErrorMessage(e as Error)); return null }
    })
    ipcMain.handle('db:deletePrompt', async (_event, id) => {
        try { return await databaseService.deletePrompt(id) }
        catch (e) { console.error('[IPC] db:deletePrompt failed:', getErrorMessage(e as Error)); return { success: false } }
    })
    ipcMain.handle('db:updatePrompt', async (_event, id, updates) => {
        try { return await databaseService.updatePrompt(id, updates) }
        catch (e) { console.error('[IPC] db:updatePrompt failed:', getErrorMessage(e as Error)); return null }
    })
    ipcMain.handle('db:getPrompts', async () => {
        try { return await databaseService.getPrompts() }
        catch (e) { console.error('[IPC] db:getPrompts failed:', getErrorMessage(e as Error)); return [] }
    })
}
