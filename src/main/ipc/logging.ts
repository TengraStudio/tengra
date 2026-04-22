/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
const streamingEnabled = false;
const LOG_STREAM_BATCH_INTERVAL_MS = 50;
const pendingLogEntries: Array<{
    id: string
    timestamp: Date
    level: 'debug' | 'info' | 'warn' | 'error'
    source: string
    message: string
}> = [];
let pendingLogTimer: NodeJS.Timeout | null = null;

function flushPendingLogEntries() {
    if (pendingLogTimer) {
        clearTimeout(pendingLogTimer);
        pendingLogTimer = null;
    }

    if (pendingLogEntries.length === 0) {
        return;
    }

    const batch = pendingLogEntries.splice(0, pendingLogEntries.length);
    for (const win of BrowserWindow.getAllWindows()) {
        const isDestroyed = typeof (win as { isDestroyed?: () => boolean }).isDestroyed === 'function'
            ? (win as { isDestroyed: () => boolean }).isDestroyed()
            : false;
        if (isDestroyed) { continue; }
        try {
            win.webContents.send('log:entry-batch', batch);
        } catch {
            // Ignore transient renderer/window teardown races
        }
    }
}

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
        pendingLogEntries.push(entry);
        if (!pendingLogTimer) {
            pendingLogTimer = setTimeout(() => {
                flushPendingLogEntries();
            }, LOG_STREAM_BATCH_INTERVAL_MS);
        }
    }
}

/**
 * Registers IPC handlers for log streaming and buffer management
 */
export function registerLoggingIpc() {
    appLogger.debug('LoggingIPC', 'Registering logging IPC handlers');

    ipcMain.on('log:write', handleLogWrite);




}

/**
 * Handles incoming log write events from renderer processes
 * @param event - The IPC event from the renderer
 * @param arg1 - Log level string or structured log object
 * @param arg2 - Optional message string when arg1 is a level string
 */
function extractRendererContext(data: JsonValue | Error | undefined): string | undefined {
    if (!data || typeof data !== 'object' || data instanceof Error || !('rendererContext' in data)) {
        return undefined;
    }
    const candidate = (data as { rendererContext?: JsonValue }).rendererContext;
    return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate : undefined;
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
        data = arg1.data;
        const extractedContext = arg1.context ?? extractRendererContext(data);
        context = extractedContext ? `renderer:${extractedContext}` : 'renderer';
    }

    logToApp(level, context, message, data);

    let levelStr: 'debug' | 'info' | 'warn' | 'error' = 'info';
    if (level <= LogLevel.DEBUG) {
        levelStr = 'debug';
    } else if (level === LogLevel.WARN) {
        levelStr = 'warn';
    } else if (level >= LogLevel.ERROR) {
        levelStr = 'error';
    }

    pushLogEntry(levelStr, context, message);
}

/**
 * Parses a log level string into a LogLevel enum value
 * @param levelStr - The log level string to parse
 */
function parseLevel(levelStr: string): LogLevel {
    const upper = levelStr.toUpperCase();
    if (upper === 'TRACE') { return LogLevel.TRACE; }
    if (upper === 'DEBUG') { return LogLevel.DEBUG; }
    if (upper === 'WARN') { return LogLevel.WARN; }
    if (upper === 'ERROR') { return LogLevel.ERROR; }
    if (upper === 'FATAL') { return LogLevel.FATAL; }
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
        case LogLevel.TRACE: appLogger.trace(context, message, data); break;
        case LogLevel.DEBUG: appLogger.debug(context, message, data); break;
        case LogLevel.INFO: appLogger.info(context, message, data); break;
        case LogLevel.WARN: appLogger.warn(context, message, data); break;
        case LogLevel.ERROR: appLogger.error(context, message, data); break;
        case LogLevel.FATAL: appLogger.fatal(context, message, data); break;
    }
}
