/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
