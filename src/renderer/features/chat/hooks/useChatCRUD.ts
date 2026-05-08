/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { WORKSPACE_AGENT_CHAT_TYPE } from '@shared/types/workspace-agent-session';
import type { Dispatch, SetStateAction } from 'react';

import { generateId } from '@/lib/utils';
import { getChatSnapshot } from '@/store/chat.store';
import { Chat, Message } from '@/types';
import { CachedDatabase } from '@/utils/cached-database.util';
import { CommonBatches } from '@/utils/ipc-batch.util';
import { appLogger } from '@/utils/renderer-logger';

interface UseChatCRUDProps {
    currentChatId: string | null
    setCurrentChatId: (id: string | null) => void
    setChats: Dispatch<SetStateAction<Chat[]>>
    setInput: (input: string) => void
    baseDeleteFolder: (id: string, callback?: (deletedId: string) => void) => void | Promise<void>
}

function isWorkspaceAgentChat(chat: Chat): boolean {
    return chat.metadata?.chatType === WORKSPACE_AGENT_CHAT_TYPE;
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
            const currentChats = getChatSnapshot().chats;
            const currentIndex = currentChats.findIndex(chat => chat.id === id);
            const fallbackChatId = currentIndex >= 0
                ? currentChats.find((chat, index) => index > currentIndex && chat.id !== id)?.id
                    ?? currentChats.find((chat, index) => index < currentIndex && chat.id !== id)?.id
                    ?? null
                : null;
            const optimisticVisibleChats = currentChats.filter(chat => chat.id !== id);

            setChats(optimisticVisibleChats);
            if (currentChatId === id) {
                const optimisticNextChatId = optimisticVisibleChats.find(chat => chat.id === fallbackChatId)?.id
                    ?? optimisticVisibleChats[0]?.id
                    ?? null;
                setCurrentChatId(optimisticNextChatId);
                if (!optimisticNextChatId) {
                    setInput('');
                }
            }

            let result = await CachedDatabase.deleteChat(id);
            if (!result?.success) {
                throw new Error(`Failed to delete chat ${id}`);
            }

            let deletedChat = await window.electron.db.getChat(id);
            if (deletedChat) {
                await window.electron.db.deleteMessages(id);
                result = await window.electron.db.deleteChat(id);
                if (!result?.success) {
                    throw new Error(`Failed to fully delete chat ${id}`);
                }
                deletedChat = await window.electron.db.getChat(id);
            }

            if (deletedChat) {
                throw new Error(`Chat ${id} still exists after deletion`);
            }
            CachedDatabase.clearAllCaches();
            const remainingChats = await CachedDatabase.getAllChats();
            const visibleChats = (remainingChats as Chat[]).filter(
                chat => !isWorkspaceAgentChat(chat)
            );
            setChats(visibleChats.map(chat => ({
                ...chat,
                messages: [],
            })));
            if (currentChatId === id) {
                const nextChatId = visibleChats.find(chat => chat.id === fallbackChatId)?.id
                    ?? visibleChats[0]?.id
                    ?? null;
                setCurrentChatId(nextChatId);
                if (!nextChatId) {
                    setInput('');
                }
            }
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
            CachedDatabase.clearAllCaches();
            setChats(prev => prev.filter(c => !chatIds.includes(c.id)));
            if (currentChatId && chatIds.includes(currentChatId)) {
                const remainingVisibleChats = getChatSnapshot().chats.filter(
                    chat => !chatIds.includes(chat.id)
                );
                const nextChatId = remainingVisibleChats[0]?.id ?? null;
                setCurrentChatId(nextChatId);
                if (!nextChatId) {
                    setInput('');
                }
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

