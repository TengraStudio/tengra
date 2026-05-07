/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { SD_CPP_CHANNELS } from '@shared/constants/ipc-channels';
import { IpcRenderer, IpcRendererEvent } from 'electron';

export interface SdCppBridge {
    getStatus: () => Promise<RuntimeValue>;
    reinstall: () => Promise<void>;
    getHistory: (limit?: number) => Promise<RuntimeValue[]>;
    searchHistory: (query: string, limit?: number) => Promise<RuntimeValue[]>;
    exportHistory: (format?: 'json' | 'csv') => Promise<string>;
    regenerate: (historyId: string) => Promise<RuntimeValue>;
    getAnalytics: () => Promise<RuntimeValue>;
    getPresetAnalytics: () => Promise<RuntimeValue>;
    getScheduleAnalytics: () => Promise<RuntimeValue>;
    listPresets: () => Promise<RuntimeValue[]>;
    savePreset: (preset: RuntimeValue) => Promise<RuntimeValue>;
    deletePreset: (id: string) => Promise<void>;
    exportPresetShare: (id: string) => Promise<string>;
    importPresetShare: (code: string) => Promise<RuntimeValue>;
    listWorkflowTemplates: () => Promise<RuntimeValue[]>;
    saveWorkflowTemplate: (payload: RuntimeValue) => Promise<RuntimeValue>;
    deleteWorkflowTemplate: (id: string) => Promise<void>;
    exportWorkflowTemplateShare: (id: string) => Promise<string>;
    importWorkflowTemplateShare: (code: string) => Promise<RuntimeValue>;
    schedule: (payload: RuntimeValue) => Promise<RuntimeValue>;
    listSchedules: () => Promise<RuntimeValue[]>;
    cancelSchedule: (id: string) => Promise<void>;
    compare: (ids: string[]) => Promise<RuntimeValue>;
    exportComparison: (payload: { ids: string[]; format?: 'json' | 'csv' }) => Promise<string>;
    shareComparison: (ids: string[]) => Promise<string>;
    batchGenerate: (requests: RuntimeValue[]) => Promise<RuntimeValue>;
    getQueueStats: () => Promise<RuntimeValue>;
    edit: (options: RuntimeValue) => Promise<RuntimeValue>;
    onSdCppStatus: (callback: (data: RuntimeValue) => void) => () => void;
    onSdCppProgress: (callback: (data: RuntimeValue) => void) => () => void;
}

export function createSdCppBridge(ipc: IpcRenderer): SdCppBridge {
    return {
        getStatus: () => ipc.invoke(SD_CPP_CHANNELS.GET_STATUS),
        reinstall: () => ipc.invoke(SD_CPP_CHANNELS.REINSTALL),
        getHistory: limit => ipc.invoke(SD_CPP_CHANNELS.GET_HISTORY, limit),
        searchHistory: (query, limit) => ipc.invoke(SD_CPP_CHANNELS.SEARCH_HISTORY, query, limit),
        exportHistory: format => ipc.invoke(SD_CPP_CHANNELS.EXPORT_HISTORY, format),
        regenerate: historyId => ipc.invoke(SD_CPP_CHANNELS.REGENERATE, historyId),
        getAnalytics: () => ipc.invoke(SD_CPP_CHANNELS.GET_ANALYTICS),
        getPresetAnalytics: () => ipc.invoke(SD_CPP_CHANNELS.GET_PRESET_ANALYTICS),
        getScheduleAnalytics: () => ipc.invoke(SD_CPP_CHANNELS.GET_SCHEDULE_ANALYTICS),
        listPresets: () => ipc.invoke(SD_CPP_CHANNELS.LIST_PRESETS),
        savePreset: preset => ipc.invoke(SD_CPP_CHANNELS.SAVE_PRESET, preset),
        deletePreset: id => ipc.invoke(SD_CPP_CHANNELS.DELETE_PRESET, id),
        exportPresetShare: id => ipc.invoke(SD_CPP_CHANNELS.EXPORT_PRESET_SHARE, id),
        importPresetShare: code => ipc.invoke(SD_CPP_CHANNELS.IMPORT_PRESET_SHARE, code),
        listWorkflowTemplates: () => ipc.invoke(SD_CPP_CHANNELS.LIST_WORKFLOW_TEMPLATES),
        saveWorkflowTemplate: payload => ipc.invoke(SD_CPP_CHANNELS.SAVE_WORKFLOW_TEMPLATE, payload),
        deleteWorkflowTemplate: id => ipc.invoke(SD_CPP_CHANNELS.DELETE_WORKFLOW_TEMPLATE, id),
        exportWorkflowTemplateShare: id => ipc.invoke(SD_CPP_CHANNELS.EXPORT_WORKFLOW_TEMPLATE_SHARE, id),
        importWorkflowTemplateShare: code => ipc.invoke(SD_CPP_CHANNELS.IMPORT_WORKFLOW_TEMPLATE_SHARE, code),
        schedule: payload => ipc.invoke(SD_CPP_CHANNELS.SCHEDULE, payload),
        listSchedules: () => ipc.invoke(SD_CPP_CHANNELS.LIST_SCHEDULES),
        cancelSchedule: id => ipc.invoke(SD_CPP_CHANNELS.CANCEL_SCHEDULE, id),
        compare: ids => ipc.invoke(SD_CPP_CHANNELS.COMPARE, ids),
        exportComparison: payload => ipc.invoke(SD_CPP_CHANNELS.EXPORT_COMPARISON, payload),
        shareComparison: ids => ipc.invoke(SD_CPP_CHANNELS.SHARE_COMPARISON, ids),
        batchGenerate: requests => ipc.invoke(SD_CPP_CHANNELS.BATCH_GENERATE, requests),
        getQueueStats: () => ipc.invoke(SD_CPP_CHANNELS.GET_QUEUE_STATS),
        edit: options => ipc.invoke(SD_CPP_CHANNELS.EDIT, options),
        onSdCppStatus: (callback: (data: RuntimeValue) => void) => {
            const listener = (_event: IpcRendererEvent, data: RuntimeValue) => callback(data);
            ipc.on(SD_CPP_CHANNELS.STATUS, listener);
            return () => {
                ipc.removeListener(SD_CPP_CHANNELS.STATUS, listener);
            };
        },
        onSdCppProgress: (callback: (data: RuntimeValue) => void) => {
            const listener = (_event: IpcRendererEvent, data: RuntimeValue) => callback(data);
            ipc.on(SD_CPP_CHANNELS.PROGRESS, listener);
            return () => {
                ipc.removeListener(SD_CPP_CHANNELS.PROGRESS, listener);
            };
        },
    };
}

