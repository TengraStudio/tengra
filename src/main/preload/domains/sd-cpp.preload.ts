/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
        getStatus: () => ipc.invoke('sd-cpp:getStatus'),
        reinstall: () => ipc.invoke('sd-cpp:reinstall'),
        getHistory: limit => ipc.invoke('sd-cpp:getHistory', limit),
        searchHistory: (query, limit) => ipc.invoke('sd-cpp:searchHistory', query, limit),
        exportHistory: format => ipc.invoke('sd-cpp:exportHistory', format),
        regenerate: historyId => ipc.invoke('sd-cpp:regenerate', historyId),
        getAnalytics: () => ipc.invoke('sd-cpp:getAnalytics'),
        getPresetAnalytics: () => ipc.invoke('sd-cpp:getPresetAnalytics'),
        getScheduleAnalytics: () => ipc.invoke('sd-cpp:getScheduleAnalytics'),
        listPresets: () => ipc.invoke('sd-cpp:listPresets'),
        savePreset: preset => ipc.invoke('sd-cpp:savePreset', preset),
        deletePreset: id => ipc.invoke('sd-cpp:deletePreset', id),
        exportPresetShare: id => ipc.invoke('sd-cpp:exportPresetShare', id),
        importPresetShare: code => ipc.invoke('sd-cpp:importPresetShare', code),
        listWorkflowTemplates: () => ipc.invoke('sd-cpp:listWorkflowTemplates'),
        saveWorkflowTemplate: payload => ipc.invoke('sd-cpp:saveWorkflowTemplate', payload),
        deleteWorkflowTemplate: id => ipc.invoke('sd-cpp:deleteWorkflowTemplate', id),
        exportWorkflowTemplateShare: id => ipc.invoke('sd-cpp:exportWorkflowTemplateShare', id),
        importWorkflowTemplateShare: code => ipc.invoke('sd-cpp:importWorkflowTemplateShare', code),
        schedule: payload => ipc.invoke('sd-cpp:schedule', payload),
        listSchedules: () => ipc.invoke('sd-cpp:listSchedules'),
        cancelSchedule: id => ipc.invoke('sd-cpp:cancelSchedule', id),
        compare: ids => ipc.invoke('sd-cpp:compare', ids),
        exportComparison: payload => ipc.invoke('sd-cpp:exportComparison', payload),
        shareComparison: ids => ipc.invoke('sd-cpp:shareComparison', ids),
        batchGenerate: requests => ipc.invoke('sd-cpp:batchGenerate', requests),
        getQueueStats: () => ipc.invoke('sd-cpp:getQueueStats'),
        edit: options => ipc.invoke('sd-cpp:edit', options),
        onSdCppStatus: (callback: (data: RuntimeValue) => void) => {
            const listener = (_event: IpcRendererEvent, data: RuntimeValue) => callback(data);
            ipc.on('sd-cpp:status', listener);
            return () => {
                ipc.removeListener('sd-cpp:status', listener);
            };
        },
        onSdCppProgress: (callback: (data: RuntimeValue) => void) => {
            const listener = (_event: IpcRendererEvent, data: RuntimeValue) => callback(data);
            ipc.on('sd-cpp:progress', listener);
            return () => {
                ipc.removeListener('sd-cpp:progress', listener);
            };
        },
    };
}
