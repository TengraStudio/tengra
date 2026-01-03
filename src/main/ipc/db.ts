import { ipcMain } from 'electron'
import { DatabaseService } from '../services/database.service'

export function registerDbIpc(databaseService: DatabaseService) {
    ipcMain.handle('db:createChat', (_event, chat) => databaseService.createChat(chat))
    ipcMain.handle('db:updateChat', (_event, id, updates) => databaseService.updateChat(id, updates))
    ipcMain.handle('db:deleteChat', (_event, id) => databaseService.deleteChat(id))
    ipcMain.handle('db:duplicateChat', (_event, id) => databaseService.duplicateChat(id))
    ipcMain.handle('db:archiveChat', (_event, id, isArchived) => databaseService.archiveChat(id, isArchived))
    ipcMain.handle('db:getChat', (_event, id) => databaseService.getChat(id))
    ipcMain.handle('db:getAllChats', () => databaseService.getAllChats())
    ipcMain.handle('db:searchChats', (_event, query) => databaseService.searchChats(query))
    ipcMain.handle('db:addMessage', (_event, message) => databaseService.addMessage(message))
    ipcMain.handle('db:getMessages', (_event, chatId) => databaseService.getMessages(chatId))
    ipcMain.handle('db:getStats', () => databaseService.getStats())
    ipcMain.handle('db:getDetailedStats', (_event, period) => databaseService.getDetailedStats(period))
    ipcMain.handle('db:getProjects', () => databaseService.getProjects())
    ipcMain.handle('db:createProject', (_event, name, path, desc, mounts) => databaseService.createProject(name, path, desc, mounts))
    ipcMain.handle('db:updateProject', (_event, id, updates) => databaseService.updateProject(id, updates))
    ipcMain.handle('db:deleteMessage', (_event, id) => databaseService.deleteMessage(id))
    ipcMain.handle('db:updateMessage', (_event, id, updates) => databaseService.updateMessage(id, updates))
    ipcMain.handle('db:deleteAllChats', () => databaseService.deleteAllChats())

    // Folders
    ipcMain.handle('db:createFolder', (_event, name) => databaseService.createFolder(name))
    ipcMain.handle('db:deleteFolder', (_event, id) => databaseService.deleteFolder(id))
    ipcMain.handle('db:updateFolder', (_event, id, name) => databaseService.updateFolder(id, name))
    ipcMain.handle('db:getFolders', () => databaseService.getFolders())
}
