import { createContext, useContext, ReactNode, useEffect } from 'react'
import React from 'react'
import { useChatManager } from '../features/chat/hooks/useChatManager'
import { useAuth } from './AuthContext'
import { useModel } from './ModelContext'
import { useTextToSpeech } from '../features/chat/hooks/useTextToSpeech'
import { useTranslation } from '../i18n'
import { useProjectManager } from '../features/projects/hooks/useProjectManager'
import { useChatHistory } from '../features/chat/hooks/useChatHistory'
import { Project } from '@/types'
import { CatchError } from '../../shared/types/common'

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
}

const ChatContext = createContext<ChatContextType | null>(null)

export function ChatProvider({ children }: { children: ReactNode }) {
    const { appSettings, language } = useAuth()
    const { selectedModel, selectedProvider } = useModel()
    const { t } = useTranslation()

    // Project Manager Hook - consumed here to provide project context to chat
    const {
        projects, selectedProject, setSelectedProject, loadProjects
    } = useProjectManager()

    const { speak: handleSpeak, stop: handleStopSpeak, isSpeaking, speakingMessageId } = useTextToSpeech()

    // Chat History Manager for undo/redo
    const historyManager = useChatHistory()

    const chatManager = useChatManager({
        selectedModel,
        selectedProvider,
        language,
        appSettings: appSettings || undefined,
        autoReadEnabled: false, // Could be moved to settings/context
        handleSpeak: (id, text) => handleSpeak(text, id), // Adapter
        formatChatError: (e: CatchError) => {
            if (e instanceof Error) {
                const message = e.message;
                // Handle 429 rate limit/quota errors
                if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED') || message.includes('rate limit') || message.includes('quota')) {
                    try {
                        // Try to parse JSON error if present
                        const jsonMatch = message.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            const errData = JSON.parse(jsonMatch[0]);
                            const errorMsg = errData.error?.message || errData.message || message;
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
    }, [chatManager.chats, chatManager.currentChatId])

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

    const value = {
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
        undo: () => {
            isRestoringRef.current = true
            const state = historyManager.undo()
            if (state) {
                chatManager.setChats(state.chats)
                chatManager.setCurrentChatId(state.currentChatId)
            }
        },
        redo: () => {
            isRestoringRef.current = true
            const state = historyManager.redo()
            if (state) {
                chatManager.setChats(state.chats)
                chatManager.setCurrentChatId(state.currentChatId)
            }
        }
    }

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
