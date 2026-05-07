/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { WorkspaceAgentPermissionPolicy, WorkspaceAgentSession, WorkspaceAgentSessionModes, WorkspaceAgentSessionSummary } from '@shared/types/workspace-agent-session';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback } from 'react';

import type { Chat } from '@/types';

import { DEFAULT_PERMISSION_POLICY, DEFAULT_SESSION_TITLE } from '../utils/workspace-agent-session-utils';

interface UseWorkspaceAgentSessionManagementOptions {
    workspaceId: string;
    workspacePath: string;
    currentSessionId: string | null;
    setCurrentSessionId: Dispatch<SetStateAction<string | null>>;
    setSessions: Dispatch<SetStateAction<WorkspaceAgentSessionSummary[]>>;
    updateChatCollection: (sessionId: string, updater: (chat: Chat) => Chat) => void;
    loadWorkspaceSessions: () => Promise<void>;
}

export function useWorkspaceAgentSessionManagement({
    workspaceId,
    workspacePath,
    currentSessionId,
    setCurrentSessionId,
    setSessions,
    updateChatCollection,
    loadWorkspaceSessions,
}: UseWorkspaceAgentSessionManagementOptions) {
    const updateSessionSummary = useCallback(
        (nextSession: WorkspaceAgentSession) => {
            setSessions(previousSessions => {
                const nextSummary: WorkspaceAgentSessionSummary = {
                    ...nextSession,
                };
                const existingIndex = previousSessions.findIndex(
                    session => session.id === nextSession.id
                );
                if (existingIndex === -1) {
                    return [nextSummary, ...previousSessions];
                }

                const updatedSessions = [...previousSessions];
                updatedSessions[existingIndex] = nextSummary;
                return updatedSessions;
            });

            updateChatCollection(nextSession.id, chat => ({
                ...chat,
                title: nextSession.title,
                metadata: nextSession.metadata,
                updatedAt: new Date(nextSession.updatedAt),
            }));
        },
        [setSessions, updateChatCollection]
    );

    const createSession = useCallback(
        async (options?: {
            title?: string;
            modes?: WorkspaceAgentSessionModes;
            permissionPolicy?: WorkspaceAgentPermissionPolicy;
            strategy?: WorkspaceAgentSession['strategy'];
        }) => {
            const session = await window.electron.session.workspaceAgent.create({
                workspaceId,
                title: options?.title?.trim().slice(0, 80) || DEFAULT_SESSION_TITLE,
                modes: options?.modes,
                strategy: options?.strategy,
                permissionPolicy: options?.permissionPolicy ?? {
                    ...DEFAULT_PERMISSION_POLICY,
                    allowedPaths: [workspacePath],
                },
            });
            await loadWorkspaceSessions();
            setCurrentSessionId(session.id);
            return session;
        },
        [loadWorkspaceSessions, workspaceId, workspacePath, setCurrentSessionId]
    );

    const selectSession = useCallback(
        async (sessionId: string | null) => {
            await window.electron.session.workspaceAgent.select({
                workspaceId,
                sessionId,
            });
            setCurrentSessionId(sessionId);
            if (!sessionId) {
                return;
            }

            const messages = await window.electron.db.getMessages(sessionId);
            updateChatCollection(sessionId, currentChatState => ({
                ...currentChatState,
                messages,
            }));
        },
        [setCurrentSessionId, updateChatCollection, workspaceId]
    );

    const updateModes = useCallback(
        async (sessionId: string, modes: WorkspaceAgentSessionModes) => {
            const session = await window.electron.session.workspaceAgent.updateModes({
                sessionId,
                modes,
                status: modes.council || modes.plan ? 'planning' : 'active',
            });
            updateSessionSummary(session);
            return session;
        },
        [updateSessionSummary]
    );

    const updateStrategy = useCallback(
        async (sessionId: string, strategy: WorkspaceAgentSession['strategy']) => {
            const session = await window.electron.session.workspaceAgent.updateStrategy({
                sessionId,
                strategy,
            });
            updateSessionSummary(session);
            return session;
        },
        [updateSessionSummary]
    );

    const updatePermissions = useCallback(
        async (sessionId: string, permissionPolicy: WorkspaceAgentPermissionPolicy) => {
            const session =
                await window.electron.session.workspaceAgent.updatePermissions({
                    sessionId,
                    permissionPolicy,
                });
            updateSessionSummary(session);
            return session;
        },
        [updateSessionSummary]
    );

    const archiveSession = useCallback(
        async (sessionId: string, archived: boolean) => {
            await window.electron.session.workspaceAgent.archive({
                sessionId,
                archived,
            });
            if (currentSessionId === sessionId && archived) {
                setCurrentSessionId(null);
            }
            await loadWorkspaceSessions();
        },
        [currentSessionId, loadWorkspaceSessions, setCurrentSessionId]
    );

    const deleteSession = useCallback(
        async (sessionId: string) => {
            await window.electron.session.workspaceAgent.delete({
                sessionId,
            });
            if (currentSessionId === sessionId) {
                setCurrentSessionId(null);
            }
            await loadWorkspaceSessions();
        },
        [currentSessionId, loadWorkspaceSessions, setCurrentSessionId]
    );

    const renameSession = useCallback(
        async (sessionId: string, title: string) => {
            const trimmedTitle = title.trim();
            if (!trimmedTitle) {
                return null;
            }

            const session = await window.electron.session.workspaceAgent.rename({
                sessionId,
                title: trimmedTitle.slice(0, 120),
            });
            updateSessionSummary(session);
            updateChatCollection(session.id, chat => ({
                ...chat,
                title: session.title,
                updatedAt: new Date(session.updatedAt),
            }));
            return session;
        },
        [updateChatCollection, updateSessionSummary]
    );

    return {
        createSession,
        selectSession,
        updateModes,
        updateStrategy,
        updatePermissions,
        archiveSession,
        deleteSession,
        renameSession,
        updateSessionSummary,
    };
}

