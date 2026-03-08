import React from 'react';

import { CommandStrip } from '@/features/workspace/components/workspace/CommandStrip';
import { ShortcutHelpOverlay } from '@/features/workspace/components/workspace/ShortcutHelpOverlay';
import { WorkspaceDialogs } from '@/features/workspace/components/workspace/WorkspaceDialogs';
import { WorkspaceExplorerPanel } from '@/features/workspace/components/workspace/WorkspaceExplorerPanel';
import { WorkspaceMain } from '@/features/workspace/components/workspace/WorkspaceMain';
import { WorkspaceNotifications } from '@/features/workspace/components/workspace/WorkspaceNotifications';
import { WorkspaceQuickSwitch } from '@/features/workspace/components/workspace/WorkspaceQuickSwitch';
import { WorkspaceSidebar } from '@/features/workspace/components/workspace/WorkspaceSidebar';
import { WorkspaceTerminalLayer } from '@/features/workspace/components/workspace/WorkspaceTerminalLayer';
import { WorkspaceToolbar } from '@/features/workspace/components/workspace/WorkspaceToolbar';
import { useQuickSwitch } from '@/features/workspace/hooks/useQuickSwitch';
import { useTerminalLayout } from '@/features/workspace/hooks/useTerminalLayout';
import { useWorkspaceBranchState } from '@/features/workspace/hooks/useWorkspaceBranchState';
import { useWorkspaceShortcuts } from '@/features/workspace/hooks/useWorkspaceShortcuts';
import { useWorkspaceDetailsController } from '@/features/workspace/hooks/useWorkspaceWorkspaceController';
import { useRenderTracker } from '@/hooks/useRenderTracker';
import { useWorkspaceProfiler } from '@/hooks/useWorkspaceProfiler';
import { Language } from '@/i18n';
import type { GroupedModels } from '@/types';
import { AppSettings, ChatError, CodexUsage, Message, QuotaResponse, TerminalTab,Workspace } from '@/types';

interface WorkspaceDetailsProps {
    workspace: Workspace;
    onBack: () => void;
    onDeleteWorkspace?: () => void;
    language: Language;
    tabs: TerminalTab[];
    activeTabId: string | null;
    setTabs: (tabs: TerminalTab[] | ((prev: TerminalTab[]) => TerminalTab[])) => void;
    setActiveTabId: (id: string | null) => void;
    selectedProvider: string;
    selectedModel: string;
    onSelectModel: (provider: string, model: string) => void;
    groupedModels?: GroupedModels;
    quotas?: { accounts: QuotaResponse[] } | null;
    codexUsage?: { accounts: { usage: CodexUsage }[] } | null;
    settings?: AppSettings | null;
    sendMessage?: (content?: string) => void | Promise<void>;
    messages?: Message[];
    isLoading?: boolean;
    chatError?: ChatError | null;
}

export const WorkspaceDetails: React.FC<WorkspaceDetailsProps> = ({
    workspace,
    onBack,
    onDeleteWorkspace,
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
    sendMessage,
    messages,
    isLoading,
    chatError,
}) => {
    useRenderTracker('WorkspaceDetails');
    const { onRender } = useWorkspaceProfiler();

    const { ps, wm, handleUpdateWorkspace, submitEntryModal, entryBusy, t } =
        useWorkspaceDetailsController({ workspace, language });

    const tl = useTerminalLayout({
        showTerminal: ps.showTerminal,
        setShowTerminal: ps.setShowTerminal,
        terminalHeight: ps.terminalHeight,
        setTerminalHeight: ps.setTerminalHeight,
        showAgentPanel: ps.showAgentPanel,
        sidebarCollapsed: ps.sidebarCollapsed,
        tabsCount: tabs.length,
    });

    const qs = useQuickSwitch(wm.openTabs);
    const {
        currentBranchName,
        availableBranches,
        isBranchLoading,
        isBranchSwitching,
        handleBranchSelect,
    } = useWorkspaceBranchState({
        workspacePath: workspace.path,
        notify: ps.notify,
        t,
    });

    useWorkspaceShortcuts({
        wm,
        setShowShortcutHelp: qs.setShowShortcutHelp,
        setShowQuickSwitch: qs.setShowQuickSwitch,
        setQuickSwitchQuery: qs.setQuickSwitchQuery,
        setQuickSwitchIndex: qs.setQuickSwitchIndex,
        showTerminal: ps.showTerminal,
        setShowTerminal: ps.setShowTerminal,
        isFloatingTerminal: tl.isFloatingTerminal,
        setIsFloatingTerminal: tl.setIsFloatingTerminal,
        setIsMaximizedTerminal: tl.setIsMaximizedTerminal,
        setTerminalHeight: ps.setTerminalHeight,
        lastExpandedTerminalHeightRef: tl.lastExpandedTerminalHeightRef,
    });

    const openWorkspaceFile = React.useCallback(
        (path: string, line?: number) => {
            const name = path.split(/[\\/]/).pop() ?? 'file';
            const mountId = wm.mounts[0]?.id;
            if (!mountId) {
                return;
            }
            const entry = {
                mountId,
                path,
                name,
                isDirectory: false,
                initialLine: line,
            };
            void wm.openFile(entry);
            ps.setSelectedEntries([entry]);
        },
        [ps, wm]
    );

    return (
        <div className="h-full flex flex-col bg-background relative overflow-hidden">
            <React.Profiler id="WorkspaceToolbar" onRender={onRender}>
                <WorkspaceToolbar
                    workspace={workspace}
                    workspaceName={workspace.title}
                    onNameChange={title => {
                        void handleUpdateWorkspace({ title });
                    }}
                    handleRunWorkspace={() => {
                        tl.setIsFloatingTerminal(false);
                        ps.setShowTerminal(true);
                    }}
                    onBack={onBack}
                    language={language}
                    dashboardTab={wm.dashboardTab}
                    onDashboardTabChange={wm.setDashboardTab}
                    sidebarCollapsed={ps.sidebarCollapsed}
                    toggleSidebar={() => ps.setSidebarCollapsed(!ps.sidebarCollapsed)}
                    showAgentPanel={ps.showAgentPanel}
                    toggleAgentPanel={() => ps.setShowAgentPanel(!ps.showAgentPanel)}
                    mountStatus={wm.mountStatus}
                />
            </React.Profiler>

            <div className="flex-1 flex overflow-hidden relative">
                <React.Profiler id="WorkspaceExplorerPanel" onRender={onRender}>
                    <WorkspaceExplorerPanel
                        workspaceId={workspace.id}
                        ps={ps}
                        wm={wm}
                        language={language}
                        onMove={(entry, targetDirPath) => {
                            void wm.moveEntry(entry, targetDirPath);
                        }}
                    />
                </React.Profiler>

                <React.Profiler id="WorkspaceMain" onRender={onRender}>
                    <WorkspaceMain
                        dashboardTab={wm.dashboardTab}
                        openTabs={wm.openTabs}
                        activeTabId={wm.activeTabId}
                        setActiveEditorTabId={wm.setActiveEditorTabId}
                        closeTab={wm.closeTab}
                        togglePinTab={wm.togglePinTab}
                        closeAllTabs={wm.closeAllTabs}
                        closeTabsToRight={wm.closeTabsToRight}
                        closeOtherTabs={wm.closeOtherTabs}
                        copyTabAbsolutePath={wm.copyTabAbsolutePath}
                        copyTabRelativePath={wm.copyTabRelativePath}
                        revealTabInExplorer={async (tabId: string) => {
                            wm.revealTabInExplorer(tabId);
                        }}
                        activeTab={wm.activeTab}
                        updateTabContent={wm.updateTabContent}
                        workspace={workspace}
                        handleUpdateWorkspace={handleUpdateWorkspace}
                        onAddMount={() => ps.setShowMountModal(true)}
                        setShowLogoModal={ps.setShowLogoModal}
                        t={t}
                        language={language}
                        setDashboardTab={wm.setDashboardTab}
                        onDeleteWorkspace={onDeleteWorkspace}
                        selectedEntry={ps.selectedEntries[0]}
                        onOpenFile={openWorkspaceFile}
                    />
                </React.Profiler>

                <React.Profiler id="WorkspaceSidebar" onRender={onRender}>
                    <WorkspaceSidebar
                        workspaceId={workspace.id}
                        showAgentPanel={ps.showAgentPanel}
                        agentPanelWidth={ps.agentPanelWidth}
                        setAgentPanelWidth={ps.setAgentPanelWidth}
                        selectedProvider={selectedProvider}
                        selectedModel={selectedModel}
                        onSelectModel={onSelectModel}
                        settings={settings ?? null}
                        groupedModels={groupedModels as GroupedModels}
                        quotas={quotas ?? null}
                        codexUsage={codexUsage ?? null}
                        agentChatMessage={ps.agentChatMessage}
                        setAgentChatMessage={ps.setAgentChatMessage}
                        onSendMessage={
                            sendMessage
                                ? (content?: string) => {
                                    void sendMessage(content);
                                }
                                : undefined
                        }
                        t={t}
                        messages={messages}
                        isLoading={isLoading}
                        chatError={chatError}
                        language={language}
                        onSourceClick={(path: string) => {
                            void wm.openFile({
                                mountId: wm.mounts[0]?.id,
                                path,
                                name: path.split(/[\\/]/).pop() ?? '',
                                isDirectory: false,
                            });
                        }}
                    />
                </React.Profiler>
            </div>

            <React.Profiler id="WorkspaceTerminalLayer" onRender={onRender}>
                <WorkspaceTerminalLayer
                    showTerminal={ps.showTerminal}
                    isFloatingTerminal={tl.isFloatingTerminal}
                    isMaximizedTerminal={tl.isMaximizedTerminal}
                    isResizingTerminal={tl.isResizingTerminal}
                    sidebarCollapsed={ps.sidebarCollapsed}
                    terminalHeight={ps.terminalHeight}
                    floatingTerminalLayout={tl.floatingTerminalLayout}
                    dockedTerminalRightInsetPx={tl.dockedTerminalRightInsetPx}
                    lastExpandedTerminalHeightRef={tl.lastExpandedTerminalHeightRef}
                    setShowTerminal={ps.setShowTerminal}
                    setIsMaximizedTerminal={tl.setIsMaximizedTerminal}
                    setIsResizingTerminal={tl.setIsResizingTerminal}
                    setIsFloatingTerminal={tl.setIsFloatingTerminal}
                    setTerminalHeight={ps.setTerminalHeight}
                    workspaceId={workspace.id}
                    workspacePath={workspace.path}
                    tabs={tabs}
                    activeTabId={activeTabId}
                    setTabs={setTabs}
                    setActiveTabId={setActiveTabId}
                    onOpenFile={openWorkspaceFile}
                />
            </React.Profiler>

            <WorkspaceDialogs
                ps={ps}
                wm={wm}
                workspace={workspace}
                handleUpdateWorkspace={handleUpdateWorkspace}
                submitEntryModal={submitEntryModal}
                entryBusy={entryBusy}
                language={language}
            />
            <CommandStrip
                language={language}
                branchName={currentBranchName}
                branches={availableBranches}
                isBranchLoading={isBranchLoading}
                isBranchSwitching={isBranchSwitching}
                notificationCount={ps.notifications.length}
                status={isLoading ? 'busy' : 'ready'}
                activeFilePath={wm.activeTab?.path}
                activeFileContent={wm.activeTab?.content}
                activeFileType={wm.activeTab?.type}
                onBranchSelect={handleBranchSelect}
                onCommandClick={() => {
                    window.dispatchEvent(new CustomEvent('app:open-command-palette'));
                }}
                onQuickSwitchClick={() => {
                    qs.setShowQuickSwitch(true);
                    qs.setQuickSwitchQuery('');
                    qs.setQuickSwitchIndex(0);
                }}
                onMouseDown={tl.handleCommandStripResizeStart}
            />

            <ShortcutHelpOverlay visible={qs.showShortcutHelp} t={t} />

            {qs.showQuickSwitch && (
                <WorkspaceQuickSwitch
                    isOpen={qs.showQuickSwitch}
                    onClose={() => qs.setShowQuickSwitch(false)}
                    items={qs.quickSwitchItems}
                    query={qs.quickSwitchQuery}
                    onQueryChange={qs.setQuickSwitchQuery}
                    selectedIndex={qs.quickSwitchIndex}
                    onSelectedIndexChange={qs.setQuickSwitchIndex}
                    onSelect={(tabId) => {
                        wm.setActiveEditorTabId(tabId);
                        qs.setShowQuickSwitch(false);
                    }}
                    t={t}
                />
            )}
            <WorkspaceNotifications notifications={ps.notifications} />
        </div>
    );
};

// Workspace alias for the new naming convention

