import { appLogger } from '@main/logging/logger';
import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { CommandService } from '@main/services/system/command.service';
import { ToolExecutor } from '@main/tools/tool-executor';
import { createSafeIpcHandler,createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { withRateLimit } from '@main/utils/rate-limiter.util';
import { JsonObject } from '@shared/types/common';
import { BrowserWindow, ipcMain } from 'electron';
import { z } from 'zod';

import { toolArgsSchema, toolCallIdSchema,toolNameSchema } from './validation';

export function registerToolsIpc(getMainWindow: () => BrowserWindow | null, toolExecutor: ToolExecutor, commandService: CommandService) {
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'tools operation');

    ipcMain.handle('tools:execute', createValidatedIpcHandler('tools:execute', async (event, toolName: string, args: JsonObject) => {
        validateSender(event);
        return await withRateLimit('tools', () => toolExecutor.execute(toolName, args));
    }, {
        argsSchema: z.tuple([toolNameSchema, toolArgsSchema])
    }));

    ipcMain.handle('tools:kill', createValidatedIpcHandler('tools:kill', async (event, toolCallId: string) => {
        validateSender(event);
        return commandService.killCommand(toolCallId);
    }, {
        argsSchema: z.tuple([toolCallIdSchema])
    }));

    ipcMain.handle('tools:getDefinitions', createSafeIpcHandler('tools:getDefinitions', async (event) => {
        validateSender(event);
        appLogger.info('tools', '[Main] tools:getDefinitions called');
        try {
            const defs = await toolExecutor.getToolDefinitions();
            appLogger.info('tools', '[Main] tool definitions returned:', defs.length);
            // Ensure the definitions are serializable by converting to plain JSON
            return JSON.parse(JSON.stringify(defs));
        } catch (e) {
            appLogger.error('tools', '[Main] tools:getDefinitions error:', e as Error);
            return [];
        }
    }, []));
}
