/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { CatchError } from '@shared/types/common';
import type {
    CouncilRunConfig,
    WorkspaceAgentPermissionPolicy,
    WorkspaceAgentSessionModes,
} from '@shared/types/workspace-agent-session';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useModel } from '@/context/ModelContext';
import { useChatGenerator } from '@/features/chat/hooks/useChatGenerator';
import type { Language } from '@/i18n';
import { useTranslation } from '@/i18n';
import type { Chat, Message, Workspace } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import type { WorkspaceAgentComposerPreset } from '../components/workspace/WorkspaceAgentComposer';
import { EMPTY_COUNCIL_STATE } from '../types/workspace-agent-session-local';
import {
    applyCouncilSetupToSession,
    buildNormalizedQuotaSnapshot,
    dedupeChatMessages,
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
import { useWorkspaceAgentSessionStats } from './useWorkspaceAgentSessionStats';

interface UseWorkspaceAgentSessionsOptions {
    workspace: Workspace;
    language: Language;
}

type WorkspaceMessageDeliveryMode = 'send' | 'queue' | 'steer';

interface PendingWorkspaceMessage {
    id: string;
    content: string;
    mode: Exclude<WorkspaceMessageDeliveryMode, 'send'>;
    createdAt: number;
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
    const { appSettings, quotas, codexUsage, claudeQuota, updateGeneral } = useAuth();
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
    const [deliveryMode, setDeliveryMode] = useState<WorkspaceMessageDeliveryMode>('send');
    const [pendingMessagesBySession, setPendingMessagesBySession] = useState<Record<string, PendingWorkspaceMessage[]>>({});
    const [draftPermissionPolicy, setDraftPermissionPolicy] =
        useState<WorkspaceAgentPermissionPolicy>(() => ({
            ...DEFAULT_PERMISSION_POLICY,
            commandPolicy: appSettings?.general?.agentCommandPolicy ?? DEFAULT_PERMISSION_POLICY.commandPolicy,
            pathPolicy: appSettings?.general?.agentPathPolicy ?? DEFAULT_PERMISSION_POLICY.pathPolicy,
            allowedCommands: appSettings?.general?.agentAllowedCommands ?? [],
            disallowedCommands: appSettings?.general?.agentDisallowedCommands ?? [],
            allowedPaths: appSettings?.general?.agentAllowedPaths?.length 
                ? appSettings.general.agentAllowedPaths 
                : [workspace.path],
        }));

    // Computed safe policy that uses latest settings
    const currentSafePermissionPolicy = useMemo<WorkspaceAgentPermissionPolicy>(() => ({
        ...DEFAULT_PERMISSION_POLICY,
        commandPolicy: appSettings?.general?.agentCommandPolicy ?? DEFAULT_PERMISSION_POLICY.commandPolicy,
        pathPolicy: appSettings?.general?.agentPathPolicy ?? DEFAULT_PERMISSION_POLICY.pathPolicy,
        allowedCommands: appSettings?.general?.agentAllowedCommands ?? [],
        disallowedCommands: appSettings?.general?.agentDisallowedCommands ?? [],
        allowedPaths: appSettings?.general?.agentAllowedPaths?.length 
            ? appSettings.general.agentAllowedPaths 
            : [workspace.path],
    }), [appSettings?.general, workspace.path]);

    // Sync draft policy with settings if they change and no session is active
    useEffect(() => {
        if (!currentSessionId && appSettings?.general) {
            setDraftPermissionPolicy(prev => ({
                ...prev,
                commandPolicy: appSettings.general.agentCommandPolicy ?? prev.commandPolicy,
                pathPolicy: appSettings.general.agentPathPolicy ?? prev.pathPolicy,
                allowedCommands: appSettings.general.agentAllowedCommands ?? prev.allowedCommands,
                disallowedCommands: appSettings.general.agentDisallowedCommands ?? prev.disallowedCommands,
                allowedPaths: appSettings.general.agentAllowedPaths ?? prev.allowedPaths,
            }));
        }
    }, [appSettings?.general, currentSessionId]);

    const updateChatCollection = useCallback((sessionId: string, updater: (chat: Chat) => Chat) => {
        setChats(previousChats => {
            const existingChat = previousChats.find(chat => chat.id === sessionId);
            if (existingChat) {
                return previousChats.map(chat => {
                    if (chat.id === sessionId) {
                        const updated = updater(chat);
                        return { ...updated, messages: dedupeChatMessages(updated.messages) };
                    }
                    return chat;
                });
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
        deleteSession,
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

    const currentModes = useMemo(
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
        appSettings: appSettings ?? undefined,
        selectedModel,
        selectedProvider,
        language,
        activeWorkspacePath: workspace.path,
        workspaceId: workspace.id,
        workspaceTitle: workspace.title,
        workspaceDescription: workspace.description,
        t,
        handleSpeak: () => undefined,
        autoReadEnabled: false,
        formatChatError,
        systemMode: 'thinking',
        onMessageAdded: (chatId, message) => {
            updateChatCollection(chatId, chat => ({
                ...chat,
                messages: [...chat.messages, message],
            }));
        },
        onMessageUpdated: (chatId, messageId, updates) => {
            updateChatCollection(chatId, chat => ({
                ...chat,
                messages: chat.messages.map(m => m.id === messageId ? { ...m, ...updates } : m),
            }));
        },
        onChatUpdated: (chatId, updates) => {
            updateChatCollection(chatId, chat => ({
                ...chat,
                ...updates,
            }));
        },
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

    const currentPermissionPolicy =
        currentSession?.permissionPolicy ?? draftPermissionPolicy;
    const currentStreamingState = useMemo(() => {
        return currentSessionId ? streamingStates[currentSessionId] : null;
    }, [currentSessionId, streamingStates]);

    const isLoading = useMemo(() => {
        return Boolean(currentStreamingState);
    }, [currentStreamingState]);

    const { refreshStats } = useWorkspaceAgentSessionStats({
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
                    titlePrefix: t('frontend.agents.council'),
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
        refreshStats,
        updateChatCollection,
    });

    const enqueuePendingMessage = useCallback((
        sessionId: string,
        content: string,
        mode: Exclude<WorkspaceMessageDeliveryMode, 'send'>
    ) => {
        setPendingMessagesBySession(previousState => ({
            ...previousState,
            [sessionId]: [
                ...(previousState[sessionId] ?? []),
                {
                    id: `${sessionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    content,
                    mode,
                    createdAt: Date.now(),
                },
            ],
        }));
    }, []);

    const submitMessage = useCallback(async (mode?: WorkspaceMessageDeliveryMode) => {
        const trimmed = composerValue.trim();
        if (trimmed.length === 0) {
            return;
        }

        const effectiveMode: WorkspaceMessageDeliveryMode =
            mode ?? (isLoading && deliveryMode === 'send' ? 'steer' : deliveryMode);

        if (effectiveMode === 'send' || !currentSessionId || !currentSession) {
            await handleSend();
            setDeliveryMode('send');
            return;
        }

        enqueuePendingMessage(currentSessionId, trimmed, effectiveMode);
        setComposerValue('');
        setDeliveryMode('send');
    }, [
        composerValue,
        currentSession,
        currentSessionId,
        deliveryMode,
        enqueuePendingMessage,
        handleSend,
        isLoading,
        setComposerValue,
        setDeliveryMode,
    ]);

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
            titlePrefix: t('frontend.agents.council'),
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
            // Persist to global settings so it becomes the default for future sessions
            await updateGeneral({
                agentCommandPolicy: permissionPolicy.commandPolicy,
                agentPathPolicy: permissionPolicy.pathPolicy,
                agentAllowedCommands: permissionPolicy.allowedCommands,
                agentDisallowedCommands: permissionPolicy.disallowedCommands,
                agentAllowedPaths: permissionPolicy.allowedPaths,
            });

            if (!currentSession) {
                setDraftPermissionPolicy(permissionPolicy);
                return;
            }

            await updatePermissions(currentSession.id, permissionPolicy);
        },
        [currentSession, updatePermissions, updateGeneral]
    );

    const openEmptySession = useCallback(async () => {
        await selectSession(null);
        setShowCouncilSetup(false);
        setPendingCouncilSetup(null);
        setDraftModes(DEFAULT_MODES);
        setDraftPermissionPolicy(currentSafePermissionPolicy);
    }, [currentSafePermissionPolicy, selectSession]);

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

    useEffect(() => {
        if (!currentSessionId || isLoading) {
            return;
        }
        const queuedMessages = pendingMessagesBySession[currentSessionId] ?? [];
        const nextQueuedMessage = queuedMessages[0];
        if (!nextQueuedMessage) {
            return;
        }

        const nextContent = nextQueuedMessage.mode === 'steer'
            ? `Steer the current task with this update and continue from the latest state:\n\n${nextQueuedMessage.content}`
            : nextQueuedMessage.content;

        setPendingMessagesBySession(previousState => ({
            ...previousState,
            [currentSessionId]: queuedMessages.slice(1),
        }));
        void handleSend(nextContent);
    }, [currentSessionId, handleSend, isLoading, pendingMessagesBySession]);

    const recentSessionsVal = useMemo(
        () =>
            [...sessions]
                .filter(session => !session.archived)
                .sort((left, right) => right.updatedAt - left.updatedAt)
                .slice(0, 5),
        [sessions]
    );

    const queuedMessageCount = useMemo(() => {
        if (!currentSessionId) {
            return 0;
        }
        return pendingMessagesBySession[currentSessionId]?.length ?? 0;
    }, [currentSessionId, pendingMessagesBySession]);

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
        deliveryMode,
        setDeliveryMode,
        queuedMessageCount,
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
        currentStreamingState,
        chatError: lastChatError,
        clearChatError,
        stopGeneration,
        quotaSnapshot,
        loadWorkspaceSessions,
        selectSession,
        createSession,
        openEmptySession,
        handleSend: submitMessage,
        toggleCouncil,
        selectPreset,
        updateEffectivePermissions,
        applyCouncilSetup,
        approvePlan,
        archiveSession,
        deleteSession,
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

