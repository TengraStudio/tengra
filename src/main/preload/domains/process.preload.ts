/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { PROCESS_CHANNELS } from '@shared/constants/ipc-channels';
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
        spawn: (command, args, cwd) => ipc.invoke(PROCESS_CHANNELS.SPAWN, command, args, cwd),
        kill: id => ipc.invoke(PROCESS_CHANNELS.KILL, id),
        list: () => ipc.invoke(PROCESS_CHANNELS.LIST),
        scanScripts: rootPath => ipc.invoke(PROCESS_CHANNELS.SCAN_SCRIPTS, rootPath),
        resize: (id, cols, rows) => ipc.invoke(PROCESS_CHANNELS.RESIZE, id, cols, rows).then(() => undefined),
        write: (id, data) => ipc.invoke(PROCESS_CHANNELS.WRITE, id, data).then(() => undefined),
        onData: callback => {
            const listener = (_event: IpcRendererEvent, data: { id: string; data: string }) =>
                callback(data);
            ipc.on(PROCESS_CHANNELS.DATA, listener);
            return () => {
                ipc.removeListener(PROCESS_CHANNELS.DATA, listener);
            };
        },
        onExit: callback => {
            const listener = (_event: IpcRendererEvent, data: { id: string; code: number }) =>
                callback(data);
            ipc.on(PROCESS_CHANNELS.EXIT, listener);
            return () => {
                ipc.removeListener(PROCESS_CHANNELS.EXIT, listener);
            };
        },
        removeListeners: () => {
            ipc.removeAllListeners(PROCESS_CHANNELS.DATA);
            ipc.removeAllListeners(PROCESS_CHANNELS.EXIT);
        },
    };
}

