import { appLogger } from '@main/logging/logger'
import { CommandService } from '@main/services/system/command.service'
import { ToolExecutor } from '@main/tools/tool-executor'
import { JsonObject } from '@shared/types/common'
import { ipcMain } from 'electron'

export function registerToolsIpc(toolExecutor: ToolExecutor, commandService: CommandService) {
    ipcMain.handle('tools:execute', async (_event, toolName: string, args: JsonObject) => {
        return await toolExecutor.execute(toolName, args)
    })

    ipcMain.handle('tools:kill', (_event, toolCallId: string) => {
        return commandService.killCommand(toolCallId)
    })

    ipcMain.handle('tools:getDefinitions', async () => {
        appLogger.info('tools', '[Main] tools:getDefinitions called')
        try {
            const defs = await toolExecutor.getToolDefinitions()
            appLogger.info('tools', '[Main] tool definitions returned:', defs.length)
            return defs
        } catch (e) {
            console.error('[Main] tools:getDefinitions error:', e)
            return []
        }
    })
}
