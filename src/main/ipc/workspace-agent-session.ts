/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createMainWindowSenderValidator } from '@main/ipc/sender-validator';
import {
    Chat as StoredChat,
    DatabaseService,
} from '@main/services/data/database.service';
import { AdvancedMemoryService } from '@main/services/llm/advanced-memory.service';
import { MemoryContextService } from '@main/services/llm/memory-context.service';
import { ModelRegistryService } from '@main/services/llm/model-registry.service';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import {
    WORKSPACE_AGENT_SESSION_CHANNELS,
} from '@shared/constants/ipc-channels';
import {
    workspaceAgentContextTelemetryResponseSchema,
    workspaceAgentSessionArchiveRequestSchema,
    workspaceAgentSessionCreateRequestSchema,
    workspaceAgentSessionListRequestSchema,
    workspaceAgentSessionListResponseSchema,
    workspaceAgentSessionPersistenceResponseSchema,
    workspaceAgentSessionPersistenceUpdateRequestSchema,
    workspaceAgentSessionRenameRequestSchema,
    workspaceAgentSessionResponseSchema,
    workspaceAgentSessionResumeRequestSchema,
    workspaceAgentSessionSelectRequestSchema,
    workspaceAgentSessionTelemetryRequestSchema,
    workspaceAgentSessionUpdateModesRequestSchema,
    workspaceAgentSessionUpdatePermissionsRequestSchema,
    workspaceAgentSessionUpdateStrategyRequestSchema,
} from '@shared/schemas/workspace-agent-session.schema';
import type { JsonObject } from '@shared/types/common';
import type {
    CouncilAssistEvent,
    CouncilInterAgentMessage,
    CouncilReviewDecision,
    CouncilRunConfig,
    CouncilSubagentRuntime,
    CouncilSubagentWorkspaceDraft,
    WorkspaceAgentContextTelemetry,
    WorkspaceAgentPermissionPolicy,
    WorkspaceAgentSession,
    WorkspaceAgentSessionListResponse,
    WorkspaceAgentSessionModes,
    WorkspaceAgentSessionPersistence,
    WorkspaceAgentSessionSummary,
} from '@shared/types/workspace-agent-session';
import { WORKSPACE_AGENT_CHAT_TYPE } from '@shared/types/workspace-agent-session';
import { estimateTokens } from '@shared/utils/token.util';
import { BrowserWindow, ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';

const WORKSPACE_AGENT_METADATA_KEY = 'workspaceAgentSession';
const WORKSPACE_AGENT_PERSISTENCE_KEY = 'workspaceAgentPanel';

const DEFAULT_MODES: WorkspaceAgentSessionModes = {
    ask: true,
    plan: false,
    agent: false,
    council: false,
};

const DEFAULT_PERMISSION_POLICY: WorkspaceAgentPermissionPolicy = {
    commandPolicy: 'ask-every-time',
    pathPolicy: 'workspace-root-only',
    allowedCommands: [],
    disallowedCommands: [],
    allowedPaths: [],
};

const DEFAULT_COUNCIL_CONFIG: CouncilRunConfig = {
    enabled: false,
    chairman: { mode: 'auto' },
    strategy: 'reasoning-first',
    requestedSubagentCount: 'auto',
    activeView: 'board',
};

interface WorkspaceAgentChatMetadata extends JsonObject {
    status?: WorkspaceAgentSession['status'];
    modes?: WorkspaceAgentSessionModes;
    strategy?: WorkspaceAgentSession['strategy'];
    permissionPolicy?: WorkspaceAgentPermissionPolicy;
    background?: boolean;
    archived?: boolean;
    contextTelemetry?: WorkspaceAgentContextTelemetry;
    councilConfig?: CouncilRunConfig;
    council?: {
        chairman?: CouncilSubagentRuntime;
        subagents?: CouncilSubagentRuntime[];
        drafts?: CouncilSubagentWorkspaceDraft[];
        reviewQueue?: CouncilSubagentWorkspaceDraft[];
        decisions?: CouncilReviewDecision[];
        assistEvents?: CouncilAssistEvent[];
        messages?: CouncilInterAgentMessage[];
    };
}

interface WorkspaceAgentWorkspaceMetadata extends JsonObject {
    activeSessionId?: string | null;
    recentSessionIds?: string[];
    composerDraft?: string;
    updatedAt?: number;
}

function readJsonObject(value: JsonObject | undefined, key: string): JsonObject | null {
    const candidate = value?.[key];
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        return null;
    }
    return candidate as JsonObject;
}

function getWorkspacePersistence(workspaceMetadata?: JsonObject): WorkspaceAgentSessionPersistence {
    const raw = readJsonObject(workspaceMetadata, WORKSPACE_AGENT_PERSISTENCE_KEY) as
        | WorkspaceAgentWorkspaceMetadata
        | null;
    return {
        activeSessionId:
            typeof raw?.activeSessionId === 'string' ? raw.activeSessionId : null,
        recentSessionIds: Array.isArray(raw?.recentSessionIds)
            ? raw.recentSessionIds.filter(
                (value): value is string => typeof value === 'string' && value.trim().length > 0
            )
            : [],
        composerDraft: typeof raw?.composerDraft === 'string' ? raw.composerDraft : '',
        updatedAt:
            typeof raw?.updatedAt === 'number' && Number.isFinite(raw.updatedAt)
                ? raw.updatedAt
                : Date.now(),
    };
}

function mergeWorkspacePersistence(
    workspaceMetadata: JsonObject | undefined,
    persistence: WorkspaceAgentSessionPersistence
): JsonObject {
    return {
        ...(workspaceMetadata ?? {}),
        [WORKSPACE_AGENT_PERSISTENCE_KEY]: persistence,
    };
}

function mergePersistencePatch(
    currentPersistence: WorkspaceAgentSessionPersistence,
    patch: {
        activeSessionId?: string | null;
        recentSessionIds?: string[];
        composerDraft?: string;
    }
): WorkspaceAgentSessionPersistence {
    return {
        activeSessionId:
            patch.activeSessionId !== undefined
                ? patch.activeSessionId
                : currentPersistence.activeSessionId,
        recentSessionIds: patch.recentSessionIds ?? currentPersistence.recentSessionIds,
        composerDraft:
            patch.composerDraft !== undefined
                ? patch.composerDraft
                : currentPersistence.composerDraft,
        updatedAt: Date.now(),
    };
}

function getSessionMetadata(chat: StoredChat): WorkspaceAgentChatMetadata {
    const raw = readJsonObject(chat.metadata, WORKSPACE_AGENT_METADATA_KEY) as
        | WorkspaceAgentChatMetadata
        | null;
    return raw ?? {};
}

function mergeSessionMetadata(chat: StoredChat, sessionMetadata: WorkspaceAgentChatMetadata): JsonObject {
    return {
        ...(chat.metadata ?? {}),
        chatType: WORKSPACE_AGENT_CHAT_TYPE,
        [WORKSPACE_AGENT_METADATA_KEY]: sessionMetadata,
    };
}

function normalizeModes(modes?: WorkspaceAgentSessionModes): WorkspaceAgentSessionModes {
    if (!modes) {
        return DEFAULT_MODES;
    }
    const council = Boolean(modes.council);
    return {
        ask: council ? false : Boolean(modes.ask),
        plan: council ? true : Boolean(modes.plan),
        agent: council ? true : Boolean(modes.agent),
        council,
    };
}

function listTextMessages(messages: JsonObject[]): string {
    return messages
        .map(message =>
            typeof message.content === 'string' ? message.content : ''
        )
        .join('\n');
}

function toUnixTime(value: Date | number | string | undefined): number {
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

async function buildContextTelemetry(
    chat: StoredChat,
    databaseService: DatabaseService,
    modelRegistryService?: ModelRegistryService
): Promise<WorkspaceAgentContextTelemetry> {
    const sessionMetadata = getSessionMetadata(chat);
    const messages = await databaseService.getMessages(chat.id);
    const usedTokens = estimateTokens(listTextMessages(messages));
    const model = chat.model || 'workspace-session';
    const provider = chat.backend || 'workspace';
    const availableModels = modelRegistryService
        ? await modelRegistryService.getAllModels()
        : [];
    const contextWindow =
        availableModels.find(
            availableModel =>
                availableModel.id === model ||
                availableModel.id.toLowerCase() === model.toLowerCase()
        )?.contextWindow ?? 32000;
    const remainingTokens = Math.max(0, contextWindow - usedTokens);
    const usagePercent = Math.min(100, (usedTokens / contextWindow) * 100);
    const pressureState =
        usagePercent >= 85 ? 'high' : usagePercent >= 60 ? 'medium' : 'low';
    const currentTelemetry = sessionMetadata.contextTelemetry;

    return {
        model,
        provider,
        strategy: sessionMetadata.strategy ?? 'reasoning-first',
        contextWindow,
        usedTokens,
        remainingTokens,
        usagePercent,
        pressureState,
        handoffCount: currentTelemetry?.handoffCount ?? 0,
        lastHandoffAt: currentTelemetry?.lastHandoffAt,
        lastHandoffLabel: currentTelemetry?.lastHandoffLabel,
    };
}

async function toWorkspaceAgentSession(
    chat: StoredChat,
    databaseService: DatabaseService,
    modelRegistryService?: ModelRegistryService
): Promise<WorkspaceAgentSession> {
    const messages = await databaseService.getMessages(chat.id);
    const sessionMetadata = getSessionMetadata(chat);
    const contextTelemetry =
        sessionMetadata.contextTelemetry ??
        (await buildContextTelemetry(chat, databaseService, modelRegistryService));

    return {
        id: chat.id,
        chatId: chat.id,
        workspaceId: chat.workspaceId ?? '',
        title: chat.title,
        status: sessionMetadata.status ?? 'idle',
        updatedAt: toUnixTime(chat.updatedAt),
        createdAt: toUnixTime(chat.createdAt),
        messageCount: messages.length,
        lastMessagePreview:
            messages[messages.length - 1]?.content && typeof messages[messages.length - 1]?.content === 'string'
                ? String(messages[messages.length - 1]?.content).slice(0, 280)
                : undefined,
        modes: normalizeModes(sessionMetadata.modes),
        strategy: sessionMetadata.strategy ?? 'reasoning-first',
        permissionPolicy: sessionMetadata.permissionPolicy ?? DEFAULT_PERMISSION_POLICY,
        contextTelemetry,
        councilConfig: sessionMetadata.councilConfig ?? DEFAULT_COUNCIL_CONFIG,
        background: Boolean(sessionMetadata.background),
        archived: Boolean(sessionMetadata.archived || chat.metadata?.isArchived),
        metadata: mergeSessionMetadata(chat, {
            ...sessionMetadata,
            contextTelemetry,
        }),
        council: {
            chairman: sessionMetadata.council?.chairman,
            subagents: sessionMetadata.council?.subagents ?? [],
            drafts: sessionMetadata.council?.drafts ?? [],
            reviewQueue: sessionMetadata.council?.reviewQueue ?? [],
            decisions: sessionMetadata.council?.decisions ?? [],
            assistEvents: sessionMetadata.council?.assistEvents ?? [],
            messages: sessionMetadata.council?.messages ?? [],
        },
    };
}

function toWorkspaceAgentSummary(
    session: WorkspaceAgentSession
): WorkspaceAgentSessionSummary {
    const {
        chatId: _chatId,
        metadata: _metadata,
        council: _council,
        ...summary
    } = session;
    return summary;
}

async function listWorkspaceSessions(
    workspaceId: string,
    databaseService: DatabaseService,
    modelRegistryService?: ModelRegistryService
): Promise<WorkspaceAgentSession[]> {
    const chats = await databaseService.getAllChats();
    const workspaceChats = chats.filter(chat => chat.workspaceId === workspaceId);
    const sessions: WorkspaceAgentSession[] = [];

    for (const chat of workspaceChats) {
        sessions.push(
            await toWorkspaceAgentSession(chat, databaseService, modelRegistryService)
        );
    }

    sessions.sort((left, right) => right.updatedAt - left.updatedAt);
    return sessions;
}

async function requireWorkspace(
    workspaceId: string,
    databaseService: DatabaseService
) {
    const workspace = await databaseService.getWorkspace(workspaceId);
    if (!workspace) {
        throw new Error(`Workspace ${workspaceId} not found`);
    }
    return workspace;
}

async function requireChat(chatId: string, databaseService: DatabaseService) {
    const chats = await databaseService.getAllChats();
    const chat = chats.find(candidate => candidate.id === chatId);
    if (!chat) {
        throw new Error(`Workspace agent session ${chatId} not found`);
    }
    return chat;
}

export function registerWorkspaceAgentSessionIpc(
    getMainWindow: () => BrowserWindow | null,
    databaseService: DatabaseService,
    modelRegistryService?: ModelRegistryService,
    advancedMemoryService?: AdvancedMemoryService
): void {
    const validateSender = createMainWindowSenderValidator(
        getMainWindow,
        'workspace agent session operation'
    );

    const memoryContextService = new MemoryContextService(advancedMemoryService);

    const rememberSessionEvent = (
        sessionId: string,
        workspaceId: string | undefined,
        message: string,
        tags: string[]
    ): void => {
        memoryContextService.rememberInsight({
            content: message,
            sourceId: `workspace-agent:${sessionId}:${Date.now()}`,
            category: 'workflow',
            tags,
            workspaceId
        });
    };

    ipcMain.handle(
        WORKSPACE_AGENT_SESSION_CHANNELS.LIST_BY_WORKSPACE,
        createValidatedIpcHandler(
            WORKSPACE_AGENT_SESSION_CHANNELS.LIST_BY_WORKSPACE,
            async (event, workspaceId: string): Promise<WorkspaceAgentSessionListResponse> => {
                validateSender(event);
                const workspace = await requireWorkspace(workspaceId, databaseService);
                const sessions = await listWorkspaceSessions(
                    workspaceId,
                    databaseService,
                    modelRegistryService
                );
                return {
                    sessions: sessions.map(toWorkspaceAgentSummary),
                    persistence: getWorkspacePersistence(workspace.metadata),
                };
            },
            {
                argsSchema: workspaceAgentSessionListRequestSchema,
                responseSchema: workspaceAgentSessionListResponseSchema,
            }
        )
    );

    ipcMain.handle(
        WORKSPACE_AGENT_SESSION_CHANNELS.CREATE,
        createValidatedIpcHandler(
            WORKSPACE_AGENT_SESSION_CHANNELS.CREATE,
            async (
                event,
                payload: {
                    workspaceId: string;
                    title: string;
                    modes?: WorkspaceAgentSessionModes;
                    strategy?: WorkspaceAgentSession['strategy'];
                    permissionPolicy?: WorkspaceAgentPermissionPolicy;
                }
            ): Promise<WorkspaceAgentSession> => {
                validateSender(event);
                const workspace = await requireWorkspace(payload.workspaceId, databaseService);
                const now = Date.now();
                const chatId = randomUUID();
                const modes = normalizeModes(payload.modes);
                const metadata = {
                    chatType: WORKSPACE_AGENT_CHAT_TYPE,
                    [WORKSPACE_AGENT_METADATA_KEY]: {
                        status: 'active',
                        modes,
                        strategy: payload.strategy ?? 'reasoning-first',
                        permissionPolicy:
                            payload.permissionPolicy ?? DEFAULT_PERMISSION_POLICY,
                        background: false,
                        archived: false,
                        councilConfig: modes.council
                            ? { ...DEFAULT_COUNCIL_CONFIG, enabled: true }
                            : DEFAULT_COUNCIL_CONFIG,
                    } satisfies WorkspaceAgentChatMetadata,
                } satisfies JsonObject;

                await databaseService.createChat({
                    id: chatId,
                    title: payload.title,
                    model: 'workspace-session',
                    backend: 'workspace',
                    messages: [],
                    createdAt: new Date(now),
                    updatedAt: new Date(now),
                    workspaceId: payload.workspaceId,
                    metadata,
                });

                rememberSessionEvent(
                    chatId,
                    payload.workspaceId,
                    `Workspace agent session created. title=${payload.title}; strategy=${payload.strategy ?? 'reasoning-first'}`,
                    ['agent', 'session-create']
                );

                const currentPersistence = getWorkspacePersistence(workspace.metadata);
                const nextPersistence: WorkspaceAgentSessionPersistence = {
                    activeSessionId: chatId,
                    recentSessionIds: [chatId, ...currentPersistence.recentSessionIds].slice(
                        0,
                        50
                    ),
                    composerDraft: '',
                    updatedAt: now,
                };

                await databaseService.updateWorkspace(payload.workspaceId, {
                    metadata: mergeWorkspacePersistence(workspace.metadata, nextPersistence),
                });

                const chat = await requireChat(chatId, databaseService);
                return toWorkspaceAgentSession(chat, databaseService, modelRegistryService);
            },
            {
                argsSchema: workspaceAgentSessionCreateRequestSchema,
                responseSchema: workspaceAgentSessionResponseSchema,
            }
        )
    );

    ipcMain.handle(
        WORKSPACE_AGENT_SESSION_CHANNELS.RENAME,
        createValidatedIpcHandler(
            WORKSPACE_AGENT_SESSION_CHANNELS.RENAME,
            async (
                event,
                payload: { sessionId: string; title: string }
            ): Promise<WorkspaceAgentSession> => {
                validateSender(event);
                const chat = await requireChat(payload.sessionId, databaseService);
                await databaseService.updateChat(chat.id, {
                    title: payload.title,
                    updatedAt: new Date(),
                });
                rememberSessionEvent(
                    chat.id,
                    chat.workspaceId,
                    `Workspace agent session renamed. newTitle=${payload.title}`,
                    ['agent', 'session-rename']
                );

                return toWorkspaceAgentSession(
                    await requireChat(chat.id, databaseService),
                    databaseService,
                    modelRegistryService
                );
            },
            {
                argsSchema: workspaceAgentSessionRenameRequestSchema,
                responseSchema: workspaceAgentSessionResponseSchema,
            }
        )
    );

    ipcMain.handle(
        WORKSPACE_AGENT_SESSION_CHANNELS.SELECT,
        createValidatedIpcHandler(
            WORKSPACE_AGENT_SESSION_CHANNELS.SELECT,
            async (
                event,
                payload: { workspaceId: string; sessionId: string | null }
            ): Promise<WorkspaceAgentSessionPersistence> => {
                validateSender(event);
                const workspace = await requireWorkspace(payload.workspaceId, databaseService);
                const currentPersistence = getWorkspacePersistence(workspace.metadata);
                const nextPersistence: WorkspaceAgentSessionPersistence = {
                    activeSessionId: payload.sessionId,
                    recentSessionIds: payload.sessionId
                        ? [
                              payload.sessionId,
                              ...currentPersistence.recentSessionIds.filter(
                                  value => value !== payload.sessionId
                              ),
                          ].slice(0, 50)
                        : currentPersistence.recentSessionIds,
                    composerDraft: currentPersistence.composerDraft,
                    updatedAt: Date.now(),
                };
                await databaseService.updateWorkspace(payload.workspaceId, {
                    metadata: mergeWorkspacePersistence(workspace.metadata, nextPersistence),
                });
                if (payload.sessionId) {
                    rememberSessionEvent(
                        payload.sessionId,
                        payload.workspaceId,
                        `Workspace agent active session selected. sessionId=${payload.sessionId}`,
                        ['agent', 'session-select']
                    );
                }
                return nextPersistence;
            },
            {
                argsSchema: workspaceAgentSessionSelectRequestSchema,
                responseSchema: workspaceAgentSessionPersistenceResponseSchema,
            }
        )
    );

    ipcMain.handle(
        WORKSPACE_AGENT_SESSION_CHANNELS.UPDATE_PERSISTENCE,
        createValidatedIpcHandler(
            WORKSPACE_AGENT_SESSION_CHANNELS.UPDATE_PERSISTENCE,
            async (
                event,
                payload: {
                    workspaceId: string;
                    activeSessionId?: string | null;
                    recentSessionIds?: string[];
                    composerDraft?: string;
                }
            ): Promise<WorkspaceAgentSessionPersistence> => {
                validateSender(event);
                const workspace = await requireWorkspace(payload.workspaceId, databaseService);
                const currentPersistence = getWorkspacePersistence(workspace.metadata);
                const nextPersistence = mergePersistencePatch(
                    currentPersistence,
                    payload
                );

                await databaseService.updateWorkspace(payload.workspaceId, {
                    metadata: mergeWorkspacePersistence(workspace.metadata, nextPersistence),
                });

                return nextPersistence;
            },
            {
                argsSchema: workspaceAgentSessionPersistenceUpdateRequestSchema,
                responseSchema: workspaceAgentSessionPersistenceResponseSchema,
            }
        )
    );

    ipcMain.handle(
        WORKSPACE_AGENT_SESSION_CHANNELS.UPDATE_MODES,
        createValidatedIpcHandler(
            WORKSPACE_AGENT_SESSION_CHANNELS.UPDATE_MODES,
            async (
                event,
                payload: {
                    sessionId: string;
                    modes: WorkspaceAgentSessionModes;
                    status?: WorkspaceAgentSession['status'];
                }
            ): Promise<WorkspaceAgentSession> => {
                validateSender(event);
                const chat = await requireChat(payload.sessionId, databaseService);
                const sessionMetadata = getSessionMetadata(chat);
                const modes = normalizeModes(payload.modes);
                const councilConfig = modes.council
                    ? {
                          ...(sessionMetadata.councilConfig ?? DEFAULT_COUNCIL_CONFIG),
                          enabled: true,
                      }
                    : {
                          ...(sessionMetadata.councilConfig ?? DEFAULT_COUNCIL_CONFIG),
                          enabled: false,
                      };

                await databaseService.updateChat(chat.id, {
                    metadata: mergeSessionMetadata(chat, {
                        ...sessionMetadata,
                        modes,
                        status: payload.status ?? sessionMetadata.status ?? 'active',
                        councilConfig,
                    }),
                });
                rememberSessionEvent(
                    chat.id,
                    chat.workspaceId,
                    `Workspace agent modes updated. ask=${String(modes.ask)}; plan=${String(modes.plan)}; agent=${String(modes.agent)}; council=${String(modes.council)}`,
                    ['agent', 'modes-update']
                );

                return toWorkspaceAgentSession(
                    await requireChat(chat.id, databaseService),
                    databaseService,
                    modelRegistryService
                );
            },
            {
                argsSchema: workspaceAgentSessionUpdateModesRequestSchema,
                responseSchema: workspaceAgentSessionResponseSchema,
            }
        )
    );

    ipcMain.handle(
        WORKSPACE_AGENT_SESSION_CHANNELS.UPDATE_PERMISSIONS,
        createValidatedIpcHandler(
            WORKSPACE_AGENT_SESSION_CHANNELS.UPDATE_PERMISSIONS,
            async (
                event,
                payload: {
                    sessionId: string;
                    permissionPolicy: WorkspaceAgentPermissionPolicy;
                }
            ): Promise<WorkspaceAgentSession> => {
                validateSender(event);
                const chat = await requireChat(payload.sessionId, databaseService);
                const sessionMetadata = getSessionMetadata(chat);
                await databaseService.updateChat(chat.id, {
                    metadata: mergeSessionMetadata(chat, {
                        ...sessionMetadata,
                        permissionPolicy: payload.permissionPolicy,
                    }),
                });
                rememberSessionEvent(
                    chat.id,
                    chat.workspaceId,
                    `Workspace agent permissions updated. commandPolicy=${payload.permissionPolicy.commandPolicy}; pathPolicy=${payload.permissionPolicy.pathPolicy}`,
                    ['agent', 'permissions-update']
                );
                return toWorkspaceAgentSession(
                    await requireChat(chat.id, databaseService),
                    databaseService,
                    modelRegistryService
                );
            },
            {
                argsSchema: workspaceAgentSessionUpdatePermissionsRequestSchema,
                responseSchema: workspaceAgentSessionResponseSchema,
            }
        )
    );

    ipcMain.handle(
        WORKSPACE_AGENT_SESSION_CHANNELS.UPDATE_STRATEGY,
        createValidatedIpcHandler(
            WORKSPACE_AGENT_SESSION_CHANNELS.UPDATE_STRATEGY,
            async (
                event,
                payload: {
                    sessionId: string;
                    strategy: WorkspaceAgentSession['strategy'];
                }
            ): Promise<WorkspaceAgentSession> => {
                validateSender(event);
                const chat = await requireChat(payload.sessionId, databaseService);
                const sessionMetadata = getSessionMetadata(chat);
                await databaseService.updateChat(chat.id, {
                    metadata: mergeSessionMetadata(chat, {
                        ...sessionMetadata,
                        strategy: payload.strategy,
                        councilConfig: {
                            ...(sessionMetadata.councilConfig ?? DEFAULT_COUNCIL_CONFIG),
                            strategy: payload.strategy,
                        },
                    }),
                });
                rememberSessionEvent(
                    chat.id,
                    chat.workspaceId,
                    `Workspace agent strategy updated. strategy=${payload.strategy}`,
                    ['agent', 'strategy-update']
                );
                return toWorkspaceAgentSession(
                    await requireChat(chat.id, databaseService),
                    databaseService,
                    modelRegistryService
                );
            },
            {
                argsSchema: workspaceAgentSessionUpdateStrategyRequestSchema,
                responseSchema: workspaceAgentSessionResponseSchema,
            }
        )
    );

    ipcMain.handle(
        WORKSPACE_AGENT_SESSION_CHANNELS.GET_CONTEXT_TELEMETRY,
        createValidatedIpcHandler(
            WORKSPACE_AGENT_SESSION_CHANNELS.GET_CONTEXT_TELEMETRY,
            async (
                event,
                payload: { sessionId: string }
            ): Promise<WorkspaceAgentContextTelemetry | null> => {
                validateSender(event);
                const chat = await requireChat(payload.sessionId, databaseService);
                return buildContextTelemetry(chat, databaseService, modelRegistryService);
            },
            {
                argsSchema: workspaceAgentSessionTelemetryRequestSchema,
                responseSchema: workspaceAgentContextTelemetryResponseSchema,
            }
        )
    );

    ipcMain.handle(
        WORKSPACE_AGENT_SESSION_CHANNELS.ARCHIVE,
        createValidatedIpcHandler(
            WORKSPACE_AGENT_SESSION_CHANNELS.ARCHIVE,
            async (
                event,
                payload: { sessionId: string; archived: boolean }
            ): Promise<WorkspaceAgentSession> => {
                validateSender(event);
                const chat = await requireChat(payload.sessionId, databaseService);
                const sessionMetadata = getSessionMetadata(chat);
                await databaseService.updateChat(chat.id, {
                    metadata: mergeSessionMetadata(chat, {
                        ...sessionMetadata,
                        archived: payload.archived,
                        status: payload.archived ? 'background' : sessionMetadata.status,
                    }),
                });
                rememberSessionEvent(
                    chat.id,
                    chat.workspaceId,
                    `Workspace agent archive state changed. archived=${String(payload.archived)}`,
                    ['agent', 'archive-state']
                );
                return toWorkspaceAgentSession(
                    await requireChat(chat.id, databaseService),
                    databaseService,
                    modelRegistryService
                );
            },
            {
                argsSchema: workspaceAgentSessionArchiveRequestSchema,
                responseSchema: workspaceAgentSessionResponseSchema,
            }
        )
    );

    ipcMain.handle(
        WORKSPACE_AGENT_SESSION_CHANNELS.RESUME_BACKGROUND_STATE,
        createValidatedIpcHandler(
            WORKSPACE_AGENT_SESSION_CHANNELS.RESUME_BACKGROUND_STATE,
            async (
                event,
                payload: { workspaceId: string; activeSessionId: string | null }
            ): Promise<WorkspaceAgentSessionPersistence> => {
                validateSender(event);
                const workspace = await requireWorkspace(payload.workspaceId, databaseService);
                const currentPersistence = getWorkspacePersistence(workspace.metadata);
                const sessions = await listWorkspaceSessions(payload.workspaceId, databaseService);

                for (const session of sessions) {
                    const chat = await requireChat(session.id, databaseService);
                    const sessionMetadata = getSessionMetadata(chat);
                    const background = payload.activeSessionId !== null && session.id !== payload.activeSessionId;
                    const nextStatus = background
                        ? 'background'
                        : sessionMetadata.status === 'background'
                            ? 'active'
                            : sessionMetadata.status;
                    await databaseService.updateChat(chat.id, {
                        metadata: mergeSessionMetadata(chat, {
                            ...sessionMetadata,
                            background,
                            status: nextStatus,
                        }),
                    });
                }

                const nextPersistence: WorkspaceAgentSessionPersistence = {
                    ...currentPersistence,
                    activeSessionId: payload.activeSessionId,
                    updatedAt: Date.now(),
                };
                await databaseService.updateWorkspace(payload.workspaceId, {
                    metadata: mergeWorkspacePersistence(workspace.metadata, nextPersistence),
                });
                if (payload.activeSessionId) {
                    rememberSessionEvent(
                        payload.activeSessionId,
                        payload.workspaceId,
                        `Workspace agent resumed background state. activeSessionId=${payload.activeSessionId}`,
                        ['agent', 'session-resume']
                    );
                }
                return nextPersistence;
            },
            {
                argsSchema: workspaceAgentSessionResumeRequestSchema,
                responseSchema: workspaceAgentSessionPersistenceResponseSchema,
            }
        )
    );
}
