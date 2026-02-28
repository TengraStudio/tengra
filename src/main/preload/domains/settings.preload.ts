import { AppSettings } from '@shared/types';
import { IpcRenderer } from 'electron';

export interface SettingsBridge {
    getSettings: () => Promise<AppSettings>;
    saveSettings: (settings: AppSettings) => Promise<AppSettings>;
    health: () => Promise<{
        status: 'healthy' | 'degraded';
        uiState: 'ready' | 'failure';
        metrics: Record<string, unknown>;
        budgets: { getMs: number; saveMs: number };
    }>;
}

export function createSettingsBridge(ipc: IpcRenderer): SettingsBridge {
    return {
        getSettings: () => ipc.invoke('settings:get'),
        saveSettings: settings => ipc.invoke('settings:save', settings),
        health: () => ipc.invoke('settings:health'),
    };
}
