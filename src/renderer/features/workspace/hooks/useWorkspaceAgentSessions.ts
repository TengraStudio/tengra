/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useAuth } from '@renderer/context/AuthContext';
import { useModel } from '@renderer/context/ModelContext';
import { useChatGenerator } from '@renderer/features/chat/hooks/useChatGenerator';
import type { Language } from '@renderer/i18n';
import { useTranslation } from '@renderer/i18n';
import type { CatchError } from '@shared/types/common';
import type {
    CouncilRunConfig,
    WorkspaceAgentPermissionPolicy,
    WorkspaceAgentSessionModes,
} from '@shared/types/workspace-agent-session';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Chat, Workspace } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import type { WorkspaceAgentComposerPreset } from '../components/workspace/WorkspaceAgentComposer';
import { EMPTY_COUNCIL_STATE } from '../types/workspace-agent-session-local';
import {
    applyCouncilSetupToSession,
    buildNormalizedQuotaSnapshot,
    DEFAULT_COUNCIL_SETUP,
    DEFAULT_MODES,
    DEFAULT_PERMISSION_POLICY,
    toCouncilRuntime,
    toSessionModes,
} from '../utils/workspace-agent-session-utils';

import { useWorkspaceAgentSessionCouncil } from './useWorkspaceAgentSessionCouncil';
import { useWorkspaceAgentSessionManagement } from './useWorkspaceAgentSessionManagement';
import { useWorkspaceAgentSessionMessaging } from './useWorkspaceAgentSessionMessaging';
import { useWorkspaceAgentSessionState } from './useWorkspaceAgentSessionState';
import { useWorkspaceAgentSessionTelemetry } from './useWorkspaceAgentSessionTelemetry';

interface UseWorkspaceAgentSessionsOptions {
    workspace: Workspace;
    language: Language;
}

/**
 * Orchestrates workspace-scoped AI agent sessions, including message handling,
 * council coordination, and state persistence.
 */
export function useWorkspaceAgentSessions({
    workspace,
    language,
}: UseWorkspaceAgentSessionsOptions) {
    const { t } = useTranslation(language);
    const { appSettings, quotas, codexUsage, claudeQuota } = useAuth();
    const {
        selectedModel,
        selectedProvider,
        groupedModels,
        setSelectedModel,
        setSelectedProvider,
        persistLastSelection,
    } = useModel();

    const {
        sessions,
        setSessions,
        chats,
        setChats,
        currentSessionId,
        setCurrentSessionId,
        composerValue,
        setComposerValue,
        councilStateBySession,
        setCouncilStateBySession,
        loadWorkspaceSessions,
    } = useWorkspaceAgentSessionState({ workspaceId: workspace.id });

    const [showSessionPicker, setShowSessionPicker] = useState(false);
    const [showCouncilSetup, setShowCouncilSetup] = useState(false);
    const [councilSetup, setCouncilSetup] = useState<CouncilRunConfig>(DEFAULT_COUNCIL_SETUP);
    const [pendingCouncilSetup, setPendingCouncilSetup] = useState<CouncilRunConfig | null>(null);
    const [draftModes, setDraftModes] = useState<WorkspaceAgentSessionModes>(DEFAULT_MODES);
    const [draftPermissionPolicy, setDraftPermissionPolicy] =
        useState<WorkspaceAgentPermissionPolicy>({
            ...DEFAULT_PERMISSION_POLICY,
            allowedPaths: [workspace.path],
        });

    const updateChatCollection = useCallback((sessionId: string, updater: (chat: Chat) => Chat) => {
        setChats(previousChats => {
            const existingChat = previousChats.find(chat => chat.id === sessionId);
            if (existingChat) {
                return previousChats.map(chat => (chat.id === sessionId ? updater(chat) : chat));
            }

            const sessionSummary = sessions.find(session => session.id === sessionId);
            const fallbackChat: Chat = {
                id: sessionId,
                title: sessionSummary?.title ?? 'Workspace Session',
                model: selectedModel,
                backend: selectedProvider,
                messages: [],
                createdAt: new Date(),
                updatedAt: new Date(),
                workspaceId: workspace.id,
                metadata: {},
                isGenerating: false,
            };
            return [...previousChats, updater(fallbackChat)];
        });
    }, [selectedModel, selectedProvider, sessions, setChats, workspace.id]);

    const {
        createSession,
        selectSession,
        updateModes,
        updateStrategy,
        updatePermissions,
        archiveSession,
        renameSession,
    } = useWorkspaceAgentSessionManagement({
        workspaceId: workspace.id,
        workspacePath: workspace.path,
        currentSessionId,
        setCurrentSessionId,
        setSessions,
        updateChatCollection,
        loadWorkspaceSessions,
    });

    const activeChatModes = useMemo(
        () => toSessionModes(chats.find(chat => chat.id === currentSessionId) ?? null),
        [chats, currentSessionId]
    );

    const formatChatError = useCallback((error: CatchError) => {
        if (!error) {return t('common.unknownError');}
        if (typeof error === 'string') {return error;}
        if (error instanceof Error) {return error.message;}
        if (typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
            return error.message;
        }
        return t('common.unknownError');
    }, [t]);

    const {
        streamingStates,
        lastChatError,
        clearChatError,
        generateResponse,
        stopGeneration,
    } = useChatGenerator({
        chats,
        setChats,
        appSettings: appSettings ?? undefined,
        selectedModel,
        selectedProvider,
        language,
        activeWorkspacePath: workspace.path,
        workspaceId: workspace.id,
        t,
        handleSpeak: () => undefined,
        autoReadEnabled: false,
        formatChatError,
        systemMode:
            (currentSessionId ? activeChatModes.agent : draftModes.agent) ? 'agent' : 'thinking',
    });

    const currentChat = useMemo(
        () => chats.find(chat => chat.id === currentSessionId) ?? null,
        [chats, currentSessionId]
    );

    const currentSession = useMemo(
        () => sessions.find(session => session.id === currentSessionId) ?? null,
        [currentSessionId, sessions]
    );

    const currentMessages = useMemo(() => currentChat?.messages ?? [], [currentChat]);

    const currentCouncilRuntime = useMemo(() => toCouncilRuntime(currentChat), [currentChat]);

    const currentCouncilState = useMemo(() => {
        if (!currentSessionId) {return EMPTY_COUNCIL_STATE;}
        return councilStateBySession[currentSessionId] ?? EMPTY_COUNCIL_STATE;
    }, [councilStateBySession, currentSessionId]);

    const safePermissionPolicy = useMemo<WorkspaceAgentPermissionPolicy>(() => ({
        ...DEFAULT_PERMISSION_POLICY,
        allowedPaths: [workspace.path],
    }), [workspace.path]);

    const currentModes = currentSession?.modes ?? draftModes;
    const currentPermissionPolicy =
        currentSession?.permissionPolicy ?? draftPermissionPolicy;
    const isLoading = useMemo(() => {
        return currentSessionId ? Boolean(streamingStates[currentSessionId]) : false;
    }, [currentSessionId, streamingStates]);

    const { refreshTelemetry } = useWorkspaceAgentSessionTelemetry({
        currentSessionId,
        currentSession,
        setSessions,
    });

    const {
        refreshCouncilState,
        persistCouncilRuntime,
        switchCouncilView,
        approvePlan,
        submitDraft,
        reviewDraft,
        assignAssist,
        sendDiscussionMessage,
    } = useWorkspaceAgentSessionCouncil({
        chats,
        currentSessionId,
        currentSession,
        currentModes,
        currentCouncilRuntime,
        setCouncilStateBySession,
        loadWorkspaceSessions,
        updateChatCollection,
        updateModes,
    });

    const quotaSnapshot = useMemo(() => buildNormalizedQuotaSnapshot({
        groupedModels,
        quotas,
        codexUsage,
        claudeQuota,
    }), [claudeQuota, codexUsage, groupedModels, quotas]);

    const { handleSend } = useWorkspaceAgentSessionMessaging({
        composerValue,
        setComposerValue,
        resolveTargetSession: async title => {
            if (currentSessionId && currentSession) {
                return {
                    modes: currentModes,
                    session: currentSession,
                };
            }

            const createdSession = await createSession({
                title,
                modes: pendingCouncilSetup
                    ? { ask: false, plan: true, agent: true, council: true }
                    : draftModes,
                permissionPolicy: draftPermissionPolicy,
            });

            if (pendingCouncilSetup) {
                await applyCouncilSetupToSession({
                    composerValue,
                    councilSetup: pendingCouncilSetup,
                    currentSession: createdSession,
                    currentSessionId: createdSession.id,
                    createSession,
                    groupedModels,
                    persistCouncilRuntime,
                    quotaSnapshot,
                    selectedModel,
                    selectedProvider,
                    titlePrefix: t('agents.council'),
                    updateModes,
                    updateStrategy,
                    workspaceDescription: workspace.description,
                    workspaceTitle: workspace.title,
                    setCurrentSessionId,
                    setShowCouncilSetup,
                });
                setPendingCouncilSetup(null);
                setDraftModes(DEFAULT_MODES);
            }

            return {
                modes: pendingCouncilSetup
                    ? { ask: false, plan: true, agent: true, council: true }
                    : draftModes,
                session: createdSession,
            };
        },
        isLoading,
        selectedModel,
        selectedProvider,
        generateResponse,
        loadWorkspaceSessions,
        refreshCouncilState,
        refreshTelemetry,
        updateChatCollection,
    });

    const applyCouncilSetup = useCallback(async () => {
        if (!currentSessionId || !currentSession) {
            setPendingCouncilSetup({
                ...councilSetup,
                enabled: true,
            });
            setDraftModes({ ask: false, plan: true, agent: true, council: true });
            setShowCouncilSetup(false);
            return;
        }

        await applyCouncilSetupToSession({
            composerValue,
            councilSetup,
            currentSession,
            currentSessionId,
            createSession,
            groupedModels,
            persistCouncilRuntime,
            quotaSnapshot,
            selectedModel,
            selectedProvider,
            titlePrefix: t('agents.council'),
            updateModes,
            updateStrategy,
            workspaceDescription: workspace.description,
            workspaceTitle: workspace.title,
            setCurrentSessionId,
            setShowCouncilSetup,
        });
    }, [
        composerValue,
        councilSetup,
        currentSession,
        currentSessionId,
        createSession,
        groupedModels,
        persistCouncilRuntime,
        quotaSnapshot,
        selectedModel,
        selectedProvider,
        t,
        updateModes,
        updateStrategy,
        workspace.description,
        workspace.title,
        setCurrentSessionId,
        setPendingCouncilSetup,
    ]);

    const toggleCouncil = useCallback(async () => {
        if (!currentSession) {
            setPendingCouncilSetup(null);
            const shouldHideSetup = showCouncilSetup;
            setShowCouncilSetup(previousValue => !previousValue);
            if (shouldHideSetup) {
                setDraftModes(DEFAULT_MODES);
            }
            return;
        }

        if (!currentSession.modes.council) {
            setShowCouncilSetup(true);
            return;
        }

        await updateModes(currentSession.id, {
            ask: true,
            plan: false,
            agent: false,
            council: false,
        });
        await persistCouncilRuntime(currentSession.id, {
            councilConfig: {
                ...(currentSession.councilConfig ?? DEFAULT_COUNCIL_SETUP),
                enabled: false,
                activeView: 'board',
            },
            status: 'active',
        });
    }, [currentSession, persistCouncilRuntime, showCouncilSetup, updateModes]);

    const selectPreset = useCallback(async (preset: WorkspaceAgentComposerPreset) => {
        const nextModes: WorkspaceAgentSessionModes =
            preset === 'plan'
                ? { ask: false, plan: true, agent: false, council: false }
                : preset === 'agent'
                    ? { ask: false, plan: false, agent: true, council: false }
                    : { ask: true, plan: false, agent: false, council: false };

        setPendingCouncilSetup(null);
        setShowCouncilSetup(false);

        if (!currentSession) {
            setDraftModes(nextModes);
            return;
        }

        await updateModes(currentSession.id, nextModes);
    }, [currentSession, updateModes]);

    const updateEffectivePermissions = useCallback(
        async (permissionPolicy: WorkspaceAgentPermissionPolicy) => {
            if (!currentSession) {
                setDraftPermissionPolicy(permissionPolicy);
                return;
            }

            await updatePermissions(currentSession.id, permissionPolicy);
        },
        [currentSession, updatePermissions]
    );

    const openEmptySession = useCallback(async () => {
        await selectSession(null);
        setShowCouncilSetup(false);
        setPendingCouncilSetup(null);
        setDraftModes(DEFAULT_MODES);
        setDraftPermissionPolicy(safePermissionPolicy);
    }, [safePermissionPolicy, selectSession]);

    // Cleanup and background sync
    useEffect(() => {
        if (!workspace.id) {return;}
        window.electron.session.workspaceAgent.resumeBackgroundState({
            workspaceId: workspace.id,
            activeSessionId: currentSessionId,
        }).catch(err => appLogger.error('WorkspaceAgentSessions', 'Failed to sync background state', err));
    }, [currentSessionId, workspace.id]);

    useEffect(() => {
        if (!workspace.id) {return;}
        const timeoutId = window.setTimeout(() => {
            window.electron.session.workspaceAgent.updatePersistence({
                workspaceId: workspace.id,
                activeSessionId: currentSessionId,
                composerDraft: composerValue,
            }).catch(err => appLogger.error('WorkspaceAgentSessions', 'Failed to persist state', err));
        }, 250);
        return () => window.clearTimeout(timeoutId);
    }, [composerValue, currentSessionId, workspace.id]);

    useEffect(() => {
        if (!currentSessionId) {return;}
        const chat = chats.find(c => c.id === currentSessionId);
        if (chat?.messages.length) {return;}

        const loadMessages = async () => {
            const messages = await window.electron.db.getMessages(currentSessionId);
            updateChatCollection(currentSessionId, currentChatState => ({
                ...currentChatState,
                messages,
            }));
        };
        void loadMessages();
    }, [chats, currentSessionId, updateChatCollection]);

    const recentSessionsVal = useMemo(
        () => sessions.filter(session => !session.archived).slice(0, 5),
        [sessions]
    );

    return {
        sessions,
        recentSessions: recentSessionsVal,
        currentSession,
        currentSessionId,
        currentMessages,
        currentModes,
        currentPermissionPolicy,
        currentCouncilRuntime,
        currentCouncilState,
        composerValue,
        setComposerValue,
        showSessionPicker,
        setShowSessionPicker,
        showCouncilSetup,
        setShowCouncilSetup,
        councilSetup,
        setCouncilSetup,
        selectedProvider,
        selectedModel,
        groupedModels,
        setSelectedProvider,
        setSelectedModel,
        persistLastSelection,
        isLoading,
        chatError: lastChatError,
        clearChatError,
        stopGeneration,
        quotaSnapshot,
        loadWorkspaceSessions,
        selectSession,
        createSession,
        openEmptySession,
        handleSend,
        toggleCouncil,
        selectPreset,
        updateEffectivePermissions,
        applyCouncilSetup,
        approvePlan,
        archiveSession,
        renameSession,
        updateStrategy,
        updatePermissions,
        switchCouncilView,
        submitDraft,
        reviewDraft,
        assignAssist,
        sendDiscussionMessage,
    };
}
