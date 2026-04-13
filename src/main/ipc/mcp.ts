import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { appLogger } from '@main/logging/logger';
import { McpDispatcher } from '@main/mcp/dispatcher';
import { createIpcHandler as baseCreateIpcHandler, createSafeIpcHandler as baseCreateSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { withOperationGuard } from '@main/utils/operation-wrapper.util';
import { MCPServerConfig } from '@shared/types';
import { JsonObject } from '@shared/types/common';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';

/** Maximum service name length */
const MAX_SERVICE_NAME_LENGTH = 128;
/** Maximum action name length */
const MAX_ACTION_NAME_LENGTH = 128;

/**
 * Validates a service name
 */
function validateServiceName(value: RuntimeValue): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_SERVICE_NAME_LENGTH) {
        return null;
    }
    return trimmed;
}

/**
 * Validates an action name
 */
function validateActionName(value: RuntimeValue): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_ACTION_NAME_LENGTH) {
        return null;
    }
    return trimmed;
}

/**
 * Validates args object
 */
function validateArgs(value: RuntimeValue): JsonObject {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    return value as JsonObject;
}

/**
 * Registers IPC handlers for MCP operations
 */
export function registerMcpIpc(mcpDispatcher: McpDispatcher, getMainWindow: () => BrowserWindow | null) {
    appLogger.debug('McpIPC', 'Registering MCP IPC handlers');
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'mcp operation');
    const createIpcHandler = <T = RuntimeValue, Args extends RuntimeValue[] = RuntimeValue[]>(
        channel: string,
        handler: (event: IpcMainInvokeEvent, ...args: Args) => Promise<T>
    ) => baseCreateIpcHandler<T, Args>(channel, async (event, ...args) => {
        validateSender(event);
        return await handler(event, ...args);
    });
    const createSafeIpcHandler = <T = RuntimeValue, Args extends RuntimeValue[] = RuntimeValue[]>(
        channel: string,
        handler: (event: IpcMainInvokeEvent, ...args: Args) => Promise<T>,
        defaultValue: T
    ) => baseCreateSafeIpcHandler<T, Args>(channel, async (event, ...args) => {
        validateSender(event);
        return await handler(event, ...args);
    }, defaultValue);

    ipcMain.handle('mcp:list', createSafeIpcHandler('mcp:list',
        async () => {
            return mcpDispatcher.listServices();
        }, []
    ));

    ipcMain.handle('mcp:dispatch', createIpcHandler('mcp:dispatch',
        async (event: IpcMainInvokeEvent, serviceRaw: RuntimeValue, actionRaw: RuntimeValue, argsRaw: RuntimeValue) => {
            const service = validateServiceName(serviceRaw);
            const action = validateActionName(actionRaw);
            if (!service || !action) {
                throw new Error('Invalid service or action name');
            }
            const args = validateArgs(argsRaw);
            const result = await withOperationGuard('mcp', async () =>
                mcpDispatcher.dispatch(service, action, args)
            );
            event.sender.send('mcp:result', result);
            return result;
        }
    ));

    ipcMain.handle('mcp:toggle', createIpcHandler('mcp:toggle',
        async (_event: IpcMainInvokeEvent, serviceRaw: RuntimeValue, enabledRaw: RuntimeValue) => {
            const service = validateServiceName(serviceRaw);
            if (!service) {
                throw new Error('Invalid service name');
            }
            const enabled = enabledRaw === true;
            return mcpDispatcher.toggleService(service, enabled);
        }
    ));

    ipcMain.handle('mcp:install', createIpcHandler('mcp:install',
        async (_event: IpcMainInvokeEvent, config: MCPServerConfig) => {
            if (!config || typeof config !== 'object') {
                throw new Error('Invalid MCP server config');
            }
            return mcpDispatcher.installService(config);
        }
    ));

    ipcMain.handle('mcp:uninstall', createIpcHandler('mcp:uninstall',
        async (_event: IpcMainInvokeEvent, nameRaw: RuntimeValue) => {
            const name = validateServiceName(nameRaw);
            if (!name) {
                throw new Error('Invalid service name');
            }
            return mcpDispatcher.uninstallService(name);
        }
    ));

    ipcMain.handle('mcp:debug-metrics', createSafeIpcHandler('mcp:debug-metrics',
        async () => {
            return mcpDispatcher.getDebugMetrics();
        }, []
    ));

    ipcMain.handle('mcp:permissions:list-requests', createSafeIpcHandler('mcp:permissions:list-requests',
        async () => {
            return mcpDispatcher.getPermissionRequests();
        }, []
    ));

    ipcMain.handle('mcp:permissions:set', createIpcHandler('mcp:permissions:set',
        async (_event: IpcMainInvokeEvent, serviceRaw: RuntimeValue, actionRaw: RuntimeValue, policyRaw: RuntimeValue) => {
            const service = validateServiceName(serviceRaw);
            const action = validateActionName(actionRaw);
            if (!service || !action) {
                throw new Error('Invalid service/action');
            }

            if (policyRaw !== 'allow' && policyRaw !== 'deny' && policyRaw !== 'ask') {
                throw new Error('Invalid permission policy');
            }

            return mcpDispatcher.setActionPermission(service, action, policyRaw);
        }
    ));

    ipcMain.handle('mcp:permissions:resolve-request', createIpcHandler('mcp:permissions:resolve-request',
        async (_event: IpcMainInvokeEvent, requestIdRaw: RuntimeValue, decisionRaw: RuntimeValue) => {
            if (typeof requestIdRaw !== 'string' || requestIdRaw.trim().length === 0) {
                throw new Error('Invalid request id');
            }
            if (decisionRaw !== 'approved' && decisionRaw !== 'denied') {
                throw new Error('Invalid decision');
            }
            return mcpDispatcher.resolvePermissionRequest(requestIdRaw, decisionRaw);
        }
    ));
}
