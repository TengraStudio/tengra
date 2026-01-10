import { ipcMain } from 'electron'
import { McpDispatcher } from '../mcp/dispatcher'
import { MCPServerConfig } from '../../shared/types'
import { JsonObject } from '../../shared/types/common'
import { getErrorMessage } from '../../shared/utils/error.util'

export function registerMcpIpc(mcpDispatcher: McpDispatcher) {
    ipcMain.handle('mcp:list', () => {
        return mcpDispatcher.listServices()
    })

    ipcMain.handle('mcp:dispatch', async (event, service: string, action: string, args: JsonObject) => {
        try {
            const result = await mcpDispatcher.dispatch(service, action, args)
            event.sender.send('mcp:result', result)
            return result
        } catch (err) {
            console.warn('Failed to dispatch MCP action', getErrorMessage(err as Error))
            throw new Error(getErrorMessage(err as Error))
        }
    })

    ipcMain.handle('mcp:toggle', (_event, service: string, enabled: boolean) => {
        return mcpDispatcher.toggleService(service, enabled)
    })

    ipcMain.handle('mcp:install', (_event, config: MCPServerConfig) => {
        return mcpDispatcher.installService(config)
    })

    ipcMain.handle('mcp:uninstall', (_event, name: string) => {
        return mcpDispatcher.uninstallService(name)
    })
}
