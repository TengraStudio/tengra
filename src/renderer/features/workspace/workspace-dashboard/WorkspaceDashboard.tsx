import { WorkspaceOverviewTab } from '@renderer/features/workspace/components';
import { useWorkspaceDashboardLogic } from '@renderer/features/workspace/hooks/useWorkspaceDashboardLogic';
import { RefreshCw } from 'lucide-react';
import React from 'react';

import { LoadingSpinner } from '@/components/lazy';
import { Language } from '@/i18n';
import type { Workspace, WorkspaceDashboardTab } from '@/types';
import { performanceMonitor } from '@/utils/performance';

const TerminalComponent = React.lazy(() =>
    import('@renderer/features/workspace/components/ide').then(m => ({
        default: m.TerminalComponent,
    }))
);

const WorkspaceEnvironmentTab = React.lazy(() =>
    import('@renderer/features/workspace/components').then(m => ({
        default: m.WorkspaceEnvironmentTab,
    }))
);

const WorkspaceFilesTab = React.lazy(() =>
    import('@renderer/features/workspace/components').then(m => ({
        default: m.WorkspaceFilesTab,
    }))
);

const WorkspaceGitTab = React.lazy(() =>
    import('@renderer/features/workspace/components').then(m => ({
        default: m.WorkspaceGitTab,
    }))
);

const WorkspaceLogsTab = React.lazy(() =>
    import('@renderer/features/workspace/components').then(m => ({
        default: m.WorkspaceLogsTab,
    }))
);

const WorkspaceSearchTab = React.lazy(() =>
    import('@renderer/features/workspace/components').then(m => ({
        default: m.WorkspaceSearchTab,
    }))
);

const WorkspaceSettingsPanel = React.lazy(() =>
    import('@renderer/features/workspace/components').then(m => ({
        default: m.WorkspaceSettingsPanel,
    }))
);

const WorkspaceTodoTab = React.lazy(() =>
    import('@renderer/features/workspace/components').then(m => ({
        default: m.WorkspaceTodoTab,
    }))
);

const WorkspaceDashboardPanelLoader = ({ message }: { message: string }) => (
    <div className="flex h-full min-h-0 items-center justify-center">
        <LoadingSpinner message={message} />
    </div>
);

interface WorkspaceDashboardProps {
    workspace: Workspace;
    onUpdate?: (updates: Partial<Workspace>) => Promise<void>;
    onAddMount?: () => void;
    onUploadLogo?: () => void;
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
    onUploadLogo,
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

    React.useEffect(() => {
        if (state.activeTab === 'overview' && !performanceMonitor.hasMark('workspace:dashboard:ready')) {
            performanceMonitor.mark('workspace:dashboard:ready');
        }
    }, [state.activeTab]);

    const analysis = state.analysis;
    const renderLazyPanel = (content: React.ReactNode) => (
        <React.Suspense fallback={<WorkspaceDashboardPanelLoader message={t('common.loading')} />}>
            {content}
        </React.Suspense>
    );

    if (state.activeTab === 'overview' && state.loading && !analysis) {
        return (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
                <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                {t('workspaceDashboard.analyzing')}
            </div>
        );
    }

    if (state.activeTab === 'overview' && !analysis) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                {t('workspaceDashboard.noWorkspace')}
            </div>
        );
    }

    const tabs: Record<string, () => JSX.Element | null> = {
        overview: () => (
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
                onUploadLogo={onUploadLogo}
                analyzeWorkspace={actions.analyzeWorkspace}
                onDelete={onDelete}
                t={t}
            />
        ),
        terminal: () => renderLazyPanel(
            <div className="h-full bg-background/70 rounded-xl border border-border/50 overflow-hidden p-1">
                <TerminalComponent cwd={state.workspaceRoot} />
            </div>
        ),
        tasks: () => renderLazyPanel(
            <div className="h-full overflow-hidden">
                <WorkspaceTodoTab
                    workspace={workspace}
                    onUpdate={onUpdate}
                    t={t}
                />
            </div>
        ),
        search: () => renderLazyPanel(
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
        settings: () => renderLazyPanel(
            <div className="h-full">
                <WorkspaceSettingsPanel
                    workspace={workspace}
                    onUpdate={async updates => {
                        await onUpdate?.(updates);
                    }}
                    language={language}
                    onDelete={onDelete}
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
        git: () => renderLazyPanel(
            <WorkspaceGitTab workspace={workspace} t={t} activeTab={state.activeTab} />
        ),
        env: () => renderLazyPanel(
            <WorkspaceEnvironmentTab workspacePath={state.workspaceRoot} language={language} />
        ),
        environment: () => renderLazyPanel(
            <WorkspaceEnvironmentTab workspacePath={state.workspaceRoot} language={language} />
        ),
        logs: () => renderLazyPanel(
            <WorkspaceLogsTab workspacePath={state.workspaceRoot} language={language} />
        ),
        files: () => renderLazyPanel(
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
                {tabs[state.activeTab]?.() ?? null}
            </div>
        </div>
    );
};
