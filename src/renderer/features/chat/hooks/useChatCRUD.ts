/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { Dispatch, SetStateAction } from 'react';

import { generateId } from '@/lib/utils';
import { Chat, Message } from '@/types';
import { CommonBatches } from '@/utils/ipc-batch.util';
import { appLogger } from '@/utils/renderer-logger';

interface UseChatCRUDProps {
    currentChatId: string | null
    setCurrentChatId: (id: string | null) => void
    setChats: Dispatch<SetStateAction<Chat[]>>
    setInput: (input: string) => void
    baseDeleteFolder: (id: string, callback?: (deletedId: string) => void) => void | Promise<void>
}

export const useChatCRUD = (props: UseChatCRUDProps): {
    createNewChat: () => void;
    deleteChat: (id: string) => Promise<void>;
    clearMessages: () => Promise<void>;
    deleteFolder: (id: string) => void;
    moveChatToFolder: (chatId: string, folderId: string | null) => Promise<void>;
    addMessage: (chatId: string, role: string, content: string) => Promise<void>;
    updateChat: (id: string, updates: Partial<Chat>) => Promise<void>;
    togglePin: (id: string, isPinned: boolean) => Promise<void>;
    toggleFavorite: (id: string, isFavorite: boolean) => Promise<void>;
    bulkUpdateChats: (updates: Array<{ id: string; updates: Partial<Chat> }>) => Promise<void>;
    bulkDeleteChats: (chatIds: string[]) => Promise<void>;
} => {
    const { currentChatId, setCurrentChatId, setChats, setInput, baseDeleteFolder } = props;

    const createNewChat = () => {
        setCurrentChatId(null);
        setInput('');
    };

    const deleteChat = async (id: string) => {
        try {
            await window.electron.db.deleteChat(id);
            setChats(prev => prev.filter(c => c.id !== id));
            if (currentChatId === id) { createNewChat(); }
        } catch (error) {
            appLogger.error('useChatCRUD', 'Failed to delete chat', error as Error);
        }
    };

    const clearMessages = async () => {
        if (!currentChatId) { return; }
        try {
            await window.electron.db.deleteMessages(currentChatId);
            setChats(prev => prev.map(c => c.id === currentChatId ? { ...c, messages: [] } : c));
        } catch (error) {
            appLogger.error('useChatCRUD', 'Failed to clear messages', error as Error);
        }
    };

    const deleteFolder = (id: string) => {
        void baseDeleteFolder(id, (deletedId) => {
            setChats(prev => prev.map(c => c.folderId === deletedId ? { ...c, folderId: undefined } : c));
        });
    };

    const moveChatToFolder = async (chatId: string, folderId: string | null) => {
        try {
            await window.electron.db.updateChat(chatId, { folderId });
            setChats(prev => prev.map(c => c.id === chatId ? { ...c, folderId: folderId ?? undefined } : c));
        } catch (error) {
            appLogger.error('useChatCRUD', 'Failed to move chat to folder', error as Error);
        }
    };

    const addMessage = async (chatId: string, role: string, content: string) => {
        try {
            const messageObj = { role, content, timestamp: Date.now() };
            await window.electron.db.addMessage({ ...messageObj, chatId });
            const uiMessage: Message = { ...messageObj, id: generateId(), timestamp: new Date(messageObj.timestamp), role: role as 'user' | 'assistant' | 'system' };
            setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: [...c.messages, uiMessage] } : c));
        } catch (error) {
            appLogger.error('useChatCRUD', 'Failed to add message', error as Error);
        }
    };

    const updateChat = async (id: string, updates: Partial<Chat>) => {
        try {
            await window.electron.db.updateChat(id, updates);
            setChats(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
        } catch (error) {
            appLogger.error('useChatCRUD', 'Failed to update chat', error as Error);
        }
    };

    const togglePin = async (id: string, isPinned: boolean) => {
        await updateChat(id, { isPinned });
    };

    const toggleFavorite = async (id: string, isFavorite: boolean) => {
        await updateChat(id, { isFavorite });
    };

    // Batch operations for efficiency
    const bulkUpdateChats = async (updates: Array<{ id: string; updates: Partial<Chat> }>) => {
        try {
            await CommonBatches.updateChatsBatch(updates);
            setChats(prev => prev.map(c => {
                const update = updates.find(u => u.id === c.id);
                return update ? { ...c, ...update.updates } : c;
            }));
        } catch (error) {
            appLogger.error('useChatCRUD', 'Failed to bulk update chats', error as Error);
        }
    };

    const bulkDeleteChats = async (chatIds: string[]) => {
        try {
            await CommonBatches.deleteChatsBatch(chatIds);
            setChats(prev => prev.filter(c => !chatIds.includes(c.id)));
            if (currentChatId && chatIds.includes(currentChatId)) {
                createNewChat();
            }
        } catch (error) {
            appLogger.error('useChatCRUD', 'Failed to bulk delete chats', error as Error);
        }
    };

    return {
        createNewChat,
        deleteChat,
        clearMessages,
        deleteFolder,
        moveChatToFolder,
        addMessage,
        updateChat,
        togglePin,
        toggleFavorite,
        bulkUpdateChats,
        bulkDeleteChats
    };
};
