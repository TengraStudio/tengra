import { ProjectDashboard } from '@renderer/features/projects/components/ProjectDashboard';
import React from 'react';

import { TerminalPanel } from '@/features/terminal/TerminalPanel';
import { Language } from '@/i18n';
import { cn } from '@/lib/utils';
import { EditorTab, Project, ProjectDashboardTab, TerminalTab, WorkspaceDashboardTab } from '@/types';

import { EditorTabs } from './EditorTabs';
import { WorkspaceEditor } from './WorkspaceEditor';

interface WorkspaceMainProps {
    dashboardTab: WorkspaceDashboardTab
    openTabs: EditorTab[]
    activeTabId: string | null
    setActiveEditorTabId: (id: string | null) => void
    closeTab: (id: string) => void
    activeTab: EditorTab | null
    updateTabContent: (content: string) => void
    project: Project
    handleUpdateProject: (updates: Partial<Project>) => Promise<void>
    setShowLogoModal: (show: boolean) => void
    language: Language
    setDashboardTab: (tab: ProjectDashboardTab) => void
    onDeleteProject?: () => void
    showTerminal: boolean
    setShowTerminal: (show: boolean) => void
    terminalHeight: number
    setTerminalHeight: (h: number) => void
    tabs: TerminalTab[]
    activeTabIdTerminal: string | null
    setTabsTerminal: (tabs: TerminalTab[] | ((prev: TerminalTab[]) => TerminalTab[])) => void
    setActiveTabIdTerminal: (id: string | null) => void
    selectedEntry?: { path: string; isDirectory: boolean } | null
    onOpenFile?: (path: string) => void
}

export const WorkspaceMain: React.FC<WorkspaceMainProps> = ({
    dashboardTab, openTabs, activeTabId, setActiveEditorTabId, closeTab,
    activeTab, updateTabContent, project, handleUpdateProject,
    setShowLogoModal, language, setDashboardTab, onDeleteProject,
    showTerminal, setShowTerminal, terminalHeight, setTerminalHeight,
    tabs, activeTabIdTerminal, setTabsTerminal, setActiveTabIdTerminal,
    selectedEntry, onOpenFile
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
                    />
                </div>
            )}

            <div className="flex-1 relative overflow-hidden">
                <div className={cn("absolute inset-0 z-0", dashboardTab !== 'editor' && "pointer-events-none opacity-0")}>
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
                            onOpenLogoGenerator={() => setShowLogoModal(true)}
                            language={language}
                            activeTab={dashboardTab as ProjectDashboardTab}
                            onTabChange={setDashboardTab}
                            onDelete={onDeleteProject}
                            selectedEntry={selectedEntry}
                            onOpenFile={onOpenFile}
                        />
                    </div>
                )}

                <div
                    className={cn(
                        "absolute bottom-0 left-0 right-0 bg-background border-t border-white/10 z-30",
                        !showTerminal && "hidden"
                    )}
                    style={{ height: terminalHeight }}
                >
                    <TerminalPanel
                        isOpen={showTerminal}
                        onToggle={() => setShowTerminal(!showTerminal)}
                        height={terminalHeight}
                        onHeightChange={setTerminalHeight}
                        projectPath={project.path}
                        tabs={tabs}
                        activeTabId={activeTabIdTerminal}
                        setTabs={setTabsTerminal}
                        setActiveTabId={setActiveTabIdTerminal}
                    />
                </div>
            </div>
        </div>
    );
};
