import React from 'react';

import { Modal } from '@/components/ui/modal';
import { AnimatePresence } from '@/lib/framer-motion-compat';
import { Project } from '@/types';

interface ArchiveProjectModalProps {
    project: Project | null;
    onClose: () => void;
    onSubmit: () => Promise<void>;
    t: (key: string) => string;
}

export const ArchiveProjectModal: React.FC<ArchiveProjectModalProps> = ({
    project,
    onClose,
    onSubmit,
    t,
}) => (
    <AnimatePresence>
        {project && (
            <Modal isOpen={!!project} onClose={onClose} title={t('workspaces.archiveWorkspace')}>
                <div className="space-y-4 pt-2">
                    <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                        <p className="text-sm text-success/90 leading-relaxed font-light">
                            {t('workspaces.archiveConfirmation')}{' '}
                            <span className="font-semibold text-foreground">{project.title}</span>?
                            <span className="block mt-1 text-xs text-success font-normal italic opacity-80">
                                {t('workspaces.archiveWarning')}
                            </span>
                        </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm hover:bg-white/5 transition-colors font-light"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={() => {
                                void onSubmit();
                            }}
                            className="px-6 py-2 rounded-lg text-sm font-medium bg-success text-foreground hover:bg-success active:scale-95 transition-all shadow-lg shadow-emerald-900/20"
                        >
                            {project.status === 'archived'
                                ? t('common.unarchive') || 'Unarchive'
                                : t('workspaces.archiveWorkspace')}
                        </button>
                    </div>
                </div>
            </Modal>
        )}
    </AnimatePresence>
);
