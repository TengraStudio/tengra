import { IpcValue } from '@shared/types';
import { IpcRenderer } from 'electron';

export interface LogBridge {
    write: (
        level: 'debug' | 'info' | 'warn' | 'error',
        message: string,
        data?: Record<string, IpcValue>
    ) => void;
    debug: (message: string, data?: Record<string, IpcValue>) => void;
    info: (message: string, data?: Record<string, IpcValue>) => void;
    warn: (message: string, data?: Record<string, IpcValue>) => void;
    error: (message: string, data?: Record<string, IpcValue>) => void;
}

export function createLogBridge(ipc: IpcRenderer): LogBridge {
    return {
        write: (level, message, data) => ipc.send('log:write', { level, message, data }),
        debug: (message, data) => ipc.send('log:write', { level: 'debug', message, data }),
        info: (message, data) => ipc.send('log:write', { level: 'info', message, data }),
        warn: (message, data) => ipc.send('log:write', { level: 'warn', message, data }),
        error: (message, data) => ipc.send('log:write', { level: 'error', message, data }),
    };
}
