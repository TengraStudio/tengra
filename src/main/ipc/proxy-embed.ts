import { appLogger } from '@main/logging/logger';
import { ProxyService } from '@main/services/proxy/proxy.service';
import { createIpcHandler, createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { ipcMain, IpcMainInvokeEvent } from 'electron';

/** Minimum allowed port */
const MIN_PORT = 1024;
/** Maximum allowed port */
const MAX_PORT = 65535;

/**
 * Validates proxy start options
 */
function validateStartOptions(value: RuntimeValue): { port?: number } | undefined {
    if (!value || typeof value !== 'object') {
        return undefined;
    }

    const raw = value as Record<string, RuntimeValue>;
    const result: { port?: number } = {};

    if (typeof raw.port === 'number') {
        const port = Math.floor(raw.port);
        if (port >= MIN_PORT && port <= MAX_PORT) {
            result.port = port;
        }
    }

    return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Registers IPC handlers for embedded proxy operations
 */
export function registerProxyEmbedIpc(proxyService: ProxyService): void {
    appLogger.info('ProxyEmbedIPC', 'Registering proxy embed IPC handlers');

    ipcMain.handle(
        'proxy:embed:start',
        createIpcHandler(
            'proxy:embed:start',
            async (_event: IpcMainInvokeEvent, argsRaw: RuntimeValue) => {
                const args = validateStartOptions(argsRaw);
                return await proxyService.startEmbeddedProxy(args);
            }
        )
    );

    ipcMain.handle(
        'proxy:embed:stop',
        createSafeIpcHandler(
            'proxy:embed:stop',
            async () => {
                await proxyService.stopEmbeddedProxy();
            },
            undefined
        )
    );

    ipcMain.handle(
        'proxy:embed:status',
        createSafeIpcHandler(
            'proxy:embed:status',
            async () => {
                return proxyService.getEmbeddedProxyStatus();
            },
            { running: false, port: undefined }
        )
    );
}
