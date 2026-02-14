import { appLogger, LogLevel } from '@main/logging/logger';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { JsonValue } from '@shared/types/common';
import { BrowserWindow, ipcMain } from 'electron';

// Log buffer for streaming to renderer
const logBuffer: Array<{
    id: string
    timestamp: Date
    level: 'debug' | 'info' | 'warn' | 'error'
    source: string
    message: string
}> = [];
const MAX_BUFFER_SIZE = 1000;
let streamingEnabled = false;

/**
 * Add a log entry to the buffer and send to all renderer windows
 */
export function pushLogEntry(level: 'debug' | 'info' | 'warn' | 'error', source: string, message: string) {
    const entry = {
        id: `${Date.now()}-${crypto.randomUUID().substring(0, 8)}`,
        timestamp: new Date(),
        level,
        source,
        message
    };

    // Add to buffer
    logBuffer.push(entry);
    if (logBuffer.length > MAX_BUFFER_SIZE) {
        logBuffer.shift();
    }

    // Stream to all windows if enabled
    if (streamingEnabled) {
        for (const win of BrowserWindow.getAllWindows()) {
            if (!win.isDestroyed()) {
                win.webContents.send('log:entry', entry);
            }
        }
    }
}

/**
 * Registers IPC handlers for log streaming and buffer management
 */
export function registerLoggingIpc() {
    appLogger.info('LoggingIPC', 'Registering logging IPC handlers');

    ipcMain.on('log:write', handleLogWrite);

    ipcMain.handle('log:stream:start', createSafeIpcHandler('log:stream:start',
        async () => {
            streamingEnabled = true;
            return { success: true };
        }, { success: false }
    ));

    ipcMain.handle('log:stream:stop', createSafeIpcHandler('log:stream:stop',
        async () => {
            streamingEnabled = false;
            return { success: true };
        }, { success: false }
    ));

    ipcMain.handle('log:buffer:get', createSafeIpcHandler('log:buffer:get',
        async () => {
            return logBuffer.slice(-500);
        }, []
    ));

    ipcMain.handle('log:buffer:clear', createSafeIpcHandler('log:buffer:clear',
        async () => {
            logBuffer.length = 0;
            return { success: true };
        }, { success: false }
    ));
}

/**
 * Handles incoming log write events from renderer processes
 * @param event - The IPC event from the renderer
 * @param arg1 - Log level string or structured log object
 * @param arg2 - Optional message string when arg1 is a level string
 */
function handleLogWrite(event: Electron.IpcMainEvent, arg1: string | { level?: LogLevel, message?: string, context?: string, data?: JsonValue | Error }, arg2?: string) {
    // SEC-013-4: Verify sender is a valid window
    try {
        if (!BrowserWindow.fromWebContents(event.sender)) {
            appLogger.warn('Security', `Unauthorized log write attempt from sender ${event.sender.id}`);
            return;
        }
    } catch {
        // e.g. sender destroyed
        return;
    }

    let level: LogLevel = LogLevel.INFO;
    let message = '';
    let context = 'renderer';
    let data: JsonValue | Error | undefined = undefined;

    if (typeof arg1 === 'string') {
        level = parseLevel(arg1);
        message = arg2 ?? '';
    } else {
        level = arg1.level ?? LogLevel.INFO;
        message = arg1.message ?? '';
        context = arg1.context ? `renderer:${arg1.context}` : 'renderer';
        data = arg1.data;
    }

    logToApp(level, context, message, data);

    const levelNames: Array<'debug' | 'info' | 'warn' | 'error'> = ['debug', 'info', 'warn', 'error'];
    const levelStr = levelNames[level] || 'info';
    pushLogEntry(levelStr, context, message);
}

/**
 * Parses a log level string into a LogLevel enum value
 * @param levelStr - The log level string to parse
 */
function parseLevel(levelStr: string): LogLevel {
    const upper = levelStr.toUpperCase();
    if (upper === 'DEBUG') { return LogLevel.DEBUG; }
    if (upper === 'WARN') { return LogLevel.WARN; }
    if (upper === 'ERROR') { return LogLevel.ERROR; }
    return LogLevel.INFO;
}

/**
 * Dispatches a log entry to the application logger at the appropriate level
 * @param level - The log severity level
 * @param context - The source context for the log entry
 * @param message - The log message
 * @param data - Optional additional data or error to attach
 */
function logToApp(level: LogLevel, context: string, message: string, data?: JsonValue | Error) {
    switch (level) {
        case LogLevel.DEBUG: appLogger.debug(context, message, data); break;
        case LogLevel.INFO: appLogger.info(context, message, data); break;
        case LogLevel.WARN: appLogger.warn(context, message, data); break;
        case LogLevel.ERROR: appLogger.error(context, message, data); break;
    }
}
