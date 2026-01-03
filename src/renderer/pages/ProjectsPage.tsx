import React, { useState } from 'react'
import { useTranslation } from '../i18n'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Plus, Folder, Calendar, Users, ChevronRight, Search, LayoutGrid, List as ListIcon, MoreVertical, Rocket, X, Tag } from 'lucide-react'
import { Project } from '../types'
import { ProjectWorkspace } from '../components/ProjectWorkspace'
import { Language } from '../i18n'

interface ProjectsPageProps {
    projects: Project[]
    onRefresh: () => void
    selectedProject?: Project | null
    onSelectProject?: (project: Project | null) => void
    language: Language
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({ projects, onRefresh, selectedProject, onSelectProject, language }) => {
    const { t } = useTranslation(language)
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [searchQuery, setSearchQuery] = useState('')

    // Modal State
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [newProjectName, setNewProjectName] = useState('')
    const [newProjectCategory, setNewProjectCategory] = useState('')
    const [isCreating, setIsCreating] = useState(false)

    const handleCreateProject = async () => {
        // Step 2: Select Directory
        const result = await window.electron.selectDirectory()
        if (result.success && result.path) {
            const description = `${result.path} ${t('projects.locationDescription') || 'konumundaki klasör projesi.'}`
            try {
                const mounts = [{
                    id: `local-${Date.now()}`,
                    name: 'Local',
                    type: 'local',
                    rootPath: result.path
                }]
                await window.electron.db.createProject(
                    newProjectName || t('projects.newProject'),
                    result.path,
                    description,
                    JSON.stringify(mounts)
                )
                onRefresh()
                setShowCreateModal(false)
                setNewProjectName('')
                setNewProjectCategory('')
            } catch (error) {
                console.error('Failed to create project:', error)
            }
        }
        setIsCreating(false)
    }

    const startCreationFlow = () => {
        setShowCreateModal(true)
    }

    if (selectedProject) {
        return <ProjectWorkspace project={selectedProject} onBack={() => onSelectProject?.(null)} language={language} />
    }

    const filteredProjects = projects.filter(p =>
        p?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p?.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="h-full flex flex-col bg-background/50 backdrop-blur-3xl overflow-hidden p-8 gap-8">
            {/* Header Area */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-black text-foreground tracking-tight flex items-center gap-3">
                        <Rocket className="text-primary w-10 h-10" />
                        {t('sidebar.projects')}
                    </h1>
                    <p className="text-muted-foreground mt-2 font-medium">{t('projects.subtitle') || 'Ortak akıl ve karmaşık görev yönetimi merkezi.'}</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex bg-muted/20 rounded-lg p-1 border border-border/50">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={cn("p-2 rounded-md transition-all", viewMode === 'grid' ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground")}
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={cn("p-2 rounded-md transition-all", viewMode === 'list' ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground")}
                        >
                            <ListIcon className="w-4 h-4" />
                        </button>
                    </div>
                    <button
                        onClick={startCreationFlow}
                        className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-xl font-bold transition-all shadow-xl shadow-primary/20 hover:scale-105 active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        {t('projects.newProjectButton') || 'YENİ PROJE'}
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-4">
                <div className="flex-1 relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder={t('projects.searchPlaceholder') || 'Projelerde ara...'}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all placeholder:text-muted-foreground/30"
                    />
                </div>
            </div>

            {/* Projects List/Grid */}
            <div className="flex-1 overflow-y-auto pr-4 -mr-4 scrollbar-hide">
                {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <AnimatePresence>
                            {filteredProjects.map((project, i) => (
                                <motion.div
                                    key={project.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    onClick={() => onSelectProject?.(project)}
                                    className="group relative bg-card/40 hover:bg-card/60 border border-border rounded-[28px] p-6 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/5 cursor-pointer flex flex-col gap-4 overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 p-4 translate-x-4 -translate-y-4 group-hover:translate-x-0 group-hover:translate-y-0 transition-all opacity-0 group-hover:opacity-100">
                                        <button className="p-2 hover:bg-white/10 rounded-full text-muted-foreground hover:text-white" onClick={(e) => e.stopPropagation()}>
                                            <MoreVertical className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner",
                                            project.status === 'active' ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-500/20 text-zinc-400"
                                        )}>
                                            <Folder className="w-7 h-7" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors">{project.title}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className={cn("w-2 h-2 rounded-full", project.status === 'active' ? "bg-emerald-500 animate-pulse" : "bg-zinc-500")} />
                                                <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground/60">
                                                    {project.status === 'active' ? (t('common.active') || 'Aktif') : (t('common.draft') || 'Taslak')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <p className="text-sm text-muted-foreground/80 leading-relaxed line-clamp-2 min-h-[40px]">
                                        {project.description}
                                    </p>

                                    <div className="h-px bg-white/5 my-2" />

                                    <div className="flex items-center justify-between text-xs font-medium">
                                        <div className="flex items-center gap-4 text-muted-foreground/60">
                                            <div className="flex items-center gap-1.5">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {(() => {
                                                    const createdAt = project.createdAt instanceof Date ? project.createdAt : new Date(project.createdAt)
                                                    return Number.isNaN(createdAt.getTime()) ? '-' : createdAt.toLocaleDateString()
                                                })()}
                                            </div>
                                            {project.councilConfig && project.councilConfig.enabled && (
                                                <div className="flex items-center gap-1.5 text-primary/80">
                                                    <Users className="w-3.5 h-3.5" />
                                                    {t('projects.councilActive') || 'Konsey Aktif'}
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-2 bg-white/5 rounded-full group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                                            <ChevronRight className="w-4 h-4" />
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {/* Creative Add Card */}
                        <motion.div
                            onClick={startCreationFlow}
                            className="bg-dashed border-2 border-dashed border-white/10 hover:border-primary/40 rounded-[28px] p-8 flex flex-col items-center justify-center gap-4 text-muted-foreground/40 hover:text-primary/60 transition-all group cursor-pointer min-h-[220px]"
                            whileHover={{ scale: 1.02 }}
                        >
                            <div className="w-16 h-16 rounded-full border-2 border-dashed border-current flex items-center justify-center group-hover:rotate-90 transition-transform duration-500">
                                <Plus className="w-8 h-8" />
                            </div>
                            <span className="font-bold tracking-widest text-sm uppercase">{t('projects.createCard') || 'Yeni Proje Oluştur'}</span>
                        </motion.div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="text-center text-muted-foreground py-20">{t('projects.listComingSoon') || 'Liste görünümü yakında eklenecek.'}</div>
                    </div>
                )}
            </div>

            <AnimatePresence>
                {showCreateModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setShowCreateModal(false)}
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative w-full max-w-md bg-card border border-border rounded-3xl p-8 shadow-2xl overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-purple-600" />
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-full text-zinc-500 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="mb-8">
                                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 text-primary">
                                    <Rocket className="w-8 h-8" />
                                </div>
                                <h2 className="text-2xl font-black text-white">{t('projects.createModalTitle') || 'Yeni Proje Oluştur'}</h2>
                                <p className="text-muted-foreground mt-2">{t('projects.createModalDesc') || 'Projeniz için temel bilgileri girin.'}</p>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 ml-1">{t('projects.nameLabel') || 'Proje Adı'}</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={newProjectName}
                                            onChange={(e) => setNewProjectName(e.target.value)}
                                            placeholder={t('projects.namePlaceholder') || 'Örn: AI Asistanı'}
                                            className="w-full bg-white/5 border border-white/10 focus:border-primary/50 rounded-xl px-4 py-3 pl-11 text-white placeholder:text-zinc-600 outline-none transition-all"
                                            autoFocus
                                        />
                                        <Folder className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 ml-1">{t('projects.categoryLabel') || 'Kategori (Opsiyonel)'}</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={newProjectCategory}
                                            onChange={(e) => setNewProjectCategory(e.target.value)}
                                            placeholder={t('projects.categoryPlaceholder') || 'Örn: Geliştirme, Analiz...'}
                                            className="w-full bg-white/5 border border-white/10 focus:border-primary/50 rounded-xl px-4 py-3 pl-11 text-white placeholder:text-zinc-600 outline-none transition-all"
                                        />
                                        <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                                    </div>
                                </div>

                                <button
                                    onClick={() => { setIsCreating(true); handleCreateProject() }}
                                    disabled={!newProjectName.trim() || isCreating}
                                    className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground py-4 rounded-xl font-bold text-lg shadow-lg shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                >
                                    {isCreating ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            {t('projects.selectingFolder') || 'Klasör Seçiliyor...'}
                                        </>
                                    ) : (
                                        <>
                                            {t('projects.selectFolderAndCreate') || 'Klasör Seç & Oluştur'} <ChevronRight className="w-5 h-5" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
