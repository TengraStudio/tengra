/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ADVANCED_MEMORY_CHANNELS } from '@shared/constants/ipc-channels';
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
        getPending: () => ipc.invoke(ADVANCED_MEMORY_CHANNELS.GET_PENDING),
        confirm: (id, adjustments) => ipc.invoke(ADVANCED_MEMORY_CHANNELS.CONFIRM, id, adjustments),
        reject: (id, reason) => ipc.invoke(ADVANCED_MEMORY_CHANNELS.REJECT, id, reason),
        confirmAll: () => ipc.invoke(ADVANCED_MEMORY_CHANNELS.CONFIRM_ALL),
        rejectAll: () => ipc.invoke(ADVANCED_MEMORY_CHANNELS.REJECT_ALL),
        remember: (content, options) => ipc.invoke(ADVANCED_MEMORY_CHANNELS.REMEMBER, content, options),
        recall: context => ipc.invoke(ADVANCED_MEMORY_CHANNELS.RECALL, context),
        search: (query, limit) => ipc.invoke(ADVANCED_MEMORY_CHANNELS.SEARCH, query, limit),
        searchResolutions: (query, limit) => ipc.invoke(ADVANCED_MEMORY_CHANNELS.SEARCH_RESOLUTIONS, query, limit),
        getSearchAnalytics: () => ipc.invoke(ADVANCED_MEMORY_CHANNELS.GET_SEARCH_ANALYTICS),
        getSearchHistory: limit => ipc.invoke(ADVANCED_MEMORY_CHANNELS.GET_SEARCH_HISTORY, limit),
        getSearchSuggestions: (prefix, limit) => ipc.invoke(ADVANCED_MEMORY_CHANNELS.GET_SEARCH_SUGGESTIONS, prefix, limit),
        export: (query, limit) => ipc.invoke(ADVANCED_MEMORY_CHANNELS.EXPORT, query, limit),
        import: payload => ipc.invoke(ADVANCED_MEMORY_CHANNELS.IMPORT, payload),
        getStats: () => ipc.invoke(ADVANCED_MEMORY_CHANNELS.GET_STATS),
        runDecay: () => ipc.invoke(ADVANCED_MEMORY_CHANNELS.RUN_DECAY),
        extractFromMessage: (content, sourceId, workspaceId) => ipc.invoke(ADVANCED_MEMORY_CHANNELS.EXTRACT_FROM_MESSAGE, content, sourceId, workspaceId),
        delete: id => ipc.invoke(ADVANCED_MEMORY_CHANNELS.DELETE, id),
        deleteMany: ids => ipc.invoke(ADVANCED_MEMORY_CHANNELS.DELETE_MANY, ids),
        edit: (id, updates) => ipc.invoke(ADVANCED_MEMORY_CHANNELS.EDIT, id, updates),
        archive: id => ipc.invoke(ADVANCED_MEMORY_CHANNELS.ARCHIVE, id),
        archiveMany: ids => ipc.invoke(ADVANCED_MEMORY_CHANNELS.ARCHIVE_MANY, ids),
        restore: id => ipc.invoke(ADVANCED_MEMORY_CHANNELS.RESTORE, id),
        get: id => ipc.invoke(ADVANCED_MEMORY_CHANNELS.GET, id),
        shareWithWorkspace: (memoryId, targetWorkspaceId) => ipc.invoke(ADVANCED_MEMORY_CHANNELS.SHARE_WITH_WORKSPACE, memoryId, targetWorkspaceId),
        createSharedNamespace: payload => ipc.invoke(ADVANCED_MEMORY_CHANNELS.CREATE_SHARED_NAMESPACE, payload),
        syncSharedNamespace: request => ipc.invoke(ADVANCED_MEMORY_CHANNELS.SYNC_SHARED_NAMESPACE, request),
        getSharedNamespaceAnalytics: namespaceId => ipc.invoke(ADVANCED_MEMORY_CHANNELS.GET_SHARED_NAMESPACE_ANALYTICS, namespaceId),
        searchAcrossWorkspaces: payload => ipc.invoke(ADVANCED_MEMORY_CHANNELS.SEARCH_ACROSS_WORKSPACES, payload),
        getHistory: id => ipc.invoke(ADVANCED_MEMORY_CHANNELS.GET_HISTORY, id),
        rollback: (id, versionIndex) => ipc.invoke(ADVANCED_MEMORY_CHANNELS.ROLLBACK, id, versionIndex),
        recategorize: ids => ipc.invoke(ADVANCED_MEMORY_CHANNELS.RECATEGORIZE, ids),
        getAllEntityKnowledge: () => ipc.invoke(ADVANCED_MEMORY_CHANNELS.GET_ALL_ENTITY_KNOWLEDGE),
        getAllEpisodes: () => ipc.invoke(ADVANCED_MEMORY_CHANNELS.GET_ALL_EPISODES),
        getAllAdvancedMemories: () => ipc.invoke(ADVANCED_MEMORY_CHANNELS.GET_ALL),
        health: () => ipc.invoke(ADVANCED_MEMORY_CHANNELS.HEALTH),
    };
}

