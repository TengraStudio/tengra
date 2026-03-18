import type { WorkspaceAgentSessionSummary } from '@shared/types/workspace-agent-session';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Chat } from '@/types';

import type { SessionCouncilState } from '../types/workspace-agent-session-local';
import { loadWorkspaceSessionsForWorkspace } from '../utils/workspace-agent-session-utils';

interface UseWorkspaceAgentSessionStateOptions {
    workspaceId: string;
}

export function useWorkspaceAgentSessionState({ workspaceId }: UseWorkspaceAgentSessionStateOptions) {
    const [sessions, setSessions] = useState<WorkspaceAgentSessionSummary[]>([]);
    const [chats, setChats] = useState<Chat[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [composerValue, setComposerValue] = useState('');
    const [councilStateBySession, setCouncilStateBySession] = useState<
        Record<string, SessionCouncilState>
    >({});
    const chatsRef = useRef<Chat[]>([]);

    useEffect(() => {
        chatsRef.current = chats;
    }, [chats]);

    const loadWorkspaceSessions = useCallback(async () => {
        await loadWorkspaceSessionsForWorkspace({
            workspaceId,
            chatsRef,
            setChats,
            setSessions,
            setCurrentSessionId,
            setComposerValue,
        });
    }, [workspaceId]);

    useEffect(() => {
        void Promise.resolve().then(loadWorkspaceSessions);
    }, [loadWorkspaceSessions]);

    return {
        sessions,
        setSessions,
        chats,
        setChats,
        chatsRef,
        currentSessionId,
        setCurrentSessionId,
        composerValue,
        setComposerValue,
        councilStateBySession,
        setCouncilStateBySession,
        loadWorkspaceSessions,
    };
}
