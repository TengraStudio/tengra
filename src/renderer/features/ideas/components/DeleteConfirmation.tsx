/**
 * Delete confirmation modal wrapper component
 */
import React, { useCallback } from 'react';

import { ConfirmationModal } from '@/components/ui/ConfirmationModal';

export type DeleteConfirmType = 'idea' | 'session' | 'bulk';

export interface DeleteConfirmState {
    isOpen: boolean;
    type: DeleteConfirmType;
    id?: string;
    ids?: string[];
}

interface DeleteConfirmationProps {
    state: DeleteConfirmState;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
}

export const DeleteConfirmation: React.FC<DeleteConfirmationProps> = ({ state, onClose, onConfirm }) => {
    const isIdea = state.type === 'idea';
    const title = isIdea ? 'Delete Idea' : 'Delete Multiple Ideas';
    const message = isIdea
        ? 'Are you sure you want to delete this idea? This action cannot be undone.'
        : `Are you sure you want to delete ${state.ids?.length ?? 0} ideas? This action cannot be undone.`;

    const handleConfirm = useCallback(() => {
        void onConfirm();
    }, [onConfirm]);

    return (
        <ConfirmationModal
            isOpen={state.isOpen}
            onClose={onClose}
            onConfirm={handleConfirm}
            title={title}
            message={message}
            confirmLabel="Delete"
            variant="danger"
        />
    );
};
