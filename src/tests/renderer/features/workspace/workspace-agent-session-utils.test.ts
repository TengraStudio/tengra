/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { Chat } from '@/types';
import {
    dedupeChatMessages,
    loadWorkspaceSessionsForWorkspace,
} from '@/features/workspace/utils/workspace-agent-session-utils';

const mockListByWorkspace = vi.fn();
const mockGetAllChats = vi.fn();

Object.defineProperty(window, 'electron', {
    value: {
        session: {
            workspaceAgent: {
                listByWorkspace: mockListByWorkspace,
            },
        },
        db: {
            getAllChats: mockGetAllChats,
        },
    },
    configurable: true,
    writable: true,
});

function createChat(id: string, workspaceId = 'workspace-1'): Chat {
    return {
        id,
        title: `Chat ${id}`,
        model: 'gpt-4o',
        backend: 'opencode',
        messages: [],
        createdAt: new Date('2026-04-30T10:00:00.000Z'),
        updatedAt: new Date('2026-04-30T10:00:00.000Z'),
        workspaceId,
        metadata: {},
    };
}

describe('loadWorkspaceSessionsForWorkspace', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockListByWorkspace.mockResolvedValue({
            sessions: [],
            persistence: {
                activeSessionId: 'old-session',
                recentSessionIds: ['old-session'],
                composerDraft: '',
                updatedAt: Date.now(),
            },
        });
        mockGetAllChats.mockResolvedValue([createChat('old-session')]);
    });

    it('does not auto-restore the persisted active session when nothing is currently selected', async () => {
        const setCurrentSessionId = vi.fn();

        await loadWorkspaceSessionsForWorkspace({
            workspaceId: 'workspace-1',
            chatsRef: { current: [] },
            setChats: vi.fn(),
            setSessions: vi.fn(),
            setCurrentSessionId,
            setComposerValue: vi.fn(),
        });

        const updater = setCurrentSessionId.mock.calls[0][0] as (prev: string | null) => string | null;
        expect(updater(null)).toBeNull();
    });

    it('preserves the current session when it already exists in this mount', async () => {
        const setCurrentSessionId = vi.fn();

        await loadWorkspaceSessionsForWorkspace({
            workspaceId: 'workspace-1',
            chatsRef: { current: [createChat('old-session')] },
            setChats: vi.fn(),
            setSessions: vi.fn(),
            setCurrentSessionId,
            setComposerValue: vi.fn(),
        });

        const updater = setCurrentSessionId.mock.calls[0][0] as (prev: string | null) => string | null;
        expect(updater('old-session')).toBe('old-session');
    });
});

describe('dedupeChatMessages', () => {
    it('removes duplicate messages by id and adjacent repeated content', () => {
        const messages: Chat['messages'] = [
            {
                id: 'user-1',
                role: 'user',
                content: 'Hello',
                timestamp: new Date('2026-04-30T10:00:00.000Z'),
            },
            {
                id: 'user-1',
                role: 'user',
                content: 'Hello',
                timestamp: new Date('2026-04-30T10:00:01.000Z'),
            },
            {
                id: 'assistant-1',
                role: 'assistant',
                content: 'Working on it',
                timestamp: new Date('2026-04-30T10:00:02.000Z'),
            },
            {
                id: 'assistant-2',
                role: 'assistant',
                content: 'Working on it',
                timestamp: new Date('2026-04-30T10:00:03.000Z'),
            },
        ];

        expect(dedupeChatMessages(messages)).toHaveLength(2);
        expect(dedupeChatMessages(messages).map(message => message.id)).toEqual([
            'user-1',
            'assistant-1',
        ]);
    });
});
