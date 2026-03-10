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
