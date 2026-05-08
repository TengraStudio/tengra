/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React from 'react';

import { Modal } from '@/components/ui/modal';
import { AnimatePresence } from '@/lib/framer-motion-compat';

import { DeleteFilesCheckbox } from './DeleteFilesCheckbox';

/* Batch-02: Extracted Long Classes */
const C_BULKDELETEMODAL_1 = "px-6 py-2 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-95 transition-all shadow-lg shadow-destructive/20";


interface BulkDeleteModalProps {
    isOpen: boolean;
    count: number;
    onClose: () => void;
    onSubmit: (deleteFiles: boolean) => Promise<void>;
    t: (key: string) => string;
}

export const BulkDeleteModal: React.FC<BulkDeleteModalProps> = ({ isOpen, count, onClose, onSubmit, t }) => {
    const [deleteFiles, setDeleteFiles] = React.useState(false);
    // Reset state when modal is closed to ensure it starts fresh next time
    if (!isOpen && deleteFiles) {
        setDeleteFiles(false);
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <Modal isOpen={isOpen} onClose={onClose} title={t('frontend.workspaces.bulkDelete')}>
                    <div className="space-y-4 pt-2">
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                            <p className="text-sm text-destructive/90 leading-relaxed font-light">
                                {t('frontend.workspaces.deleteConfirmation')} <span className="font-semibold text-foreground">{count} {t('frontend.sidebar.workspaces').toLowerCase()}</span>?
                                <span className="block mt-1 typo-caption text-destructive/70 font-normal opacity-80">{t('frontend.workspaces.deleteWarning')}</span>
                            </p>
                        </div>
                        <DeleteFilesCheckbox checked={deleteFiles} onChange={setDeleteFiles} t={t} />
                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm hover:bg-muted/40 transition-colors font-light">
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={() => { void onSubmit(deleteFiles); }}
                                className={C_BULKDELETEMODAL_1}
                            >
                                {t('frontend.workspaces.bulkDelete')}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </AnimatePresence>
    );
};

