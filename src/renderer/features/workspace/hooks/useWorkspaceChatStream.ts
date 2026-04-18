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
    SessionConversationStreamState,
    useSessionConversationStream,
} from '@renderer/hooks/useSessionConversationStream';

export type WorkspaceChatStreamResult = SessionConversationStreamState;
export type UseWorkspaceChatStreamResult = SessionConversationStreamState;

interface UseWorkspaceChatStreamOptions {
    provider: string;
    model: string;
    language: string;
    workspaceId: string;
}

/**
 * Workspace AI sidebar chat now uses the shared session conversation runtime.
 * The workspace hook remains as a UI-focused adapter while the stream lifecycle
 * and session synchronization live in a common hook.
 */
export function useWorkspaceChatStream(
    options: UseWorkspaceChatStreamOptions
): UseWorkspaceChatStreamResult {
    return useSessionConversationStream({
        provider: options.provider,
        model: options.model,
        language: options.language,
        workspaceId: options.workspaceId,
    });
}
