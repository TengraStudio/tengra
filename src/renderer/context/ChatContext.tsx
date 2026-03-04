import { useAuth } from '@renderer/context/AuthContext';
import { useModel } from '@renderer/context/ModelContext';
import { useWorkspace } from '@renderer/context/WorkspaceContext';
import { useChatHistory } from '@renderer/features/chat/hooks/useChatHistory';
import { useChatManager } from '@renderer/features/chat/hooks/useChatManager';
import { useTextToSpeech } from '@renderer/features/chat/hooks/useTextToSpeech';
import { useTranslation } from '@renderer/i18n';
import { CatchError } from '@shared/types/common';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef } from 'react';

import { Chat, Project } from '@/types';

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

const ChatContext = createContext<ChatContextType | null>(null);

function formatRateLimitError(message: string, t: (key: string) => string): string {
    try {
        const jsonMatch = message.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const errData = safeJsonParse<{ error?: { message?: string }; message?: string }>(jsonMatch[0], {});
            const errorMsg = errData.error?.message ?? errData.message ?? message;
            if (errorMsg.includes('Resource has been exhausted') || errorMsg.includes('quota')) {
                return t('chat.quotaExceeded');
            }
        }
    } catch {
        // Not JSON
    }
    return t('chat.rateLimitExceeded');
}

function handleChatError(e: CatchError, t: (key: string) => string): string {
    if (!(e instanceof Error)) { return String(e ?? 'Unknown error'); }
    const message = e.message;
    const isRateLimit = message.includes('429') || message.includes('RESOURCE_EXHAUSTED') || message.includes('rate limit') || message.includes('quota');
    return isRateLimit ? formatRateLimitError(message, t) : message;
}

function isEditableElement(): boolean {
    const activeTag = document.activeElement?.tagName.toLowerCase();
    return activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement).isContentEditable;
}

const isUndoKey = (e: KeyboardEvent): boolean => (e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey;
const isRedoKey = (e: KeyboardEvent): boolean => ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') || ((e.ctrlKey || e.metaKey) && e.key === 'y');

interface UndoRedoHandlers {
    setChats: (chats: Chat[]) => void
    setCurrentChatId: (id: string | null) => void
}

function useUndoRedoKeyboard(
    historyManager: ReturnType<typeof useChatHistory>,
    handlers: UndoRedoHandlers,
    isRestoringRef: React.MutableRefObject<boolean>
): void {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isEditableElement()) { return; }

            if (isUndoKey(e)) { applyHistoryState(historyManager.undo(), handlers, isRestoringRef, e); }
            else if (isRedoKey(e)) { applyHistoryState(historyManager.redo(), handlers, isRestoringRef, e); }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [historyManager, handlers, isRestoringRef]);
}

function applyHistoryState(
    state: { chats: Chat[]; currentChatId: string | null } | null,
    handlers: UndoRedoHandlers,
    isRestoringRef: React.MutableRefObject<boolean>,
    e: KeyboardEvent
): void {
    if (!state) { return; }
    e.preventDefault();
    isRestoringRef.current = true;
    handlers.setChats(state.chats);
    handlers.setCurrentChatId(state.currentChatId);
}

function useHistorySync(
    chats: Chat[],
    currentChatId: string | null,
    historyManager: ReturnType<typeof useChatHistory>,
    isRestoringRef: React.MutableRefObject<boolean>
): void {
    const saveTimeoutRef = useRef<NodeJS.Timeout>();

    useEffect(() => {
        if (isRestoringRef.current) {
            isRestoringRef.current = false;
            return;
        }

        // Debounce history saves (500ms)
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        if (chats.length > 0) {
            saveTimeoutRef.current = setTimeout(() => {
                historyManager.saveState(chats, currentChatId);
            }, 500);
        }

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [chats, currentChatId, historyManager, isRestoringRef]);
}

export function ChatProvider({ children }: { children: ReactNode }) {
    const { appSettings, language } = useAuth();
    const { selectedModel, selectedProvider, selectedModels } = useModel();
    const { t } = useTranslation();
    const { projects, selectedProject, setSelectedProject, loadProjects } = useWorkspace();
    const { speak: handleSpeak, stop: handleStopSpeak, isSpeaking, speakingMessageId } = useTextToSpeech();
    const historyManager = useChatHistory();
    const isRestoringRef = useRef(false);

    const handleSpeakAdapter = useCallback((id: string, text: string) => { handleSpeak(text, id); }, [handleSpeak]);

    const chatManager = useChatManager({
        selectedModel,
        selectedProvider,
        selectedModels,
        language,
        appSettings: appSettings ?? undefined,
        autoReadEnabled: false,
        handleSpeak: handleSpeakAdapter,
        formatChatError: (e: CatchError) => handleChatError(e, t),
        t,
        projectId: selectedProject?.id,
        activeWorkspacePath: selectedProject?.path
    });

    const handlers = useMemo(() => ({
        setChats: chatManager.setChats,
        setCurrentChatId: chatManager.setCurrentChatId
    }), [chatManager.setChats, chatManager.setCurrentChatId]);

    useHistorySync(chatManager.chats, chatManager.currentChatId, historyManager, isRestoringRef);
    useUndoRedoKeyboard(historyManager, handlers, isRestoringRef);

    const undo = useCallback(() => {
        isRestoringRef.current = true;
        const state = historyManager.undo();
        if (state) {
            chatManager.setChats(state.chats);
            chatManager.setCurrentChatId(state.currentChatId);
        }
    }, [historyManager, chatManager]);

    const redo = useCallback(() => {
        isRestoringRef.current = true;
        const state = historyManager.redo();
        if (state) {
            chatManager.setChats(state.chats);
            chatManager.setCurrentChatId(state.currentChatId);
        }
    }, [historyManager, chatManager]);

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
        setSystemMode: chatManager.setSystemMode,
        bulkDeleteChats: chatManager.bulkDeleteChats
    }), [
        chatManager, handleSpeak, handleStopSpeak, isSpeaking, speakingMessageId,
        projects, selectedProject, setSelectedProject, loadProjects,
        historyManager.canUndo, historyManager.canRedo, undo, redo
    ]);

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    );
}

export function useChat() {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
}
