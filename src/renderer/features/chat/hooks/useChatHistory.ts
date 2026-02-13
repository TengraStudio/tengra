/**
 * Chat History Manager Hook
 * Provides undo/redo functionality for chat operations
 */

import { ChatId, isChatId, toChatId } from '@shared/types/ids';
import { useCallback, useRef, useState } from 'react';

import { Chat } from '@/types';

export interface ChatHistoryState {
    chats: Chat[]
    currentChatId: ChatId | null
    timestamp: number
}

export interface ChatHistoryManager {
    canUndo: boolean
    canRedo: boolean
    undo: () => ChatHistoryState | null
    redo: () => ChatHistoryState | null
    saveState: (chats: Chat[], currentChatId: string | null) => void
    clearHistory: () => void
}

/** Reduced from 50 to 20 to limit memory usage */
const MAX_HISTORY_SIZE = 20;

/** Maximum messages to keep per chat in history states */
const MAX_MESSAGES_PER_HISTORY_CHAT = 30;

/**
 * Trims messages in a chat to limit memory usage in history states.
 * Only keeps the most recent messages.
 */
function trimMessagesForHistory<T extends { messages: unknown[] }>(chat: T): T {
    if (chat.messages.length <= MAX_MESSAGES_PER_HISTORY_CHAT) {
        return chat;
    }
    return {
        ...chat,
        messages: chat.messages.slice(-MAX_MESSAGES_PER_HISTORY_CHAT)
    };
}

/**
 * Hook for managing chat history with undo/redo
 */
export function useChatHistory(): ChatHistoryManager {
    const [history, setHistory] = useState<ChatHistoryState[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const isSavingRef = useRef(false);

    const saveState = useCallback((chats: Chat[], currentChatId: string | null) => {
        // Prevent saving during undo/redo operations
        if (isSavingRef.current) { return; }

        // PERF-005-4: Use shallow copy instead of deep copy for messages
        // Messages are immutable in our architecture, so deep copy is unnecessary
        // Also trim messages to prevent memory bloat in history
        const newState: ChatHistoryState = {
            chats: chats.map(chat => trimMessagesForHistory({
                ...chat,
                messages: chat.messages // Shallow copy is sufficient for immutable arrays
            })),
            currentChatId: currentChatId && isChatId(currentChatId) ? currentChatId : (currentChatId ? toChatId(currentChatId) : null),
            timestamp: Date.now()
        };

        setHistory(prev => {
            // Remove any states after current index (when undoing then making new changes)
            const newHistory = prev.slice(0, historyIndex + 1);

            // Add new state
            newHistory.push(newState);

            // Limit history size
            if (newHistory.length > MAX_HISTORY_SIZE) {
                newHistory.shift();
                return newHistory;
            }

            return newHistory;
        });

        setHistoryIndex(prev => {
            const newIndex = prev + 1;
            // If we're adding after an undo, limit to max size
            return Math.min(newIndex, MAX_HISTORY_SIZE - 1);
        });
    }, [historyIndex]);

    const undo = useCallback((): ChatHistoryState | null => {
        if (historyIndex <= 0) { return null; }

        isSavingRef.current = true;
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        const state = history[newIndex];
        isSavingRef.current = false;

        return { ...state };
    }, [history, historyIndex]);

    const redo = useCallback((): ChatHistoryState | null => {
        if (historyIndex >= history.length - 1) { return null; }

        isSavingRef.current = true;
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        const state = history[newIndex];
        isSavingRef.current = false;

        return { ...state };
    }, [history, historyIndex]);

    const clearHistory = useCallback(() => {
        setHistory([]);
        setHistoryIndex(-1);
    }, []);

    return {
        canUndo: historyIndex > 0,
        canRedo: historyIndex < history.length - 1,
        undo,
        redo,
        saveState,
        clearHistory
    };
}
