/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconRefresh } from '@tabler/icons-react';
import React from 'react';

import { LoadingSpinner } from '@/components/lazy';
import { useWorkspaceDashboardLogic } from '@/features/workspace/hooks/useWorkspaceDashboardLogic';
import { Language } from '@/i18n';
import type { Workspace, WorkspaceDashboardTab } from '@/types';
import { performanceMonitor } from '@/utils/performance';

import { WorkspaceOverviewTab } from './WorkspaceOverviewTab';

const TerminalComponent = React.lazy(() =>
    import('@/features/workspace/components/ide').then(m => ({
        default: m.TerminalComponent,
    }))
);

const WorkspaceFilesTab = React.lazy(() =>
    import('./WorkspaceFilesTab').then(m => ({
        default: m.WorkspaceFilesTab,
    }))
);

const WorkspaceGitTab = React.lazy(() =>
    import('./WorkspaceGitTab').then(m => ({
        default: m.WorkspaceGitTab,
    }))
);


const WorkspaceSearchTab = React.lazy(() =>
    import('./WorkspaceSearchTab').then(m => ({
        default: m.WorkspaceSearchTab,
    }))
);

const WorkspaceSettingsPanel = React.lazy(() =>
    import('./WorkspaceSettingsPanel').then(m => ({
        default: m.WorkspaceSettingsPanel,
    }))
);

const WorkspaceTodoTab = React.lazy(() =>
    import('./WorkspaceTodoTab').then(m => ({
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
                <IconRefresh className="w-6 h-6 animate-spin mr-2" />
                {t('frontend.workspaceDashboard.analyzing')}
            </div>
        );
    }

    if (state.activeTab === 'overview' && !analysis) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                {t('frontend.workspaceDashboard.noWorkspace')}
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
        settings: () => {
            const handleUpdate = async (updates: Partial<Workspace>) => {
                await onUpdate?.(updates);
            };
            const handleAddMount = () => {
                onAddMount?.();
            };
            const handleRemoveMount = (id: string) => {
                const nextMounts = workspace.mounts.filter(m => m.id !== id);
                void onUpdate?.({ mounts: nextMounts });
            };

            return renderLazyPanel(
                <div className="h-full">
                    <WorkspaceSettingsPanel
                        workspace={workspace}
                        onUpdate={handleUpdate}
                        language={language}
                        onDelete={onDelete}
                        onAddMount={handleAddMount}
                        onRemoveMount={handleRemoveMount}
                    />
                </div>
            );
        },
        git: () => renderLazyPanel(
            <WorkspaceGitTab workspace={workspace} t={t} activeTab={state.activeTab} />
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

