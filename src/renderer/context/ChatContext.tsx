import { useAuth } from '@renderer/context/AuthContext'
import { useModel } from '@renderer/context/ModelContext'
import { useChatHistory } from '@renderer/features/chat/hooks/useChatHistory'
import { useChatManager } from '@renderer/features/chat/hooks/useChatManager'
import { useTextToSpeech } from '@renderer/features/chat/hooks/useTextToSpeech'
import { useProject } from '@renderer/context/ProjectContext'
import { useTranslation } from '@renderer/i18n'
import { CatchError } from '@shared/types/common'
import { safeJsonParse } from '@shared/utils/sanitize.util'
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo } from 'react'
import React from 'react'

import { Project } from '@/types'

// We extend the return type to include TTS functions since they are closely related
type ChatContextType = ReturnType<typeof useChatManager> & {
    handleSpeak: (text: string, id: string) => void
    handleStopSpeak: () => void
    isSpeaking: boolean
    speakingMessageId: string | null
    // Project context is also needed for chat
    projects: Project[]
    selectedProject: Project | null
    setSelectedProject: (p: Project | null) => void
    loadProjects: () => Promise<void>
    // Undo/Redo
    canUndo: boolean
    canRedo: boolean
    undo: () => void
    redo: () => void
    systemMode: 'thinking' | 'agent' | 'fast'
    setSystemMode: (mode: 'thinking' | 'agent' | 'fast') => void
}

const ChatContext = createContext<ChatContextType | null>(null)

export function ChatProvider({ children }: { children: ReactNode }) {
    const { appSettings, language } = useAuth()
    const { selectedModel, selectedProvider, selectedModels } = useModel()
    const { t } = useTranslation()

    // Consume Project Context instead of re-instantiating the manager
    const {
        projects, selectedProject, setSelectedProject, loadProjects
    } = useProject()

    const { speak: handleSpeak, stop: handleStopSpeak, isSpeaking, speakingMessageId } = useTextToSpeech()

    // Chat History Manager for undo/redo
    const historyManager = useChatHistory()

    const handleSpeakAdapter = useCallback((id: string, text: string) => {
        handleSpeak(text, id);
    }, [handleSpeak]);

    const chatManager = useChatManager({
        selectedModel,
        selectedProvider,
        selectedModels,
        language,
        appSettings: appSettings || undefined,
        autoReadEnabled: false, // Could be moved to settings/context
        handleSpeak: handleSpeakAdapter, // Stable Adapter
        formatChatError: (e: CatchError) => {
            if (e instanceof Error) {
                const message = e.message;
                // Handle 429 rate limit/quota errors
                if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED') || message.includes('rate limit') || message.includes('quota')) {
                    try {
                        // Try to parse JSON error if present
                        const jsonMatch = message.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            const errData = safeJsonParse<{ error?: { message?: string }; message?: string }>(jsonMatch[0], {})
                            const errorMsg = errData.error?.message ?? errData.message ?? message;
                            if (errorMsg.includes('Resource has been exhausted') || errorMsg.includes('quota')) {
                                return 'Quota or rate limit exceeded. This could be due to rate limiting (too many requests) or quota exhaustion. Please wait a few minutes and try again.';
                            }
                        }
                    } catch {
                        // Not JSON, use default message
                    }
                    return 'Rate limit or quota exceeded. Please wait a few minutes and try again.';
                }
                return message;
            }
            return String(e || 'Unknown error');
        },
        t,
        projectId: selectedProject?.id,
        activeWorkspacePath: selectedProject?.path
    })

    // Track if we're currently restoring from history to avoid saving during undo/redo
    const isRestoringRef = React.useRef(false)

    // Save state to history when chats or currentChatId changes (but not during undo/redo)
    useEffect(() => {
        if (isRestoringRef.current) {
            isRestoringRef.current = false
            return
        }
        if (chatManager.chats && chatManager.chats.length >= 0) {
            historyManager.saveState(chatManager.chats, chatManager.currentChatId)
        }
    }, [chatManager.chats, chatManager.currentChatId, historyManager])

    // Handle undo/redo keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const activeTag = document.activeElement?.tagName.toLowerCase()
            // Don't trigger undo/redo in input fields
            if (activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement).isContentEditable) {
                return
            }

            // Ctrl+Z or Cmd+Z for undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault()
                isRestoringRef.current = true
                const state = historyManager.undo()
                if (state) {
                    chatManager.setChats(state.chats)
                    chatManager.setCurrentChatId(state.currentChatId)
                }
            }
            // Ctrl+Shift+Z or Cmd+Shift+Z for redo (or Ctrl+Y)
            if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') || ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
                e.preventDefault()
                isRestoringRef.current = true
                const state = historyManager.redo()
                if (state) {
                    chatManager.setChats(state.chats)
                    chatManager.setCurrentChatId(state.currentChatId)
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [historyManager, chatManager])

    const undo = useCallback(() => {
        isRestoringRef.current = true
        const state = historyManager.undo()
        if (state) {
            chatManager.setChats(state.chats)
            chatManager.setCurrentChatId(state.currentChatId)
        }
    }, [historyManager, chatManager])

    const redo = useCallback(() => {
        isRestoringRef.current = true
        const state = historyManager.redo()
        if (state) {
            chatManager.setChats(state.chats)
            chatManager.setCurrentChatId(state.currentChatId)
        }
    }, [historyManager, chatManager])

    const value = useMemo(() => ({
        ...chatManager,
        handleSpeak,
        handleStopSpeak,
        isSpeaking,
        speakingMessageId,
        projects,
        selectedProject,
        setSelectedProject,
        loadProjects,
        canUndo: historyManager.canUndo,
        canRedo: historyManager.canRedo,
        undo,
        redo,
        systemMode: chatManager.systemMode,
        setSystemMode: chatManager.setSystemMode
    }), [
        chatManager, handleSpeak, handleStopSpeak, isSpeaking, speakingMessageId,
        projects, selectedProject, setSelectedProject, loadProjects,
        historyManager.canUndo, historyManager.canRedo, undo, redo,
        chatManager.systemMode, chatManager.setSystemMode
    ])

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    )
}

export function useChat() {
    const context = useContext(ChatContext)
    if (!context) {
        throw new Error('useChat must be used within a ChatProvider')
    }
    return context
}
