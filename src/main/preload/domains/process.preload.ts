/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ProcessInfo } from '@shared/types';
import { IpcRenderer, IpcRendererEvent } from 'electron';

export interface ProcessBridge {
    spawn: (command: string, args: string[], cwd: string) => Promise<string>;
    kill: (id: string) => Promise<boolean>;
    list: () => Promise<ProcessInfo[]>;
    scanScripts: (rootPath: string) => Promise<Record<string, string>>;
    resize: (id: string, cols: number, rows: number) => Promise<void>;
    write: (id: string, data: string) => Promise<void>;
    onData: (callback: (data: { id: string; data: string }) => void) => () => void;
    onExit: (callback: (data: { id: string; code: number }) => void) => () => void;
    removeListeners: () => void;
}

export function createProcessBridge(ipc: IpcRenderer): ProcessBridge {
    return {
        spawn: (command, args, cwd) => ipc.invoke('process:spawn', command, args, cwd),
        kill: id => ipc.invoke('process:kill', id),
        list: () => ipc.invoke('process:list'),
        scanScripts: rootPath => ipc.invoke('process:scan-scripts', rootPath),
        resize: (id, cols, rows) => ipc.invoke('process:resize', id, cols, rows).then(() => undefined),
        write: (id, data) => ipc.invoke('process:write', id, data).then(() => undefined),
        onData: callback => {
            const listener = (_event: IpcRendererEvent, data: { id: string; data: string }) =>
                callback(data);
            ipc.on('process:data', listener);
            return () => {
                ipc.removeListener('process:data', listener);
            };
        },
        onExit: callback => {
            const listener = (_event: IpcRendererEvent, data: { id: string; code: number }) =>
                callback(data);
            ipc.on('process:exit', listener);
            return () => {
                ipc.removeListener('process:exit', listener);
            };
        },
        removeListeners: () => {
            ipc.removeAllListeners('process:data');
            ipc.removeAllListeners('process:exit');
        },
    };
}
