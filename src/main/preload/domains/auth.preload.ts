/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { AUTH_CHANNELS } from '@shared/constants/ipc-channels';
import { IpcRenderer } from 'electron';

export interface AuthBridge {
    copilotLogin: () => Promise<{
        device_code: string;
        user_code: string;
        verification_uri: string;
        expires_in: number;
        interval: number;
    }>;
    pollToken: (
        deviceCode: string,
        interval: number
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
    createAccount: (name: string) => Promise<{ success: boolean; error?: string }>;
    switchAccount: (id: string) => Promise<{ success: boolean; error?: string }>;
    onAccountChanged: (callback: () => void) => () => void;
}

export function createAuthBridge(ipc: IpcRenderer): AuthBridge {
    return {
        copilotLogin: () => ipc.invoke(AUTH_CHANNELS.COPILOT_LOGIN),
        pollToken: (deviceCode: string, interval: number) =>
            ipc.invoke(AUTH_CHANNELS.POLL_TOKEN, deviceCode, interval),
        createAccount: (name: string) => ipc.invoke(AUTH_CHANNELS.CREATE_ACCOUNT, name),
        switchAccount: (id: string) => ipc.invoke(AUTH_CHANNELS.SWITCH_ACCOUNT, id),
        onAccountChanged: callback => {
            const listener = () => callback();
            ipc.on(AUTH_CHANNELS.ACCOUNT_CHANGED_EVENT, listener);
            return () => ipc.removeListener(AUTH_CHANNELS.ACCOUNT_CHANGED_EVENT, listener);
        },
    };
}

