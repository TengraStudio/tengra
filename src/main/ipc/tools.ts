import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { appLogger } from '@main/logging/logger';
import { CommandService } from '@main/services/system/command.service';
import { ToolExecutor } from '@main/tools/tool-executor';
import { createSafeIpcHandler, createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { withRateLimit } from '@main/utils/rate-limiter.util';
import { TOOLS_CHANNELS } from '@shared/constants/ipc-channels';
import { JsonObject } from '@shared/types/common';
import { BrowserWindow, ipcMain } from 'electron';
import { z } from 'zod';

import { toolArgsSchema, toolCallIdSchema, toolNameSchema } from './validation';

const toolExecuteRequestSchema = z.object({
    toolName: toolNameSchema,
    args: toolArgsSchema,
    toolCallId: toolCallIdSchema.optional(),
});

const toolExecuteResponseSchema = z.object({
    success: z.boolean(),
    result: z.unknown().optional(),
    error: z.string().optional(),
    errorType: z.enum(['timeout', 'limit', 'permission', 'notFound', 'unknown']).optional(),
});

export function registerToolsIpc(getMainWindow: () => BrowserWindow | null, toolExecutor: ToolExecutor, commandService: CommandService) {
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'tools operation');

    ipcMain.handle('tools:execute', createValidatedIpcHandler('tools:execute', async (event, payload: {
        toolName: string;
        args: JsonObject;
        toolCallId?: string;
    }) => {
        validateSender(event);
        return await withRateLimit('tools', () => toolExecutor.execute(payload.toolName, payload.args));
    }, {
        argsSchema: z.tuple([toolExecuteRequestSchema]),
        responseSchema: toolExecuteResponseSchema
    }));

    ipcMain.handle('tools:kill', createValidatedIpcHandler('tools:kill', async (event, toolCallId: string) => {
        validateSender(event);
        return commandService.killCommand(toolCallId);
    }, {
        argsSchema: z.tuple([toolCallIdSchema])
    }));

    ipcMain.handle(TOOLS_CHANNELS.GET_DEFINITIONS, createSafeIpcHandler(TOOLS_CHANNELS.GET_DEFINITIONS, async (event) => {
        validateSender(event);
        appLogger.info('tools', `[Main] ${TOOLS_CHANNELS.GET_DEFINITIONS} called`);
        try {
            const defs = await toolExecutor.getToolDefinitions();
            appLogger.info('tools', '[Main] tool definitions returned:', defs.length);
            // Ensure the definitions are serializable by converting to plain JSON
            return JSON.parse(JSON.stringify(defs));
        } catch (e) {
            appLogger.error('tools', `[Main] ${TOOLS_CHANNELS.GET_DEFINITIONS} error:`, e as Error);
            return [];
        }
    }, []));
}
