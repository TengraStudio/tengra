import React, { useState } from 'react'
import { useTranslation } from '@/i18n'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Plus, Calendar, Search, Terminal, ArrowRight, Monitor, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Project, TerminalTab } from '@/types'
import { ProjectWorkspace } from './components/ProjectWorkspace'
import { Language } from '@/i18n'
import { ProjectWizardModal } from './components/ProjectWizardModal'

interface ProjectsPageProps {
    projects: Project[]
    onRefresh: () => void
    selectedProject?: Project | null
    onSelectProject?: (project: Project | null) => void
    language: Language
    tabs: TerminalTab[]
    activeTabId: string | null
    setTabs: (tabs: TerminalTab[] | ((prev: TerminalTab[]) => TerminalTab[])) => void
    setActiveTabId: (id: string | null) => void
    // Model Selector Props
    selectedProvider: string
    selectedModel: string
    onSelectModel: (provider: string, model: string) => void
    groupedModels?: any
    quotas?: any
    codexUsage?: any
    settings?: any
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({
    projects, onRefresh, selectedProject, onSelectProject, language, tabs, activeTabId, setTabs, setActiveTabId,
    selectedProvider, selectedModel, onSelectModel, groupedModels, quotas, codexUsage, settings
}) => {
    const { t } = useTranslation(language)
    const [searchQuery, setSearchQuery] = useState('')

    const [editingProject, setEditingProject] = useState<Project | null>(null)
    const [deletingProject, setDeletingProject] = useState<Project | null>(null)
    const [editForm, setEditForm] = useState({ title: '', description: '' })
    const [showProjectMenu, setShowProjectMenu] = useState<string | null>(null)
    const [showWizard, setShowWizard] = useState(false)

    // Wizard Callbacks
    const handleWizardCreate = async (path: string, name: string, description: string) => {
        try {
            const mounts = [{
                id: `local-${Date.now()}`,
                name: name, // Use project name
                type: 'local',
                rootPath: path
            }]
            await window.electron.db.createProject(
                name,
                path,
                description,
                JSON.stringify(mounts)
            )
            onRefresh()
            setShowWizard(false)
        } catch (error) {
            console.error('Failed to register project:', error)
        }
    }

    const handleImportProject = async () => {
        // Close wizard first or keep it open? Close seems better to switch context.
        // Or we can invoke usage from within wizard, but simpler to lift up.
        setShowWizard(false)

        const result = await window.electron.selectDirectory()
        if (result.success && result.path) {
            const name = result.path.split(/[\\/]/).pop() || 'Untitled Project'
            try {
                const mounts = [{
                    id: `local-${Date.now()}`,
                    name: name, // Use folder name
                    type: 'local',
                    rootPath: result.path
                }]
                await window.electron.db.createProject(
                    name,
                    result.path,
                    result.path, // Description defaults to path
                    JSON.stringify(mounts)
                )
                onRefresh()
            } catch (error) {
                console.error('Failed to import project:', error)
            }
        }
    }

    // Handlers for Edit/Delete
    const handleEditClick = (project: Project, e: React.MouseEvent) => {
        e.stopPropagation()
        setEditingProject(project)
        setEditForm({ title: project.title, description: project.description || '' })
        setShowProjectMenu(null)
    }

    const handleDeleteClick = (project: Project, e: React.MouseEvent) => {
        e.stopPropagation()
        setDeletingProject(project)
        setShowProjectMenu(null)
    }

    const handleUpdateProject = async () => {
        if (!editingProject) return
        try {
            await window.electron.db.updateProject(editingProject.id, editForm)
            setEditingProject(null)
            onRefresh()
        } catch (error) {
            console.error('Failed to update project:', error)
        }
    }

    const handleDeleteProject = async () => {
        if (!deletingProject) return
        try {
            await window.electron.db.deleteProject(deletingProject.id)
            setDeletingProject(null)
            onRefresh()
        } catch (error) {
            console.error('Failed to delete project:', error)
        }
    }

    if (selectedProject) {
        return <ProjectWorkspace
            project={selectedProject}
            onBack={() => onSelectProject?.(null)}
            language={language}
            tabs={tabs}
            activeTabId={activeTabId}
            setTabs={setTabs}
            setActiveTabId={setActiveTabId}
            selectedProvider={selectedProvider}
            selectedModel={selectedModel}
            onSelectModel={onSelectModel}
            groupedModels={groupedModels}
            quotas={quotas}
            codexUsage={codexUsage}
            settings={settings}
        />
    }

    const filteredProjects = projects.filter(p =>
        p?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p?.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="h-full flex flex-col bg-background p-8 overflow-y-auto">
            <div className="max-w-5xl mx-auto w-full space-y-8">

                {/* Header */}
                <div className="flex items-end justify-between border-b border-border/40 pb-6">
                    <div>
                        <h1 className="text-3xl font-light tracking-tight text-foreground">
                            {t('sidebar.projects')}
                        </h1>
                        <p className="text-muted-foreground mt-2 font-light">
                            {t('projects.subtitle') || 'YÃ¶nettiÄŸiniz tÃ¼m Ã§alÄ±ÅŸma alanlarÄ±.'}
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setShowWizard(true)}
                        className="h-12 px-6 bg-foreground text-background hover:bg-foreground/90 rounded-lg font-medium transition-all flex items-center gap-2 shadow-lg shadow-black/5"
                    >
                        <Plus className="w-5 h-5" />
                        {t('projects.newProjectButton') || 'Yeni Proje'}
                    </button>

                    <div className="flex-1 relative group max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-foreground transition-colors" />
                        <input
                            type="text"
                            placeholder={t('projects.searchPlaceholder') || 'Projelerde ara...'}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-muted/30 border-none rounded-lg h-12 pl-11 pr-4 text-foreground focus:ring-1 focus:ring-foreground/20 transition-all placeholder:text-muted-foreground/40"
                        />
                    </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProjects.map((project, i) => (
                        <motion.div
                            key={project.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            onClick={() => onSelectProject?.(project)}
                            className="group bg-card border border-border/60 hover:border-foreground/20 rounded-xl p-5 cursor-pointer transition-all hover:shadow-xl hover:shadow-black/5 flex flex-col gap-4 relative overflow-hidden"
                        >
                            <div className="flex items-start justify-between">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                    <Terminal className="w-5 h-5" />
                                </div>

                                <div className="flex items-center gap-2">
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ArrowRight className="w-5 h-5 text-muted-foreground -rotate-45 group-hover:rotate-0 transition-transform duration-300" />
                                    </div>

                                    {/* Action Menu */}
                                    <div className="relative">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setShowProjectMenu(showProjectMenu === project.id ? null : project.id)
                                            }}
                                            className={cn(
                                                "p-1.5 rounded-md hover:bg-white/10 text-muted-foreground hover:text-white transition-colors",
                                                showProjectMenu === project.id ? "opacity-100 bg-white/10 text-white" : "opacity-0 group-hover:opacity-100"
                                            )}
                                        >
                                            <MoreVertical className="w-4 h-4" />
                                        </button>

                                        {showProjectMenu === project.id && (
                                            <>
                                                <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowProjectMenu(null) }} />
                                                <div
                                                    className="absolute right-0 top-full mt-1 w-40 bg-[#121212] border border-white/10 rounded-lg shadow-xl z-50 py-1"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <button
                                                        onClick={(e) => handleEditClick(project, e)}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 transition-colors text-left"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5 text-blue-400" />
                                                        DÃ¼zenle
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDeleteClick(project, e)}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-red-500/10 text-red-400 transition-colors text-left"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                        Sil
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors truncate">
                                    {project.title}
                                </h3>
                                <p className="text-xs text-muted-foreground/60 truncate mt-1 font-mono">
                                    {project.path}
                                </p>
                            </div>

                            <div className="pt-4 border-t border-border/40 mt-auto flex items-center justify-between text-xs text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {new Date(project.createdAt).toLocaleDateString()}
                                </span>
                                <span className={cn("px-2 py-0.5 rounded-full bg-muted/50 uppercase text-[10px] font-bold tracking-wider", project.status === 'active' ? "text-emerald-500" : "")}>
                                    {project.status || 'Active'}
                                </span>
                            </div>
                        </motion.div>
                    ))}

                    {/* Edit Modal */}
                    <AnimatePresence>
                        {editingProject && (
                            <Modal isOpen={!!editingProject} onClose={() => setEditingProject(null)} title="Projeyi DÃ¼zenle">
                                <div className="space-y-4 pt-2">
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-muted-foreground uppercase">Proje AdÄ±</label>
                                        <input
                                            value={editForm.title}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                                            placeholder="Proje adÄ±..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-muted-foreground uppercase">AÃ§Ä±klama</label>
                                        <textarea
                                            value={editForm.description}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50 min-h-[80px] resize-none"
                                            placeholder="Proje aÃ§Ä±klamasÄ±..."
                                        />
                                    </div>
                                    <div className="flex justify-end gap-2 pt-2">
                                        <button
                                            onClick={() => setEditingProject(null)}
                                            className="px-4 py-2 rounded-lg text-sm hover:bg-white/5 transition-colors"
                                        >
                                            Ä°ptal
                                        </button>
                                        <button
                                            onClick={handleUpdateProject}
                                            disabled={!editForm.title.trim()}
                                            className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                                        >
                                            Kaydet
                                        </button>
                                    </div>
                                </div>
                            </Modal>
                        )}
                    </AnimatePresence>

                    {/* Delete Modal */}
                    <AnimatePresence>
                        {deletingProject && (
                            <Modal isOpen={!!deletingProject} onClose={() => setDeletingProject(null)} title="Projeyi Sil">
                                <div className="space-y-4 pt-2">
                                    <p className="text-sm text-muted-foreground">
                                        Bu projeyi silmek Ã¼zeresiniz: <span className="text-foreground font-medium">{deletingProject.title}</span>.
                                        Bu iÅŸlem sadece Ã§alÄ±ÅŸma alanÄ±ndan kaldÄ±rÄ±r, diskteki dosyalar silinmez.
                                    </p>
                                    <div className="flex justify-end gap-2 pt-2">
                                        <button
                                            onClick={() => setDeletingProject(null)}
                                            className="px-4 py-2 rounded-lg text-sm hover:bg-white/5 transition-colors"
                                        >
                                            Ä°ptal
                                        </button>
                                        <button
                                            onClick={handleDeleteProject}
                                            className="px-4 py-2 rounded-lg text-sm bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                                        >
                                            Sil
                                        </button>
                                    </div>
                                </div>
                            </Modal>
                        )}
                    </AnimatePresence>

                    {/* Project Wizard */}
                    <ProjectWizardModal
                        isOpen={showWizard}
                        onClose={() => setShowWizard(false)}
                        onProjectCreated={handleWizardCreate}
                        onImportProject={handleImportProject}
                    />


                    {filteredProjects.length === 0 && (
                        <div className="col-span-full py-12 text-center border-2 border-dashed border-border/30 rounded-xl">
                            <Monitor className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                            <p className="text-muted-foreground font-medium">Proje bulunamadÄ±.</p>
                            <p className="text-xs text-muted-foreground/50 mt-1">Yeni bir proje oluÅŸturarak baÅŸlayÄ±n.</p>
                        </div>
                    )}
                </div>
            </div>
        </div >
    )
}
