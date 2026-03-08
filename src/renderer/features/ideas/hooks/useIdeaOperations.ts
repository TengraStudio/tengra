/**
 * Hook for managing idea approval operations with optimistic updates
 */
import type { IdeaSession, WorkspaceIdea } from '@shared/types/ideas';
import { useCallback } from 'react';

interface UseIdeaApprovalStateProps {
    selectedIdea: WorkspaceIdea | null;
    currentSession: IdeaSession | null;
    onApproveSuccess: (workspaceId: string) => void;
    onError: () => void;
    onLoadIdeas: (sessionId: string) => void;
    approveIdea: (ideaId: string, workspacePath: string, selectedName?: string) => Promise<{ id: string } | null>;
}

export function useIdeaApprovalState({
    selectedIdea,
    currentSession,
    onApproveSuccess,
    onError,
    onLoadIdeas,
    approveIdea
}: UseIdeaApprovalStateProps) {
    return useCallback(
        async (workspacePath: string, selectedName?: string) => {
            if (!selectedIdea || !currentSession?.id) {
                return;
            }

            try {
                const workspace = await approveIdea(selectedIdea.id, workspacePath, selectedName);
                if (workspace) {
                    onApproveSuccess(workspace.id);
                }
            } catch {
                onError();
                onLoadIdeas(currentSession.id);
            }
        },
        [selectedIdea, currentSession, onApproveSuccess, onError, onLoadIdeas, approveIdea]
    );
}

/**
 * Hook for managing idea rejection with optimistic updates
 */
interface UseIdeaRejectionProps {
    selectedIdea: WorkspaceIdea | null;
    currentSession: IdeaSession | null;
    onRejectSuccess: () => void;
    onError: () => void;
    onLoadIdeas: (sessionId: string) => void;
    rejectIdea: (ideaId: string) => Promise<boolean>;
}

export function useIdeaRejection({
    selectedIdea,
    currentSession,
    onRejectSuccess,
    onError,
    onLoadIdeas,
    rejectIdea
}: UseIdeaRejectionProps) {
    return useCallback(async () => {
        if (!selectedIdea || !currentSession?.id) {
            return;
        }

        try {
            const success = await rejectIdea(selectedIdea.id);
            if (success) {
                onRejectSuccess();
            }
        } catch {
            onError();
            onLoadIdeas(currentSession.id);
        }
    }, [selectedIdea, currentSession, onRejectSuccess, onError, onLoadIdeas, rejectIdea]);
}

/**
 * Hook for managing idea archiving with optimistic updates
 */
interface UseIdeaArchivingProps {
    selectedIdea: WorkspaceIdea | null;
    currentSession: IdeaSession | null;
    onArchiveSuccess: () => void;
    onError: () => void;
    onLoadIdeas: (sessionId: string) => void;
    archiveIdea: (ideaId: string) => Promise<boolean>;
}

export function useIdeaArchiving({
    selectedIdea,
    currentSession,
    onArchiveSuccess,
    onError,
    onLoadIdeas,
    archiveIdea
}: UseIdeaArchivingProps) {
    return useCallback(async () => {
        if (!selectedIdea || !currentSession?.id) {
            return;
        }

        try {
            const success = await archiveIdea(selectedIdea.id);
            if (success) {
                onArchiveSuccess();
            }
        } catch {
            onError();
            onLoadIdeas(currentSession.id);
        }
    }, [selectedIdea, currentSession, onArchiveSuccess, onError, onLoadIdeas, archiveIdea]);
}
