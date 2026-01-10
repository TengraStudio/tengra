import { createContext, useContext, ReactNode } from 'react'
import { useChatManager } from '../features/chat/hooks/useChatManager'
import { useAuth } from './AuthContext'
import { useModel } from './ModelContext'
import { useTextToSpeech } from '../features/chat/hooks/useTextToSpeech'
import { useTranslation } from '../i18n'
import { useProjectManager } from '../features/projects/hooks/useProjectManager'
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

    const chatManager = useChatManager({
        selectedModel,
        selectedProvider,
        language,
        appSettings: appSettings || undefined,
        autoReadEnabled: false, // Could be moved to settings/context
        handleSpeak: (id, text) => handleSpeak(text, id), // Adapter
        formatChatError: (e: CatchError) => (e instanceof Error ? e.message : String(e || 'Unknown error')),
        t,
        projectId: selectedProject?.id,
        activeWorkspacePath: selectedProject?.path
    })

    const value = {
        ...chatManager,
        handleSpeak,
        handleStopSpeak,
        isSpeaking,
        speakingMessageId,
        projects,
        selectedProject,
        setSelectedProject,
        loadProjects
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
