/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { AUTH_SESSION_CHANNELS } from '@shared/constants/ipc-channels';
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
            ipc.invoke(AUTH_SESSION_CHANNELS.START, { provider, accountId, source }),
        touch: sessionId => ipc.invoke(AUTH_SESSION_CHANNELS.TOUCH, sessionId),
        end: sessionId => ipc.invoke(AUTH_SESSION_CHANNELS.END, sessionId),
        setLimit: (provider, limit) => ipc.invoke(AUTH_SESSION_CHANNELS.SET_LIMIT, { provider, limit }),
        getAnalytics: provider => ipc.invoke(AUTH_SESSION_CHANNELS.ANALYTICS, provider),
        setTimeout: timeoutMs => ipc.invoke(AUTH_SESSION_CHANNELS.SET_TIMEOUT, timeoutMs),
        getTimeout: () => ipc.invoke(AUTH_SESSION_CHANNELS.GET_TIMEOUT),
    };
}

