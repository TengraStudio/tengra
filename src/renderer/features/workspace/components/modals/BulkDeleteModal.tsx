import React from 'react';

import { Modal } from '@/components/ui/modal';
import { AnimatePresence } from '@/lib/framer-motion-compat';

import { DeleteFilesCheckbox } from './DeleteFilesCheckbox';

interface BulkDeleteModalProps {
    isOpen: boolean;
    count: number;
    onClose: () => void;
    onSubmit: (deleteFiles: boolean) => Promise<void>;
    t: (key: string) => string;
}

export const BulkDeleteModal: React.FC<BulkDeleteModalProps> = ({ isOpen, count, onClose, onSubmit, t }) => {
    const [deleteFiles, setDeleteFiles] = React.useState(false);
    React.useEffect(() => { if (!isOpen) { setDeleteFiles(false); } }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <Modal isOpen={isOpen} onClose={onClose} title={t('workspaces.bulkDelete')}>
                    <div className="space-y-4 pt-2">
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                            <p className="text-sm text-destructive/90 leading-relaxed font-light">
                                {t('workspaces.deleteConfirmation')} <span className="font-semibold text-foreground">{count} {t('sidebar.workspaces').toLowerCase()}</span>?
                                <span className="block mt-1 text-xs text-destructive/70 font-normal opacity-80">{t('workspaces.deleteWarning')}</span>
                            </p>
                        </div>
                        <DeleteFilesCheckbox checked={deleteFiles} onChange={setDeleteFiles} t={t} />
                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm hover:bg-muted/40 transition-colors font-light">
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={() => { void onSubmit(deleteFiles); }}
                                className="px-6 py-2 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-95 transition-all shadow-lg shadow-destructive/20"
                            >
                                {t('workspaces.bulkDelete')}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </AnimatePresence>
    );
};
