/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
    AdvancedMemoryHealthSummary,
    AdvancedSemanticFragment,
    MemoryCategory,
    PendingMemory
} from '@shared/types/advanced-memory';
import { RuntimeValue } from '@shared/types/common';
import { IpcRenderer } from 'electron';

export interface AdvancedMemoryBridge {
    getPending: () => Promise<{ success: boolean; data: PendingMemory[]; error?: string }>;
    confirm: (id: string, adjustments?: {
        content?: string;
        category?: MemoryCategory;
        tags?: string[];
        importance?: number;
    }) => Promise<{ success: boolean; data?: AdvancedSemanticFragment; error?: string }>;
    reject: (id: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
    confirmAll: () => Promise<{ success: boolean; confirmed: number; error?: string }>;
    rejectAll: () => Promise<{ success: boolean; rejected: number; error?: string }>;
    remember: (content: string, options?: {
        category?: MemoryCategory;
        tags?: string[];
        workspaceId?: string;
    }) => Promise<{ success: boolean; data?: AdvancedSemanticFragment; error?: string }>;
    recall: (context: Record<string, RuntimeValue>) => Promise<{ success: boolean; data: { memories: AdvancedSemanticFragment[]; totalMatches: number }; error?: string }>;
    search: (query: string, limit?: number) => Promise<{ success: boolean; data: AdvancedSemanticFragment[]; error?: string }>;
    searchResolutions: (query: string, limit?: number) => Promise<{ success: boolean; data: AdvancedSemanticFragment[]; error?: string }>;
    getSearchAnalytics: () => Promise<{ success: boolean; data: RuntimeValue; error?: string }>;
    getSearchHistory: (limit?: number) => Promise<{ success: boolean; data: RuntimeValue[]; error?: string }>;
    getSearchSuggestions: (prefix?: string, limit?: number) => Promise<{ success: boolean; data: string[]; error?: string }>;
    export: (query?: string, limit?: number) => Promise<{ success: boolean; data?: RuntimeValue; error?: string }>;
    import: (payload: {
        memories?: Array<Partial<AdvancedSemanticFragment>>;
        pendingMemories?: Array<Partial<PendingMemory>>;
        replaceExisting?: boolean;
    }) => Promise<{ success: boolean; data?: RuntimeValue; error?: string }>;
    getStats: () => Promise<{ success: boolean; data?: RuntimeValue; error?: string }>;
    runDecay: () => Promise<{ success: boolean; error?: string }>;
    extractFromMessage: (content: string, sourceId: string, workspaceId?: string) => Promise<{ success: boolean; data: PendingMemory[]; error?: string }>;
    delete: (id: string) => Promise<{ success: boolean; error?: string }>;
    deleteMany: (ids: string[]) => Promise<{ success: boolean; deleted: number; failed: string[]; error?: string }>;
    edit: (id: string, updates: Record<string, RuntimeValue>) => Promise<{ success: boolean; data?: AdvancedSemanticFragment; error?: string }>;
    archive: (id: string) => Promise<{ success: boolean; error?: string }>;
    archiveMany: (ids: string[]) => Promise<{ success: boolean; archived: number; failed: string[]; error?: string }>;
    restore: (id: string) => Promise<{ success: boolean; error?: string }>;
    get: (id: string) => Promise<{ success: boolean; data?: AdvancedSemanticFragment; error?: string }>;
    shareWithWorkspace: (memoryId: string, targetWorkspaceId: string) => Promise<{ success: boolean; data?: AdvancedSemanticFragment; error?: string }>;
    createSharedNamespace: (payload: {
        id: string;
        name: string;
        workspaceIds: string[];
        accessControl?: Record<string, string[]>;
    }) => Promise<{ success: boolean; data?: RuntimeValue; error?: string }>;
    syncSharedNamespace: (request: Record<string, RuntimeValue>) => Promise<{ success: boolean; data?: RuntimeValue; error?: string }>;
    getSharedNamespaceAnalytics: (namespaceId: string) => Promise<{ success: boolean; data?: RuntimeValue; error?: string }>;
    searchAcrossWorkspaces: (payload: {
        namespaceId: string;
        query: string;
        workspaceId: string;
        limit?: number;
    }) => Promise<{ success: boolean; data: AdvancedSemanticFragment[]; error?: string }>;
    getHistory: (id: string) => Promise<{ success: boolean; data: RuntimeValue[]; error?: string }>;
    rollback: (id: string, versionIndex: number) => Promise<{ success: boolean; data?: AdvancedSemanticFragment; error?: string }>;
    recategorize: (ids?: string[]) => Promise<{ success: boolean; error?: string }>;
    getAllEntityKnowledge: () => Promise<{ success: boolean; data: RuntimeValue[]; error?: string }>;
    getAllEpisodes: () => Promise<{ success: boolean; data: RuntimeValue[]; error?: string }>;
    getAllAdvancedMemories: () => Promise<{ success: boolean; data: AdvancedSemanticFragment[]; error?: string }>;
    health: () => Promise<{ success: boolean; data?: AdvancedMemoryHealthSummary; error?: string }>;
}

export function createAdvancedMemoryBridge(ipc: IpcRenderer): AdvancedMemoryBridge {
    return {
        getPending: () => ipc.invoke('advancedMemory:getPending'),
        confirm: (id, adjustments) => ipc.invoke('advancedMemory:confirm', id, adjustments),
        reject: (id, reason) => ipc.invoke('advancedMemory:reject', id, reason),
        confirmAll: () => ipc.invoke('advancedMemory:confirmAll'),
        rejectAll: () => ipc.invoke('advancedMemory:rejectAll'),
        remember: (content, options) => ipc.invoke('advancedMemory:remember', content, options),
        recall: context => ipc.invoke('advancedMemory:recall', context),
        search: (query, limit) => ipc.invoke('advancedMemory:search', query, limit),
        searchResolutions: (query, limit) => ipc.invoke('advancedMemory:searchResolutions', query, limit),
        getSearchAnalytics: () => ipc.invoke('advancedMemory:getSearchAnalytics'),
        getSearchHistory: limit => ipc.invoke('advancedMemory:getSearchHistory', limit),
        getSearchSuggestions: (prefix, limit) => ipc.invoke('advancedMemory:getSearchSuggestions', prefix, limit),
        export: (query, limit) => ipc.invoke('advancedMemory:export', query, limit),
        import: payload => ipc.invoke('advancedMemory:import', payload),
        getStats: () => ipc.invoke('advancedMemory:getStats'),
        runDecay: () => ipc.invoke('advancedMemory:runDecay'),
        extractFromMessage: (content, sourceId, workspaceId) => ipc.invoke('advancedMemory:extractFromMessage', content, sourceId, workspaceId),
        delete: id => ipc.invoke('advancedMemory:delete', id),
        deleteMany: ids => ipc.invoke('advancedMemory:deleteMany', ids),
        edit: (id, updates) => ipc.invoke('advancedMemory:edit', id, updates),
        archive: id => ipc.invoke('advancedMemory:archive', id),
        archiveMany: ids => ipc.invoke('advancedMemory:archiveMany', ids),
        restore: id => ipc.invoke('advancedMemory:restore', id),
        get: id => ipc.invoke('advancedMemory:get', id),
        shareWithWorkspace: (memoryId, targetWorkspaceId) => ipc.invoke('advancedMemory:shareWithWorkspace', memoryId, targetWorkspaceId),
        createSharedNamespace: payload => ipc.invoke('advancedMemory:createSharedNamespace', payload),
        syncSharedNamespace: request => ipc.invoke('advancedMemory:syncSharedNamespace', request),
        getSharedNamespaceAnalytics: namespaceId => ipc.invoke('advancedMemory:getSharedNamespaceAnalytics', namespaceId),
        searchAcrossWorkspaces: payload => ipc.invoke('advancedMemory:searchAcrossWorkspaces', payload),
        getHistory: id => ipc.invoke('advancedMemory:getHistory', id),
        rollback: (id, versionIndex) => ipc.invoke('advancedMemory:rollback', id, versionIndex),
        recategorize: ids => ipc.invoke('advancedMemory:recategorize', ids),
        getAllEntityKnowledge: () => ipc.invoke('advancedMemory:getAllEntityKnowledge'),
        getAllEpisodes: () => ipc.invoke('advancedMemory:getAllEpisodes'),
        getAllAdvancedMemories: () => ipc.invoke('advancedMemory:getAllAdvancedMemories'),
        health: () => ipc.invoke('advancedMemory:health'),
    };
}
