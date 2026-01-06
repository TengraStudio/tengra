import { ipcMain } from 'electron'
import { ProxyService } from '../services/proxy.service'

export function registerProxyIpc(proxyService: ProxyService) {
    ipcMain.handle('proxy:antigravityLogin', async () => {
        return await proxyService.getAntigravityAuthUrl()
    })

    ipcMain.handle('proxy:geminiLogin', async () => {
        // Use custom login to get correct scopes (generative-language) which Cliproxy misses
        return await proxyService.customGeminiLogin()
    })

    ipcMain.handle('proxy:claudeLogin', async () => {
        return await proxyService.getClaudeAuthUrl()
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

    ipcMain.handle('proxy:deleteAuthFile', async (_event, name: string) => {
        return await proxyService.deleteAuthFile(name)
    })
}
