import { ipcMain } from 'electron'
import { DatabaseService } from '../services/data/database.service'
import { EmbeddingService } from '../services/llm/embedding.service'

export function registerDbIpc(databaseService: DatabaseService, embeddingService?: EmbeddingService) {
    ipcMain.handle('db:createChat', (_event, chat) => databaseService.createChat(chat))
    ipcMain.handle('db:updateChat', (_event, id, updates) => databaseService.updateChat(id, updates))
    ipcMain.handle('db:deleteChat', (_event, id) => databaseService.deleteChat(id))
    ipcMain.handle('db:duplicateChat', (_event, id) => databaseService.duplicateChat(id))
    ipcMain.handle('db:archiveChat', (_event, id, isArchived) => databaseService.archiveChat(id, isArchived))
    ipcMain.handle('db:getChat', (_event, id) => databaseService.getChat(id))
    ipcMain.handle('db:getAllChats', () => databaseService.getAllChats())
    ipcMain.handle('db:searchChats', (_event, query) => databaseService.searchChats(query))
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
                console.error('[DB IPC] Failed to generate embedding for message:', error)
            }
        }
        return databaseService.addMessage(message)
    })
    ipcMain.handle('db:getMessages', (_event, chatId) => databaseService.getChatMessages(chatId))
    ipcMain.handle('db:getStats', () => databaseService.getStats())
    ipcMain.handle('db:getDetailedStats', (_event, period) => databaseService.getDetailedStats(period))
    ipcMain.handle('db:getProjects', () => databaseService.getProjects())
    ipcMain.handle('db:createProject', (_event, name, path, desc, mounts) => databaseService.createProject(name, path, desc, mounts))
    ipcMain.handle('db:updateProject', (_event, id, updates) => databaseService.updateProject(id, updates))
    ipcMain.handle('db:deleteProject', (_event, id) => databaseService.deleteProject(id))
    ipcMain.handle('db:archiveProject', (_event, id, isArchived) => databaseService.archiveProject(id, isArchived))
    ipcMain.handle('db:deleteMessage', (_event, id) => databaseService.deleteMessage(id))
    ipcMain.handle('db:deleteMessages', (_event, chatId) => databaseService.deleteMessages(chatId))
    ipcMain.handle('db:updateMessage', (_event, id, updates) => databaseService.updateMessage(id, updates))
    ipcMain.handle('db:deleteAllChats', () => databaseService.deleteAllChats())
    ipcMain.handle('db:deleteChatsByTitle', (_event, title) => databaseService.deleteChatsByTitle(title))

    // Folders
    ipcMain.handle('db:createFolder', (_event, name, color) => databaseService.createFolder(name, color))
    ipcMain.handle('db:deleteFolder', (_event, id) => databaseService.deleteFolder(id))
    ipcMain.handle('db:updateFolder', (_event, id, updates) => databaseService.updateFolder(id, updates))
    ipcMain.handle('db:getFolders', () => databaseService.getAllFolders())

    // Prompts
    ipcMain.handle('db:createPrompt', (_event, title, content, tags) => databaseService.createPrompt(title, content, tags))
    ipcMain.handle('db:deletePrompt', (_event, id) => databaseService.deletePrompt(id))
    ipcMain.handle('db:updatePrompt', (_event, id, updates) => databaseService.updatePrompt(id, updates))
    ipcMain.handle('db:getPrompts', () => databaseService.getPrompts())
}
