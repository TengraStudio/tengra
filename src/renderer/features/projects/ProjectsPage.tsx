import { ProjectWizardModal } from '@renderer/features/projects/components/ProjectWizardModal';
import { ProjectWorkspace } from '@renderer/features/projects/components/ProjectWorkspace';
import { AppSettings } from '@shared/types';
import { CodexUsage, QuotaResponse } from '@shared/types/quota';
import { Archive, ArrowDownUp, Edit, FolderOpen, Monitor, Trash2 } from 'lucide-react';
import React, { memo, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';

import { GroupedModels } from '@/features/models/utils/model-fetcher';
import { Language, useTranslation } from '@/i18n';
import { Message, Project, TerminalTab } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import { ProjectCard, ProjectCardSurfaceProvider } from './components/ProjectCard';
import { ProjectModals } from './components/ProjectModals';
import { ProjectsHeader } from './components/ProjectsHeader';
import {
    loadProjectListPreferences,
    saveProjectListPreferences,
    useProjectListStateMachine,
} from './hooks/useProjectListStateMachine';

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
    const LIST_SETTINGS_STORAGE_KEY = 'projects.listView.settings.v1';
    const [searchQuery, setSearchQuery] = useState('');
    const [showWizard, setShowWizard] = useState(false);
    const [showProjectMenu, setShowProjectMenu] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [sortBy, setSortBy] = useState<'title' | 'updatedAt' | 'createdAt'>('updatedAt');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [listPreset, setListPreset] = useState<'recent' | 'oldest' | 'name-az' | 'name-za'>('recent');

    React.useEffect(() => {
        const savedPreferences = loadProjectListPreferences(LIST_SETTINGS_STORAGE_KEY, {
            viewMode: 'grid',
            sortBy: 'updatedAt',
            sortDirection: 'desc',
            listPreset: 'recent',
        });
        setViewMode(savedPreferences.viewMode);
        setSortBy(savedPreferences.sortBy);
        setSortDirection(savedPreferences.sortDirection);
        setListPreset(savedPreferences.listPreset);
    }, []);

    React.useEffect(() => {
        saveProjectListPreferences(LIST_SETTINGS_STORAGE_KEY, {
            viewMode,
            sortBy,
            sortDirection,
            listPreset,
        });
    }, [viewMode, sortBy, sortDirection, listPreset]);

    const normalizedSearchQuery = React.useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);
    const projectSearchIndex = React.useMemo(() => {
        const index = new Map<string, string>();
        for (const project of projects) {
            index.set(
                project.id,
                `${project.title} ${project.description}`.toLowerCase()
            );
        }
        return index;
    }, [projects]);
    const sortedProjectsByActiveSort = React.useMemo(() => {
        const direction = sortDirection === 'asc' ? 1 : -1;
        return [...projects].sort((a, b) => {
            if (sortBy === 'title') {
                return a.title.localeCompare(b.title) * direction;
            }
            return (a[sortBy] - b[sortBy]) * direction;
        });
    }, [projects, sortBy, sortDirection]);
    const filteredProjects = React.useMemo(
        () =>
            normalizedSearchQuery === ''
                ? sortedProjectsByActiveSort
                : sortedProjectsByActiveSort.filter(project =>
                    (projectSearchIndex.get(project.id) ?? '').includes(normalizedSearchQuery)
                ),
        [sortedProjectsByActiveSort, normalizedSearchQuery, projectSearchIndex]
    );
    const sortedProjects = filteredProjects;

    const toggleSort = (nextSortBy: 'title' | 'updatedAt' | 'createdAt') => {
        if (sortBy === nextSortBy) {
            setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setSortBy(nextSortBy);
        setSortDirection(nextSortBy === 'title' ? 'asc' : 'desc');
    };

    const applyListPreset = (preset: 'recent' | 'oldest' | 'name-az' | 'name-za') => {
        setListPreset(preset);
        switch (preset) {
            case 'oldest':
                setSortBy('updatedAt');
                setSortDirection('asc');
                break;
            case 'name-az':
                setSortBy('title');
                setSortDirection('asc');
                break;
            case 'name-za':
                setSortBy('title');
                setSortDirection('desc');
                break;
            default:
                setSortBy('updatedAt');
                setSortDirection('desc');
                break;
        }
    };

    const exportProjectsList = () => {
        const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
        const lines = [
            ['title', 'description', 'path', 'status', 'updatedAt', 'createdAt'].join(','),
            ...sortedProjects.map(project => [
                escapeCsv(project.title),
                escapeCsv(project.description ?? ''),
                escapeCsv(project.path),
                escapeCsv(project.status ?? ''),
                new Date(project.updatedAt).toISOString(),
                new Date(project.createdAt).toISOString(),
            ].join(',')),
        ];

        const csv = lines.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `projects-${new Date().toISOString().slice(0, 10)}.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

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
    const bulkArchiveMode = React.useMemo(() => {
        const selectedProjects = sortedProjects.filter(project =>
            sm.state.selectedProjectIds.has(project.id)
        );
        if (selectedProjects.length === 0) {
            return 'archive' as const;
        }
        return selectedProjects.every(project => project.status === 'archived')
            ? ('restore' as const)
            : ('archive' as const);
    }, [sm.state.selectedProjectIds, sortedProjects]);

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
                    bulkArchiveMode={bulkArchiveMode}
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
                    totalCount={sortedProjects.length}
                    onToggleSelectAll={sm.toggleSelectAll}
                    onBulkDelete={sm.startBulkDelete}
                    onBulkArchive={sm.startBulkArchive}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    listPreset={listPreset}
                    onListPresetChange={(preset) =>
                        applyListPreset(preset as 'recent' | 'oldest' | 'name-az' | 'name-za')
                    }
                    onExportList={exportProjectsList}
                    t={t}
                />

                {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <ProjectCardSurfaceProvider
                            onSelect={(p) => onSelectProject?.(p)}
                            activeMenuId={showProjectMenu}
                            setActiveMenuId={setShowProjectMenu}
                            onEdit={(p, e) => { setShowProjectMenu(null); sm.startEdit(p, e); }}
                            onDelete={(p, e) => { setShowProjectMenu(null); sm.startDelete(p, e); }}
                            onArchive={(p) => sm.startArchive(p)}
                            t={t}
                        >
                            {sortedProjects.map((project, i) => (
                                <ProjectCard
                                    key={project.id}
                                    project={project}
                                    index={i}
                                    isSelected={sm.state.selectedProjectIds.has(project.id)}
                                    onToggleSelection={() => sm.toggleSelection(project.id)}
                                />
                            ))}
                        </ProjectCardSurfaceProvider>
                        {sortedProjects.length === 0 && (
                            <div className="col-span-full py-12 text-center border-2 border-dashed border-border/30 rounded-xl">
                                <Monitor className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                                <p className="text-muted-foreground font-medium">{t('projects.noProjects')}</p>
                                <p className="text-xs text-muted-foreground/50 mt-1">{t('projects.startNewProject')}</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="rounded-xl border border-border/40 overflow-hidden">
                        <div className="grid grid-cols-[40px_2fr_2fr_1fr_160px] gap-3 px-4 py-3 bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            <div />
                            <button onClick={() => toggleSort('title')} className="flex items-center gap-1 text-left hover:text-foreground transition-colors">
                                Name <ArrowDownUp className="w-3 h-3" />
                            </button>
                            <div>Path</div>
                            <button onClick={() => toggleSort('updatedAt')} className="flex items-center gap-1 text-left hover:text-foreground transition-colors">
                                Updated <ArrowDownUp className="w-3 h-3" />
                            </button>
                            <div className="text-right">Actions</div>
                        </div>
                        <Virtuoso
                            style={{ height: 520 }}
                            data={sortedProjects}
                            itemContent={(_index, project) => (
                                <div className="grid grid-cols-[40px_2fr_2fr_1fr_160px] gap-3 px-4 py-3 border-t border-border/20 items-center text-sm">
                                    <div>
                                        <input
                                            type="checkbox"
                                            checked={sm.state.selectedProjectIds.has(project.id)}
                                            onChange={() => sm.toggleSelection(project.id)}
                                            className="w-4 h-4 rounded border-border/40 bg-muted/30 text-foreground focus:ring-foreground/20 cursor-pointer"
                                        />
                                    </div>
                                    <button
                                        onClick={() => onSelectProject?.(project)}
                                        className="text-left min-w-0"
                                        title={project.description || t('projects.noDescription')}
                                    >
                                        <div className="font-medium truncate">{project.title}</div>
                                        <div className="text-xs text-muted-foreground truncate">{project.description || t('projects.noDescription')}</div>
                                    </button>
                                    <div className="text-xs text-muted-foreground truncate font-mono">{project.path}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {new Date(project.updatedAt).toLocaleDateString()}
                                    </div>
                                    <div className="flex items-center justify-end gap-1">
                                        <button onClick={() => onSelectProject?.(project)} className="p-2 rounded-md hover:bg-muted/30" title="Open">
                                            <FolderOpen className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => sm.startEdit(project)} className="p-2 rounded-md hover:bg-muted/30" title={t('common.edit')}>
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => sm.startArchive(project)}
                                            className="p-2 rounded-md hover:bg-muted/30"
                                            title={
                                                project.status === 'archived'
                                                    ? t('common.unarchive') || 'Restore'
                                                    : t('projects.archiveProject')
                                            }
                                        >
                                            <Archive className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => sm.startDelete(project)} className="p-2 rounded-md hover:bg-destructive/10 text-destructive" title={t('common.delete')}>
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        />
                        {sortedProjects.length === 0 && (
                            <div className="py-12 text-center border-t border-border/20">
                                <Monitor className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                                <p className="text-muted-foreground font-medium">{t('projects.noProjects')}</p>
                                <p className="text-xs text-muted-foreground/50 mt-1">{t('projects.startNewProject')}</p>
                            </div>
                        )}
                    </div>
                )}

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
                    bulkArchiveMode={bulkArchiveMode}
                    t={t}
                />

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
            </div>
        </div >
    );
};

export const MemoizedProjectsPage = memo(ProjectsPage);

