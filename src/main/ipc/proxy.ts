import { ipcMain } from 'electron'
import { ProxyService } from '@main/services/proxy/proxy.service'
import { ProxyProcessManager } from '@main/services/proxy/proxy-process.manager'

export function registerProxyIpc(proxyService: ProxyService, processManager?: ProxyProcessManager) {
    ipcMain.handle('proxy:antigravityLogin', async () => {
        return await proxyService.getAntigravityAuthUrl()
    })

    ipcMain.handle('proxy:claudeLogin', async () => {
        return await proxyService.getAnthropicAuthUrl()
    })

    ipcMain.handle('proxy:anthropicLogin', async () => {
        return await proxyService.getAnthropicAuthUrl()
    })

    ipcMain.handle('proxy:codexLogin', async () => {
        return await proxyService.getCodexAuthUrl()
    })

    ipcMain.handle('proxy:checkAuthStatus', async () => {
        return await proxyService.getAuthFiles()
    })

    ipcMain.handle('proxy:getModels', async () => {
        return await proxyService.getModels()
    })

    ipcMain.handle('proxy:getQuota', async () => {
        return await proxyService.getQuota()
    })

    ipcMain.handle('proxy:getCopilotQuota', async () => {
        return await proxyService.getCopilotQuota()
    })

    ipcMain.handle('proxy:getCodexUsage', async () => {
        return await proxyService.getCodexUsage()
    })

    ipcMain.handle('proxy:getClaudeQuota', async () => {
        return await proxyService.getClaudeQuota()
    })

    ipcMain.handle('proxy:deleteAuthFile', async (_event, name: string) => {
        return await proxyService.deleteAuthFile(name)
    })

    // Sync auth files from temp to permanent storage after OAuth callbacks
    ipcMain.handle('proxy:syncAuthFiles', async () => {
        if (processManager) {
            await processManager.forceSyncAuthFiles()
            return { success: true }
        }
        return { success: false, error: 'Process manager not available' }
    })
}
