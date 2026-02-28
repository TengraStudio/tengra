import { IpcRenderer } from 'electron';

export interface SdCppBridge {
    getStatus: () => Promise<unknown>;
    reinstall: () => Promise<void>;
    getHistory: (limit?: number) => Promise<unknown[]>;
    searchHistory: (query: string, limit?: number) => Promise<unknown[]>;
    exportHistory: (format?: 'json' | 'csv') => Promise<string>;
    regenerate: (historyId: string) => Promise<unknown>;
    getAnalytics: () => Promise<unknown>;
    getPresetAnalytics: () => Promise<unknown>;
    getScheduleAnalytics: () => Promise<unknown>;
    listPresets: () => Promise<unknown[]>;
    savePreset: (preset: unknown) => Promise<unknown>;
    deletePreset: (id: string) => Promise<void>;
    exportPresetShare: (id: string) => Promise<string>;
    importPresetShare: (code: string) => Promise<unknown>;
    listWorkflowTemplates: () => Promise<unknown[]>;
    saveWorkflowTemplate: (payload: unknown) => Promise<unknown>;
    deleteWorkflowTemplate: (id: string) => Promise<void>;
    exportWorkflowTemplateShare: (id: string) => Promise<string>;
    importWorkflowTemplateShare: (code: string) => Promise<unknown>;
    schedule: (payload: unknown) => Promise<unknown>;
    listSchedules: () => Promise<unknown[]>;
    cancelSchedule: (id: string) => Promise<void>;
    compare: (ids: string[]) => Promise<unknown>;
    exportComparison: (payload: { ids: string[]; format?: 'json' | 'csv' }) => Promise<string>;
    shareComparison: (ids: string[]) => Promise<string>;
    batchGenerate: (requests: unknown[]) => Promise<unknown>;
    getQueueStats: () => Promise<unknown>;
    edit: (options: unknown) => Promise<unknown>;
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
    };
}
