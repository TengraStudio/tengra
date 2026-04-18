/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import { appLogger } from '@main/logging/logger';
import { ProcessService } from '@main/services/system/process.service';
import { createSafeIpcHandler as baseCreateSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { IPC_TIMEOUTS } from '@shared/constants/timeouts';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';

const MAX_COMMAND_LENGTH = 1024;
const MAX_PATH_LENGTH = 4096;
const MAX_ID_LENGTH = 64;
const MAX_DATA_LENGTH = 65536;
const MAX_ARGS = 100;
const MAX_COLS = 1000;
const MAX_ROWS = 500;

/**
 * Validates and sanitizes a command string, blocking shell control characters.
 * @param value - Raw command input to validate
 * @returns Trimmed command string or null if invalid
 */
function validateCommand(value: RuntimeValue): string | null {
    if (typeof value !== 'string') {return null;}
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_COMMAND_LENGTH) {return null;}
    // Security: Block shell control characters (SEC-001-3)
    if (/[;&|`$(){}<>\r\n\0]/.test(trimmed)) {return null;}
    return trimmed;
}

/**
 * Validates a file system path string.
 * @param value - Raw path input to validate
 * @returns Trimmed path string or null if invalid
 */
function validatePath(value: RuntimeValue): string | null {
    if (typeof value !== 'string') {return null;}
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_PATH_LENGTH) {return null;}
    return trimmed;
}

/**
 * Validates a process identifier string.
 * @param value - Raw ID input to validate
 * @returns Trimmed ID string or null if invalid
 */
function validateId(value: RuntimeValue): string | null {
    if (typeof value !== 'string') {return null;}
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_ID_LENGTH) {return null;}
    return trimmed;
}

/**
 * Validates and sanitizes an array of command arguments.
 * @param value - Raw arguments array to validate
 * @returns Sanitized array of string arguments
 */
function validateArgs(value: RuntimeValue): string[] {
    if (!Array.isArray(value)) {return [];}
    return value
        .slice(0, MAX_ARGS)
        .filter((arg): arg is string => typeof arg === 'string')
        .map(arg => arg.slice(0, MAX_COMMAND_LENGTH));
}

/**
 * Validates a numeric value within a given range.
 * @param value - Raw numeric input to validate
 * @param min - Minimum allowed value (inclusive)
 * @param max - Maximum allowed value (inclusive)
 * @returns Floored integer or null if invalid
 */
function validateNumber(value: RuntimeValue, min: number, max: number): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {return null;}
    if (value < min || value > max) {return null;}
    return Math.floor(value);
}

/**
 * Registers IPC handlers for process management
 */
export const registerProcessIpc = (getMainWindow: () => BrowserWindow | null, processService: ProcessService) => {
    appLogger.info('ProcessIPC', 'Registering process IPC handlers');
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'process operation');
    const createSafeIpcHandler = <T = RuntimeValue, Args extends RuntimeValue[] = RuntimeValue[]>(
        handlerName: string,
        handler: (event: IpcMainInvokeEvent, ...args: Args) => Promise<T>,
        defaultValue: T
    ) => baseCreateSafeIpcHandler<T, Args>(handlerName, async (event, ...args) => {
        validateSender(event);
        return await handler(event, ...args);
    }, defaultValue);

    ipcMain.handle('process:spawn', createSafeIpcHandler('process:spawn',
        async (_event: IpcMainInvokeEvent, commandRaw: RuntimeValue, argsRaw: RuntimeValue, cwdRaw: RuntimeValue) => {
            const command = validateCommand(commandRaw);
            if (!command) {
                throw new Error('error.process.invalid_command');
            }

            const args = validateArgs(argsRaw);
            const cwd = validatePath(cwdRaw) ?? process.cwd();

            return processService.spawn(command, args, cwd);
        }, null
    ));

    ipcMain.handle('process:kill', createSafeIpcHandler('process:kill',
        async (_event: IpcMainInvokeEvent, idRaw: RuntimeValue) => {
            const id = validateId(idRaw);
            if (!id) {
                throw new Error('Invalid process ID');
            }
            return processService.kill(id);
        }, false
    ));

    ipcMain.handle('process:list', createSafeIpcHandler('process:list',
        async () => {
            return processService.getRunningTasks();
        }, []
    ));

    ipcMain.handle('process:scan-scripts', createSafeIpcHandler('process:scan-scripts',
        async (_event: IpcMainInvokeEvent, rootPathRaw: RuntimeValue) => {
            const rootPath = validatePath(rootPathRaw);
            if (!rootPath) {
                throw new Error('Invalid root path');
            }
            return await processService.scanScripts(rootPath);
        }, {}
    ));

    ipcMain.handle('process:resize', createSafeIpcHandler('process:resize',
        async (_event: IpcMainInvokeEvent, idRaw: RuntimeValue, colsRaw: RuntimeValue, rowsRaw: RuntimeValue) => {
            const id = validateId(idRaw);
            if (!id) {
                throw new Error('Invalid process ID');
            }

            const cols = validateNumber(colsRaw, 1, MAX_COLS);
            const rows = validateNumber(rowsRaw, 1, MAX_ROWS);
            if (cols === null || rows === null) {
                throw new Error('Invalid dimensions');
            }

            processService.resize(id, cols, rows);
            return true;
        }, false
    ));

    ipcMain.handle('process:write', createSafeIpcHandler('process:write',
        async (_event: IpcMainInvokeEvent, idRaw: RuntimeValue, dataRaw: RuntimeValue) => {
            const id = validateId(idRaw);
            if (!id) {
                throw new Error('Invalid process ID');
            }

            if (typeof dataRaw !== 'string' || dataRaw.length > MAX_DATA_LENGTH) {
                throw new Error('Invalid data');
            }

            processService.write(id, dataRaw);
            return true;
        }, false
    ));

    // Bridge events
    // We need a way to send 'data' and 'exit' events to the renderer.
    // The renderer should listen to 'process:output:{id}' or similar.
    // Since id is dynamic, we can send a global 'process:event' or specific if we passed webContents.
    // For now, let's assume we send to the sender of the spawn command - but strictly simpler:
    // We will emit on the main window or all windows.
    // Actually, ProcessService emits events. We can hook them up here.

    // Note: This requires holding a reference to the window or using `event.sender` from the spawn call.
    // However, since spawn is a handle (async), we return the ID. 
    // We'll set up a global listener on processService once and broadcast.
    /*
    processService.on('data', ({ id, data }) => {
        // Broadcast to all windows? Or manageable via specific channel?
        // Using `webContents.getAllWebContents().forEach(wc => wc.send('process:data', { id, data }))`
        // requires 'electron' import.
    })
    */
};

/**
 * Sets up process data and exit event forwarding to all renderer windows with buffered output.
 * @param processService - The process service instance to listen for events on
 */
export const setupProcessEvents = (processService: ProcessService) => {
    const buffers = new Map<string, string>();
    let timer: NodeJS.Timeout | null = null;

    const flush = () => {
        if (buffers.size === 0) { return; }

        BrowserWindow.getAllWindows().forEach(win => {
            if (win.isDestroyed()) { return; }
            buffers.forEach((data, id) => {
                win.webContents.send('process:data', { id, data });
            });
        });
        buffers.clear();
        timer = null;
    };

    processService.on('data', ({ id, data }) => {
        const current = buffers.get(id) ?? '';
        buffers.set(id, current + data);

        timer ??= setTimeout(flush, IPC_TIMEOUTS.BUFFER_FLUSH);
    });

    processService.on('exit', ({ id, code }) => {
        // Flush immediately on exit
        flush();
        BrowserWindow.getAllWindows().forEach(win => {
            if (!win.isDestroyed()) {
                win.webContents.send('process:exit', { id, code });
            }
        });
    });
};
