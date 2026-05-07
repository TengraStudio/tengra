/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as crypto from 'crypto';

import { ipc } from '@main/core/ipc-decorators';
import { appLogger, LogLevel } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { LOG_CHANNELS } from '@shared/constants/ipc-channels';
import { JsonValue } from '@shared/types/common';
import { BrowserWindow, IpcMainEvent } from 'electron';

export class LoggingService extends BaseService {
    private logBuffer: Array<{
        id: string
        timestamp: Date
        level: 'debug' | 'info' | 'warn' | 'error'
        source: string
        message: string
    }> = [];
    private readonly MAX_BUFFER_SIZE = 1000;
    private streamingEnabled = false;
    private readonly LOG_STREAM_BATCH_INTERVAL_MS = 50;
    private pendingLogEntries: Array<{
        id: string
        timestamp: Date
        level: 'debug' | 'info' | 'warn' | 'error'
        source: string
        message: string
    }> = [];
    private pendingLogTimer: NodeJS.Timeout | null = null;

    constructor() {
        super('LoggingService');
    }

    private flushPendingLogEntries() {
        if (this.pendingLogTimer) {
            clearTimeout(this.pendingLogTimer);
            this.pendingLogTimer = null;
        }

        if (this.pendingLogEntries.length === 0) {
            return;
        }

        const batch = this.pendingLogEntries.splice(0, this.pendingLogEntries.length);
        for (const win of BrowserWindow.getAllWindows()) {
            if (win.isDestroyed()) { continue; }
            try {
                win.webContents.send('log:entry-batch', batch);
            } catch {
                // Ignore transient renderer/window teardown races
            }
        }
    }

    pushLogEntry(level: 'debug' | 'info' | 'warn' | 'error', source: string, message: string) {
        const entry = {
            id: `${Date.now()}-${crypto.randomUUID().substring(0, 8)}`,
            timestamp: new Date(),
            level,
            source,
            message
        };

        // Add to buffer
        this.logBuffer.push(entry);
        if (this.logBuffer.length > this.MAX_BUFFER_SIZE) {
            this.logBuffer.shift();
        }

        // Stream to all windows if enabled
        if (this.streamingEnabled) {
            this.pendingLogEntries.push(entry);
            if (!this.pendingLogTimer) {
                this.pendingLogTimer = setTimeout(() => {
                    this.flushPendingLogEntries();
                }, this.LOG_STREAM_BATCH_INTERVAL_MS);
            }
        }
    }

    @ipc({ channel: 'log:write', type: 'on', withEvent: true })
    handleLogWrite(event: IpcMainEvent, arg1: string | { level?: LogLevel, message?: string, context?: string, data?: JsonValue | Error }, arg2?: string) {
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
            level = this.parseLevel(arg1);
            message = arg2 ?? '';
        } else {
            level = arg1.level ?? LogLevel.INFO;
            message = arg1.message ?? '';
            data = arg1.data;
            const extractedContext = arg1.context ?? this.extractRendererContext(data);
            context = extractedContext ? `renderer:${extractedContext}` : 'renderer';
        }

        this.logToApp(level, context, message, data);

        let levelStr: 'debug' | 'info' | 'warn' | 'error' = 'info';
        if (level <= LogLevel.DEBUG) {
            levelStr = 'debug';
        } else if (level === LogLevel.WARN) {
            levelStr = 'warn';
        } else if (level >= LogLevel.ERROR) {
            levelStr = 'error';
        }

        this.pushLogEntry(levelStr, context, message);
    }

    @ipc(LOG_CHANNELS.BUFFER_GET)
    async getBufferIpc() {
        return this.logBuffer.slice(-500);
    }

    @ipc(LOG_CHANNELS.BUFFER_CLEAR)
    async clearBufferIpc() {
        this.logBuffer.length = 0;
        return { success: true };
    }

    @ipc(LOG_CHANNELS.STREAM_START)
    async startStreamIpc() {
        this.streamingEnabled = true;
        return { success: true };
    }

    @ipc(LOG_CHANNELS.STREAM_STOP)
    async stopStreamIpc() {
        this.streamingEnabled = false;
        return { success: true };
    }

    private extractRendererContext(data: JsonValue | Error | undefined): string | undefined {
        if (!data || typeof data !== 'object' || data instanceof Error || !('rendererContext' in data)) {
            return undefined;
        }
        const candidate = (data as { rendererContext?: JsonValue }).rendererContext;
        return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate : undefined;
    }

    private parseLevel(levelStr: string): LogLevel {
        const upper = levelStr.toUpperCase();
        if (upper === 'TRACE') { return LogLevel.TRACE; }
        if (upper === 'DEBUG') { return LogLevel.DEBUG; }
        if (upper === 'WARN') { return LogLevel.WARN; }
        if (upper === 'ERROR') { return LogLevel.ERROR; }
        if (upper === 'FATAL') { return LogLevel.FATAL; }
        return LogLevel.INFO;
    }

    private logToApp(level: LogLevel, context: string, message: string, data?: JsonValue | Error) {
        switch (level) {
            case LogLevel.TRACE: appLogger.trace(context, message, data); break;
            case LogLevel.DEBUG: appLogger.debug(context, message, data); break;
            case LogLevel.INFO: appLogger.info(context, message, data); break;
            case LogLevel.WARN: appLogger.warn(context, message, data); break;
            case LogLevel.ERROR: appLogger.error(context, message, data); break;
            case LogLevel.FATAL: appLogger.fatal(context, message, data); break;
        }
    }
}

