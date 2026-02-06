/**
 * Delete confirmation modal wrapper component
 */
import React, { useCallback } from 'react';

import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { useTranslation } from '@/i18n';

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
    const { t } = useTranslation();
    const isIdea = state.type === 'idea';
    const title = isIdea ? t('ideas.delete.title') : t('ideas.delete.bulkTitle');
    const message = isIdea
        ? t('ideas.delete.message')
        : t('ideas.delete.bulkMessage', { count: state.ids?.length ?? 0 });

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
            confirmLabel={t('common.delete')}
            variant="danger"
        />
    );
};
