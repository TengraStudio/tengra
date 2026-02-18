import { ProjectDashboard } from '@renderer/features/projects/components/ProjectDashboard';
import React from 'react';

import { Language } from '@/i18n';
import { cn } from '@/lib/utils';
import { EditorTab, Project, ProjectDashboardTab, WorkspaceDashboardTab } from '@/types';

import { EditorTabs } from './EditorTabs';
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
    project: Project;
    handleUpdateProject: (updates: Partial<Project>) => Promise<void>;
    onAddMount?: () => void;
    setShowLogoModal: (show: boolean) => void;
    t: (key: string) => string;
    language: Language;
    setDashboardTab: (tab: ProjectDashboardTab) => void;
    onDeleteProject?: () => void;
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
    project,
    handleUpdateProject,
    onAddMount,
    setShowLogoModal,
    t,
    language,
    setDashboardTab,
    onDeleteProject,
    selectedEntry,
    onOpenFile,
}) => {
    return (
        <div className="flex-1 flex flex-col min-w-0 bg-background relative">
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
                        emptyState={null}
                    />
                </div>

                {dashboardTab !== 'editor' && (
                    <div className="absolute inset-0 z-10 bg-background animate-in fade-in duration-200">
                        <ProjectDashboard
                            project={project}
                            onUpdate={handleUpdateProject}
                            onAddMount={onAddMount}
                            onOpenLogoGenerator={() => setShowLogoModal(true)}
                            language={language}
                            activeTab={
                                dashboardTab === 'terminal'
                                    ? 'overview'
                                    : (dashboardTab as ProjectDashboardTab)
                            }
                            onTabChange={setDashboardTab}
                            onDelete={onDeleteProject}
                            selectedEntry={selectedEntry}
                            onOpenFile={onOpenFile}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
