import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { McpDispatcher } from '../mcp/dispatcher'
import { MCPServerConfig } from '../../shared/types'
import { JsonObject } from '../../shared/types/common'
import { createIpcHandler } from '../utils/ipc-wrapper.util'

export function registerMcpIpc(mcpDispatcher: McpDispatcher) {
    ipcMain.handle('mcp:list', createIpcHandler('mcp:list', async () => {
        return mcpDispatcher.listServices()
    }))

    ipcMain.handle('mcp:dispatch', createIpcHandler('mcp:dispatch', async (event: IpcMainInvokeEvent, service: string, action: string, args: JsonObject) => {
        const result = await mcpDispatcher.dispatch(service, action, args)
        event.sender.send('mcp:result', result)
        return result
    }))

    ipcMain.handle('mcp:toggle', createIpcHandler('mcp:toggle', async (_event: IpcMainInvokeEvent, service: string, enabled: boolean) => {
        return mcpDispatcher.toggleService(service, enabled)
    }))

    ipcMain.handle('mcp:install', createIpcHandler('mcp:install', async (_event: IpcMainInvokeEvent, config: MCPServerConfig) => {
        return mcpDispatcher.installService(config)
    }))

    ipcMain.handle('mcp:uninstall', createIpcHandler('mcp:uninstall', async (_event: IpcMainInvokeEvent, name: string) => {
        return mcpDispatcher.uninstallService(name)
    }))
}
