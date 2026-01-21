import { LogoGeneratorModal } from '@renderer/features/projects/components/LogoGeneratorModal'
import { CommandStrip } from '@renderer/features/projects/components/workspace/CommandStrip'
import { WorkspaceToolbar } from '@renderer/features/projects/components/workspace/WorkspaceToolbar'
import { WorkspaceExplorer } from '@renderer/features/projects/components/WorkspaceExplorer'
import { useProjectState } from '@renderer/features/projects/hooks/useProjectState'
import { useProjectWorkspaceController } from '@renderer/features/projects/hooks/useProjectWorkspaceController'
import { useWorkspaceManager } from '@renderer/features/projects/hooks/useWorkspaceManager'
import React from 'react'

import { GroupedModels } from '@/features/models/utils/model-fetcher'
import { Language } from '@/i18n'
import { cn } from '@/lib/utils'
import { AppSettings, CodexUsage, Message, Project, QuotaResponse, TerminalTab } from '@/types'

import { WorkspaceMain } from './workspace/WorkspaceMain'
import { WorkspaceNotifications } from './workspace/WorkspaceNotifications'
import { WorkspaceSidebar } from './workspace/WorkspaceSidebar'

// Types are now shared from @/types

interface ProjectWorkspaceProps {
    project: Project
    onBack: () => void
    onUpdateProject?: (updates: Partial<Project>) => Promise<void>
    onDeleteProject?: () => void
    language: Language
    // Terminal props passed from parent
    tabs: TerminalTab[]
    activeTabId: string | null
    setTabs: (tabs: TerminalTab[] | ((prev: TerminalTab[]) => TerminalTab[])) => void
    setActiveTabId: (id: string | null) => void
    // AI / Model props
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

export const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = ({
    project,
    onBack,
    onUpdateProject,
    onDeleteProject,
    language,
    tabs,
    activeTabId,
    setTabs,
    setActiveTabId,
    selectedProvider,
    selectedModel,
    onSelectModel,
    groupedModels,
    quotas,
    codexUsage,
    settings,
    sendMessage: _sendMessage,
    messages,
    isLoading
}) => {
    const {
        ps, wm, activityLog, setActivityLog,
        handleUpdateProject, runCouncil, toggleAgent, t
    } = useProjectWorkspaceController({ project, language, onUpdateProject })



    return (
        <div className="h-full flex flex-col bg-background relative overflow-hidden">
            {/* Top Toolbar */}
            <WorkspaceToolbar
                project={project}
                projectName={project.title}
                onNameChange={(title) => { void handleUpdateProject({ title }) }}
                handleRunProject={() => wm.setDashboardTab('terminal')}
                onBack={onBack}
                language={language}
                dashboardTab={wm.dashboardTab}
                onDashboardTabChange={wm.setDashboardTab}
                sidebarCollapsed={ps.sidebarCollapsed}
                toggleSidebar={() => ps.setSidebarCollapsed(!ps.sidebarCollapsed)}
                showAgentPanel={ps.showAgentPanel}
                toggleAgentPanel={() => ps.setShowAgentPanel(!ps.showAgentPanel)}
            />

            <div className="flex-1 flex overflow-hidden relative">
                {/* Left Panel: Explorer */}
                <ProjectExplorerPanel
                    ps={ps}
                    wm={wm}
                    language={language}
                />

                <WorkspaceMain
                    dashboardTab={wm.dashboardTab}
                    openTabs={wm.openTabs}
                    activeTabId={wm.activeTabId}
                    setActiveEditorTabId={wm.setActiveEditorTabId}
                    closeTab={wm.closeTab}
                    activeTab={wm.activeTab}
                    updateTabContent={wm.updateTabContent}
                    project={project}
                    handleUpdateProject={handleUpdateProject}
                    setShowLogoModal={ps.setShowLogoModal}
                    language={language}
                    setDashboardTab={wm.setDashboardTab}
                    onDeleteProject={onDeleteProject}
                    showTerminal={ps.showTerminal}
                    setShowTerminal={ps.setShowTerminal}
                    terminalHeight={ps.terminalHeight}
                    setTerminalHeight={ps.setTerminalHeight}
                    tabs={tabs}
                    activeTabIdTerminal={activeTabId}
                    setTabsTerminal={setTabs}
                    setActiveTabIdTerminal={setActiveTabId}
                />

                <WorkspaceSidebar
                    showAgentPanel={ps.showAgentPanel}
                    agentPanelWidth={ps.agentPanelWidth}
                    setAgentPanelWidth={ps.setAgentPanelWidth}
                    viewTab={ps.viewTab}
                    selectedProvider={selectedProvider}
                    selectedModel={selectedModel}
                    onSelectModel={onSelectModel}
                    settings={settings ?? null}
                    groupedModels={groupedModels as GroupedModels}
                    quotas={quotas ?? null}
                    codexUsage={codexUsage ?? null}
                    agentChatMessage={ps.agentChatMessage}
                    setAgentChatMessage={ps.setAgentChatMessage}
                    councilEnabled={wm.councilEnabled}
                    toggleCouncil={() => wm.setCouncilEnabled(!wm.councilEnabled)}
                    agents={ps.agents}
                    toggleAgent={toggleAgent}
                    addAgent={() => ps.notify('info', 'Agent creation coming soon')}
                    runCouncil={() => { void runCouncil() }}
                    activityLog={activityLog}
                    clearLogs={() => setActivityLog([])}
                    t={t}
                    messages={messages}
                    isLoading={isLoading}
                    language={language}
                    onSourceClick={(path: string) => { void wm.openFile({ mountId: wm.mounts[0]?.id, path, name: path.split('/').pop() ?? '', isDirectory: false }) }}
                />
            </div>

            {/* Notifications */}
            <WorkspaceNotifications notifications={ps.notifications} />

            {/* Modals */}
            <LogoGeneratorModal
                isOpen={ps.showLogoModal}
                onClose={() => ps.setShowLogoModal(false)}
                project={project}
                onApply={(logoPath: string) => { void handleUpdateProject({ logo: logoPath }).then(() => ps.setShowLogoModal(false)) }}
                language={language}
            />

            {/* Global Command Strip */}
            <CommandStrip
                language={language}
                branchName="main"
                notificationCount={ps.notifications.length}
                status={isLoading ? 'busy' : 'ready'}
                onCommandClick={() => ps.notify('info', 'Command Palette coming soon')}
            />
        </div>
    )
}

interface ProjectExplorerPanelProps {
    ps: ReturnType<typeof useProjectState>;
    wm: ReturnType<typeof useWorkspaceManager>;
    language: Language;
}

function ProjectExplorerPanel({ ps, wm, language }: ProjectExplorerPanelProps) {
    return (
        <div className={cn(
            "flex flex-col border-r border-border/40 bg-background/80 backdrop-blur-xl shrink-0 transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] z-20",
            ps.sidebarCollapsed ? "w-0 overflow-hidden opacity-0" : "w-72 opacity-100"
        )}>
            <div className="flex-1 overflow-hidden">
                <WorkspaceExplorer
                    mounts={wm.mounts}
                    mountStatus={wm.mountStatus}
                    refreshSignal={wm.refreshSignal}
                    onOpenFile={(...args) => { void wm.openFile(...args) }}
                    onSelectEntry={ps.setSelectedEntry}
                    selectedEntry={ps.selectedEntry}
                    onAddMount={() => ps.setShowMountModal(true)}
                    onRemoveMount={(id: string) => { void wm.persistMounts(wm.mounts.filter(m => m.id !== id)) }}
                    onEnsureMount={wm.ensureMountReady}
                    onContextAction={(action) => {
                        ps.setEntryModal({ type: action.type, entry: action.entry })
                        if (action.type !== 'delete') { ps.setEntryName(action.entry.name) }
                    }}
                    variant="panel"
                    language={language}
                />
            </div>
        </div>
    )
}
