/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { SETTINGS_CHANNELS } from '@shared/constants/ipc-channels';
import { AppSettings } from '@shared/types';
import { IpcRenderer } from 'electron';

export interface SettingsBridge {
    getSettings: () => Promise<AppSettings>;
    saveSettings: (settings: AppSettings) => Promise<AppSettings>;
    health: () => Promise<{
        status: 'healthy' | 'degraded';
        uiState: 'ready' | 'failure';
        metrics: Record<string, RuntimeValue>;
        budgets: { getMs: number; saveMs: number };
    }>;
}

export function createSettingsBridge(ipc: IpcRenderer): SettingsBridge {
    return {
        getSettings: () => ipc.invoke(SETTINGS_CHANNELS.GET),
        saveSettings: settings => ipc.invoke(SETTINGS_CHANNELS.SAVE, settings),
        health: () => ipc.invoke(SETTINGS_CHANNELS.HEALTH),
    };
}

