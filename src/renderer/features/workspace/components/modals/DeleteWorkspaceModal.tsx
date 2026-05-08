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
import { Workspace } from '@/types';

import { DeleteFilesCheckbox } from './DeleteFilesCheckbox';

/* Batch-02: Extracted Long Classes */
const C_DELETEWORKSPACEMODAL_1 = "px-6 py-2 rounded-lg text-sm font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-95 transition-all shadow-lg shadow-destructive/20";


interface DeleteWorkspaceModalProps {
    workspace: Workspace | null;
    onClose: () => void;
    onSubmit: (deleteFiles: boolean) => Promise<void>;
    t: (key: string) => string;
}

export const DeleteWorkspaceModal: React.FC<DeleteWorkspaceModalProps> = ({ workspace, onClose, onSubmit, t }) => {
    const [deleteFiles, setDeleteFiles] = React.useState(false);
    // Reset state when workspace is cleared to ensure it starts fresh next time
    if (!workspace && deleteFiles) {
        setDeleteFiles(false);
    }

    return (
        <AnimatePresence>
            {workspace && (
                <Modal isOpen={!!workspace} onClose={onClose} title={t('frontend.workspaces.deleteWorkspace')}>
                    <div className="space-y-4 pt-2">
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                            <p className="text-sm text-destructive">
                                {t('frontend.workspaces.deleteConfirmation')} <span className="font-bold text-foreground">{workspace.title}</span>?
                                <span className="block mt-1 typo-caption text-destructive/70 font-medium">{t('frontend.workspaces.deleteWarning')}</span>
                            </p>
                        </div>
                        <DeleteFilesCheckbox checked={deleteFiles} onChange={setDeleteFiles} t={t} />
                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm hover:bg-muted/40 transition-colors">
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={() => { void onSubmit(deleteFiles); }}
                                className={C_DELETEWORKSPACEMODAL_1}
                            >
                                {t('common.delete')}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </AnimatePresence>
    );
};

