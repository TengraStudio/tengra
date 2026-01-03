import { ipcMain } from 'electron'
import { ProxyEmbedService } from '../services/proxy-embed.service'

export function registerProxyEmbedIpc(proxyEmbedService: ProxyEmbedService) {
    ipcMain.handle('proxy:embed:start', async (_event, args?: { configPath?: string; port?: number; health?: boolean }) => {
        return await proxyEmbedService.start(args)
    })

    ipcMain.handle('proxy:embed:stop', async () => {
        return await proxyEmbedService.stop()
    })

    ipcMain.handle('proxy:embed:status', () => {
        return proxyEmbedService.status()
    })
}
