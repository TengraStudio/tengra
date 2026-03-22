/**
 * Hook for managing deletion confirmation state and logic
 */
import type { WorkspaceIdea } from '@shared/types/ideas';
import { useCallback, useState } from 'react';

import { appLogger } from '@/utils/renderer-logger';

import type { DeleteConfirmType } from '../components/DeleteConfirmation';

export interface DeleteConfirmState {
    isOpen: boolean;
    type: DeleteConfirmType;
    id?: string;
    ids?: string[];
}

interface UseDeleteConfirmationReturn {
    deleteConfirm: DeleteConfirmState;
    handleDeleteRequest: (id: string) => void;
    handleBulkDeleteRequest: (ids: string[]) => void;
    closeDeleteConfirm: () => void;
    confirmDelete: (onConfirm: () => Promise<void>, onAfter: () => void) => Promise<void>;
}

/**
 * Hook to manage deletion confirmation state and operations
 */
export function useDeleteConfirmation(
    onLoadIdeas: (sessionId: string) => void | Promise<void>,
    currentSessionId: string | undefined,
    selectedIdea: WorkspaceIdea | null,
    setSelectedIdea: (idea: WorkspaceIdea | null) => void
): UseDeleteConfirmationReturn {
    const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>({
        isOpen: false,
        type: 'idea'
    });

    const handleDeleteRequest = useCallback((id: string): void => {
        setDeleteConfirm({ isOpen: true, type: 'idea', id });
    }, []);

    const handleBulkDeleteRequest = useCallback((ids: string[]): void => {
        setDeleteConfirm({ isOpen: true, type: 'bulk', ids });
    }, []);

    const closeDeleteConfirm = useCallback((): void => {
        setDeleteConfirm({ isOpen: false, type: 'idea' });
    }, []);

    const confirmDelete = useCallback(
        async (onConfirm: () => Promise<void>, onAfter: () => void) => {
            if (!currentSessionId) {
                return;
            }

            try {
                await onConfirm();
                if (selectedIdea?.id === deleteConfirm.id) {
                    setSelectedIdea(null);
                }
                void onLoadIdeas(currentSessionId);
            } catch (err) {
                appLogger.error('DeleteConfirmation', 'Failed to delete', err as Error);
            } finally {
                closeDeleteConfirm();
                onAfter();
            }
        },
        [currentSessionId, deleteConfirm.id, selectedIdea?.id, setSelectedIdea, onLoadIdeas, closeDeleteConfirm]
    );

    return {
        deleteConfirm,
        handleDeleteRequest,
        handleBulkDeleteRequest,
        closeDeleteConfirm,
        confirmDelete
    };
}

