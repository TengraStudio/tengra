import { WorkspaceDashboard } from '@renderer/features/workspace/components/WorkspaceDashboard';
import React from 'react';

import { Language } from '@/i18n';
import { cn } from '@/lib/utils';
import { EditorTab, Workspace, WorkspaceDashboardTab } from '@/types';

import { EditorTabs } from './EditorTabs';
import { WorkspaceContentHub } from './WorkspaceContentHub';
import { WorkspaceEditor } from './WorkspaceEditor';

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
    updateTabContent: (content: string) => void;
    workspace: Workspace;
    handleUpdateWorkspace: (updates: Partial<Workspace>) => Promise<void>;
    onAddMount?: () => void;
    setShowLogoModal: (show: boolean) => void;
    t: (key: string) => string;
    language: Language;
    setDashboardTab: (tab: WorkspaceDashboardTab) => void;
    onDeleteWorkspace?: () => void;
    selectedEntry?: { path: string; isDirectory: boolean } | null;
    onOpenFile?: (path: string) => void;
}

export const WorkspaceMain: React.FC<WorkspaceMainProps> = ({
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
    workspace,
    handleUpdateWorkspace,
    onAddMount,
    setShowLogoModal,
    t,
    language,
    setDashboardTab,
    onDeleteWorkspace,
    selectedEntry,
    onOpenFile,
}) => {
    const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);

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

    return (
        <div
            className="flex-1 flex flex-col min-w-0 bg-background relative"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            {openTabs.length > 0 && dashboardTab === 'editor' && (
                <div className="z-20 relative">
                    <EditorTabs
                        openTabs={openTabs}
                        activeTabId={activeTabId}
                        setActiveTabId={setActiveEditorTabId}
                        closeTab={closeTab}
                        togglePinTab={togglePinTab}
                        closeAllTabs={closeAllTabs}
                        closeTabsToRight={closeTabsToRight}
                        closeOtherTabs={closeOtherTabs}
                        copyTabAbsolutePath={copyTabAbsolutePath}
                        copyTabRelativePath={copyTabRelativePath}
                        revealTabInExplorer={revealTabInExplorer}
                        t={t}
                    />
                </div>
            )}

            <div className="flex-1 relative overflow-hidden">
                <div
                    className={cn(
                        'absolute inset-0 z-0',
                        dashboardTab !== 'editor' && 'pointer-events-none opacity-0'
                    )}
                >
                    <WorkspaceEditor
                        activeTab={activeTab}
                        updateTabContent={updateTabContent}
                        workspaceKey={workspace.id}
                        workspacePath={workspace.path}
                        emptyState={null}
                    />
                </div>

                {dashboardTab !== 'editor' && (
                    <div className="absolute inset-0 z-10 bg-background animate-in fade-in duration-200">
                        <WorkspaceDashboard
                            workspace={workspace}
                            onUpdate={handleUpdateWorkspace}
                            onAddMount={onAddMount}
                            onOpenLogoGenerator={() => setShowLogoModal(true)}
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
                        <WorkspaceContentHub workspace={workspace} onApplyTemplate={handleUpdateWorkspace} />
                    </div>
                )}
            </div>
        </div>
    );
};
