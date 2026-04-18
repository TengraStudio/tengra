/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IpcRenderer } from 'electron';

export interface AuthSessionBridge {
    start: (provider: string, accountId?: string, source?: string) => Promise<{ sessionId: string }>;
    touch: (sessionId: string) => Promise<{ success: boolean }>;
    end: (sessionId: string) => Promise<{ success: boolean }>;
    setLimit: (provider: string, limit: number) => Promise<{ limit: number }>;
    getAnalytics: (provider?: string) => Promise<{
        totalActiveSessions: number;
        byProvider: Record<string, number>;
        oldestSessionAt?: number;
    }>;
    setTimeout: (timeoutMs: number) => Promise<{ timeoutMs: number }>;
    getTimeout: () => Promise<{ timeoutMs: number }>;
}

export function createAuthSessionBridge(ipc: IpcRenderer): AuthSessionBridge {
    return {
        start: (provider, accountId, source) =>
            ipc.invoke('auth:session:start', { provider, accountId, source }),
        touch: sessionId => ipc.invoke('auth:session:touch', sessionId),
        end: sessionId => ipc.invoke('auth:session:end', sessionId),
        setLimit: (provider, limit) => ipc.invoke('auth:session:set-limit', { provider, limit }),
        getAnalytics: provider => ipc.invoke('auth:session:analytics', provider),
        setTimeout: timeoutMs => ipc.invoke('auth:session:set-timeout', timeoutMs),
        getTimeout: () => ipc.invoke('auth:session:get-timeout'),
    };
}
