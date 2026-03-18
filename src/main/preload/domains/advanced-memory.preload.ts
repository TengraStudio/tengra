import {
    AdvancedSemanticFragment,
    MemoryCategory,
    MemoryImportResult,
    MemorySearchAnalytics,
    MemorySearchHistoryEntry,
    MemoryStatistics,
    RecallContext,
} from '@shared/types/advanced-memory';
import { IpcRenderer, IpcRendererEvent } from 'electron';

export interface AdvancedMemoryBridge {
    addFragment: (fragment: Partial<AdvancedSemanticFragment>) => Promise<{ success: boolean; id?: string; error?: string }>;
    getFragment: (id: string) => Promise<AdvancedSemanticFragment | null>;
    updateFragment: (id: string, updates: Partial<AdvancedSemanticFragment>) => Promise<{ success: boolean; error?: string }>;
    deleteFragment: (id: string) => Promise<{ success: boolean; error?: string }>;
    search: (query: string, options?: {
        categories?: MemoryCategory[];
        tags?: string[];
        limit?: number;
        minScore?: number;
        includeContext?: boolean;
    }) => Promise<{ fragments: AdvancedSemanticFragment[]; context?: RecallContext }>;
    getStats: () => Promise<MemoryStatistics>;
    getAnalytics: (period?: 'day' | 'week' | 'month') => Promise<MemorySearchAnalytics>;
    getRecentActivity: (limit?: number) => Promise<AdvancedSemanticFragment[]>;
    getSearchHistory: (limit?: number) => Promise<MemorySearchHistoryEntry[]>;
    clearHistory: () => Promise<{ success: boolean }>;
    importData: (payload: string, options?: { format: 'json' | 'csv' | 'markdown'; merge?: boolean }) => Promise<MemoryImportResult>;
    exportData: (options?: { categories?: MemoryCategory[]; format: 'json' | 'csv' | 'markdown' }) => Promise<string>;
    getPendingCount: () => Promise<number>;
    processPending: () => Promise<{ success: boolean; processed: number; errors: string[] }>;
    onSyncStatus: (callback: (status: {
        lastSync: number;
        pending: number;
        status: 'idle' | 'syncing' | 'error';
        error?: string;
    }) => void) => () => void;
}

export function createAdvancedMemoryBridge(ipc: IpcRenderer): AdvancedMemoryBridge {
    return {
        addFragment: fragment => ipc.invoke('memory:advanced:add', fragment),
        getFragment: id => ipc.invoke('memory:advanced:get', id),
        updateFragment: (id, updates) => ipc.invoke('memory:advanced:update', { id, updates }),
        deleteFragment: id => ipc.invoke('memory:advanced:delete', id),
        search: (query, options) => ipc.invoke('memory:advanced:search', { query, options }),
        getStats: () => ipc.invoke('memory:advanced:stats'),
        getAnalytics: period => ipc.invoke('memory:advanced:analytics', period),
        getRecentActivity: limit => ipc.invoke('memory:advanced:recent', limit),
        getSearchHistory: limit => ipc.invoke('memory:advanced:history', limit),
        clearHistory: () => ipc.invoke('memory:advanced:clear-history'),
        importData: (payload, options) => ipc.invoke('memory:advanced:import', { payload, options }),
        exportData: options => ipc.invoke('memory:advanced:export', options),
        getPendingCount: () => ipc.invoke('memory:advanced:pending-count'),
        processPending: () => ipc.invoke('memory:advanced:process-pending'),
        onSyncStatus: callback => {
            const listener = (_event: IpcRendererEvent, status: Record<string, RuntimeValue>) =>
                callback(status as Parameters<Parameters<AdvancedMemoryBridge['onSyncStatus']>[0]>[0]);
            ipc.on('memory:advanced:sync-status', listener);
            return () => ipc.removeListener('memory:advanced:sync-status', listener);
        },
    };
}
