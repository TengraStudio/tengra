import React from 'react';

import { Modal } from '@/components/ui/modal';
import { AnimatePresence } from '@/lib/framer-motion-compat';
import { Project } from '@/types';

interface ProjectModalsProps {
    editingProject: Project | null
    setEditingProject: (p: Project | null) => void
    deletingProject: Project | null
    setDeletingProject: (p: Project | null) => void
    isArchiving: Project | null
    setIsArchiving: (p: Project | null) => void
    isBulkDeleting: boolean
    setIsBulkDeleting: (b: boolean) => void
    isBulkArchiving: boolean
    setIsBulkArchiving: (b: boolean) => void
    selectedCount: number
    editForm: { title: string; description: string }
    setEditForm: (f: { title: string; description: string } | ((prev: { title: string; description: string }) => { title: string; description: string })) => void
    handleUpdateProject: () => Promise<void>
    handleDeleteProject: (deleteFiles: boolean) => Promise<void>
    handleArchiveProject: () => Promise<void>
    handleBulkDelete: (deleteFiles: boolean) => Promise<void>
    handleBulkArchive: (isArchived: boolean) => Promise<void>
    t: (key: string) => string
}

const EditProjectModal: React.FC<{
    project: Project | null;
    onClose: () => void;
    form: { title: string; description: string };
    setForm: (f: { title: string; description: string } | ((prev: { title: string; description: string }) => { title: string; description: string })) => void;
    onSubmit: () => Promise<void>;
    t: (key: string) => string;
}> = ({ project, onClose, form, setForm, onSubmit, t }) => (
    <AnimatePresence>
        {project && (
            <Modal isOpen={!!project} onClose={onClose} title={t('projects.editProject')}>
                <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground uppercase">{t('projects.nameLabel')}</label>
                        <input
                            value={form.title}
                            onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full bg-muted/30 border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                            placeholder={t('projects.namePlaceholder')}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground uppercase">{t('projects.description')}</label>
                        <textarea
                            value={form.description}
                            onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                            className="w-full bg-muted/30 border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50 min-h-[80px] resize-none"
                            placeholder={t('projects.projectDescPlaceholder')}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm hover:bg-muted/50 transition-colors">
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={() => { void onSubmit(); }}
                            disabled={!form.title.trim()}
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

const DeleteProjectModal: React.FC<{
    project: Project | null;
    onClose: () => void;
    onSubmit: (deleteFiles: boolean) => Promise<void>;
    t: (key: string) => string;
}> = ({ project, onClose, onSubmit, t }) => {
    const [deleteFiles, setDeleteFiles] = React.useState(false);
    React.useEffect(() => { if (!project) { setDeleteFiles(false); } }, [project]);

    return (
        <AnimatePresence>
            {project && (
                <Modal isOpen={!!project} onClose={onClose} title={t('projects.deleteProject')}>
                    <div className="space-y-4 pt-2">
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                            <p className="text-sm text-destructive">
                                {t('projects.deleteConfirmation')} <span className="font-bold text-foreground">{project.title}</span>?
                                <span className="block mt-1 text-xs text-destructive/70 font-medium italic">{t('projects.deleteWarning')}</span>
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

const ArchiveProjectModal: React.FC<{
    project: Project | null;
    onClose: () => void;
    onSubmit: () => Promise<void>;
    t: (key: string) => string;
}> = ({ project, onClose, onSubmit, t }) => (
    <AnimatePresence>
        {project && (
            <Modal isOpen={!!project} onClose={onClose} title={t('projects.archiveProject')}>
                <div className="space-y-4 pt-2">
                    <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                        <p className="text-sm text-success/90 leading-relaxed font-light">
                            {t('projects.archiveConfirmation')} <span className="font-semibold text-foreground">{project.title}</span>?
                            <span className="block mt-1 text-xs text-success font-normal italic opacity-80">{t('projects.archiveWarning')}</span>
                        </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm hover:bg-white/5 transition-colors font-light">
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={() => { void onSubmit(); }}
                            className="px-6 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-foreground hover:bg-emerald-700 active:scale-95 transition-all shadow-lg shadow-emerald-900/20"
                        >
                            {project.status === 'archived' ? t('common.unarchive') || 'Unarchive' : t('projects.archiveProject')}
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
    onClose: () => void;
    onSubmit: () => Promise<void>;
    t: (key: string) => string;
}> = ({ isOpen, count, onClose, onSubmit, t }) => (
    <AnimatePresence>
        {isOpen && (
            <Modal isOpen={isOpen} onClose={onClose} title={t('projects.bulkArchive')}>
                <div className="space-y-4 pt-2">
                    <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                        <p className="text-sm text-success/90 leading-relaxed font-light">
                            {t('projects.archiveConfirmation')} <span className="font-semibold text-foreground">{count} {t('sidebar.projects').toLowerCase()}</span>?
                            <span className="block mt-1 text-xs text-success font-normal italic opacity-80">{t('projects.archiveWarning')}</span>
                        </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm hover:bg-white/5 transition-colors font-light">
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={() => { void onSubmit(); }}
                            className="px-6 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-foreground hover:bg-emerald-700 active:scale-95 transition-all shadow-lg shadow-emerald-900/20"
                        >
                            {t('projects.bulkArchive')}
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
    React.useEffect(() => { if (!isOpen) { setDeleteFiles(false); } }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <Modal isOpen={isOpen} onClose={onClose} title={t('projects.bulkDelete')}>
                    <div className="space-y-4 pt-2">
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                            <p className="text-sm text-destructive/90 leading-relaxed font-light">
                                {t('projects.deleteConfirmation')} <span className="font-semibold text-foreground">{count} {t('sidebar.projects').toLowerCase()}</span>?
                                <span className="block mt-1 text-xs text-destructive/70 font-normal italic opacity-80">{t('projects.deleteWarning')}</span>
                            </p>
                        </div>
                        <DeleteFilesCheckbox checked={deleteFiles} onChange={setDeleteFiles} t={t} />
                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm hover:bg-white/5 transition-colors font-light">
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={() => { void onSubmit(deleteFiles); }}
                                className="px-6 py-2 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-95 transition-all shadow-lg shadow-destructive/20"
                            >
                                {t('projects.bulkDelete')}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </AnimatePresence>
    );
};

const DeleteFilesCheckbox: React.FC<{ checked: boolean; onChange: (b: boolean) => void; t: (key: string) => string }> = ({ checked, onChange, t }) => (
    <label className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50 cursor-pointer hover:bg-muted/50 transition-colors group">
        <div className="relative flex items-center justify-center w-5 h-5">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
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
                {t('projects.deleteProjectFiles')}
            </span>
            {checked && (
                <span className="text-xxs text-destructive font-bold uppercase animate-pulse">
                    ⚠️ Permanent Deletion
                </span>
            )}
        </div>
    </label>
);

export const ProjectModals: React.FC<ProjectModalsProps> = ({
    editingProject, setEditingProject, deletingProject, setDeletingProject,
    isArchiving, setIsArchiving, isBulkDeleting, setIsBulkDeleting,
    isBulkArchiving, setIsBulkArchiving, selectedCount,
    editForm, setEditForm, handleUpdateProject, handleDeleteProject,
    handleArchiveProject, handleBulkDelete, handleBulkArchive, t
}) => (
    <>
        <EditProjectModal
            project={editingProject}
            onClose={() => setEditingProject(null)}
            form={editForm}
            setForm={setEditForm}
            onSubmit={handleUpdateProject}
            t={t}
        />
        <DeleteProjectModal
            project={deletingProject}
            onClose={() => setDeletingProject(null)}
            onSubmit={handleDeleteProject}
            t={t}
        />
        <ArchiveProjectModal
            project={isArchiving}
            onClose={() => setIsArchiving(null)}
            onSubmit={handleArchiveProject}
            t={t}
        />
        <BulkArchiveModal
            isOpen={isBulkArchiving}
            count={selectedCount}
            onClose={() => setIsBulkArchiving(false)}
            onSubmit={() => handleBulkArchive(true)}
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
