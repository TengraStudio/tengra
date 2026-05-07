/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { WorkspaceAgentSessionModes, WorkspaceAgentSessionSummary } from '@shared/types/workspace-agent-session';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useRef } from 'react';

import type { Chat, Message } from '@/types';

import { sendWorkspaceAgentMessage } from '../utils/workspace-agent-session-utils';

interface UseWorkspaceAgentSessionMessagingOptions {
    composerValue: string;
    setComposerValue: Dispatch<SetStateAction<string>>;
    resolveTargetSession: (
        title: string
    ) => Promise<{
        session: WorkspaceAgentSessionSummary;
        modes: WorkspaceAgentSessionModes;
    }>;
    isLoading: boolean;
    selectedModel: string;
    selectedProvider: string;
    generateResponse: (chatId: string, userMessage: Message, retryModel?: string) => Promise<void>;
    loadWorkspaceSessions: () => Promise<void>;
    refreshCouncilState: (sessionId: string) => Promise<void>;
    refreshStats: (sessionId: string) => Promise<void>;
    updateChatCollection: (sessionId: string, updater: (chat: Chat) => Chat) => void;
}

export function useWorkspaceAgentSessionMessaging({
    composerValue,
    setComposerValue,
    resolveTargetSession,
    isLoading,
    selectedModel,
    selectedProvider,
    generateResponse,
    loadWorkspaceSessions,
    refreshCouncilState,
    refreshStats,
    updateChatCollection,
}: UseWorkspaceAgentSessionMessagingOptions) {
    const isSendingRef = useRef(false);

    const handleSend = useCallback(async (contentOverride?: string) => {
        if (isSendingRef.current) { return; }
        isSendingRef.current = true;
        try {
            await sendWorkspaceAgentMessage({
                composerValue: contentOverride ?? composerValue,
                resolveTargetSession,
                generateResponse,
                isLoading,
                loadWorkspaceSessions,
                refreshCouncilState,
                refreshStats,
                selectedModel,
                selectedProvider,
                updateChatCollection,
                setComposerValue,
            });
        } finally {
            isSendingRef.current = false;
        }
    }, [
        composerValue,
        generateResponse,
        isLoading,
        loadWorkspaceSessions,
        refreshCouncilState,
        refreshStats,
        resolveTargetSession,
        selectedModel,
        selectedProvider,
        updateChatCollection,
        setComposerValue,
    ]);

    return {
        handleSend,
    };
}

