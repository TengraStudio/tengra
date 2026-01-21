import { ProjectWizardModal } from '@renderer/features/projects/components/ProjectWizardModal'
import { ProjectWorkspace } from '@renderer/features/projects/components/ProjectWorkspace'
import { AppSettings } from '@shared/types'
import { CodexUsage, QuotaResponse } from '@shared/types/quota'
import { ProjectMount } from '@shared/types/renderer'
import { Monitor } from 'lucide-react'
import React, { memo, useState } from 'react'

import { GroupedModels } from '@/features/models/utils/model-fetcher'
import { Language, useTranslation } from '@/i18n'
import { Message, Project, TerminalTab } from '@/types'

import { ProjectCard } from './components/ProjectCard'
import { ProjectModals } from './components/ProjectModals'
import { ProjectsHeader } from './components/ProjectsHeader'

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
    selectedProvider: string
    selectedModel: string
    onSelectModel: (provider: string, model: string) => void
    groupedModels?: GroupedModels
    quotas?: { accounts: QuotaResponse[] } | null
    codexUsage?: { accounts: { usage: CodexUsage }[] } | null
    settings?: AppSettings | null
    sendMessage?: (content?: string) => void
    messages?: Message[]
    isLoading?: boolean
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({
    projects, onRefresh, selectedProject, onSelectProject, language, tabs, activeTabId, setTabs, setActiveTabId,
    selectedProvider, selectedModel, onSelectModel, groupedModels, quotas, codexUsage, settings,
    sendMessage, messages, isLoading
}) => {
    const { t } = useTranslation(language)
    const [searchQuery, setSearchQuery] = useState('')

    const [editingProject, setEditingProject] = useState<Project | null>(null)
    const [deletingProject, setDeletingProject] = useState<Project | null>(null)
    const [editForm, setEditForm] = useState({ title: '', description: '' })
    const [showProjectMenu, setShowProjectMenu] = useState<string | null>(null)
    const [showWizard, setShowWizard] = useState(false)

    // Wizard Callbacks
    const handleWizardCreate = async (path: string, name: string, description: string, userMounts?: ProjectMount[]) => {
        try {
            const mounts = userMounts && userMounts.length > 0 ? userMounts : [{
                id: `local-${Date.now()}`,
                name: name,
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

    // Handlers for Edit/Delete
    const handleEditClick = (project: Project, e: React.MouseEvent) => {
        e.stopPropagation()
        setEditingProject(project)
        setEditForm({ title: project.title, description: project.description })
        setShowProjectMenu(null)
    }

    const handleDeleteClick = (project: Project, e: React.MouseEvent) => {
        e.stopPropagation()
        setDeletingProject(project)
        setShowProjectMenu(null)
    }

    const handleUpdateProject = async () => {
        if (!editingProject) { return }
        try {
            await window.electron.db.updateProject(editingProject.id, editForm)
            setEditingProject(null)
            onRefresh()
        } catch (error) {
            console.error('Failed to update project:', error)
        }
    }

    const handleDeleteProject = async () => {
        if (!deletingProject) { return }
        try {
            await window.electron.db.deleteProject(deletingProject.id)
            setDeletingProject(null)
            onRefresh()
        } catch (error) {
            console.error('Failed to delete project:', error)
        }
    }

    if (selectedProject) {
        return (
            <>
                <ProjectWorkspace
                    project={selectedProject}
                    onBack={() => onSelectProject?.(null)}
                    onDeleteProject={() => setDeletingProject(selectedProject)}
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
                    codexUsage={codexUsage ?? undefined}
                    settings={settings ?? undefined}
                    sendMessage={sendMessage}
                    messages={messages}
                    isLoading={isLoading}
                />
                <ProjectModals
                    editingProject={null}
                    setEditingProject={() => { }}
                    deletingProject={deletingProject}
                    setDeletingProject={setDeletingProject}
                    editForm={editForm}
                    setEditForm={setEditForm}
                    handleUpdateProject={handleUpdateProject}
                    handleDeleteProject={handleDeleteProject}
                    t={t}
                />
            </>
        )
    }

    const filteredProjects = projects.filter(p =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="h-full flex flex-col bg-background p-8 overflow-y-auto">
            <div className="max-w-5xl mx-auto w-full space-y-8">

                {/* Header and Actions */}
                <ProjectsHeader
                    title={t('sidebar.projects')}
                    subtitle={t('projects.subtitle')}
                    newProjectLabel={t('projects.newProjectButton')}
                    searchPlaceholder={t('projects.searchPlaceholder')}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    onNewProject={() => setShowWizard(true)}
                />

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProjects.map((project, i) => (
                        <ProjectCard
                            key={project.id}
                            project={project}
                            index={i}
                            onSelect={(p) => onSelectProject?.(p)}
                            showMenu={showProjectMenu === project.id}
                            setShowMenu={setShowProjectMenu}
                            onEdit={handleEditClick}
                            onDelete={handleDeleteClick}
                            t={t}
                        />
                    ))}

                    <ProjectModals
                        editingProject={editingProject}
                        setEditingProject={setEditingProject}
                        deletingProject={deletingProject}
                        setDeletingProject={setDeletingProject}
                        editForm={editForm}
                        setEditForm={setEditForm}
                        handleUpdateProject={handleUpdateProject}
                        handleDeleteProject={handleDeleteProject}
                        t={t}
                    />

                    {/* Project Wizard */}
                    <ProjectWizardModal
                        isOpen={showWizard}
                        onClose={() => setShowWizard(false)}
                        onProjectCreated={(...args) => { void handleWizardCreate(...args) }}
                        language={language}
                    />


                    {filteredProjects.length === 0 && (
                        <div className="col-span-full py-12 text-center border-2 border-dashed border-border/30 rounded-xl">
                            <Monitor className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                            <p className="text-muted-foreground font-medium">{t('projects.noProjects')}</p>
                            <p className="text-xs text-muted-foreground/50 mt-1">{t('projects.startNewProject')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div >
    )
}

export const MemoizedProjectsPage = memo(ProjectsPage)
