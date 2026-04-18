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

/* Batch-02: Extracted Long Classes */
const C_ARCHIVEWORKSPACEMODAL_1 = "px-6 py-2 rounded-lg text-sm font-medium bg-success text-foreground hover:bg-success active:scale-95 transition-all shadow-lg shadow-emerald-900/20";


interface ArchiveWorkspaceModalProps {
    workspace: Workspace | null;
    onClose: () => void;
    onSubmit: () => Promise<void>;
    t: (key: string) => string;
}

export const ArchiveWorkspaceModal: React.FC<ArchiveWorkspaceModalProps> = ({
    workspace,
    onClose,
    onSubmit,
    t,
}) => (
    <AnimatePresence>
        {workspace && (
            <Modal isOpen={!!workspace} onClose={onClose} title={t('workspaces.archiveWorkspace')}>
                <div className="space-y-4 pt-2">
                    <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                        <p className="text-sm text-success/90 leading-relaxed font-light">
                            {t('workspaces.archiveConfirmation')}{' '}
                            <span className="font-semibold text-foreground">{workspace.title}</span>?
                            <span className="block mt-1 typo-caption text-success font-normal opacity-80">
                                {t('workspaces.archiveWarning')}
                            </span>
                        </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm hover:bg-muted/40 transition-colors font-light"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={() => {
                                void onSubmit();
                            }}
                            className={C_ARCHIVEWORKSPACEMODAL_1}
                        >
                            {workspace.status === 'archived'
                                ? t('common.unarchive')
                                : t('workspaces.archiveWorkspace')}
                        </button>
                    </div>
                </div>
            </Modal>
        )}
    </AnimatePresence>
);
