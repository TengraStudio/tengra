/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { AgentEventRecord, AgentState } from '@shared/types/agent-state';
import type { IpcValue, JsonObject, JsonValue } from '@shared/types/common';
import type {
    CouncilRunConfig,
    CouncilSubagentRuntime,
    CouncilSubagentWorkspaceDraft,
    WorkspaceAgentPermissionPolicy,
    WorkspaceAgentSession,
    WorkspaceAgentSessionModes,
    WorkspaceAgentSessionSummary,
} from '@shared/types/workspace-agent-session';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { useModel } from '@/context/ModelContext';
import { generateId } from '@/lib/utils';
import type { Chat, Message } from '@/types';

import {
    buildNormalizedQuotaSnapshot,
    recommendCouncilParticipants,
} from './workspace-agent-routing';

export {
    buildNormalizedQuotaSnapshot,
    recommendCouncilParticipants,
};
import { appLogger } from '@/utils/renderer-logger';

import type { SessionCouncilRuntime, SessionCouncilState, WorkspaceAgentSessionMetadata } from '../types/workspace-agent-session-local';

export const WORKSPACE_AGENT_METADATA_KEY = 'workspaceAgentSession';
export const DEFAULT_SESSION_TITLE = 'Workspace Session';

export const DEFAULT_MODES: WorkspaceAgentSessionModes = {
    ask: true,
    plan: false,
    agent: false,
    council: false,
};

export const DEFAULT_PERMISSION_POLICY: WorkspaceAgentPermissionPolicy = {
    commandPolicy: 'ask-every-time',
    pathPolicy: 'workspace-root-only',
    allowedCommands: [],
    disallowedCommands: [],
    allowedPaths: [],
};

export const DEFAULT_COUNCIL_SETUP: CouncilRunConfig = {
    enabled: false,
    chairman: { mode: 'auto' },
    strategy: 'reasoning-first',
    requestedSubagentCount: 'auto',
    activeView: 'board',
};

export function toMessagePreview(message: Message | undefined): string | undefined {
    if (!message) {
        return undefined;
    }
    if (typeof message.content === 'string') {
        return message.content.slice(0, 280);
    }
    return message.content
        .map(part => (part.type === 'text' ? part.text : part.image_url.url))
        .join('\n')
        .slice(0, 280);
}

export function readObject(value: JsonValue | undefined): JsonObject | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    return value;
}

export function readStringArray(value: JsonValue | undefined): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((entry): entry is string => typeof entry === 'string');
}

function toTimestamp(value: Date | number | string | undefined): number {
    if (value instanceof Date) {
        return value.getTime();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const timestamp = Date.parse(value);
        if (Number.isFinite(timestamp)) {
            return timestamp;
        }
    }
    return Date.now();
}

export function toSessionMetadata(chat: Chat | null): WorkspaceAgentSessionMetadata {
    const rawMetadata = chat?.metadata?.[WORKSPACE_AGENT_METADATA_KEY];
    const value = readObject(rawMetadata);
    if (!value) {
        return {};
    }
    return value as WorkspaceAgentSessionMetadata;
}

export function toSessionModes(chat: Chat | null): WorkspaceAgentSessionModes {
    const metadata = toSessionMetadata(chat);
    const rawModes = readObject(metadata.modes as JsonValue | undefined);
    if (!rawModes) {
        return DEFAULT_MODES;
    }

    const council = Boolean(rawModes.council);
    return {
        ask: council ? false : Boolean(rawModes.ask),
        plan: council ? true : Boolean(rawModes.plan),
        agent: council ? true : Boolean(rawModes.agent),
        council,
    };
}

export function toPermissionPolicy(
    chat: Chat,
    fallback?: WorkspaceAgentSessionSummary
): WorkspaceAgentPermissionPolicy {
    const metadata = toSessionMetadata(chat);
    const rawPolicy = readObject(metadata.permissionPolicy as JsonValue | undefined);
    if (!rawPolicy) {
        return fallback?.permissionPolicy ?? DEFAULT_PERMISSION_POLICY;
    }

    const commandPolicy =
        rawPolicy.commandPolicy === 'blocked' ||
        rawPolicy.commandPolicy === 'ask-every-time' ||
        rawPolicy.commandPolicy === 'allowlist' ||
        rawPolicy.commandPolicy === 'full-access'
            ? rawPolicy.commandPolicy
            : DEFAULT_PERMISSION_POLICY.commandPolicy;
    const pathPolicy =
        rawPolicy.pathPolicy === 'workspace-root-only' ||
        rawPolicy.pathPolicy === 'allowlist' ||
        rawPolicy.pathPolicy === 'restricted-off-dangerous'
            ? rawPolicy.pathPolicy
            : DEFAULT_PERMISSION_POLICY.pathPolicy;

    return {
        commandPolicy,
        pathPolicy,
        allowedCommands: readStringArray(rawPolicy.allowedCommands),
        disallowedCommands: readStringArray(rawPolicy.disallowedCommands),
        allowedPaths: readStringArray(rawPolicy.allowedPaths),
    };
}

export function toCouncilRuntime(chat: Chat | null): SessionCouncilRuntime {
    const runtime = toSessionMetadata(chat).council;
    return {
        chairman: runtime?.chairman,
        subagents: runtime?.subagents ?? [],
        drafts: runtime?.drafts ?? [],
        reviewQueue: runtime?.reviewQueue ?? [],
        decisions: runtime?.decisions ?? [],
        assistEvents: runtime?.assistEvents ?? [],
        messages: runtime?.messages ?? [],
    };
}

export function toCouncilConfig(chat: Chat, fallback?: WorkspaceAgentSessionSummary): CouncilRunConfig {
    const metadata = toSessionMetadata(chat);
    return metadata.councilConfig ?? fallback?.councilConfig ?? DEFAULT_COUNCIL_SETUP;
}

function normalizeMessageContent(message: Message): string {
    return typeof message.content === 'string' ? message.content.trim() : '';
}

export function dedupeChatMessages(messages: Message[]): Message[] {
    const uniqueMessages: Message[] = [];
    const seenIds = new Set<string>();

    for (const message of messages) {
        if (!message.id || seenIds.has(message.id)) {
            continue;
        }

        const previousMessage = uniqueMessages[uniqueMessages.length - 1];
        const content = normalizeMessageContent(message);
        if (
            previousMessage?.role === message.role &&
            previousMessage.role !== 'tool' &&
            normalizeMessageContent(previousMessage) === content &&
            content.length > 0
        ) {
            continue;
        }

        uniqueMessages.push(message);
        seenIds.add(message.id);
    }

    return uniqueMessages;
}

export function mergeWorkspaceChats(
    allChats: Chat[],
    workspaceId: string,
    previousChats: Chat[]
): Chat[] {
    return allChats
        .filter(chat => chat.workspaceId === workspaceId)
        .map(chat => ({
            ...chat,
            messages: dedupeChatMessages(
                previousChats.find(previous => previous.id === chat.id)?.messages ?? []
            ),
        }))
        .sort(
            (left, right) =>
                toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt)
        );
}

export function buildSessionSummary(
    chat: Chat,
    existingSummary?: WorkspaceAgentSessionSummary
): WorkspaceAgentSessionSummary {
    const metadata = toSessionMetadata(chat);
    return {
        id: chat.id,
        workspaceId: chat.workspaceId ?? '',
        title: chat.title,
        status: metadata.status ?? existingSummary?.status ?? 'idle',
        updatedAt: toTimestamp(chat.updatedAt),
        createdAt: toTimestamp(chat.createdAt),
        messageCount: chat.messages.length,
        lastMessagePreview: toMessagePreview(chat.messages[chat.messages.length - 1]),
        modes: toSessionModes(chat),
        strategy: metadata.strategy ?? existingSummary?.strategy ?? 'reasoning-first',
        permissionPolicy: toPermissionPolicy(chat, existingSummary),
        usageStats: existingSummary?.usageStats,
        councilConfig: toCouncilConfig(chat, existingSummary),
        background: metadata.background ?? existingSummary?.background ?? false,
        archived: Boolean(metadata.archived) || Boolean(chat.metadata?.isArchived),
    };
}

export function toAgentState(value: IpcValue, fallback: AgentState): AgentState {
    if (
        value === 'idle' ||
        value === 'initializing' ||
        value === 'planning' ||
        value === 'executing' ||
        value === 'waiting_llm' ||
        value === 'waiting_tool' ||
        value === 'waiting_user' ||
        value === 'recovering' ||
        value === 'rotating_provider' ||
        value === 'fallback' ||
        value === 'paused' ||
        value === 'completed' ||
        value === 'failed'
    ) {
        return value;
    }
    return fallback;
}

export function normalizeTimelineEvent(
    event: Record<string, IpcValue>,
    index: number
): AgentEventRecord {
    const timestampValue = event.timestamp;
    const timestamp =
        typeof timestampValue === 'number'
            ? new Date(timestampValue)
            : typeof timestampValue === 'string'
                ? new Date(timestampValue)
                : new Date();
    const eventType =
        typeof event.type === 'string' ? event.type : 'PLAN_READY';

    return {
        id: typeof event.id === 'string' ? event.id : `event-${index}`,
        timestamp,
        type: eventType as AgentEventRecord['type'],
        payload: event.payload,
        stateBeforeTransition: toAgentState(event.stateBeforeTransition, 'planning'),
        stateAfterTransition: toAgentState(event.stateAfterTransition, 'executing'),
    };
}

export function buildChairmanRuntime(
    runtimes: CouncilSubagentRuntime[],
    config: CouncilRunConfig
): CouncilSubagentRuntime | undefined {
    const chairman = runtimes[0];
    if (!chairman) {
        return undefined;
    }

    return {
        ...chairman,
        provider: config.chairman.provider ?? chairman.provider,
        model: config.chairman.model ?? chairman.model,
        status: 'reviewing',
        helpAvailable: false,
    };
}

export function buildDraftPackages(subagents: CouncilSubagentRuntime[]): CouncilSubagentWorkspaceDraft[] {
    return subagents.map(subagent => ({
        id: `draft-${subagent.id}`,
        agentId: subagent.id,
        workspaceId: subagent.workspaceId,
        baseRevision: 'workspace-head',
        changedFiles: [],
        patchSummary: '',
        riskFlags: [],
        submittedAt: Date.now(),
    }));
}

export async function loadWorkspaceSessionsForWorkspace(options: {
    workspaceId: string;
    chatsRef: MutableRefObject<Chat[]>;
    setChats: Dispatch<SetStateAction<Chat[]>>;
    setSessions: Dispatch<SetStateAction<WorkspaceAgentSessionSummary[]>>;
    setCurrentSessionId: Dispatch<SetStateAction<string | null>>;
    setComposerValue: Dispatch<SetStateAction<string>>;
}): Promise<void> {
    const [listing, allChats] = await Promise.all([
        window.electron.session.workspaceAgent.listByWorkspace(options.workspaceId),
        window.electron.db.getAllChats(),
    ]);
    const mergedChats = mergeWorkspaceChats(
        allChats,
        options.workspaceId,
        options.chatsRef.current
    );

    options.setChats(mergedChats);
    options.setSessions(previousSessions =>
        mergedChats.map(chat =>
            buildSessionSummary(
                chat,
                listing.sessions.find(session => session.id === chat.id) ??
                    previousSessions.find(session => session.id === chat.id)
            )
        )
    );
    options.setCurrentSessionId(previousSessionId => {
        if (!previousSessionId) {
            return null;
        }
        const sessionStillExists = mergedChats.some(chat => chat.id === previousSessionId);
        return sessionStillExists ? previousSessionId : null;
    });
    options.setComposerValue(listing.persistence.composerDraft);
}

export async function refreshStatsForSession(options: {
    sessionId: string;
    setSessions: Dispatch<SetStateAction<WorkspaceAgentSessionSummary[]>>;
}): Promise<void> {
    const stats = await window.electron.session.workspaceAgent.getContextStats({
        sessionId: options.sessionId,
    });
    if (!stats) {
        return;
    }

    options.setSessions(previousSessions =>
        previousSessions.map(session =>
            session.id === options.sessionId
                ? { ...session, usageStats: stats }
                : session
        )
    );
}

export async function refreshCouncilStateForSession(options: {
    sessionId: string;
    setCouncilStateBySession: Dispatch<SetStateAction<Record<string, SessionCouncilState>>>;
}): Promise<void> {
    const [proposalResult, timelineResult] = await Promise.all([
        window.electron.session.council.getProposal(options.sessionId),
        window.electron.session.council.getTimeline(options.sessionId),
    ]);

    const normalizedTimeline = (timelineResult.events ?? []).map(
        (event, index) => normalizeTimelineEvent(event, index)
    );
    options.setCouncilStateBySession(previousState => ({
        ...previousState,
        [options.sessionId]: {
            proposal: proposalResult.plan ?? [],
            timeline: normalizedTimeline,
        },
    }));
}

export async function persistCouncilRuntimeMetadata(options: {
    sessionId: string;
    chats: Chat[];
    loadWorkspaceSessions: () => Promise<void>;
    updateChatCollection: (sessionId: string, updater: (chat: Chat) => Chat) => void;
    updates: {
        councilConfig?: CouncilRunConfig;
        status?: WorkspaceAgentSession['status'];
        council?: Partial<SessionCouncilRuntime>;
    };
}): Promise<void> {
    const targetChat = options.chats.find(chat => chat.id === options.sessionId);
    if (!targetChat) {
        return;
    }

    const metadata = toSessionMetadata(targetChat);
    const nextMetadata: WorkspaceAgentSessionMetadata = {
        ...metadata,
        councilConfig: options.updates.councilConfig ?? metadata.councilConfig,
        status: options.updates.status ?? metadata.status,
        council: {
            ...toCouncilRuntime(targetChat),
            ...options.updates.council,
        },
    };

    await window.electron.db.updateChat(options.sessionId, {
        metadata: {
            ...(targetChat.metadata ?? {}),
            [WORKSPACE_AGENT_METADATA_KEY]: nextMetadata,
        },
    });

    options.updateChatCollection(options.sessionId, chat => ({
        ...chat,
        metadata: {
            ...(chat.metadata ?? {}),
            [WORKSPACE_AGENT_METADATA_KEY]: nextMetadata,
        },
    }));
    await options.loadWorkspaceSessions();
}

export async function applyCouncilSetupToSession(options: {
    composerValue: string;
    councilSetup: CouncilRunConfig;
    currentSession: WorkspaceAgentSessionSummary | null;
    currentSessionId: string | null;
    createSession: (options?: {
        title?: string;
        modes?: WorkspaceAgentSessionModes;
        permissionPolicy?: WorkspaceAgentPermissionPolicy;
        strategy?: WorkspaceAgentSession['strategy'];
    }) => Promise<WorkspaceAgentSession>;
    groupedModels: ReturnType<typeof useModel>['groupedModels'];
    persistCouncilRuntime: (sessionId: string, updates: {
        councilConfig?: CouncilRunConfig;
        status?: WorkspaceAgentSession['status'];
        council?: Partial<SessionCouncilRuntime>;
    }) => Promise<void>;
    quotaSnapshot: ReturnType<typeof buildNormalizedQuotaSnapshot>;
    selectedModel: string;
    selectedProvider: string;
    titlePrefix: string;
    updateModes: (sessionId: string, modes: WorkspaceAgentSessionModes) => Promise<WorkspaceAgentSession>;
    updateStrategy: (
        sessionId: string,
        strategy: WorkspaceAgentSession['strategy']
    ) => Promise<WorkspaceAgentSession>;
    workspaceDescription: string;
    workspaceTitle: string;
    setCurrentSessionId: Dispatch<SetStateAction<string | null>>;
    setShowCouncilSetup: Dispatch<SetStateAction<boolean>>;
}): Promise<void> {
    const targetSession =
        options.currentSessionId !== null && options.currentSession
            ? options.currentSession
            : await options.createSession({
                title: `${options.titlePrefix} ${options.workspaceTitle}`,
                modes: { ask: false, plan: true, agent: true, council: true },
            });
    const recommendation = recommendCouncilParticipants({
        task: options.composerValue || options.workspaceDescription || options.workspaceTitle,
        groupedModels: options.groupedModels,
        snapshot: options.quotaSnapshot,
        strategy: options.councilSetup.strategy,
        requestedCount:
            options.councilSetup.requestedSubagentCount === 'auto'
                ? 4
                : options.councilSetup.requestedSubagentCount,
    });
    const chairmanSelection =
        options.councilSetup.chairman.mode === 'auto'
            ? {
                  mode: 'auto' as const,
                  provider: recommendation.chairman?.provider,
                  model: recommendation.chairman?.model,
                  agentId: recommendation.runtimes[0]?.id,
              }
            : {
                  ...options.councilSetup.chairman,
                  provider: options.councilSetup.chairman.provider ?? options.selectedProvider,
                  model: options.councilSetup.chairman.model ?? options.selectedModel,
              };
    const nextCouncilConfig: CouncilRunConfig = {
        ...options.councilSetup,
        enabled: true,
        chairman: chairmanSelection,
    };
    const chairmanRuntime = buildChairmanRuntime(
        recommendation.runtimes,
        nextCouncilConfig
    );
    const subagents = recommendation.runtimes
        .slice(1)
        .map((runtime: CouncilSubagentRuntime) => ({ ...runtime, status: 'working' as const }));
    const drafts = buildDraftPackages(subagents);

    await options.updateModes(targetSession.id, {
        ask: false,
        plan: true,
        agent: true,
        council: true,
    });
    await options.updateStrategy(targetSession.id, options.councilSetup.strategy);
    await options.persistCouncilRuntime(targetSession.id, {
        councilConfig: nextCouncilConfig,
        status: 'planning',
        council: {
            chairman: chairmanRuntime,
            subagents,
            drafts,
            reviewQueue: [],
            decisions: [],
            assistEvents: [],
            messages: [],
        },
    });
    options.setShowCouncilSetup(false);
    options.setCurrentSessionId(targetSession.id);
}

export async function sendWorkspaceAgentMessage(options: {
    composerValue: string;
    resolveTargetSession: (title: string) => Promise<{
        session: WorkspaceAgentSessionSummary;
        modes: WorkspaceAgentSessionModes;
    }>;
    generateResponse: (chatId: string, userMessage: Message, retryModel?: string) => Promise<void>;
    isLoading: boolean;
    loadWorkspaceSessions: () => Promise<void>;
    refreshCouncilState: (sessionId: string) => Promise<void>;
    refreshStats: (sessionId: string) => Promise<void>;
    selectedModel: string;
    selectedProvider: string;
    updateChatCollection: (sessionId: string, updater: (chat: Chat) => Chat) => void;
    setComposerValue: Dispatch<SetStateAction<string>>;
}): Promise<void> {
    const trimmedContent = options.composerValue.trim();
    if (!trimmedContent || options.selectedModel.trim() === '' || options.isLoading) {
        return;
    }

    const target = await options.resolveTargetSession(trimmedContent.slice(0, 48));
    const targetSession = target.session;

    await window.electron.db.updateChat(targetSession.id, {
        model: options.selectedModel,
        backend: options.selectedProvider,
    });

    const timestamp = Date.now();
    const userMessage: Message = {
        id: generateId(),
        chatId: targetSession.id,
        role: 'user',
        content: trimmedContent,
        timestamp: new Date(timestamp),
        provider: options.selectedProvider,
        model: options.selectedModel,
    };

    await window.electron.db.addMessage({
        ...userMessage,
        chatId: targetSession.id,
        timestamp,
        provider: options.selectedProvider,
        model: options.selectedModel,
    });

    options.updateChatCollection(targetSession.id, chat => ({
        ...chat,
        model: options.selectedModel,
        backend: options.selectedProvider,
        isGenerating: true,
        messages: [...chat.messages, userMessage],
    }));
    options.setComposerValue('');
    
    const targetModes = target.modes;
    if (targetModes.plan || targetModes.council) {
        await window.electron.session.council.generatePlan(
            targetSession.id,
            trimmedContent
        );
        await options.refreshCouncilState(targetSession.id);
    } else {
        // We start generation but wrap it to refresh usageStats when finished
        options.generateResponse(targetSession.id, userMessage).then(async () => {
            await options.refreshStats(targetSession.id);
            await options.loadWorkspaceSessions();
        }).catch(err => {
            appLogger.error('WorkspaceAgentSessionUtils', 'Failed to refresh stats after generation', err);
        });
    }

    // Immediate refresh for UI responsiveness (message count etc)
    await options.refreshStats(targetSession.id);
    await options.loadWorkspaceSessions();
}

