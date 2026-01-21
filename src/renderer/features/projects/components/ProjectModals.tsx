import React from 'react'

import { Modal } from '@/components/ui/modal'
import { AnimatePresence } from '@/lib/framer-motion-compat'
import { Project } from '@/types'

interface ProjectModalsProps {
    editingProject: Project | null
    setEditingProject: (p: Project | null) => void
    deletingProject: Project | null
    setDeletingProject: (p: Project | null) => void
    editForm: { title: string; description: string }
    setEditForm: (f: { title: string; description: string } | ((prev: { title: string; description: string }) => { title: string; description: string })) => void
    handleUpdateProject: () => Promise<void>
    handleDeleteProject: () => Promise<void>
    t: (key: string) => string
}

export const ProjectModals: React.FC<ProjectModalsProps> = ({
    editingProject, setEditingProject, deletingProject, setDeletingProject,
    editForm, setEditForm, handleUpdateProject, handleDeleteProject, t
}) => {
    return (
        <>
            <AnimatePresence>
                {editingProject && (
                    <Modal isOpen={!!editingProject} onClose={() => setEditingProject(null)} title={t('projects.editProject')}>
                        <div className="space-y-4 pt-2">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground uppercase">{t('projects.nameLabel')}</label>
                                <input
                                    value={editForm.title}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                                    placeholder={t('projects.namePlaceholder')}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground uppercase">{t('projects.description')}</label>
                                <textarea
                                    value={editForm.description}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50 min-h-[80px] resize-none"
                                    placeholder={t('projects.projectDescPlaceholder')}
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    onClick={() => setEditingProject(null)}
                                    className="px-4 py-2 rounded-lg text-sm hover:bg-white/5 transition-colors"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    onClick={() => { void handleUpdateProject() }}
                                    disabled={!editForm.title.trim()}
                                    className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                                >
                                    {t('common.save')}
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {deletingProject && (
                    <Modal isOpen={!!deletingProject} onClose={() => setDeletingProject(null)} title={t('projects.deleteProject')}>
                        <div className="space-y-4 pt-2">
                            <p className="text-sm text-muted-foreground">
                                {t('projects.deleteConfirmation')} <span className="text-foreground font-medium">{deletingProject.title}</span>.
                                {t('projects.deleteWarning')}
                            </p>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    onClick={() => setDeletingProject(null)}
                                    className="px-4 py-2 rounded-lg text-sm hover:bg-white/5 transition-colors"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    onClick={() => { void handleDeleteProject() }}
                                    className="px-4 py-2 rounded-lg text-sm bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                                >
                                    {t('common.delete')}
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </>
    )
}
