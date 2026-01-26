import { ProxyService } from '@main/services/proxy/proxy.service';
import { ipcMain } from 'electron';

export function registerProxyEmbedIpc(proxyService: ProxyService) {
    ipcMain.handle('proxy:embed:start', async (_event, args?: { port?: number }) => {
        return await proxyService.startEmbeddedProxy(args);
    });

    ipcMain.handle('proxy:embed:stop', async () => {
        return await proxyService.stopEmbeddedProxy();
    });

    ipcMain.handle('proxy:embed:status', () => {
        return proxyService.getEmbeddedProxyStatus();
    });
}
