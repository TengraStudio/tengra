import { ProjectWizardModal } from '@renderer/features/projects/components/ProjectWizardModal';
import { ProjectWorkspace } from '@renderer/features/projects/components/ProjectWorkspace';
import { AppSettings } from '@shared/types';
import { CodexUsage, QuotaResponse } from '@shared/types/quota';
import { Monitor } from 'lucide-react';
import React, { memo, useState } from 'react';

import { appLogger } from '@main/logging/logger';
import { GroupedModels } from '@/features/models/utils/model-fetcher';
import { Language, useTranslation } from '@/i18n';
import { Message, Project, TerminalTab } from '@/types';

import { ProjectCard } from './components/ProjectCard';
import { ProjectModals } from './components/ProjectModals';
import { ProjectsHeader } from './components/ProjectsHeader';
import { useProjectListStateMachine } from './hooks/useProjectListStateMachine';

interface ProjectsPageProps {
    projects: Project[]
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
    projects, selectedProject, onSelectProject, language, tabs, activeTabId, setTabs, setActiveTabId,
    selectedProvider, selectedModel, onSelectModel, groupedModels, quotas, codexUsage, settings,
    sendMessage, messages, isLoading
}) => {
    const { t } = useTranslation(language);
    const [searchQuery, setSearchQuery] = useState('');
    const [showWizard, setShowWizard] = useState(false);
    const [showProjectMenu, setShowProjectMenu] = useState<string | null>(null);

    const filteredProjects = React.useMemo(() => projects.filter(p =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase())
    ), [projects, searchQuery]);

    // Use state machine for coordinated state management
    const sm = useProjectListStateMachine({
        filteredProjects,
        onError: (error: unknown) => appLogger.error('ProjectsPage', 'Operation failed', error instanceof Error ? error : new Error(String(error)))
    });

    // Adapter: Map state machine state to modal props
    const editingProject = sm.state.status === 'editing' ? sm.state.targetProject : null;
    const deletingProject = sm.state.status === 'deleting' ? sm.state.targetProject : null;
    const isArchiving = sm.state.status === 'archiving' ? sm.state.targetProject : null;
    const isBulkDeleting = sm.state.status === 'bulk_deleting';
    const isBulkArchiving = sm.state.status === 'bulk_archiving';

    if (selectedProject) {
        return (
            <>
                <ProjectWorkspace
                    project={selectedProject}
                    onBack={() => onSelectProject?.(null)}
                    onDeleteProject={() => sm.startDelete(selectedProject)}
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
                    setDeletingProject={(p) => p ? sm.startDelete(p) : sm.cancelDelete()}
                    isArchiving={isArchiving}
                    setIsArchiving={(p) => p ? sm.startArchive(p) : sm.cancelArchive()}
                    isBulkDeleting={isBulkDeleting}
                    setIsBulkDeleting={(v) => v ? sm.startBulkDelete() : sm.cancelBulkDelete()}
                    isBulkArchiving={isBulkArchiving}
                    setIsBulkArchiving={(v) => v ? sm.startBulkArchive() : sm.cancelBulkArchive()}
                    selectedCount={sm.state.selectedProjectIds.size}
                    editForm={sm.state.editForm}
                    setEditForm={sm.updateEditForm}
                    handleUpdateProject={sm.executeUpdate}
                    handleDeleteProject={sm.executeDelete}
                    handleArchiveProject={sm.executeArchive}
                    handleBulkDelete={sm.executeBulkDelete}
                    handleBulkArchive={sm.executeBulkArchive}
                    t={t}
                />
            </>
        );
    }

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
                    // Selection props
                    selectedCount={sm.state.selectedProjectIds.size}
                    totalCount={filteredProjects.length}
                    onToggleSelectAll={sm.toggleSelectAll}
                    onBulkDelete={sm.startBulkDelete}
                    onBulkArchive={sm.startBulkArchive}
                    t={t}
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
                            onEdit={(p, e) => { setShowProjectMenu(null); sm.startEdit(p, e); }}
                            onDelete={(p, e) => { setShowProjectMenu(null); sm.startDelete(p, e); }}
                            onArchive={(p) => sm.startArchive(p)}
                            // Selection
                            isSelected={sm.state.selectedProjectIds.has(project.id)}
                            onToggleSelection={() => sm.toggleSelection(project.id)}
                            t={t}
                        />
                    ))}

                    <ProjectModals
                        editingProject={editingProject}
                        setEditingProject={(p) => p ? sm.startEdit(p) : sm.cancelEdit()}
                        deletingProject={deletingProject}
                        setDeletingProject={(p) => p ? sm.startDelete(p) : sm.cancelDelete()}
                        isArchiving={isArchiving}
                        setIsArchiving={(p) => p ? sm.startArchive(p) : sm.cancelArchive()}
                        isBulkDeleting={isBulkDeleting}
                        setIsBulkDeleting={(v) => v ? sm.startBulkDelete() : sm.cancelBulkDelete()}
                        isBulkArchiving={isBulkArchiving}
                        setIsBulkArchiving={(v) => v ? sm.startBulkArchive() : sm.cancelBulkArchive()}
                        selectedCount={sm.state.selectedProjectIds.size}
                        editForm={sm.state.editForm}
                        setEditForm={sm.updateEditForm}
                        handleUpdateProject={sm.executeUpdate}
                        handleDeleteProject={sm.executeDelete}
                        handleArchiveProject={sm.executeArchive}
                        handleBulkDelete={sm.executeBulkDelete}
                        handleBulkArchive={sm.executeBulkArchive}
                        t={t}
                    />

                    {/* Project Wizard */}
                    <ProjectWizardModal
                        isOpen={showWizard}
                        onClose={() => setShowWizard(false)}
                        onProjectCreated={(...args) => {
                            void sm.executeCreate(...args).then((success: boolean) => {
                                if (success) { setShowWizard(false); }
                            });
                        }}
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
    );
};

export const MemoizedProjectsPage = memo(ProjectsPage);

