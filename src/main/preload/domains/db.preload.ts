import { Chat, Folder, Message, Project } from '@shared/types';
import { IpcRenderer } from 'electron';

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
        projectCodingTime: Record<string, number>;
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
        projectId?: string;
        provider: string;
        model: string;
        tokensSent: number;
        tokensReceived: number;
        costEstimate?: number;
    }) => Promise<{ success: boolean }>;
    getProjects: () => Promise<Project[]>;
    createProject: (
        name: string,
        path: string,
        description: string,
        mounts?: string
    ) => Promise<Project>;
    updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
    deleteProject: (id: string, deleteFiles?: boolean) => Promise<void>;
    archiveProject: (id: string, isArchived: boolean) => Promise<void>;
    createFolder: (name: string, color?: string) => Promise<Folder>;
    deleteFolder: (id: string) => Promise<void>;
    updateFolder: (id: string, updates: Partial<Folder>) => Promise<void>;
    getFolders: () => Promise<Folder[]>;
}

export function createDbBridge(ipc: IpcRenderer): DbBridge {
    return {
        createChat: chat => ipc.invoke('db:createChat', chat),
        updateChat: (id, updates) => ipc.invoke('db:updateChat', { id, updates }),
        deleteChat: id => ipc.invoke('db:deleteChat', id),
        duplicateChat: id => ipc.invoke('db:duplicateChat', id),
        archiveChat: (id, isArchived) => ipc.invoke('db:archiveChat', { id, isArchived }),
        bulkDeleteChats: ids => ipc.invoke('db:bulkDeleteChats', ids),
        bulkArchiveChats: (ids, isArchived) => ipc.invoke('db:bulkArchiveChats', { ids, isArchived }),
        getChat: id => ipc.invoke('db:getChat', id),
        getAllChats: () => ipc.invoke('db:getAllChats'),
        getPrompts: () => ipc.invoke('db:getPrompts'),
        createPrompt: (title, content, tags) => ipc.invoke('db:createPrompt', { title, content, tags }),
        updatePrompt: (id, updates) => ipc.invoke('db:updatePrompt', { id, updates }),
        deletePrompt: id => ipc.invoke('db:deletePrompt', id),
        searchChats: query => ipc.invoke('db:searchChats', query),
        addMessage: message => ipc.invoke('db:addMessage', message),
        deleteMessage: id => ipc.invoke('db:deleteMessage', id),
        updateMessage: (id, updates) => ipc.invoke('db:updateMessage', { id, updates }),
        deleteAllChats: () => ipc.invoke('db:deleteAllChats'),
        deleteChatsByTitle: title => ipc.invoke('db:deleteChatsByTitle', title),
        deleteMessages: chatId => ipc.invoke('db:deleteMessages', chatId),
        getMessages: chatId => ipc.invoke('db:getMessages', chatId),
        getStats: () => ipc.invoke('db:getStats'),
        getDetailedStats: period => ipc.invoke('db:getDetailedStats', period),
        getTimeStats: () => ipc.invoke('db:getTimeStats'),
        getTokenStats: period => ipc.invoke('db:getTokenStats', period),
        addTokenUsage: record => ipc.invoke('db:addTokenUsage', record),
        getProjects: () => ipc.invoke('db:getProjects'),
        createProject: (name, path, description, mounts) =>
            ipc.invoke('db:createProject', { name, path, description, mounts }),
        updateProject: (id, updates) => ipc.invoke('db:updateProject', { id, updates }),
        deleteProject: (id, deleteFiles) => ipc.invoke('db:deleteProject', { id, deleteFiles }),
        archiveProject: (id, isArchived) => ipc.invoke('db:archiveProject', { id, isArchived }),
        createFolder: (name, color) => ipc.invoke('db:createFolder', { name, color }),
        deleteFolder: id => ipc.invoke('db:deleteFolder', id),
        updateFolder: (id, updates) => ipc.invoke('db:updateFolder', { id, updates }),
        getFolders: () => ipc.invoke('db:getFolders'),
    };
}
