/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
    FC,
    lazy,
    Suspense,
    useEffect,
    useRef,
    useState,
} from 'react';

import { MarkdownPreview } from '@/features/workspace/workspace-explorer/MarkdownPreview';

import { LazyWorkspaceEditor, LoadingSpinner } from '@/components/lazy';
import { EditorTabs } from '@/features/workspace/workspace-explorer/EditorTabs';
import { Language } from '@/i18n';
import { cn } from '@/lib/utils';
import { EditorTab, Workspace, WorkspaceDashboardTab } from '@/types';
import { performanceMonitor } from '@/utils/performance';

const WorkspaceDashboard = lazy(() =>
    import('@/features/workspace/workspace-dashboard/WorkspaceDashboard').then(m => ({
        default: m.WorkspaceDashboard,
    }))
);

interface WorkspaceMainProps {
    dashboardTab: WorkspaceDashboardTab;
    openTabs: EditorTab[];
    activeTabId: string | null;
    setActiveEditorTabId: (id: string | null) => void;
    closeTab: (id: string) => void;
    togglePinTab: (id: string) => void;
    closeAllTabs: () => void;
    closeTabsToRight: (id: string) => void;
    closeOtherTabs: (id: string) => void;
    copyTabAbsolutePath: (id: string) => Promise<void>;
    copyTabRelativePath: (id: string) => Promise<void>;
    revealTabInExplorer: (id: string) => Promise<void>;
    activeTab: EditorTab | null;
    updateTabContent: (tabId: string, content: string) => void;
    revertTab: (tabId: string) => void;
    saveActiveTab: (options?: { silent?: boolean }) => Promise<void>;
    workspace: Workspace;
    handleUpdateWorkspace: (updates: Partial<Workspace>) => Promise<void>;
    onAddMount?: () => void;
    onUploadLogo: () => void;
    t: (key: string) => string;
    language: Language;
    setDashboardTab: (tab: WorkspaceDashboardTab) => void;
    onDeleteWorkspace?: () => void;
    selectedEntry?: { path: string; isDirectory: boolean } | null;
    onOpenFile?: (path: string, line?: number) => void;
    editorBottomInsetPx?: number;
}

export const WorkspaceMain: FC<WorkspaceMainProps> = ({
    dashboardTab,
    openTabs,
    activeTabId,
    setActiveEditorTabId,
    closeTab,
    togglePinTab,
    closeAllTabs,
    closeTabsToRight,
    closeOtherTabs,
    copyTabAbsolutePath,
    copyTabRelativePath,
    revealTabInExplorer,
    activeTab,
    updateTabContent,
    revertTab,
    saveActiveTab,
    workspace,
    handleUpdateWorkspace,
    onAddMount,
    onUploadLogo,
    t,
    language,
    setDashboardTab,
    onDeleteWorkspace,
    selectedEntry,
    onOpenFile,
    editorBottomInsetPx = 0,
}) => {
    const [showMarkdownPreview, setShowMarkdownPreview] = useState(false);
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
        if (!performanceMonitor.hasMark('workspace:shell:ready')) {
            performanceMonitor.mark('workspace:shell:ready');
        }
    }, []);

    const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
        const touch = event.changedTouches[0];
        if (!touch) {
            return;
        }
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
        const start = touchStartRef.current;
        const touch = event.changedTouches[0];
        if (!start || !touch) {
            return;
        }
        const deltaX = touch.clientX - start.x;
        const deltaY = touch.clientY - start.y;
        touchStartRef.current = null;
        if (Math.abs(deltaX) < 70 || Math.abs(deltaX) < Math.abs(deltaY)) {
            return;
        }
        if (deltaX > 0) {
            setDashboardTab('overview');
            return;
        }
        setDashboardTab('files');
    };

    // Close preview if tab changes to a non-markdown file
    useEffect(() => {
        if (showMarkdownPreview && (!activeTab || !activeTab.name.toLowerCase().endsWith('.md'))) {
            setShowMarkdownPreview(false);
        }
    }, [activeTab, showMarkdownPreview]);

    return (
        <div
            className="flex-1 flex flex-col min-w-0 bg-background relative"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            {openTabs.length > 0 && dashboardTab === 'editor' && (
                <div className="z-20 relative">
                    <EditorTabs
                        workspaceId={workspace.id}
                        openTabs={openTabs}
                        activeTabId={activeTabId}
                        setActiveTabId={setActiveEditorTabId}
                        closeTab={closeTab}
                        togglePinTab={togglePinTab}
                        closeAllTabs={closeAllTabs}
                        closeTabsToRight={closeTabsToRight}
                        closeOtherTabs={closeOtherTabs}
                        revertTab={revertTab}
                copyTabAbsolutePath={copyTabAbsolutePath}
                        copyTabRelativePath={copyTabRelativePath}
                        revealTabInExplorer={revealTabInExplorer}
                        workspacePath={workspace.path}
                        onOpenFile={onOpenFile}
                        showMarkdownPreview={showMarkdownPreview}
                        onToggleMarkdownPreview={() => setShowMarkdownPreview(!showMarkdownPreview)}
                        t={t}
                    />
                </div>
            )}

            <div className="flex-1 relative overflow-hidden">
                <div
                    className={cn(
                        'absolute inset-0 z-0 flex',
                        dashboardTab !== 'editor' && 'pointer-events-none opacity-0'
                    )}
                >
                    <div className={cn("relative transition-all duration-300 ease-in-out", showMarkdownPreview ? "w-1/2 border-r border-border/40" : "w-full")}>
                        <LazyWorkspaceEditor
                            activeTab={activeTab}
                            updateTabContent={(content) => activeTab && updateTabContent(activeTab.id, content)}
                            saveActiveTab={saveActiveTab}
                            autoSaveEnabled={Boolean(workspace.advancedOptions?.autoSave)}
                            workspaceKey={workspace.id}
                            workspacePath={workspace.path}
                            workspaceEditorSettings={workspace.editor}
                            editorBottomInsetPx={editorBottomInsetPx}
                            onOpenFile={onOpenFile}
                            emptyState={null}
                        />
                    </div>
                    {showMarkdownPreview && activeTab && (
                        <div className="w-1/2 animate-in slide-in-from-right-4 duration-300 ease-in-out">
                            <MarkdownPreview 
                                content={activeTab.content} 
                                t={t} 
                            />
                        </div>
                    )}
                </div>

                {dashboardTab !== 'editor' && (
                    <Suspense
                        fallback={
                            <div className="absolute inset-0 z-10 bg-background">
                                <div className="flex h-full items-center justify-center">
                                    <LoadingSpinner message={t('common.loading')} />
                                </div>
                            </div>
                        }
                    >
                        <div className="absolute inset-0 z-10 bg-background animate-in fade-in duration-200">
                            <WorkspaceDashboard
                                workspace={workspace}
                                onUpdate={handleUpdateWorkspace}
                                onAddMount={onAddMount}
                                onUploadLogo={onUploadLogo}
                                language={language}
                                activeTab={
                                    dashboardTab === 'terminal'
                                        ? 'overview'
                                        : (dashboardTab as WorkspaceDashboardTab)
                                }
                                onTabChange={setDashboardTab}
                                onDelete={onDeleteWorkspace}
                                selectedEntry={selectedEntry}
                                onOpenFile={onOpenFile}
                            />
                        </div>
                    </Suspense>
                )}
            </div>
        </div>
    );
};

