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

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import {
    isValidWorkspaceDescription,
    isValidWorkspaceTitle
} from '@/features/workspace/components/modals/modalValidation';
import { AnimatePresence } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';
import { Workspace } from '@/types';

/* Batch-02: Extracted Long Classes */
const C_WORKSPACEMODALS_1 = "flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50 cursor-pointer hover:bg-muted/50 transition-colors group";


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
                <Modal isOpen={!!workspace} onClose={onClose} title={t('frontend.workspaces.editWorkspace')}>
                    <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label className="typo-caption font-medium text-muted-foreground">
                                {t('frontend.workspaces.nameLabel')}
                            </Label>
                            <Input
                                value={form.title}
                                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                                aria-invalid={!hasValidTitle}
                                className={cn(
                                    'w-full bg-muted/30 border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary/20',
                                    !hasValidTitle && 'border-destructive/50 focus-visible:ring-destructive'
                                )}
                                placeholder={t('frontend.workspaces.namePlaceholder')}
                            />
                            {!hasValidTitle && (
                                <p className="text-sm text-destructive">{t('common.invalidInput')}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label className="typo-caption font-medium text-muted-foreground">
                                {t('frontend.workspaces.description')}
                            </Label>
                            <Textarea
                                value={form.description}
                                onChange={e =>
                                    setForm(prev => ({ ...prev, description: e.target.value }))
                                }
                                aria-invalid={!hasValidDescription}
                                className={cn(
                                    'w-full bg-muted/30 border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary/20 min-h-80 resize-none',
                                    !hasValidDescription && 'border-destructive/50 focus-visible:ring-destructive'
                                )}
                                placeholder={t('frontend.workspaces.workspaceDescPlaceholder')}
                            />
                            {!hasValidDescription && (
                                <p className="text-sm text-destructive">{t('common.invalidInput')}</p>
                            )}
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                variant="ghost"
                                onClick={onClose}
                            >
                                {t('common.cancel')}
                            </Button>
                            <Button
                                onClick={() => {
                                    void handleSubmit();
                                }}
                                disabled={!hasValidTitle || isSaving}
                            >
                                {t('common.save')}
                            </Button>
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

    return (
        <AnimatePresence>
            {workspace && (
                <Modal isOpen={!!workspace} onClose={onClose} title={t('frontend.workspaces.deleteWorkspace')}>
                    <div className="space-y-4 pt-2">
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                            <p className="text-sm text-destructive">
                                {t('frontend.workspaces.deleteConfirmation')}{' '}
                                <span className="font-bold text-foreground">{workspace.title}</span>?
                                <span className="block mt-1 typo-caption text-destructive/70 font-medium">
                                    {t('frontend.workspaces.deleteWarning')}
                                </span>
                            </p>
                        </div>
                        <DeleteFilesCheckbox
                            checked={deleteFiles}
                            onChange={setDeleteFiles}
                            t={t}
                        />
                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                variant="ghost"
                                onClick={onClose}
                            >
                                {t('common.cancel')}
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={() => {
                                    void onSubmit(deleteFiles);
                                }}
                                className="px-6 shadow-lg shadow-destructive/20"
                            >
                                {t('common.delete')}
                            </Button>
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
            <Modal isOpen={!!workspace} onClose={onClose} title={t('frontend.workspaces.archiveWorkspace')}>
                <div className="space-y-4 pt-2">
                    <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                        <p className="text-sm text-success/90 leading-relaxed font-light">
                            {workspace.status === 'archived'
                                ? t('frontend.workspaces.restoreConfirmation')
                                : t('frontend.workspaces.archiveConfirmation')}{' '}
                            <span className="font-semibold text-foreground">{workspace.title}</span>?
                            <span className="block mt-1 typo-caption text-success font-normal opacity-80">
                                {workspace.status === 'archived'
                                    ? t('frontend.workspaces.restoreWarning')
                                    : t('frontend.workspaces.archiveWarning')}
                            </span>
                        </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            variant="ghost"
                            onClick={onClose}
                        >
                            {t('common.cancel')}
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => {
                                void onSubmit();
                            }}
                            className="px-6 bg-success/80 hover:bg-success text-success-foreground border-none transition-all shadow-lg shadow-emerald-900/20"
                        >
                            {workspace.status === 'archived'
                                ? t('common.unarchive')
                                : t('frontend.workspaces.archiveWorkspace')}
                        </Button>
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
            <Modal isOpen={isOpen} onClose={onClose} title={t('frontend.workspaces.bulkArchive')}>
                <div className="space-y-4 pt-2">
                    <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                        <p className="text-sm text-success/90 leading-relaxed font-light">
                            {mode === 'restore'
                                ? t('frontend.workspaces.restoreConfirmation')
                                : t('frontend.workspaces.archiveConfirmation')}{' '}
                            <span className="font-semibold text-foreground">
                                {count} {t('frontend.sidebar.workspaces').toLowerCase()}
                            </span>
                            ?
                            <span className="block mt-1 typo-caption text-success font-normal opacity-80">
                                {mode === 'restore'
                                    ? t('frontend.workspaces.restoreWarning')
                                    : t('frontend.workspaces.archiveWarning')}
                            </span>
                        </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            variant="ghost"
                            onClick={onClose}
                        >
                            {t('common.cancel')}
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => {
                                void onSubmit();
                            }}
                            className="px-6 bg-success/80 hover:bg-success text-success-foreground border-none transition-all shadow-lg shadow-emerald-900/20"
                        >
                            {mode === 'restore'
                                ? t('frontend.workspaces.bulkRestore')
                                : t('frontend.workspaces.bulkArchive')}
                        </Button>
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

    return (
        <AnimatePresence>
            {isOpen && (
                <Modal isOpen={isOpen} onClose={onClose} title={t('frontend.workspaces.bulkDelete')}>
                    <div className="space-y-4 pt-2">
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                            <p className="text-sm text-destructive/90 leading-relaxed font-light">
                                {t('frontend.workspaces.deleteConfirmation')}{' '}
                                <span className="font-semibold text-foreground">
                                    {count} {t('frontend.sidebar.workspaces').toLowerCase()}
                                </span>
                                ?
                                <span className="block mt-1 typo-caption text-destructive/70 font-normal opacity-80">
                                    {t('frontend.workspaces.deleteWarning')}
                                </span>
                            </p>
                        </div>
                        <DeleteFilesCheckbox
                            checked={deleteFiles}
                            onChange={setDeleteFiles}
                            t={t}
                        />
                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                variant="ghost"
                                onClick={onClose}
                            >
                                {t('common.cancel')}
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={() => {
                                    void onSubmit(deleteFiles);
                                }}
                                className="px-6 shadow-lg shadow-destructive/20"
                            >
                                {t('frontend.workspaces.bulkDelete')}
                            </Button>
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
    <div className={C_WORKSPACEMODALS_1}>
        <Checkbox
            id="delete-files"
            checked={checked}
            onCheckedChange={(checked) => onChange(typeof checked === 'boolean' ? checked : false)}
            className="w-5 h-5 border-border/50 bg-muted/20 data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
        />
        <div className="flex flex-col select-none cursor-pointer" onClick={() => onChange(!checked)}>
            <Label htmlFor="delete-files" className="text-sm font-medium text-foreground group-hover:text-destructive transition-colors cursor-pointer">
                {t('frontend.workspaces.deleteWorkspaceFiles')}
            </Label>
            {checked && (
                <span className="text-sm text-destructive font-bold animate-pulse">
                    {t('frontend.workspaceModals.permanentDeletionWarning')}
                </span>
            )}
        </div>
    </div>
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
            key={editingWorkspace?.id ?? 'edit-empty'}
            workspace={editingWorkspace}
            onClose={() => setEditingWorkspace(null)}
            form={editForm}
            setForm={setEditForm}
            onSubmit={handleUpdateWorkspace}
            t={t}
        />
        <DeleteWorkspaceModal
            key={deletingWorkspace?.id ?? 'delete-empty'}
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
            key={isBulkArchiving ? 'bulk-archive-open' : 'bulk-archive-closed'}
            isOpen={isBulkArchiving}
            count={selectedCount}
            mode={bulkArchiveMode}
            onClose={() => setIsBulkArchiving(false)}
            onSubmit={() => handleBulkArchive(bulkArchiveMode !== 'restore')}
            t={t}
        />
        <BulkDeleteModal
            key={isBulkDeleting ? 'bulk-delete-open' : 'bulk-delete-closed'}
            isOpen={isBulkDeleting}
            count={selectedCount}
            onClose={() => setIsBulkDeleting(false)}
            onSubmit={handleBulkDelete}
            t={t}
        />
    </>
);

