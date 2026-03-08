import React from 'react';

import { Modal } from '@/components/ui/modal';
import { AnimatePresence } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';
import { Workspace } from '@/types';

import { isValidWorkspaceDescription, isValidWorkspaceTitle } from './modals/modalValidation';

interface WorkspaceModalsProps {
    editingWorkspace: Workspace | null;
    setEditingWorkspace: (p: Workspace | null) => void;
    deletingWorkspace: Workspace | null;
    setDeletingWorkspace: (p: Workspace | null) => void;
    isArchiving: Workspace | null;
    setIsArchiving: (p: Workspace | null) => void;
    isBulkDeleting: boolean;
    setIsBulkDeleting: (b: boolean) => void;
    isBulkArchiving: boolean;
    setIsBulkArchiving: (b: boolean) => void;
    selectedCount: number;
    editForm: { title: string; description: string };
    setEditForm: (
        f:
            | { title: string; description: string }
            | ((prev: { title: string; description: string }) => {
                title: string;
                description: string;
            })
    ) => void;
    handleUpdateWorkspace: () => Promise<boolean>;
    handleDeleteWorkspace: (deleteFiles: boolean) => Promise<void>;
    handleArchiveWorkspace: () => Promise<void>;
    handleBulkDelete: (deleteFiles: boolean) => Promise<void>;
    handleBulkArchive: (isArchived: boolean) => Promise<void>;
    bulkArchiveMode?: 'archive' | 'restore';
    t: (key: string) => string;
}

const EditWorkspaceModal: React.FC<{
    workspace: Workspace | null;
    onClose: () => void;
    form: { title: string; description: string };
    setForm: (
        f:
            | { title: string; description: string }
            | ((prev: { title: string; description: string }) => {
                title: string;
                description: string;
            })
    ) => void;
    onSubmit: () => Promise<boolean>;
    t: (key: string) => string;
}> = ({ workspace, onClose, form, setForm, onSubmit, t }) => {
    const hasValidTitle = isValidWorkspaceTitle(form.title);
    const hasValidDescription = isValidWorkspaceDescription(form.description);
    const [isSaving, setIsSaving] = React.useState(false);
    const rollbackRef = React.useRef(form);

    React.useEffect(() => {
        if (workspace) {
            rollbackRef.current = {
                title: workspace.title,
                description: workspace.description,
            };
            setIsSaving(false);
        }
    }, [workspace]);

    const handleSubmit = async () => {
        if (!hasValidTitle || isSaving) {
            return;
        }
        const optimisticSnapshot = { ...form };
        setIsSaving(true);
        const success = await onSubmit();
        if (!success) {
            setForm(rollbackRef.current);
        } else {
            rollbackRef.current = optimisticSnapshot;
        }
        setIsSaving(false);
    };

    return (
        <AnimatePresence>
            {workspace && (
                <Modal isOpen={!!workspace} onClose={onClose} title={t('workspaces.editWorkspace')}>
                    <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground uppercase">
                                {t('workspaces.nameLabel')}
                            </label>
                            <input
                                value={form.title}
                                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                                aria-invalid={!hasValidTitle}
                                className={cn(
                                    'w-full bg-muted/30 border rounded-lg px-3 py-2 text-sm focus:outline-none',
                                    hasValidTitle
                                        ? 'border-border/50 focus:border-primary/50'
                                        : 'border-destructive/50 focus:border-destructive'
                                )}
                                placeholder={t('workspaces.namePlaceholder')}
                            />
                            {!hasValidTitle && (
                                <p className="text-xxs text-destructive">{t('common.invalidInput')}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground uppercase">
                                {t('workspaces.description')}
                            </label>
                            <textarea
                                value={form.description}
                                onChange={e =>
                                    setForm(prev => ({ ...prev, description: e.target.value }))
                                }
                                aria-invalid={!hasValidDescription}
                                className={cn(
                                    'w-full bg-muted/30 border rounded-lg px-3 py-2 text-sm focus:outline-none min-h-[80px] resize-none',
                                    hasValidDescription
                                        ? 'border-border/50 focus:border-primary/50'
                                        : 'border-destructive/50 focus:border-destructive'
                                )}
                                placeholder={t('workspaces.workspaceDescPlaceholder')}
                            />
                            {!hasValidDescription && (
                                <p className="text-xxs text-destructive">{t('common.invalidInput')}</p>
                            )}
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 rounded-lg text-sm hover:bg-muted/50 transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={() => {
                                    void handleSubmit();
                                }}
                                disabled={!hasValidTitle || isSaving}
                                className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                                {t('common.save')}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </AnimatePresence>
    );
};

const DeleteWorkspaceModal: React.FC<{
    workspace: Workspace | null;
    onClose: () => void;
    onSubmit: (deleteFiles: boolean) => Promise<void>;
    t: (key: string) => string;
}> = ({ workspace, onClose, onSubmit, t }) => {
    const [deleteFiles, setDeleteFiles] = React.useState(false);
    React.useEffect(() => {
        if (!workspace) {
            setDeleteFiles(false);
        }
    }, [workspace]);

    return (
        <AnimatePresence>
            {workspace && (
                <Modal isOpen={!!workspace} onClose={onClose} title={t('workspaces.deleteWorkspace')}>
                    <div className="space-y-4 pt-2">
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                            <p className="text-sm text-destructive">
                                {t('workspaces.deleteConfirmation')}{' '}
                                <span className="font-bold text-foreground">{workspace.title}</span>?
                                <span className="block mt-1 text-xs text-destructive/70 font-medium italic">
                                    {t('workspaces.deleteWarning')}
                                </span>
                            </p>
                        </div>
                        <DeleteFilesCheckbox
                            checked={deleteFiles}
                            onChange={setDeleteFiles}
                            t={t}
                        />
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 rounded-lg text-sm hover:bg-white/5 transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={() => {
                                    void onSubmit(deleteFiles);
                                }}
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

const ArchiveWorkspaceModal: React.FC<{
    workspace: Workspace | null;
    onClose: () => void;
    onSubmit: () => Promise<void>;
    t: (key: string) => string;
}> = ({ workspace, onClose, onSubmit, t }) => (
    <AnimatePresence>
        {workspace && (
            <Modal isOpen={!!workspace} onClose={onClose} title={t('workspaces.archiveWorkspace')}>
                <div className="space-y-4 pt-2">
                    <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                        <p className="text-sm text-success/90 leading-relaxed font-light">
                            {workspace.status === 'archived'
                                ? t('workspaces.restoreConfirmation') || 'Restore'
                                : t('workspaces.archiveConfirmation')}{' '}
                            <span className="font-semibold text-foreground">{workspace.title}</span>?
                            <span className="block mt-1 text-xs text-success font-normal italic opacity-80">
                                {workspace.status === 'archived'
                                    ? t('workspaces.restoreWarning') ||
                                    'This will move the workspace back to active.'
                                    : t('workspaces.archiveWarning')}
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
                            {workspace.status === 'archived'
                                ? t('common.unarchive') || 'Unarchive'
                                : t('workspaces.archiveWorkspace')}
                        </button>
                    </div>
                </div>
            </Modal>
        )}
    </AnimatePresence>
);

const BulkArchiveModal: React.FC<{
    isOpen: boolean;
    count: number;
    mode: 'archive' | 'restore';
    onClose: () => void;
    onSubmit: () => Promise<void>;
    t: (key: string) => string;
}> = ({ isOpen, count, mode, onClose, onSubmit, t }) => (
    <AnimatePresence>
        {isOpen && (
            <Modal isOpen={isOpen} onClose={onClose} title={t('workspaces.bulkArchive')}>
                <div className="space-y-4 pt-2">
                    <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                        <p className="text-sm text-success/90 leading-relaxed font-light">
                            {mode === 'restore'
                                ? t('workspaces.restoreConfirmation') || 'Restore'
                                : t('workspaces.archiveConfirmation')}{' '}
                            <span className="font-semibold text-foreground">
                                {count} {t('sidebar.workspaces').toLowerCase()}
                            </span>
                            ?
                            <span className="block mt-1 text-xs text-success font-normal italic opacity-80">
                                {mode === 'restore'
                                    ? t('workspaces.restoreWarning') ||
                                    'This will move selected workspaces back to active.'
                                    : t('workspaces.archiveWarning')}
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
                            {mode === 'restore'
                                ? t('workspaces.bulkRestore') || 'Restore Selected'
                                : t('workspaces.bulkArchive')}
                        </button>
                    </div>
                </div>
            </Modal>
        )}
    </AnimatePresence>
);

const BulkDeleteModal: React.FC<{
    isOpen: boolean;
    count: number;
    onClose: () => void;
    onSubmit: (deleteFiles: boolean) => Promise<void>;
    t: (key: string) => string;
}> = ({ isOpen, count, onClose, onSubmit, t }) => {
    const [deleteFiles, setDeleteFiles] = React.useState(false);
    React.useEffect(() => {
        if (!isOpen) {
            setDeleteFiles(false);
        }
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <Modal isOpen={isOpen} onClose={onClose} title={t('workspaces.bulkDelete')}>
                    <div className="space-y-4 pt-2">
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                            <p className="text-sm text-destructive/90 leading-relaxed font-light">
                                {t('workspaces.deleteConfirmation')}{' '}
                                <span className="font-semibold text-foreground">
                                    {count} {t('sidebar.workspaces').toLowerCase()}
                                </span>
                                ?
                                <span className="block mt-1 text-xs text-destructive/70 font-normal italic opacity-80">
                                    {t('workspaces.deleteWarning')}
                                </span>
                            </p>
                        </div>
                        <DeleteFilesCheckbox
                            checked={deleteFiles}
                            onChange={setDeleteFiles}
                            t={t}
                        />
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 rounded-lg text-sm hover:bg-white/5 transition-colors font-light"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={() => {
                                    void onSubmit(deleteFiles);
                                }}
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

const DeleteFilesCheckbox: React.FC<{
    checked: boolean;
    onChange: (b: boolean) => void;
    t: (key: string) => string;
}> = ({ checked, onChange, t }) => (
    <label className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50 cursor-pointer hover:bg-muted/50 transition-colors group">
        <div className="relative flex items-center justify-center w-5 h-5">
            <input
                type="checkbox"
                checked={checked}
                onChange={e => onChange(e.target.checked)}
                className="peer appearance-none w-5 h-5 border border-border/50 rounded bg-muted/20 checked:bg-destructive checked:border-destructive transition-all cursor-pointer"
            />
            <svg
                className="absolute w-3.5 h-3.5 text-foreground opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        </div>
        <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground group-hover:text-destructive transition-colors">
                {t('workspaces.deleteWorkspaceFiles')}
            </span>
            {checked && (
                <span className="text-xxs text-destructive font-bold uppercase animate-pulse">
                    ⚠️ Permanent Deletion
                </span>
            )}
        </div>
    </label>
);

export const WorkspaceModals: React.FC<WorkspaceModalsProps> = ({
    editingWorkspace,
    setEditingWorkspace,
    deletingWorkspace,
    setDeletingWorkspace,
    isArchiving,
    setIsArchiving,
    isBulkDeleting,
    setIsBulkDeleting,
    isBulkArchiving,
    setIsBulkArchiving,
    selectedCount,
    editForm,
    setEditForm,
    handleUpdateWorkspace,
    handleDeleteWorkspace,
    handleArchiveWorkspace,
    handleBulkDelete,
    handleBulkArchive,
    bulkArchiveMode = 'archive',
    t,
}) => (
    <>
        <EditWorkspaceModal
            workspace={editingWorkspace}
            onClose={() => setEditingWorkspace(null)}
            form={editForm}
            setForm={setEditForm}
            onSubmit={handleUpdateWorkspace}
            t={t}
        />
        <DeleteWorkspaceModal
            workspace={deletingWorkspace}
            onClose={() => setDeletingWorkspace(null)}
            onSubmit={handleDeleteWorkspace}
            t={t}
        />
        <ArchiveWorkspaceModal
            workspace={isArchiving}
            onClose={() => setIsArchiving(null)}
            onSubmit={handleArchiveWorkspace}
            t={t}
        />
        <BulkArchiveModal
            isOpen={isBulkArchiving}
            count={selectedCount}
            mode={bulkArchiveMode}
            onClose={() => setIsBulkArchiving(false)}
            onSubmit={() => handleBulkArchive(bulkArchiveMode !== 'restore')}
            t={t}
        />
        <BulkDeleteModal
            isOpen={isBulkDeleting}
            count={selectedCount}
            onClose={() => setIsBulkDeleting(false)}
            onSubmit={handleBulkDelete}
            t={t}
        />
    </>
);
