import { TerminalComponent } from '@renderer/features/projects/components/ide/Terminal';
import { ProjectEnvironmentTab } from '@renderer/features/projects/components/ProjectEnvironmentTab';
import { ProjectGitTab } from '@renderer/features/projects/components/ProjectGitTab';
import { ProjectIssuesTab } from '@renderer/features/projects/components/ProjectIssuesTab';
import { ProjectLogsTab } from '@renderer/features/projects/components/ProjectLogsTab';
import { ProjectSettingsPanel } from '@renderer/features/projects/components/ProjectSettingsPanel';
import { ProjectTodoTab } from '@renderer/features/projects/components/ProjectTodoTab';
import { FileSearchResult } from '@shared/types/common';
import React from 'react';

import type { GroupedModels } from '@/features/models/utils/model-fetcher';
import { Language } from '@/i18n';
import { AgentDefinition, AppSettings, CodexUsage, Project, ProjectAnalysis, ProjectDashboardTab, ProjectStats, QuotaResponse } from '@/types';

import { OpenFile } from '../../hooks/useProjectDashboard';

import { AgentTab } from './AgentTab';
import { AnalysisTab } from './AnalysisTab';
import { FilesTab } from './FilesTab';
import { OverviewTab } from './OverviewTab';
import { DangerZone, SearchResults } from './ProjectDashboardSubComponents';

interface ProjectDashboardTabsProps {
    activeTab: ProjectDashboardTab
    project: Project
    projectRoot: string
    analysis: ProjectAnalysis
    stats: ProjectStats | null
    loading: boolean
    t: (key: string) => string
    language: Language
    isEditingName: boolean
    isEditingDesc: boolean
    editName: string
    editDesc: string
    setIsEditingName: (v: boolean) => void
    setIsEditingDesc: (v: boolean) => void
    setEditName: (v: string) => void
    setEditDesc: (v: string) => void
    handleSaveName: () => void | Promise<void>
    handleSaveDesc: () => void | Promise<void>
    analyzeProject: () => void | Promise<void>
    onOpenLogoGenerator?: () => void
    onDelete?: () => void
    searchQuery: string
    setSearchQuery: (v: string) => void
    isSearching: boolean
    handleSearch: () => Promise<void>
    searchResults: FileSearchResult[]
    handleFileSelect: (path: string, line?: number) => Promise<void>
    openFiles: OpenFile[]
    activeFile: string | null
    setActiveFile: (path: string | null) => void
    closeFile: (e: React.MouseEvent, path: string) => void
    setOpenFiles: (files: OpenFile[]) => void
    selectedFolder: string | null
    onUpdate: (updates: Partial<Project>) => Promise<void>
    availableAgents: AgentDefinition[]
    groupedModels?: GroupedModels
    quotas?: { accounts: QuotaResponse[] } | null
    codexUsage?: { accounts: { usage: CodexUsage }[] } | null
    settings?: AppSettings | null
    selectedProvider?: string
    selectedModel?: string
    onSelectModel?: (provider: string, model: string) => void
    formatBytes: (bytes: number) => string
    CodeCodeIcon: React.ComponentType<{ className?: string }>
}

export const ProjectDashboardTabsContent: React.FC<ProjectDashboardTabsProps> = (props) => {
    const {
        activeTab,
        project,
        projectRoot,
        t,
        language,
        onDelete,
        onUpdate,
        searchQuery,
        setSearchQuery,
        isSearching,
        handleSearch,
        searchResults,
        handleFileSelect,
        analysis,
        availableAgents
    } = props;

    // Use a record for tab content to significantly reduce cyclomatic complexity
    const tabContent: Record<string, React.ReactNode> = {
        overview: <OverviewTab {...props} />,
        files: <FilesTab {...props} />,
        analysis: <AnalysisTab {...props} />,
        agent: <AgentTab {...props} />,
        todo: (
            <div className="h-full overflow-hidden animate-in fade-in duration-500">
                <ProjectTodoTab projectRoot={projectRoot} t={t} />
            </div>
        ),
        search: (
            <div className="space-y-6 overflow-y-auto pr-2 pb-12 animate-in fade-in duration-500">
                <div className="flex gap-2 p-1 bg-muted/10 rounded-xl border border-border/50">
                    <input
                        type="text"
                        placeholder={t('projectDashboard.searchInProject')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { void handleSearch(); } }}
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-3"
                    />
                    <button
                        onClick={() => { void handleSearch(); }}
                        disabled={isSearching ?? searchQuery.trim().length < 2}
                        className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
                    >
                        {isSearching ? t('common.searching') : t('common.search')}
                    </button>
                </div>
                <SearchResults
                    results={searchResults}
                    projectRoot={projectRoot}
                    onSelect={(path, line) => { void handleFileSelect(path, line); }}
                    t={t}
                />
            </div>
        ),
        terminal: (
            <div className="h-full overflow-hidden animate-in fade-in duration-500">
                <TerminalComponent cwd={projectRoot} projectId={project.id} />
            </div>
        ),
        git: (
            <div className="h-full overflow-hidden animate-in fade-in duration-500">
                <ProjectGitTab project={project} t={t} activeTab={activeTab} />
            </div>
        ),
        issues: (
            <div className="h-full overflow-hidden animate-in fade-in duration-500">
                <ProjectIssuesTab
                    analysis={analysis}
                    projectRoot={projectRoot}
                    onOpenFile={(path, line) => { void handleFileSelect(path, line); }}
                    language={language}
                />
            </div>
        ),
        env: (
            <div className="h-full overflow-hidden animate-in fade-in duration-500">
                <ProjectEnvironmentTab projectPath={projectRoot} language={language} />
            </div>
        ),
        logs: (
            <div className="h-full overflow-hidden animate-in fade-in duration-500">
                <ProjectLogsTab projectPath={projectRoot} language={language} />
            </div>
        ),
        settings: (
            <div className="space-y-8 overflow-y-auto pr-2 pb-12 animate-in fade-in duration-500">
                <ProjectSettingsPanel
                    project={project}
                    onUpdate={onUpdate}
                    language={language}
                    availableAgents={availableAgents}
                    onAddMount={() => { }}
                    onRemoveMount={() => { }}
                />
                <DangerZone onDelete={() => { void onDelete?.(); }} t={t} />
            </div>
        )
    };

    return (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-2">
            {tabContent[activeTab] ?? null}
        </div>
    );
};

export const formatBytes = (bytes: number) => {
    if (bytes === 0) { return '0 B'; }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const CodeCodeIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
);
