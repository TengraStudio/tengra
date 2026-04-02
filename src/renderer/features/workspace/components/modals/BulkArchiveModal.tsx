import React from 'react';

import { Modal } from '@/components/ui/modal';
import { AnimatePresence } from '@/lib/framer-motion-compat';

interface BulkArchiveModalProps {
    isOpen: boolean;
    count: number;
    onClose: () => void;
    onSubmit: () => Promise<void>;
    t: (key: string) => string;
}

export const BulkArchiveModal: React.FC<BulkArchiveModalProps> = ({
    isOpen,
    count,
    onClose,
    onSubmit,
    t,
}) => (
    <AnimatePresence>
        {isOpen && (
            <Modal isOpen={isOpen} onClose={onClose} title={t('workspaces.bulkArchive')}>
                <div className="space-y-4 pt-2">
                    <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                        <p className="text-sm text-success/90 leading-relaxed font-light">
                            {t('workspaces.archiveConfirmation')}{' '}
                            <span className="font-semibold text-foreground">
                                {count} {t('sidebar.workspaces').toLowerCase()}
                            </span>
                            ?
                            <span className="block mt-1 text-xs text-success font-normal opacity-80">
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
                            className="px-6 py-2 rounded-lg text-sm font-medium bg-success text-foreground hover:bg-success active:scale-95 transition-all shadow-lg shadow-emerald-900/20"
                        >
                            {t('workspaces.bulkArchive')}
                        </button>
                    </div>
                </div>
            </Modal>
        )}
    </AnimatePresence>
);
