/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
    buildSessionSummary,
    mergeWorkspaceChats,
} from '@renderer/features/workspace/utils/workspace-agent-session-utils';
import type { Chat } from '@shared/types/chat';
import { describe, expect, it } from 'vitest';

function createChat(
    overrides?: Partial<Chat>
): Chat {
    return {
        id: overrides?.id ?? 'chat-1',
        title: overrides?.title ?? 'Workspace Session',
        model: overrides?.model ?? 'sonnet',
        backend: overrides?.backend ?? 'claude',
        messages: overrides?.messages ?? [],
        createdAt: overrides?.createdAt ?? new Date(100),
        updatedAt: overrides?.updatedAt ?? new Date(200),
        workspaceId: overrides?.workspaceId ?? 'workspace-1',
        metadata: overrides?.metadata ?? {},
        isGenerating: overrides?.isGenerating,
        isPinned: overrides?.isPinned,
        isArchived: overrides?.isArchived,
        isFavorite: overrides?.isFavorite,
        folderId: overrides?.folderId,
    };
}

describe('workspace-agent-session-utils', () => {
    it('builds summaries when chat timestamps arrive as numbers', () => {
        const hydratedChat = createChat();
        Reflect.set(hydratedChat, 'createdAt', 101);
        Reflect.set(hydratedChat, 'updatedAt', 202);

        const summary = buildSessionSummary(hydratedChat);

        expect(summary.createdAt).toBe(101);
        expect(summary.updatedAt).toBe(202);
    });

    it('sorts workspace chats when updatedAt is serialized', () => {
        const olderChat = createChat({ id: 'chat-1', updatedAt: new Date(100) });
        const newerHydratedChat = createChat({ id: 'chat-2', updatedAt: new Date(300) });
        Reflect.set(newerHydratedChat, 'updatedAt', 300);

        const mergedChats = mergeWorkspaceChats(
            [olderChat, newerHydratedChat],
            'workspace-1',
            []
        );

        expect(mergedChats.map(chat => chat.id)).toEqual(['chat-2', 'chat-1']);
    });
});
