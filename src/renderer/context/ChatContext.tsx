/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { CatchError } from '@shared/types/common';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useModel } from '@/context/ModelContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useChatHistory } from '@/features/chat/hooks/useChatHistory';
import { useChatManager } from '@/features/chat/hooks/useChatManager';
import { useTextToSpeech } from '@/features/chat/hooks/useTextToSpeech';
import { useTranslation } from '@/i18n';
import { Chat, Workspace } from '@/types';
import { translateErrorMessage } from '@/utils/error-handler.util';

// We extend the return type to include TTS functions since they are closely related
type ChatContextType = ReturnType<typeof useChatManager> & {
    handleSpeak: (text: string, id: string) => void
    handleStopSpeak: () => void
    isSpeaking: boolean
    speakingMessageId: string | null
    // Workspace context is also needed for chat
    workspaces: Workspace[]
    selectedWorkspace: Workspace | null
    setSelectedWorkspace: (p: Workspace | null) => void
    loadWorkspaces: () => Promise<void>
    // Undo/Redo
    canUndo: boolean
    canRedo: boolean
    undo: () => void
    redo: () => void
    systemMode: 'thinking' | 'agent' | 'fast'
    setSystemMode: (mode: 'thinking' | 'agent' | 'fast') => void
}

const ChatContext = createContext<ChatContextType | null>(null);
type ChatHeaderContextType = {
    currentChatId: string | null
    currentChatTitle: string | null
    clearMessages: () => Promise<void>
};
const ChatHeaderContext = createContext<ChatHeaderContextType | null>(null);
type ChatShellContextType = {
    chatsCount: number
    createNewChat: () => void
};
const ChatShellContext = createContext<ChatShellContextType | null>(null);
type ChatLibraryContextType = {
    chats: Chat[]
    currentChatId: string | null
    setCurrentChatId: (id: string | null) => void
    deleteChat: (id: string) => Promise<void>
    updateChat: (id: string, updates: Partial<Chat>) => Promise<void>
    folders: ChatContextType['folders']
    createFolder: ChatContextType['createFolder']
    deleteFolder: ChatContextType['deleteFolder']
    prompts: ChatContextType['prompts']
    createPrompt: ChatContextType['createPrompt']
    updatePrompt: ChatContextType['updatePrompt']
    deletePrompt: ChatContextType['deletePrompt']
    togglePin: ChatContextType['togglePin']
    bulkDeleteChats: ChatContextType['bulkDeleteChats']
};
const ChatLibraryContext = createContext<ChatLibraryContextType | null>(null);
type ChatComposerContextType = {
    setInput: ChatContextType['setInput']
    handleSend: ChatContextType['handleSend']
    processFile: ChatContextType['processFile']
};
const ChatComposerContext = createContext<ChatComposerContextType | null>(null);
type ChatWindowCommandContextType = {
    clearMessages: () => Promise<void>
    lastAssistantMessageText: string
};
const ChatWindowCommandContext = createContext<ChatWindowCommandContextType | null>(null);
type ChatListeningContextType = {
    isListening: boolean
    stopListening: () => void
};
const ChatListeningContext = createContext<ChatListeningContextType | null>(null);

function formatRateLimitError(message: string, t: (key: string) => string): string {
    try {
        const jsonMatch = message.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            interface ChatErrorData { error?: { message?: string }; message?: string }
            const errData = safeJsonParse<ChatErrorData>(jsonMatch[0], {});
            const errorMsg = errData?.error?.message ?? errData?.message ?? message;
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
    if (!(e instanceof Error)) { return String(e ?? t('errors.unknown')); }
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
    // Extract saveState to avoid depending on the full historyManager object.
    // saveState is now a stable reference (empty useCallback deps), so this
    // effect only re-runs when chats or currentChatId change.
    const { saveState } = historyManager;

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
                saveState(chats, currentChatId);
            }, 500);
        }

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [chats, currentChatId, saveState, isRestoringRef]);
}

export function ChatProvider({ children }: { children: ReactNode }) {
    const { appSettings, language, quotas, linkedAccounts } = useAuth();
    const { selectedModel, selectedProvider, selectedModels, models } = useModel();
    const { t } = useTranslation();
    const { workspaces: workspaces, selectedWorkspace: selectedWorkspace, setSelectedWorkspace: setSelectedWorkspace, loadWorkspaces: loadWorkspaces } = useWorkspace();
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
        workspaceId: selectedWorkspace?.id,
        activeWorkspacePath: selectedWorkspace?.path,
        models,
        quotas: quotas ?? undefined,
        linkedAccounts: linkedAccounts?.accounts,
    });

    const handlers = useMemo(() => ({
        setChats: chatManager.setChats,
        setCurrentChatId: chatManager.setCurrentChatId
    }), [chatManager.setChats, chatManager.setCurrentChatId]);
    const currentChatTitle = useMemo(() => {
        if (!chatManager.currentChatId) {
            return null;
        }

        const activeChat = chatManager.chats.find(chat => chat.id === chatManager.currentChatId);
        return activeChat?.title ?? null;
    }, [chatManager.chats, chatManager.currentChatId]);

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
        workspaces,
        selectedWorkspace,
        setSelectedWorkspace,
        loadWorkspaces,
        canUndo: historyManager.canUndo,
        canRedo: historyManager.canRedo,
        undo,
        redo,
        systemMode: chatManager.systemMode,
        setSystemMode: chatManager.setSystemMode,
        bulkDeleteChats: chatManager.bulkDeleteChats
    }), [
        chatManager, handleSpeak, handleStopSpeak, isSpeaking, speakingMessageId,
        workspaces, selectedWorkspace, setSelectedWorkspace, loadWorkspaces,
        historyManager.canUndo, historyManager.canRedo, undo, redo
    ]);
    const headerValue = useMemo(() => ({
        currentChatId: chatManager.currentChatId,
        currentChatTitle,
        clearMessages: chatManager.clearMessages,
    }), [chatManager.clearMessages, chatManager.currentChatId, currentChatTitle]);
    const shellValue = useMemo(() => ({
        chatsCount: chatManager.chats.length,
        createNewChat: chatManager.createNewChat,
    }), [chatManager.chats.length, chatManager.createNewChat]);
    const libraryValue = useMemo(() => ({
        chats: chatManager.chats,
        currentChatId: chatManager.currentChatId,
        setCurrentChatId: chatManager.setCurrentChatId,
        deleteChat: chatManager.deleteChat,
        updateChat: chatManager.updateChat,
        folders: chatManager.folders,
        createFolder: chatManager.createFolder,
        deleteFolder: chatManager.deleteFolder,
        prompts: chatManager.prompts,
        createPrompt: chatManager.createPrompt,
        updatePrompt: chatManager.updatePrompt,
        deletePrompt: chatManager.deletePrompt,
        togglePin: chatManager.togglePin,
        bulkDeleteChats: chatManager.bulkDeleteChats,
    }), [
        chatManager.chats,
        chatManager.currentChatId,
        chatManager.setCurrentChatId,
        chatManager.deleteChat,
        chatManager.updateChat,
        chatManager.folders,
        chatManager.createFolder,
        chatManager.deleteFolder,
        chatManager.prompts,
        chatManager.createPrompt,
        chatManager.updatePrompt,
        chatManager.deletePrompt,
        chatManager.togglePin,
        chatManager.bulkDeleteChats,
    ]);
    const composerValue = useMemo(() => ({
        setInput: chatManager.setInput,
        handleSend: chatManager.handleSend,
        processFile: chatManager.processFile,
    }), [chatManager.handleSend, chatManager.processFile, chatManager.setInput]);
    const lastAssistantMessageText = useMemo(() => {
        const lastAssistantMessage = [...chatManager.messages]
            .reverse()
            .find(message => message.role === 'assistant');
        return typeof lastAssistantMessage?.content === 'string'
            ? lastAssistantMessage.content
            : '';
    }, [chatManager.messages]);
    const windowCommandValue = useMemo(() => ({
        clearMessages: chatManager.clearMessages,
        lastAssistantMessageText,
    }), [chatManager.clearMessages, lastAssistantMessageText]);
    const listeningValue = useMemo(() => ({
        isListening: chatManager.isListening,
        stopListening: chatManager.stopListening,
    }), [chatManager.isListening, chatManager.stopListening]);

    return (
        <ChatShellContext.Provider value={shellValue}>
            <ChatHeaderContext.Provider value={headerValue}>
                <ChatLibraryContext.Provider value={libraryValue}>
                    <ChatComposerContext.Provider value={composerValue}>
                        <ChatWindowCommandContext.Provider value={windowCommandValue}>
                            <ChatListeningContext.Provider value={listeningValue}>
                                <ChatContext.Provider value={value}>
                                    {children}
                                </ChatContext.Provider>
                            </ChatListeningContext.Provider>
                        </ChatWindowCommandContext.Provider>
                    </ChatComposerContext.Provider>
                </ChatLibraryContext.Provider>
            </ChatHeaderContext.Provider>
        </ChatShellContext.Provider>
    );
}

export function useChat() {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error(translateErrorMessage('useChat must be used within a ChatProvider'));
    }
    return context;
}

export function useChatHeader() {
    const context = useContext(ChatHeaderContext);
    if (!context) {
        throw new Error(translateErrorMessage('useChatHeader must be used within a ChatProvider'));
    }
    return context;
}

export function useChatShell() {
    const context = useContext(ChatShellContext);
    if (!context) {
        throw new Error(translateErrorMessage('useChatShell must be used within a ChatProvider'));
    }
    return context;
}

export function useChatLibrary() {
    const context = useContext(ChatLibraryContext);
    if (!context) {
        throw new Error(translateErrorMessage('useChatLibrary must be used within a ChatProvider'));
    }
    return context;
}

export function useChatComposer() {
    const context = useContext(ChatComposerContext);
    if (!context) {
        throw new Error(translateErrorMessage('useChatComposer must be used within a ChatProvider'));
    }
    return context;
}

export function useChatWindowCommand() {
    const context = useContext(ChatWindowCommandContext);
    if (!context) {
        throw new Error(translateErrorMessage('useChatWindowCommand must be used within a ChatProvider'));
    }
    return context;
}

export function useChatListening() {
    const context = useContext(ChatListeningContext);
    if (!context) {
        throw new Error(translateErrorMessage('useChatListening must be used within a ChatProvider'));
    }
    return context;
}
