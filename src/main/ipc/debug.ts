import { Container } from '@main/core/container';
import { logDependencyGraph } from '@main/utils/dependency-graph.util';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { ipcMain } from 'electron';

/**
 * Registers a debug IPC handler to dump the service dependency graph.
 * @param container - The DI container instance
 */
export function registerDebugIpc(container: Container): void {
    ipcMain.handle('debug:dependency-graph', createSafeIpcHandler(
        'debug:dependency-graph',
        async (): Promise<string> => {
            return logDependencyGraph(container);
        },
        'Failed to generate dependency graph'
    ));
}
