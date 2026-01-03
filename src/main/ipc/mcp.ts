import { ipcMain } from 'electron'
import { McpDispatcher } from '../mcp/dispatcher'

export function registerMcpIpc(mcpDispatcher: McpDispatcher) {
    ipcMain.handle('mcp:list', () => {
        return mcpDispatcher.listServices()
    })

    ipcMain.handle('mcp:dispatch', async (event, service: string, action: string, args: any) => {
        const result = await mcpDispatcher.dispatch(service, action, args)
        try {
            event.sender.send('mcp:result', result)
        } catch (e) {
            console.warn('Failed to send MCP result event', e)
        }
        return result
    })

    ipcMain.handle('mcp:toggle', (_event, service: string, enabled: boolean) => {
        return mcpDispatcher.toggleService(service, enabled)
    })

    ipcMain.handle('mcp:install', (_event, config: any) => {
        return mcpDispatcher.installService(config)
    })

    ipcMain.handle('mcp:uninstall', (_event, name: string) => {
        return mcpDispatcher.uninstallService(name)
    })
}
