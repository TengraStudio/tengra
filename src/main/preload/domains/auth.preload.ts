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

export interface AuthBridge {
    githubLogin: (appId?: 'profile' | 'copilot') => Promise<{
        device_code: string;
        user_code: string;
        verification_uri: string;
        expires_in: number;
        interval: number;
    }>;
    pollToken: (
        deviceCode: string,
        interval: number,
        appId?: 'profile' | 'copilot'
    ) => Promise<{
        success: boolean;
        account?: {
            provider: string;
            email?: string;
            displayName?: string;
            avatarUrl?: string;
        };
        error?: string;
    }>;
}

export function createAuthBridge(ipc: IpcRenderer): AuthBridge {
    return {
        githubLogin: (appId?: 'profile' | 'copilot') => ipc.invoke('auth:github-login', appId),
        pollToken: (deviceCode: string, interval: number, appId?: 'profile' | 'copilot') =>
            ipc.invoke('auth:poll-token', deviceCode, interval, appId),
    };
}
