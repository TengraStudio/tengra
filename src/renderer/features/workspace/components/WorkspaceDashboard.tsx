import { TerminalComponent } from '@renderer/features/workspace/components/ide/Terminal';
import { ProjectCodeTab } from '@renderer/features/workspace/components/ProjectCodeTab';
import { ProjectEnvironmentTab } from '@renderer/features/workspace/components/ProjectEnvironmentTab';
import { ProjectFilesTab } from '@renderer/features/workspace/components/ProjectFilesTab';
import { ProjectGitTab } from '@renderer/features/workspace/components/ProjectGitTab';
import { ProjectLogsTab } from '@renderer/features/workspace/components/ProjectLogsTab';
import { ProjectOverviewTab } from '@renderer/features/workspace/components/ProjectOverviewTab';
import { ProjectSearchTab } from '@renderer/features/workspace/components/ProjectSearchTab';
import { ProjectSettingsPanel } from '@renderer/features/workspace/components/ProjectSettingsPanel';
import { ProjectTodoTab } from '@renderer/features/workspace/components/ProjectTodoTab';
import { useProjectDashboardLogic } from '@renderer/features/workspace/hooks/useProjectDashboardLogic';
import { Project } from '@shared/types/project';
import { RefreshCw } from 'lucide-react';

import { Language } from '@/i18n';
import { ProjectDashboardTab } from '@/types';

interface ProjectDashboardProps {
    project: Project;
    onUpdate?: (updates: Partial<Project>) => Promise<void>;
    onAddMount?: () => void;
    onOpenLogoGenerator?: () => void;
    language?: Language;
    activeTab?: ProjectDashboardTab;
    onTabChange?: (tab: ProjectDashboardTab) => void;
    onDelete?: () => void;
    selectedEntry?: { path: string; isDirectory: boolean } | null;
    onOpenFile?: (path: string, line?: number) => void;
}

export const ProjectDashboard = ({
    project,
    onUpdate,
    onAddMount,
    onOpenLogoGenerator,
    language = 'en',
    activeTab: externalTab,
    onTabChange,
    onDelete,
    selectedEntry,
    onOpenFile,
}: ProjectDashboardProps) => {
    const { t, state, actions, editing } = useProjectDashboardLogic({
        project,
        activeTab: externalTab,
        onTabChange,
        selectedEntry,
        onOpenFile,
        onUpdate,
        language,
    });

    const analysis = state.analysis;

    if (state.loading && !analysis) {
        return (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
                <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                {t('workspaceDashboard.analyzing')}
            </div>
        );
    }

    if (!analysis) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                {t('workspaceDashboard.noWorkspace')}
            </div>
        );
    }

    const tabs: Record<string, JSX.Element> = {
        overview: (
            <ProjectOverviewTab
                project={project}
                projectRoot={state.projectRoot}
                analysis={analysis}
                stats={state.stats}
                loading={state.loading}
                isEditingName={editing.isEditingName}
                setIsEditingName={editing.setIsEditingName}
                editName={editing.editName}
                setEditName={editing.setEditName}
                handleSaveName={editing.handleSaveName}
                isEditingDesc={editing.isEditingDesc}
                setIsEditingDesc={editing.setIsEditingDesc}
                editDesc={editing.editDesc}
                setEditDesc={editing.setEditDesc}
                handleSaveDesc={editing.handleSaveDesc}
                onOpenLogoGenerator={onOpenLogoGenerator}
                analyzeProject={actions.analyzeProject}
                onDelete={onDelete}
                t={t}
            />
        ),
        terminal: (
            <div className="h-full bg-black/40 rounded-xl border border-border/50 overflow-hidden p-1">
                <TerminalComponent cwd={state.projectRoot} />
            </div>
        ),
        tasks: (
            <div className="h-full overflow-hidden">
                <ProjectTodoTab
                    project={project}
                    onUpdate={onUpdate}
                    t={t}
                />
            </div>
        ),
        search: (
            <ProjectSearchTab
                searchQuery={state.searchQuery}
                setSearchQuery={actions.setSearchQuery}
                handleSearch={actions.handleSearch}
                isSearching={state.isSearching}
                searchResults={state.searchResults}
                projectRoot={state.projectRoot}
                handleFileSelect={(path, line) => {
                    void actions.handleFileSelect(path, line);
                }}
                t={t}
            />
        ),
        code: (
            <ProjectCodeTab
                projectRoot={state.projectRoot}
                onOpenFile={(path, line) => {
                    void actions.handleFileSelect(path, line);
                }}
                t={t}
            />
        ),
        settings: (
            <div className="h-full">
                <ProjectSettingsPanel
                    project={project}
                    onUpdate={async updates => {
                        await onUpdate?.(updates);
                    }}
                    language={language}
                    availableAgents={state.availableAgents}
                    onAddMount={() => {
                        onAddMount?.();
                    }}
                    onRemoveMount={id => {
                        const nextMounts = project.mounts.filter(m => m.id !== id);
                        void onUpdate?.({ mounts: nextMounts });
                    }}
                />
            </div>
        ),
        git: <ProjectGitTab project={project} t={t} activeTab={state.activeTab} />,
        env: <ProjectEnvironmentTab projectPath={state.projectRoot} language={language} />,
        environment: <ProjectEnvironmentTab projectPath={state.projectRoot} language={language} />,
        logs: <ProjectLogsTab projectPath={state.projectRoot} language={language} />,
        files: (
            <ProjectFilesTab
                openFiles={state.openFiles}
                activeFile={state.activeFile}
                setActiveFile={actions.setActiveFile}
                setOpenFiles={actions.setOpenFiles}
                closeFile={actions.closeFile}
                activeFileObj={state.activeFileObj}
                selectedFolder={state.selectedFolder}
                projectRoot={state.projectRoot}
                t={t}
            />
        ),
    };

    return (
        <div className="h-full flex flex-col bg-background text-foreground">
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-2">
                {tabs[state.activeTab]}
            </div>
        </div>
    );
};
