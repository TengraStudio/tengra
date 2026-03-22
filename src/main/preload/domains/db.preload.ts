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
    getTimeStats: () => Promise<{
        totalOnlineTime: number;
        totalCodingTime: number;
        workspaceCodingTime: Record<string, number>;
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
    updateWorkspace: (id: string, updates: Partial<Workspace>) => Promise<void>;
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
        createChat: chat => ipc.invoke('db:createChat', chat),
        updateChat: (id, updates) => ipc.invoke('db:updateChat', id, updates),
        deleteChat: id => ipc.invoke('db:deleteChat', id),
        duplicateChat: id => ipc.invoke('db:duplicateChat', id),
        archiveChat: (id, isArchived) => ipc.invoke('db:archiveChat', id, isArchived),
        bulkDeleteChats: ids => ipc.invoke('db:bulkDeleteChats', ids),
        bulkArchiveChats: (ids, isArchived) => ipc.invoke('db:bulkArchiveChats', ids, isArchived),
        getChat: id => ipc.invoke('db:getChat', id),
        getAllChats: () => ipc.invoke('db:getAllChats'),
        getPrompts: () => ipc.invoke('db:getPrompts'),
        createPrompt: (title, content, tags) => ipc.invoke('db:createPrompt', title, content, tags),
        updatePrompt: (id, updates) => ipc.invoke('db:updatePrompt', id, updates),
        deletePrompt: id => ipc.invoke('db:deletePrompt', id),
        searchChats: query => ipc.invoke('db:searchChats', query),
        addMessage: message => ipc.invoke('db:addMessage', message),
        deleteMessage: id => ipc.invoke('db:deleteMessage', id),
        updateMessage: (id, updates) => ipc.invoke('db:updateMessage', id, updates),
        deleteAllChats: () => ipc.invoke('db:deleteAllChats'),
        deleteChatsByTitle: title => ipc.invoke('db:deleteChatsByTitle', title),
        deleteMessages: chatId => ipc.invoke('db:deleteMessages', chatId),
        getMessages: chatId => ipc.invoke('db:getMessages', chatId),
        getStats: () => ipc.invoke('db:getStats'),
        getDetailedStats: period => ipc.invoke('db:getDetailedStats', period),
        getTimeStats: () => ipc.invoke('db:getTimeStats'),
        getTokenStats: period => ipc.invoke('db:getTokenStats', period),
        addTokenUsage: record => ipc.invoke('db:addTokenUsage', record),
        getWorkspaces: () => ipc.invoke('db:getWorkspaces'),
        createWorkspace: (name, path, description, mounts) =>
            ipc.invoke('db:createWorkspace', {
                title: name,
                path,
                description,
                mounts
            }),
        updateWorkspace: (id, updates) => ipc.invoke('db:updateWorkspace', id, updates),
        deleteWorkspace: (id, deleteFiles) => ipc.invoke('db:deleteWorkspace', id, deleteFiles),
        archiveWorkspace: (id, isArchived) => ipc.invoke('db:archiveWorkspace', id, isArchived),
        bulkDeleteWorkspaces: (ids, deleteFiles) => ipc.invoke('db:bulkDeleteWorkspaces', ids, deleteFiles),
        bulkArchiveWorkspaces: (ids, isArchived) => ipc.invoke('db:bulkArchiveWorkspaces', ids, isArchived),
        createFolder: (name, color) => ipc.invoke('db:createFolder', { name, color }),
        deleteFolder: id => ipc.invoke('db:deleteFolder', id),
        updateFolder: (id, updates) => ipc.invoke('db:updateFolder', id, updates),
        getFolders: () => ipc.invoke('db:getFolders'),
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
