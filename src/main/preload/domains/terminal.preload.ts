/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { TERMINAL_CHANNELS } from '@shared/constants/ipc-channels';
import { IpcRenderer } from 'electron';

export interface TerminalBridge {
    // Events
    onData: (callback: (payload: { id: string; data: string }) => void) => () => void;
    onExit: (callback: (payload: { id: string; code?: number; signal?: number }) => void) => () => void;
    onStatusChange: (callback: (payload: { id: string; online?: boolean }) => void) => () => void;

    // Operations
    create: (options?: {
        id?: string;
        shell?: string;
        cwd?: string;
        cols?: number;
        rows?: number;
        backendId?: string;
        workspaceId?: string;
        title?: string;
        metadata?: Record<string, any>;
    }) => Promise<string | null>;
    close: (id: string) => Promise<boolean>;
    kill: (id: string) => Promise<boolean>;
    write: (id: string, data: string) => Promise<boolean>;
    resize: (id: string, cols: number, rows: number) => Promise<boolean>;
    isAvailable: () => Promise<boolean>;
    getShells: () => Promise<Array<{ id: string; name: string; path: string }>>;
    getBackends: () => Promise<Array<{ id: string; name: string; available: boolean }>>;
    getDiscoverySnapshot: (options?: { refresh?: boolean }) => Promise<{
        terminalAvailable: boolean;
        shells: Array<{ id: string; name: string; path: string }>;
        backends: Array<{ id: string; name: string; available: boolean }>;
        refreshedAt: number;
    }>;
    getDockerContainers: () => Promise<{ success: boolean; containers?: Record<string, any>[]; error?: string; raw?: string }>;
    readBuffer: (id: string) => Promise<string>;
    getSuggestions: (options: { command: string; shell: string; cwd: string; historyLimit?: number }) => Promise<string[]>;
    clearCommandHistory: () => Promise<boolean>;
    explainCommand: (options: { command: string; shell: string; cwd?: string }) => Promise<{
        explanation: string;
        breakdown: Array<{ part: string; description: string }>;
        warnings?: string[];
        relatedCommands?: string[];
    }>;
    getCommandHistory: (query?: string, limit?: number) => Promise<any[]>;
    explainError: (options: { errorOutput: string; command?: string; shell: string; cwd?: string }) => Promise<any>;
    fixError: (options: { errorOutput: string; command: string; shell: string; cwd?: string }) => Promise<any>;
    getSnapshotSessions: () => Promise<Array<{ id: string; title: string; lastActivity: number }>>;
    restoreAllSnapshots: () => Promise<{ restored: number; failed: number; sessionIds: string[] }>;
    setSessionTitle: (id: string, title: string) => Promise<boolean>;
    detach: (options: { sessionId: string }) => Promise<boolean>;
}

export function createTerminalBridge(ipc: IpcRenderer): TerminalBridge {
    return {
        onData: callback => {
            const listener = (_event: any, payload: { id: string; data: string }) => callback(payload);
            ipc.on(TERMINAL_CHANNELS.DATA, listener);
            return () => ipc.removeListener(TERMINAL_CHANNELS.DATA, listener);
        },
        onExit: callback => {
            const listener = (_event: any, payload: { id: string; code?: number; signal?: number }) => callback(payload);
            ipc.on(TERMINAL_CHANNELS.EXIT, listener);
            return () => ipc.removeListener(TERMINAL_CHANNELS.EXIT, listener);
        },
        onStatusChange: callback => {
            const listener = (_event: any, payload: { id: string; online?: boolean }) => callback(payload);
            ipc.on(TERMINAL_CHANNELS.STATUS_CHANGE_EVENT, listener);
            return () => ipc.removeListener(TERMINAL_CHANNELS.STATUS_CHANGE_EVENT, listener);
        },

        create: options => ipc.invoke(TERMINAL_CHANNELS.CREATE, options),
        close: id => ipc.invoke(TERMINAL_CHANNELS.CLOSE, id),
        kill: id => ipc.invoke(TERMINAL_CHANNELS.KILL, id),
        write: (id, data) => ipc.invoke(TERMINAL_CHANNELS.WRITE, id, data),
        resize: (id, cols, rows) => ipc.invoke(TERMINAL_CHANNELS.RESIZE, id, cols, rows),
        isAvailable: () => ipc.invoke(TERMINAL_CHANNELS.IS_AVAILABLE),
        getShells: () => ipc.invoke(TERMINAL_CHANNELS.GET_SHELLS),
        getBackends: () => ipc.invoke(TERMINAL_CHANNELS.GET_BACKENDS),
        getDiscoverySnapshot: options => ipc.invoke(TERMINAL_CHANNELS.GET_DISCOVERY_SNAPSHOT, options),
        getDockerContainers: () => ipc.invoke(TERMINAL_CHANNELS.GET_DOCKER_CONTAINERS),
        readBuffer: id => ipc.invoke(TERMINAL_CHANNELS.READ_BUFFER, id),
        getSuggestions: options => ipc.invoke(TERMINAL_CHANNELS.GET_SUGGESTIONS, options),
        clearCommandHistory: () => ipc.invoke(TERMINAL_CHANNELS.CLEAR_COMMAND_HISTORY),
        explainCommand: options => ipc.invoke(TERMINAL_CHANNELS.EXPLAIN_COMMAND, options),
        getCommandHistory: (query, limit) => ipc.invoke(TERMINAL_CHANNELS.GET_COMMAND_HISTORY, query, limit),
        explainError: options => ipc.invoke(TERMINAL_CHANNELS.EXPLAIN_ERROR, options),
        fixError: options => ipc.invoke(TERMINAL_CHANNELS.FIX_ERROR, options),
        getSnapshotSessions: () => ipc.invoke(TERMINAL_CHANNELS.GET_SNAPSHOT_SESSIONS),
        restoreAllSnapshots: () => ipc.invoke(TERMINAL_CHANNELS.RESTORE_ALL_SNAPSHOTS),
        setSessionTitle: (id, title) => ipc.invoke(TERMINAL_CHANNELS.SET_SESSION_TITLE, id, title),
        detach: options => ipc.invoke(TERMINAL_CHANNELS.DETACH, options),
    };
}

