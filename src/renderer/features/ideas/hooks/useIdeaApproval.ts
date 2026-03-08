/**
 * Hook for managing idea approval workflow
 */
import { useCallback, useState } from 'react';

import type { Workspace } from '@/types';

interface UseIdeaApprovalReturn {
    isApproving: boolean
    isRejecting: boolean
    isArchiving: boolean
    approvedWorkspace: Workspace | null
    error: string | null
    approveIdea: (ideaId: string, workspacePath: string, selectedName?: string) => Promise<Workspace | null>
    rejectIdea: (ideaId: string) => Promise<boolean>
    archiveIdea: (ideaId: string) => Promise<boolean>
    clearError: () => void
    clearApprovedWorkspace: () => void
}

export function useIdeaApproval(): UseIdeaApprovalReturn {
    const [isApproving, setIsApproving] = useState(false);
    const [isRejecting, setIsRejecting] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);
    const [approvedWorkspace, setApprovedWorkspace] = useState<Workspace | null>(null);
    const [error, setError] = useState<string | null>(null);

    const approveIdea = useCallback(async (ideaId: string, workspacePath: string, selectedName?: string): Promise<Workspace | null> => {
        setIsApproving(true);
        setError(null);
        setApprovedWorkspace(null);

        try {
            const result = await window.electron.ideas.approveIdea(ideaId, workspacePath, selectedName);
            if (result.success && result.workspace) {
                setApprovedWorkspace(result.workspace);
                return result.workspace;
            }
            throw new Error('Failed to create workspace');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to approve idea';
            setError(message);
            return null;
        } finally {
            setIsApproving(false);
        }
    }, []);

    const rejectIdea = useCallback(async (ideaId: string): Promise<boolean> => {
        setIsRejecting(true);
        setError(null);

        try {
            const result = await window.electron.ideas.rejectIdea(ideaId);
            return result.success;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to reject idea';
            setError(message);
            return false;
        } finally {
            setIsRejecting(false);
        }
    }, []);

    const archiveIdea = useCallback(async (ideaId: string): Promise<boolean> => {
        setIsArchiving(true);
        setError(null);

        try {
            const result = await window.electron.ideas.archiveIdea(ideaId);
            return result.success;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to archive idea';
            setError(message);
            return false;
        } finally {
            setIsArchiving(false);
        }
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const clearApprovedWorkspace = useCallback(() => {
        setApprovedWorkspace(null);
    }, []);

    return {
        isApproving,
        isRejecting,
        isArchiving,
        approvedWorkspace,
        error,
        approveIdea,
        rejectIdea,
        archiveIdea,
        clearError,
        clearApprovedWorkspace
    };
}
