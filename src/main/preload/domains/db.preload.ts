/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { DB_CHANNELS } from '@shared/constants/ipc-channels';
import { Chat, Folder, Message, Workspace } from '@shared/types';
import { IpcRenderer, IpcRendererEvent } from 'electron';

export interface DbBridge {
    createChat: (chat: Chat) => Promise<{ success: boolean }>;
    updateChat: (id: string, updates: Partial<Chat>) => Promise<{ success: boolean }>;
    deleteChat: (id: string) => Promise<{ success: boolean }>;
    duplicateChat: (id: string) => Promise<Chat>;
    archiveChat: (id: string, isArchived: boolean) => Promise<{ success: boolean }>;
    bulkDeleteChats: (ids: string[]) => Promise<{ success: boolean }>;
    bulkArchiveChats: (ids: string[], isArchived: boolean) => Promise<{ success: boolean }>;
    getChat: (id: string) => Promise<Chat | null>;
    getAllChats: () => Promise<Chat[]>;
    getPrompts: () => Promise<{ id: string; title: string; content: string; tags: string[] }[]>;
    createPrompt: (
        title: string,
        content: string,
        tags?: string[]
    ) => Promise<{ success: boolean }>;
    updatePrompt: (
        id: string,
        updates: Record<string, import('@shared/types').IpcValue>
    ) => Promise<{ success: boolean }>;

    deletePrompt: (id: string) => Promise<{ success: boolean }>;
    searchChats: (query: string) => Promise<Chat[]>;
    addMessage: (message: Message) => Promise<{ success: boolean }>;
    deleteMessage: (id: string) => Promise<{ success: boolean }>;
    updateMessage: (id: string, updates: Partial<Message>) => Promise<{ success: boolean }>;
    deleteAllChats: () => Promise<{ success: boolean }>;
    deleteChatsByTitle: (title: string) => Promise<number>;
    deleteMessages: (chatId: string) => Promise<{ success: boolean }>;
    getMessages: (chatId: string) => Promise<Message[]>;
    getStats: () => Promise<{ chatCount: number; messageCount: number; dbSize: number }>;
    getDetailedStats: (period: string) => Promise<{
        chatCount: number;
        messageCount: number;
        dbSize: number;
        totalTokens: number;
        promptTokens: number;
        completionTokens: number;
        tokenTimeline: { timestamp: number; promptTokens: number; completionTokens: number }[];
        activity: number[];
    }>;
    getTokenStats: (period: 'daily' | 'weekly' | 'monthly') => Promise<{
        totalSent: number;
        totalReceived: number;
        totalCost: number;
        timeline: Array<{ timestamp: number; sent: number; received: number }>;
        byProvider: Record<string, { sent: number; received: number; cost: number }>;
        byModel: Record<string, { sent: number; received: number; cost: number }>;
    }>;
    addTokenUsage: (record: {
        messageId?: string;
        chatId: string;
        workspaceId?: string;
        provider: string;
        model: string;
        tokensSent: number;
        tokensReceived: number;
        costEstimate?: number;
    }) => Promise<{ success: boolean }>;
    getWorkspaces: () => Promise<Workspace[]>;
    createWorkspace: (
        name: string,
        path: string,
        description: string,
        mounts?: import('@shared/types').WorkspaceMount[]
    ) => Promise<Workspace>;
    updateWorkspace: (id: string, updates: Partial<Workspace>) => Promise<Workspace | null>;
    deleteWorkspace: (id: string, deleteFiles?: boolean) => Promise<void>;
    archiveWorkspace: (id: string, isArchived: boolean) => Promise<void>;
    bulkDeleteWorkspaces: (ids: string[], deleteFiles?: boolean) => Promise<void>;
    bulkArchiveWorkspaces: (ids: string[], isArchived: boolean) => Promise<void>;
    createFolder: (name: string, color?: string) => Promise<Folder>;
    deleteFolder: (id: string) => Promise<void>;
    updateFolder: (id: string, updates: Partial<Folder>) => Promise<void>;
    getFolders: () => Promise<Folder[]>;
    onWorkspaceUpdated: (callback: (payload: { id?: string }) => void) => () => void;
}

export function createDbBridge(ipc: IpcRenderer): DbBridge {
    return {
        createChat: chat => ipc.invoke(DB_CHANNELS.CREATE_CHAT, chat),
        updateChat: (id, updates) => ipc.invoke(DB_CHANNELS.CHAT_UPDATE, id, updates),
        deleteChat: id => ipc.invoke(DB_CHANNELS.CHAT_DELETE, id),
        duplicateChat: id => ipc.invoke(DB_CHANNELS.DUPLICATE_CHAT, id),
        archiveChat: (id, isArchived) => ipc.invoke(DB_CHANNELS.ARCHIVE_CHAT, id, isArchived),
        bulkDeleteChats: ids => ipc.invoke(DB_CHANNELS.BULK_DELETE_CHATS, ids),
        bulkArchiveChats: (ids, isArchived) => ipc.invoke(DB_CHANNELS.BULK_ARCHIVE_CHATS, ids, isArchived),
        getChat: id => ipc.invoke(DB_CHANNELS.CHAT_GET, id),
        getAllChats: () => ipc.invoke(DB_CHANNELS.GET_ALL_CHATS),
        getPrompts: () => ipc.invoke(DB_CHANNELS.GET_PROMPTS),
        createPrompt: (title, content, tags) => ipc.invoke(DB_CHANNELS.CREATE_PROMPT, title, content, tags),
        updatePrompt: (id, updates) => ipc.invoke(DB_CHANNELS.UPDATE_PROMPT, id, updates),
        deletePrompt: id => ipc.invoke(DB_CHANNELS.DELETE_PROMPT, id),
        searchChats: query => ipc.invoke(DB_CHANNELS.SEARCH_CHATS, query),
        addMessage: message => ipc.invoke(DB_CHANNELS.ADD_MESSAGE, message),
        deleteMessage: id => ipc.invoke(DB_CHANNELS.DELETE_MESSAGE, id),
        updateMessage: (id, updates) => ipc.invoke(DB_CHANNELS.UPDATE_MESSAGE, id, updates),
        deleteAllChats: () => ipc.invoke(DB_CHANNELS.DELETE_ALL_CHATS),
        deleteChatsByTitle: title => ipc.invoke(DB_CHANNELS.DELETE_CHATS_BY_TITLE, title),
        deleteMessages: chatId => ipc.invoke(DB_CHANNELS.DELETE_MESSAGES, chatId),
        getMessages: chatId => ipc.invoke(DB_CHANNELS.GET_MESSAGES, chatId),
        getStats: () => ipc.invoke(DB_CHANNELS.GET_STATS),
        getDetailedStats: period => ipc.invoke(DB_CHANNELS.GET_DETAILED_STATS, period),
        getTokenStats: period => ipc.invoke(DB_CHANNELS.GET_TOKEN_STATS, period),
        addTokenUsage: record => ipc.invoke(DB_CHANNELS.ADD_TOKEN_USAGE, record),
        getWorkspaces: () => ipc.invoke(DB_CHANNELS.GET_WORKSPACES),
        createWorkspace: (name, path, description, mounts) =>
            ipc.invoke(DB_CHANNELS.CREATE_WORKSPACE, {
                title: name,
                path,
                description,
                mounts
            }),
        updateWorkspace: (id, updates) => ipc.invoke(DB_CHANNELS.UPDATE_WORKSPACE, id, updates),
        deleteWorkspace: (id, deleteFiles) => ipc.invoke(DB_CHANNELS.DELETE_WORKSPACE, id, deleteFiles),
        archiveWorkspace: (id, isArchived) => ipc.invoke(DB_CHANNELS.ARCHIVE_WORKSPACE, id, isArchived),
        bulkDeleteWorkspaces: (ids, deleteFiles) => ipc.invoke(DB_CHANNELS.BULK_DELETE_WORKSPACES, ids, deleteFiles),
        bulkArchiveWorkspaces: (ids, isArchived) => ipc.invoke(DB_CHANNELS.BULK_ARCHIVE_WORKSPACES, ids, isArchived),
        createFolder: (name, color) => ipc.invoke(DB_CHANNELS.CREATE_FOLDER, { name, color }),
        deleteFolder: id => ipc.invoke(DB_CHANNELS.DELETE_FOLDER, id),
        updateFolder: (id, updates) => ipc.invoke(DB_CHANNELS.UPDATE_FOLDER, id, updates),
        getFolders: () => ipc.invoke(DB_CHANNELS.GET_FOLDERS),
        onWorkspaceUpdated: callback => {
            const listener = (
                _event: IpcRendererEvent,
                payload: { id?: string }
            ) => callback(payload);
            ipc.on(DB_CHANNELS.WORKSPACE_UPDATED_EVENT, listener);
            return () => ipc.removeListener(DB_CHANNELS.WORKSPACE_UPDATED_EVENT, listener);
        },
    };
}

