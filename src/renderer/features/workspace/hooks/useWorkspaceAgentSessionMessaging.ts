import type { WorkspaceAgentSessionModes, WorkspaceAgentSessionSummary } from '@shared/types/workspace-agent-session';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback } from 'react';

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
    refreshTelemetry: (sessionId: string) => Promise<void>;
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
    refreshTelemetry,
    updateChatCollection,
}: UseWorkspaceAgentSessionMessagingOptions) {
    const handleSend = useCallback(async () => {
        await sendWorkspaceAgentMessage({
            composerValue,
            resolveTargetSession,
            generateResponse,
            isLoading,
            loadWorkspaceSessions,
            refreshCouncilState,
            refreshTelemetry,
            selectedModel,
            selectedProvider,
            updateChatCollection,
            setComposerValue,
        });
    }, [
        composerValue,
        generateResponse,
        isLoading,
        loadWorkspaceSessions,
        refreshCouncilState,
        refreshTelemetry,
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
