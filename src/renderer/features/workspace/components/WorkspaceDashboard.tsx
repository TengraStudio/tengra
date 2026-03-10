import { TerminalComponent } from '@renderer/features/workspace/components/ide/Terminal';
import { WorkspaceEnvironmentTab } from '@renderer/features/workspace/components/WorkspaceEnvironmentTab';
import { WorkspaceFilesTab } from '@renderer/features/workspace/components/WorkspaceFilesTab';
import { WorkspaceGitTab } from '@renderer/features/workspace/components/WorkspaceGitTab';
import { WorkspaceLogsTab } from '@renderer/features/workspace/components/WorkspaceLogsTab';
import { WorkspaceOverviewTab } from '@renderer/features/workspace/components/WorkspaceOverviewTab';
import { WorkspaceSearchTab } from '@renderer/features/workspace/components/WorkspaceSearchTab';
import { WorkspaceSettingsPanel } from '@renderer/features/workspace/components/WorkspaceSettingsPanel';
import { WorkspaceTodoTab } from '@renderer/features/workspace/components/WorkspaceTodoTab';
import { useWorkspaceDashboardLogic } from '@renderer/features/workspace/hooks/useWorkspaceDashboardLogic';
import { RefreshCw } from 'lucide-react';

import { Language } from '@/i18n';
import type { Workspace, WorkspaceDashboardTab } from '@/types';

interface WorkspaceDashboardProps {
    workspace: Workspace;
    onUpdate?: (updates: Partial<Workspace>) => Promise<void>;
    onAddMount?: () => void;
    onOpenLogoGenerator?: () => void;
    language?: Language;
    activeTab?: WorkspaceDashboardTab;
    onTabChange?: (tab: WorkspaceDashboardTab) => void;
    onDelete?: () => void;
    selectedEntry?: { path: string; isDirectory: boolean } | null;
    onOpenFile?: (path: string, line?: number) => void;
}

export const WorkspaceDashboard = ({
    workspace,
    onUpdate,
    onAddMount,
    onOpenLogoGenerator,
    language = 'en',
    activeTab: externalTab,
    onTabChange,
    onDelete,
    selectedEntry,
    onOpenFile,
}: WorkspaceDashboardProps) => {
    const { t, state, actions, editing } = useWorkspaceDashboardLogic({
        workspace,
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
            <WorkspaceOverviewTab
                workspace={workspace}
                workspaceRoot={state.workspaceRoot}
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
                analyzeWorkspace={actions.analyzeWorkspace}
                onDelete={onDelete}
                t={t}
            />
        ),
        terminal: (
            <div className="h-full bg-black/40 rounded-xl border border-border/50 overflow-hidden p-1">
                <TerminalComponent cwd={state.workspaceRoot} />
            </div>
        ),
        tasks: (
            <div className="h-full overflow-hidden">
                <WorkspaceTodoTab
                    workspace={workspace}
                    onUpdate={onUpdate}
                    t={t}
                />
            </div>
        ),
        search: (
            <WorkspaceSearchTab
                searchQuery={state.searchQuery}
                setSearchQuery={actions.setSearchQuery}
                handleSearch={actions.handleSearch}
                isSearching={state.isSearching}
                searchResults={state.searchResults}
                workspaceRoot={state.workspaceRoot}
                handleFileSelect={(path, line) => {
                    void actions.handleFileSelect(path, line);
                }}
                t={t}
            />
        ),
        settings: (
            <div className="h-full">
                <WorkspaceSettingsPanel
                    workspace={workspace}
                    onUpdate={async updates => {
                        await onUpdate?.(updates);
                    }}
                    language={language}
                    availableAgents={state.availableAgents}
                    onAddMount={() => {
                        onAddMount?.();
                    }}
                    onRemoveMount={id => {
                        const nextMounts = workspace.mounts.filter(m => m.id !== id);
                        void onUpdate?.({ mounts: nextMounts });
                    }}
                />
            </div>
        ),
        git: <WorkspaceGitTab workspace={workspace} t={t} activeTab={state.activeTab} />,
        env: <WorkspaceEnvironmentTab workspacePath={state.workspaceRoot} language={language} />,
        environment: <WorkspaceEnvironmentTab workspacePath={state.workspaceRoot} language={language} />,
        logs: <WorkspaceLogsTab workspacePath={state.workspaceRoot} language={language} />,
        files: (
            <WorkspaceFilesTab
                openFiles={state.openFiles}
                activeFile={state.activeFile}
                setActiveFile={actions.setActiveFile}
                setOpenFiles={actions.setOpenFiles}
                closeFile={actions.closeFile}
                activeFileObj={state.activeFileObj}
                selectedFolder={state.selectedFolder}
                workspaceRoot={state.workspaceRoot}
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
