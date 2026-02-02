import { appLogger } from '@main/logging/logger';
import { TerminalService } from '@main/services/project/terminal.service';
import { createIpcHandler, createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';

let terminalService: TerminalService | null = null;

export function registerTerminalIpc(getWindow: () => BrowserWindow | null) {
    ipcMain.setMaxListeners(50);
    try {
        terminalService = new TerminalService();
        appLogger.info('terminal', '[IPC] Terminal service initialized');
    } catch (error) {
        appLogger.error('terminal', '[IPC] Failed to initialize terminal service:', error as Error);
        terminalService = null;
    }

    // Check availability
    ipcMain.handle('terminal:isAvailable', createIpcHandler('terminal:isAvailable', async () => {
        return terminalService?.isAvailable() ?? false;
    }));

    // Get available shells
    ipcMain.handle('terminal:getShells', createSafeIpcHandler('terminal:getShells', async () => {
        return terminalService?.getAvailableShells() ?? [];
    }, []));

    // Create session
    ipcMain.handle('terminal:create', createIpcHandler('terminal:create', async (_event: IpcMainInvokeEvent, options: {
        id: string
        shell?: string
        cwd?: string
        cols?: number
        rows?: number
    }) => {
        appLogger.info('ipc', `terminal:create called for session ${options.id}`);
        if (!terminalService) {
            throw new Error('Service not initialized');
        }

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
            onData: (data: string) => {
                getWindow()?.webContents.send('terminal:data', { id: options.id, data });
            },
            onExit: (code: number) => {
                getWindow()?.webContents.send('terminal:exit', { id: options.id, code });
            }
        });
        return { success };
    }));

    // Write to session
    ipcMain.handle('terminal:write', createSafeIpcHandler('terminal:write', async (_event: IpcMainInvokeEvent, sessionId: string, data: string) => {
        if (!terminalService) { return false; }
        // Validate data type
        if (typeof data !== 'string') {
            throw new Error('data must be a string');
        }
        // Limit data size to prevent memory exhaustion
        if (data.length > 1024 * 1024) { // 1MB limit
            throw new Error('data exceeds maximum size of 1MB');
        }
        return terminalService.write(sessionId, data);
    }, false));

    // Resize session
    ipcMain.handle('terminal:resize', createSafeIpcHandler('terminal:resize', async (_event: IpcMainInvokeEvent, sessionId: string, cols: number, rows: number) => {
        if (!terminalService) { return false; }
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
        if (!terminalService) { return false; }
        return terminalService.kill(sessionId);
    }, false));

    // Get active sessions
    ipcMain.handle('terminal:getSessions', createSafeIpcHandler('terminal:getSessions', async () => {
        if (!terminalService) { return []; }
        return terminalService.getActiveSessions();
    }, []));

    // Read session buffer
    ipcMain.handle('terminal:readBuffer', createSafeIpcHandler('terminal:readBuffer', async (_event: IpcMainInvokeEvent, sessionId: string) => {
        if (!terminalService) { return ''; }
        return terminalService.getSessionBuffer(sessionId);
    }, ''));
}
