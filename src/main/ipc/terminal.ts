import { appLogger } from '@main/logging/logger';
import { TerminalService } from '@main/services/project/terminal.service';
import { createIpcHandler, createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { withRateLimit } from '@main/utils/rate-limiter.util';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';

export function registerTerminalIpc(getWindow: () => BrowserWindow | null, terminalService: TerminalService) {
    ipcMain.setMaxListeners(60);
    appLogger.info('terminal', '[IPC] Terminal service registered');

    // Check availability
    ipcMain.handle('terminal:isAvailable', createIpcHandler('terminal:isAvailable', async () => {
        return terminalService.isAvailable();
    }));

    // Get available shells
    ipcMain.handle('terminal:getShells', createSafeIpcHandler('terminal:getShells', async () => {
        return terminalService.getAvailableShells();
    }, []));

    // Create session
    ipcMain.handle('terminal:create', createIpcHandler('terminal:create', async (_event: IpcMainInvokeEvent, options: {
        id?: string
        shell?: string
        cwd?: string
        cols?: number
        rows?: number
    }) => {
        // Generate session ID if not provided
        const sessionId = options.id || `term-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        appLogger.info('ipc', `terminal:create called for session ${sessionId}`);

        // Validate cols and rows
        if (options.cols !== undefined) {
            if (!Number.isInteger(options.cols) || options.cols < 1 || options.cols > 500) {
                throw new Error('cols must be an integer between 1 and 500');
            }
        }
        if (options.rows !== undefined) {
            if (!Number.isInteger(options.rows) || options.rows < 1 || options.rows > 200) {
                throw new Error('rows must be an integer between 1 and 200');
            }
        }

        const success = terminalService.createSession({
            ...options,
            id: sessionId,
            onData: (data: string) => {
                getWindow()?.webContents.send(`terminal:data:${sessionId}`, data);
            },
            onExit: (code: number) => {
                getWindow()?.webContents.send('terminal:exit', { id: sessionId, code });
            }
        });
        return success ? sessionId : null;
    }));

    // Close session (alias for kill)
    ipcMain.handle('terminal:close', createSafeIpcHandler('terminal:close', async (_event: IpcMainInvokeEvent, sessionId: string) => {
        return terminalService.kill(sessionId);
    }, false));

    // Write to session
    ipcMain.handle('terminal:write', createSafeIpcHandler('terminal:write', async (_event: IpcMainInvokeEvent, sessionId: string, data: string) => {
        if (typeof data !== 'string') {
            throw new Error('data must be a string');
        }
        if (data.length > 1024 * 1024) { // 1MB limit
            throw new Error('data exceeds maximum size of 1MB');
        }

        return await withRateLimit('terminal', async () => terminalService.write(sessionId, data));
    }, false));

    // Resize session
    ipcMain.handle('terminal:resize', createSafeIpcHandler('terminal:resize', async (_event: IpcMainInvokeEvent, sessionId: string, cols: number, rows: number) => {
        // Validate cols and rows
        if (!Number.isInteger(cols) || cols < 1 || cols > 500) {
            throw new Error('cols must be an integer between 1 and 500');
        }
        if (!Number.isInteger(rows) || rows < 1 || rows > 200) {
            throw new Error('rows must be an integer between 1 and 200');
        }
        return terminalService.resize(sessionId, cols, rows);
    }, false));

    // Kill session
    ipcMain.handle('terminal:kill', createSafeIpcHandler('terminal:kill', async (_event: IpcMainInvokeEvent, sessionId: string) => {
        return terminalService.kill(sessionId);
    }, false));

    // Get active sessions
    ipcMain.handle('terminal:getSessions', createSafeIpcHandler('terminal:getSessions', async () => {
        return terminalService.getActiveSessions();
    }, []));

    // Read session buffer
    ipcMain.handle('terminal:readBuffer', createSafeIpcHandler('terminal:readBuffer', async (_event: IpcMainInvokeEvent, sessionId: string) => {
        return terminalService.getSessionBuffer(sessionId);
    }, ''));
}
