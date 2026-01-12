/**
 * Chat History Manager Hook
 * Provides undo/redo functionality for chat operations
 */

import { useState, useCallback, useRef } from 'react'
import { Chat } from '@/types'

export interface ChatHistoryState {
    chats: Chat[]
    currentChatId: string | null
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

const MAX_HISTORY_SIZE = 50

/**
 * Hook for managing chat history with undo/redo
 */
export function useChatHistory(): ChatHistoryManager {
    const [history, setHistory] = useState<ChatHistoryState[]>([])
    const [historyIndex, setHistoryIndex] = useState(-1)
    const isSavingRef = useRef(false)

    const saveState = useCallback((chats: Chat[], currentChatId: string | null) => {
        // Prevent saving during undo/redo operations
        if (isSavingRef.current) return

        const newState: ChatHistoryState = {
            chats: chats.map(chat => ({
                ...chat,
                messages: [...chat.messages] // Deep copy messages
            })),
            currentChatId,
            timestamp: Date.now()
        }

        setHistory(prev => {
            // Remove any states after current index (when undoing then making new changes)
            const newHistory = prev.slice(0, historyIndex + 1)
            
            // Add new state
            newHistory.push(newState)
            
            // Limit history size
            if (newHistory.length > MAX_HISTORY_SIZE) {
                newHistory.shift()
                return newHistory
            }
            
            return newHistory
        })

        setHistoryIndex(prev => {
            const newIndex = prev + 1
            // If we're adding after an undo, limit to max size
            return Math.min(newIndex, MAX_HISTORY_SIZE - 1)
        })
    }, [historyIndex])

    const undo = useCallback((): ChatHistoryState | null => {
        if (historyIndex <= 0) return null

        isSavingRef.current = true
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        const state = history[newIndex]
        isSavingRef.current = false

        return state ? { ...state } : null
    }, [history, historyIndex])

    const redo = useCallback((): ChatHistoryState | null => {
        if (historyIndex >= history.length - 1) return null

        isSavingRef.current = true
        const newIndex = historyIndex + 1
        setHistoryIndex(newIndex)
        const state = history[newIndex]
        isSavingRef.current = false

        return state ? { ...state } : null
    }, [history, historyIndex])

    const clearHistory = useCallback(() => {
        setHistory([])
        setHistoryIndex(-1)
    }, [])

    return {
        canUndo: historyIndex > 0,
        canRedo: historyIndex < history.length - 1,
        undo,
        redo,
        saveState,
        clearHistory
    }
}
