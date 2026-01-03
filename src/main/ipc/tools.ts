import { ipcMain } from 'electron'
import { CommandService } from '../services/command.service'
import { ToolExecutor } from '../tools/tool-executor'

export function registerToolsIpc(toolExecutor: ToolExecutor, commandService: CommandService) {
    ipcMain.handle('tools:execute', async (_event, toolName: string, args: any, toolCallId?: string) => {
        return await toolExecutor.execute(toolName, args, toolCallId)
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
