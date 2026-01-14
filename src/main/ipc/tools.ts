import { ipcMain } from 'electron'
import { CommandService } from '@main/services/system/command.service'
import { ToolExecutor } from '@main/tools/tool-executor'
import { JsonObject } from '@shared/types/common'

export function registerToolsIpc(toolExecutor: ToolExecutor, commandService: CommandService) {
    ipcMain.handle('tools:execute', async (_event, toolName: string, args: JsonObject) => {
        return await toolExecutor.execute(toolName, args)
    })

    ipcMain.handle('tools:kill', (_event, toolCallId: string) => {
        return commandService.killCommand(toolCallId)
    })

    ipcMain.handle('tools:getDefinitions', () => {
        console.log('[Main] tools:getDefinitions called')
        try {
            const defs = toolExecutor.getToolDefinitions()
            console.log('[Main] tool definitions returned:', defs ? defs.length : 'null')
            return defs
        } catch (e) {
            console.error('[Main] tools:getDefinitions error:', e)
            return []
        }
    })
}
