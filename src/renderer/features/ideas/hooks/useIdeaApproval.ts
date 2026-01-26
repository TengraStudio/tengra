/**
 * Hook for managing idea approval workflow
 */
import { Project } from '@shared/types/project';
import { useCallback, useState } from 'react';

interface UseIdeaApprovalReturn {
    isApproving: boolean
    isRejecting: boolean
    isArchiving: boolean
    approvedProject: Project | null
    error: string | null
    approveIdea: (ideaId: string, projectPath: string, selectedName?: string) => Promise<Project | null>
    rejectIdea: (ideaId: string) => Promise<boolean>
    archiveIdea: (ideaId: string) => Promise<boolean>
    clearError: () => void
    clearApprovedProject: () => void
}

export function useIdeaApproval(): UseIdeaApprovalReturn {
    const [isApproving, setIsApproving] = useState(false);
    const [isRejecting, setIsRejecting] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);
    const [approvedProject, setApprovedProject] = useState<Project | null>(null);
    const [error, setError] = useState<string | null>(null);

    const approveIdea = useCallback(async (ideaId: string, projectPath: string, selectedName?: string): Promise<Project | null> => {
        setIsApproving(true);
        setError(null);
        setApprovedProject(null);

        try {
            const result = await window.electron.ideas.approveIdea(ideaId, projectPath, selectedName);
            if (result.success && result.project) {
                setApprovedProject(result.project);
                return result.project;
            }
            throw new Error('Failed to create project');
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

    const clearApprovedProject = useCallback(() => {
        setApprovedProject(null);
    }, []);

    return {
        isApproving,
        isRejecting,
        isArchiving,
        approvedProject,
        error,
        approveIdea,
        rejectIdea,
        archiveIdea,
        clearError,
        clearApprovedProject
    };
}
