import { appLogger, LogLevel } from '@main/logging/logger';
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
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
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
            try {
                win.webContents.send('log:entry', entry);
            } catch {
                // Window might be destroyed
            }
        }
    }
}

export function registerLoggingIpc() {
    ipcMain.on('log:write', handleLogWrite);

    ipcMain.handle('log:stream:start', () => {
        streamingEnabled = true;
        return { success: true };
    });

    ipcMain.handle('log:stream:stop', () => {
        streamingEnabled = false;
        return { success: true };
    });

    ipcMain.handle('log:buffer:get', () => {
        return logBuffer.slice(-500);
    });

    ipcMain.handle('log:buffer:clear', () => {
        logBuffer.length = 0;
        return { success: true };
    });
}

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

function parseLevel(levelStr: string): LogLevel {
    const upper = levelStr.toUpperCase();
    if (upper === 'DEBUG') { return LogLevel.DEBUG; }
    if (upper === 'WARN') { return LogLevel.WARN; }
    if (upper === 'ERROR') { return LogLevel.ERROR; }
    return LogLevel.INFO;
}

function logToApp(level: LogLevel, context: string, message: string, data?: JsonValue | Error) {
    switch (level) {
        case LogLevel.DEBUG: appLogger.debug(context, message, data); break;
        case LogLevel.INFO: appLogger.info(context, message, data); break;
        case LogLevel.WARN: appLogger.warn(context, message, data); break;
        case LogLevel.ERROR: appLogger.error(context, message, data); break;
    }
}
