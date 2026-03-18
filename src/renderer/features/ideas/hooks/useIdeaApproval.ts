/**
 * Hook for managing idea approval workflow
 */
import { useCallback, useState } from 'react';

import { useTranslation } from '@/i18n';
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
    const { t } = useTranslation();
    const [isApproving, setIsApproving] = useState(false);
    const [isRejecting, setIsRejecting] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);
    const [approvedWorkspace, setApprovedWorkspace] = useState<Workspace | null>(null);
    const [error, setError] = useState<string | null>(null);
    const resolveErrorMessage = useCallback((err: Error | { messageKey?: string; messageParams?: Record<string, string | number> } | null | undefined, fallbackKey: string): string => {
        const errorWithI18n = err as {
            messageKey?: string;
            messageParams?: Record<string, string | number>;
        };
        if (typeof errorWithI18n.messageKey === 'string' && errorWithI18n.messageKey.length > 0) {
            return t(errorWithI18n.messageKey, errorWithI18n.messageParams);
        }
        if (err instanceof Error) {
            return err.message.startsWith('ideas.') || err.message.startsWith('errors.')
                ? t(err.message)
                : err.message;
        }
        return t(fallbackKey);
    }, [t]);

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
            throw new Error(t('ideas.errors.approvalFailed'));
        } catch (err) {
            const message = resolveErrorMessage(err as Error | { messageKey?: string; messageParams?: Record<string, string | number> }, 'ideas.errors.approvalFailed');
            setError(message);
            return null;
        } finally {
            setIsApproving(false);
        }
    }, [resolveErrorMessage, t]);

    const rejectIdea = useCallback(async (ideaId: string): Promise<boolean> => {
        setIsRejecting(true);
        setError(null);

        try {
            const result = await window.electron.ideas.rejectIdea(ideaId);
            return result.success;
        } catch (err) {
            const message = resolveErrorMessage(err as Error | { messageKey?: string; messageParams?: Record<string, string | number> }, 'ideas.errors.rejectFailed');
            setError(message);
            return false;
        } finally {
            setIsRejecting(false);
        }
    }, [resolveErrorMessage]);

    const archiveIdea = useCallback(async (ideaId: string): Promise<boolean> => {
        setIsArchiving(true);
        setError(null);

        try {
            const result = await window.electron.ideas.archiveIdea(ideaId);
            return result.success;
        } catch (err) {
            const message = resolveErrorMessage(err as Error | { messageKey?: string; messageParams?: Record<string, string | number> }, 'ideas.errors.archiveFailed');
            setError(message);
            return false;
        } finally {
            setIsArchiving(false);
        }
    }, [resolveErrorMessage]);

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
