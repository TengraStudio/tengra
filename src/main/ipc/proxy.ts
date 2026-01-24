import { ProxyService } from '@main/services/proxy/proxy.service'
import { ProxyProcessManager } from '@main/services/proxy/proxy-process.service'
import { AuthService } from '@main/services/security/auth.service'
import { registerBatchableHandler } from '@main/utils/ipc-batch.util'
import { ipcMain } from 'electron'

export function registerProxyIpc(proxyService: ProxyService, _processManager?: ProxyProcessManager, _authService?: AuthService) {
    // Register batchable quota handlers for efficient batch loading
    registerBatchableHandler('getQuota', async () => {
        return await proxyService.getQuota() as any
    })

    registerBatchableHandler('getCopilotQuota', async () => {
        return await proxyService.getCopilotQuota() as any
    })

    registerBatchableHandler('getCodexUsage', async () => {
        return await proxyService.getCodexUsage() as any
    })

    registerBatchableHandler('getClaudeQuota', async () => {
        return await proxyService.getClaudeQuota() as any
    })

    ipcMain.handle('proxy:antigravityLogin', async () => {
        return await proxyService.getAntigravityAuthUrl()
    })

    ipcMain.handle('proxy:claudeLogin', async () => {
        // Try to get OAuth URL (same as anthropicLogin)
        // This will open the browser for OAuth flow
        return await proxyService.getAnthropicAuthUrl()
    })



    ipcMain.handle('proxy:saveClaudeSession', async (_event, sessionKey: string, accountId?: string) => {
        try {
            return await proxyService.quotaService.saveClaudeSession(sessionKey, accountId)
        } catch (error) {
            console.error('Failed to save manual session:', error)
            return { success: false, error: (error as Error).message }
        }
    })



    ipcMain.handle('proxy:anthropicLogin', async () => {
        // Legacy OAuth flow - still available but doesn't capture sessionKey
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

    // Sync auth files - now handled automatically by HTTP auth API
    ipcMain.handle('proxy:syncAuthFiles', async () => {
        // Auth sync is now automatic via HTTP API - no manual sync needed
        return { success: true }
    })
}
