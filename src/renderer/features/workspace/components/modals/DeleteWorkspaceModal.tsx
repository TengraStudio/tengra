import React from 'react';

import { Modal } from '@/components/ui/modal';
import { AnimatePresence } from '@/lib/framer-motion-compat';
import { Workspace } from '@/types';

import { DeleteFilesCheckbox } from './DeleteFilesCheckbox';

interface DeleteWorkspaceModalProps {
    workspace: Workspace | null;
    onClose: () => void;
    onSubmit: (deleteFiles: boolean) => Promise<void>;
    t: (key: string) => string;
}

export const DeleteWorkspaceModal: React.FC<DeleteWorkspaceModalProps> = ({ workspace, onClose, onSubmit, t }) => {
    const [deleteFiles, setDeleteFiles] = React.useState(false);
    React.useEffect(() => { if (!workspace) { setDeleteFiles(false); } }, [workspace]);

    return (
        <AnimatePresence>
            {workspace && (
                <Modal isOpen={!!workspace} onClose={onClose} title={t('workspaces.deleteWorkspace')}>
                    <div className="space-y-4 pt-2">
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                            <p className="text-sm text-destructive">
                                {t('workspaces.deleteConfirmation')} <span className="font-bold text-foreground">{workspace.title}</span>?
                                <span className="block mt-1 text-xs text-destructive/70 font-medium italic">{t('workspaces.deleteWarning')}</span>
                            </p>
                        </div>
                        <DeleteFilesCheckbox checked={deleteFiles} onChange={setDeleteFiles} t={t} />
                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm hover:bg-white/5 transition-colors">
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={() => { void onSubmit(deleteFiles); }}
                                className="px-6 py-2 rounded-lg text-sm font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-95 transition-all shadow-lg shadow-destructive/20"
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
