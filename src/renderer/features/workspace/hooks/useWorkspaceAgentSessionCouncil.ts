/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { CouncilRunConfig, WorkspaceAgentSession, WorkspaceAgentSessionModes, WorkspaceAgentSessionSummary } from '@shared/types/workspace-agent-session';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect } from 'react';

import type { Chat } from '@/types';

import type { SessionCouncilRuntime, SessionCouncilState } from '../types/workspace-agent-session-local';
import {
    appendCouncilDiscussionMessage,
    applyCouncilReviewDecision,
    assignCouncilAssist,
    deriveCouncilRuntimeStatus,
    submitCouncilDraftForReview,
} from '../utils/workspace-agent-council-runtime';
import { DEFAULT_COUNCIL_SETUP, persistCouncilRuntimeMetadata, refreshCouncilStateForSession } from '../utils/workspace-agent-session-utils';

interface UseWorkspaceAgentSessionCouncilOptions {
    chats: Chat[];
    currentSessionId: string | null;
    currentSession: WorkspaceAgentSessionSummary | null;
    currentModes: WorkspaceAgentSessionModes;
    currentCouncilRuntime: SessionCouncilRuntime;
    setCouncilStateBySession: Dispatch<SetStateAction<Record<string, SessionCouncilState>>>;
    loadWorkspaceSessions: () => Promise<void>;
    updateChatCollection: (sessionId: string, updater: (chat: Chat) => Chat) => void;
    updateModes: (sessionId: string, modes: WorkspaceAgentSessionModes) => Promise<WorkspaceAgentSession>;
}

export function useWorkspaceAgentSessionCouncil({
    chats,
    currentSessionId,
    currentSession,
    currentModes,
    currentCouncilRuntime,
    setCouncilStateBySession,
    loadWorkspaceSessions,
    updateChatCollection,
    updateModes,
}: UseWorkspaceAgentSessionCouncilOptions) {
    const refreshCouncilState = useCallback(async (sessionId: string) => {
        await refreshCouncilStateForSession({
            sessionId,
            setCouncilStateBySession,
        });
    }, [setCouncilStateBySession]);

    const persistCouncilRuntime = useCallback(
        async (
            sessionId: string,
            updates: {
                councilConfig?: CouncilRunConfig;
                status?: WorkspaceAgentSession['status'];
                council?: Partial<SessionCouncilRuntime>;
            }
        ) => {
            await persistCouncilRuntimeMetadata({
                sessionId,
                chats,
                loadWorkspaceSessions,
                updateChatCollection,
                updates,
            });
        },
        [chats, loadWorkspaceSessions, updateChatCollection]
    );

    const persistCurrentCouncilRuntime = useCallback(
        async (runtime: SessionCouncilRuntime) => {
            if (!currentSessionId) {
                return;
            }
            await persistCouncilRuntime(currentSessionId, {
                status: deriveCouncilRuntimeStatus(runtime),
                council: runtime,
            });
        },
        [currentSessionId, persistCouncilRuntime]
    );

    const switchCouncilView = useCallback(
        async (view: CouncilRunConfig['activeView']) => {
            if (!currentSessionId || !currentSession) {
                return;
            }

            await persistCouncilRuntime(currentSessionId, {
                councilConfig: {
                    ...(currentSession.councilConfig ?? DEFAULT_COUNCIL_SETUP),
                    enabled: true,
                    activeView: view,
                },
            });
        },
        [currentSession, currentSessionId, persistCouncilRuntime]
    );

    const approvePlan = useCallback(async () => {
        if (!currentSessionId || !currentSession) {
            return;
        }
        await window.electron.session.council.approveProposal(currentSessionId);
        if (currentSession.modes.plan && !currentSession.modes.council) {
            await updateModes(currentSessionId, {
                ask: false,
                plan: false,
                agent: true,
                council: false,
            });
        }
        if (currentSession.modes.plan || currentSession.modes.agent || currentSession.modes.council) {
            await window.electron.session.council.startExecution(currentSessionId);
        }
        await refreshCouncilState(currentSessionId);
        await loadWorkspaceSessions();
    }, [
        currentSession,
        currentSessionId,
        loadWorkspaceSessions,
        refreshCouncilState,
        updateModes,
    ]);

    const submitDraft = useCallback(
        async (agentId: string) => {
            const runtime = submitCouncilDraftForReview(currentCouncilRuntime, agentId);
            await persistCurrentCouncilRuntime(runtime);
        },
        [currentCouncilRuntime, persistCurrentCouncilRuntime]
    );

    const reviewDraft = useCallback(
        async (
            draftId: string,
            decision: 'approve' | 'reject' | 'revise' | 'reassign-model'
        ) => {
            const fallbackModel =
                decision === 'reassign-model'
                    ? {
                          provider:
                              currentSession?.councilConfig?.chairman.provider ??
                              currentSession?.usageStats?.provider ??
                              '',
                          model:
                              currentSession?.councilConfig?.chairman.model ??
                              currentSession?.usageStats?.model ??
                              '',
                      }
                    : undefined;
            const runtime = applyCouncilReviewDecision(currentCouncilRuntime, {
                draftId,
                decision,
                chairmanAgentId: currentCouncilRuntime.chairman?.id,
                fallbackModel,
            });
            await persistCurrentCouncilRuntime(runtime);
        },
        [currentCouncilRuntime, currentSession, persistCurrentCouncilRuntime]
    );

    const assignAssist = useCallback(
        async (helperAgentId: string, ownerAgentId: string) => {
            const runtime = assignCouncilAssist(currentCouncilRuntime, {
                helperAgentId,
                ownerAgentId,
            });
            await persistCurrentCouncilRuntime(runtime);
        },
        [currentCouncilRuntime, persistCurrentCouncilRuntime]
    );

    const sendDiscussionMessage = useCallback(
        async (content: string, fromAgentId: string, toAgentId?: string) => {
            const runtime = appendCouncilDiscussionMessage(currentCouncilRuntime, {
                content,
                fromAgentId,
                toAgentId,
            });
            await persistCurrentCouncilRuntime(runtime);
        },
        [currentCouncilRuntime, persistCurrentCouncilRuntime]
    );

    useEffect(() => {
        if (!currentSessionId) {
            return;
        }
        if (!currentModes.plan && !currentModes.council) {
            return;
        }
        void Promise.resolve().then(() => refreshCouncilState(currentSessionId));
    }, [currentModes.council, currentModes.plan, currentSessionId, refreshCouncilState]);

    return {
        refreshCouncilState,
        persistCouncilRuntime,
        switchCouncilView,
        approvePlan,
        submitDraft,
        reviewDraft,
        assignAssist,
        sendDiscussionMessage,
    };
}

