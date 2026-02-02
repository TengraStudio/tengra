/**
 * Hook for managing idea approval operations with optimistic updates
 */
import type { IdeaSession, ProjectIdea } from '@shared/types/ideas';
import { useCallback } from 'react';

interface UseIdeaApprovalStateProps {
    selectedIdea: ProjectIdea | null;
    currentSession: IdeaSession | null;
    onApproveSuccess: (projectId: string) => void;
    onError: () => void;
    onLoadIdeas: (sessionId: string) => void;
    approveIdea: (ideaId: string, projectPath: string, selectedName?: string) => Promise<{ id: string } | null>;
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
        async (projectPath: string, selectedName?: string) => {
            if (!selectedIdea || !currentSession?.id) {
                return;
            }

            try {
                const project = await approveIdea(selectedIdea.id, projectPath, selectedName);
                if (project) {
                    onApproveSuccess(project.id);
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
    selectedIdea: ProjectIdea | null;
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
    selectedIdea: ProjectIdea | null;
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
