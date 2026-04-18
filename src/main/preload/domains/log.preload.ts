/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IpcValue } from '@shared/types';
import { IpcRenderer } from 'electron';

export interface LogBridge {
    write: (
        level: 'debug' | 'info' | 'warn' | 'error',
        message: string,
        data?: IpcValue,
        context?: string
    ) => void;
    debug: (message: string, data?: IpcValue, context?: string) => void;
    info: (message: string, data?: IpcValue, context?: string) => void;
    warn: (message: string, data?: IpcValue, context?: string) => void;
    error: (message: string, data?: IpcValue, context?: string) => void;
}

export function createLogBridge(ipc: IpcRenderer): LogBridge {
    return {
        write: (level, message, data, context) => ipc.send('log:write', { level, message, data, context }),
        debug: (message, data, context) => ipc.send('log:write', { level: 'debug', message, data, context }),
        info: (message, data, context) => ipc.send('log:write', { level: 'info', message, data, context }),
        warn: (message, data, context) => ipc.send('log:write', { level: 'warn', message, data, context }),
        error: (message, data, context) => ipc.send('log:write', { level: 'error', message, data, context }),
    };
}
