/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { WorkspaceExplorerPanel } from '@renderer/features/workspace/workspace-explorer/WorkspaceExplorerPanel';
import { CommandStrip } from '@renderer/features/workspace/workspace-shell/CommandStrip';
import { ShortcutHelpOverlay } from '@renderer/features/workspace/workspace-shell/ShortcutHelpOverlay';
import { WorkspaceDialogs } from '@renderer/features/workspace/workspace-shell/WorkspaceDialogs';
import { WorkspaceMain } from '@renderer/features/workspace/workspace-shell/WorkspaceMain';
import { WorkspaceNotifications } from '@renderer/features/workspace/workspace-shell/WorkspaceNotifications';
import { WorkspaceQuickSwitch } from '@renderer/features/workspace/workspace-shell/WorkspaceQuickSwitch';
import { WorkspaceSidebar } from '@renderer/features/workspace/workspace-shell/WorkspaceSidebar';
import { WorkspaceTerminalLayer } from '@renderer/features/workspace/workspace-shell/WorkspaceTerminalLayer';
import { WorkspaceToolbar } from '@renderer/features/workspace/workspace-shell/WorkspaceToolbar';
import { Square } from 'lucide-react';
import React from 'react';

import { useQuickSwitch } from '@/features/workspace/hooks/useQuickSwitch';
import {
    COLLAPSED_EXPLORER_LEFT_INSET_PX,
    EXPANDED_EXPLORER_LEFT_INSET_PX,
    useTerminalLayout
} from '@/features/workspace/hooks/useTerminalLayout';
import { useWorkspaceBranchState } from '@/features/workspace/hooks/useWorkspaceBranchState';
import { useWorkspaceShortcuts } from '@/features/workspace/hooks/useWorkspaceShortcuts';
import { useWorkspaceTaskRunner } from '@/features/workspace/hooks/useWorkspaceTaskRunner';
import { useWorkspaceDetailsController } from '@/features/workspace/hooks/useWorkspaceWorkspaceController';
import { WORKSPACE_NAVIGATE_EVENT, WorkspaceNavigationAction } from '@/features/workspace/utils/workspace-navigation';
import { runWorkspaceStartupPreflight, WorkspaceStartupPreflightResult } from '@/features/workspace/utils/workspace-startup-preflight';
import { useRenderTracker } from '@/hooks/useRenderTracker';
import { useWorkspaceProfiler } from '@/hooks/useWorkspaceProfiler';
import { Language } from '@/i18n';
import { TerminalTab, Workspace } from '@/types';
import { performanceMonitor } from '@/utils/performance';
import { appLogger } from '@/utils/renderer-logger';

const pendingActiveWorkspaceClears = new Map<string, number>();

function cancelPendingActiveWorkspaceClear(workspacePath: string): void {
    const pendingTimeoutId = pendingActiveWorkspaceClears.get(workspacePath);
    if (pendingTimeoutId === undefined) {
        return;
    }
    window.clearTimeout(pendingTimeoutId);
    pendingActiveWorkspaceClears.delete(workspacePath);
}

interface WorkspaceDetailsProps {
    workspace: Workspace;
    onBack: () => void;
    onDeleteWorkspace?: () => void;
    language: Language;
    tabs: TerminalTab[];
    activeTabId: string | null;
    setTabs: (tabs: TerminalTab[] | ((prev: TerminalTab[]) => TerminalTab[])) => void;
    setActiveTabId: (id: string | null) => void;
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
}) => {
    useRenderTracker('WorkspaceDetails');
    const { onRender } = useWorkspaceProfiler();
    const [branchStateEnabled, setBranchStateEnabled] = React.useState(false);
    const [preflightResult, setPreflightResult] = React.useState<WorkspaceStartupPreflightResult | null>(null);
    const [commandStripHeightPx, setCommandStripHeightPx] = React.useState(32);
    const commandStripRef = React.useRef<HTMLDivElement | null>(null);
    const workspacePath = workspace.path;

    React.useEffect(() => {
        if (typeof workspacePath !== 'string' || workspacePath.trim().length === 0) {
            return;
        }
        cancelPendingActiveWorkspaceClear(workspacePath);
        void window.electron.workspace.setActive(workspacePath).catch(error => {
            appLogger.error('WorkspaceDetails', 'Failed to set active workspace', error as Error);
        });
        return () => {
            const timeoutId = window.setTimeout(() => {
                pendingActiveWorkspaceClears.delete(workspacePath);
                void window.electron.workspace.clearActive(workspacePath).catch(error => {
                    appLogger.error('WorkspaceDetails', 'Failed to clear active workspace', error as Error);
                });
            }, 0);
            pendingActiveWorkspaceClears.set(workspacePath, timeoutId);
        };
    }, [workspacePath]);

    React.useEffect(() => {
        setBranchStateEnabled(false);
        const animationFrameId = window.requestAnimationFrame(() => {
            setBranchStateEnabled(true);
        });
        return () => {
            window.cancelAnimationFrame(animationFrameId);
        };
    }, [workspace.id]);

    const { ps, wm, handleUpdateWorkspace, submitEntryModal, entryBusy, t } =
        useWorkspaceDetailsController({ workspace, language });
    const taskRunner = useWorkspaceTaskRunner({
        workspace 
    });

    const tl = useTerminalLayout({
        showTerminal: ps.showTerminal,
        setShowTerminal: ps.setShowTerminal,
        terminalHeight: ps.terminalHeight,
        setTerminalHeight: ps.setTerminalHeight,
        initialMaximizedTerminal: ps.terminalMaximized,
        onTerminalLayoutStateChange: ps.setTerminalLayoutState,
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
        workspacePath,
        enabled: branchStateEnabled, 
        t,
    });

    const handleManualLogoUpload = React.useCallback(async () => {
        try {
            const uploadedPath = await window.electron.workspace.uploadLogo(workspace.path);
            if (!uploadedPath) {
                return;
            }

            await handleUpdateWorkspace({
                logo: uploadedPath,
                updatedAt: Date.now(),
            });
        } catch (error) {
            appLogger.error('WorkspaceDetails', 'Logo upload failed', error as Error); 
        }
    }, [handleUpdateWorkspace, workspace.path]);

    useWorkspaceShortcuts({
        wm,
        setShowShortcutHelp: qs.setShowShortcutHelp,
        setShowQuickSwitch: qs.setShowQuickSwitch,
        setQuickSwitchQuery: qs.setQuickSwitchQuery,
        setQuickSwitchIndex: qs.setQuickSwitchIndex,
        showTerminal: ps.showTerminal,
        setShowTerminal: ps.setShowTerminal, 
        setIsMaximizedTerminal: tl.setIsMaximizedTerminal,
        setTerminalHeight: ps.setTerminalHeight,
        lastExpandedTerminalHeightRef: tl.lastExpandedTerminalHeightRef,
    });

    const openWorkspaceFile = React.useCallback(
        (path: string, line?: number, readOnly?: boolean) => {
            const mountId = wm.mounts[0]?.id;
            if (!mountId) {
                return;
            }
            const mountRoot = wm.mounts[0]?.rootPath ?? '';

            const isAbsolutePath = (p: string) => (
                /^[a-zA-Z]:[\\/]/.test(p) // Windows drive
                || p.startsWith('\\\\') // UNC
                || p.startsWith('/') // POSIX
            );

            const normalizedPath = (() => {
                const raw = (path ?? '').trim();
                if (!raw) {
                    return raw;
                }
                if (isAbsolutePath(raw) || !mountRoot) {
                    return raw;
                }
                const sep = mountRoot.includes('\\') ? '\\' : '/';
                return `${mountRoot.replace(/[\\/]+$/g, '')}${sep}${raw.replace(/^[\\/]+/g, '')}`;
            })();

            const name = normalizedPath.split(/[\\/]/).pop() ?? 'file';
            const entry = {
                mountId,
                path: normalizedPath,
                name,
                isDirectory: false,
                initialLine: line,
                readOnly: Boolean(readOnly),
            };
            void wm.openFile(entry);
            ps.setSelectedEntries([entry]);
        },
        [ps, wm]
    );

    const handleExplorerMove = React.useCallback(
        (entry: Parameters<NonNullable<typeof wm.moveEntry>>[0], targetDirPath: string) => {
            void wm.moveEntry(entry, targetDirPath);
        },
        [wm]
    );

    const handleSidebarSourceClick = React.useCallback(
        (path: string) => {
            void wm.openFile({
                mountId: wm.mounts[0]?.id,
                path,
                name: path.split(/[\\/]/).pop() ?? '',
                isDirectory: false,
            });
        },
        [wm]
    );

    React.useEffect(() => {
        let cancelled = false;
        void runWorkspaceStartupPreflight(workspace)
            .then(result => {
                if (!cancelled) {
                    setPreflightResult(result);
                }
            })
            .catch(error => {
                appLogger.error('WorkspaceDetails', 'Workspace preflight failed', error as Error);
                if (!cancelled) {
                    setPreflightResult(null);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [workspace]);

    React.useEffect(() => {
        const element = commandStripRef.current;
        if (!element) {
            return;
        }

        const measure = () => {
            const measuredHeight = Math.ceil(element.getBoundingClientRect().height);
            setCommandStripHeightPx(Math.max(0, measuredHeight));
        };

        measure();
        const observer = new ResizeObserver(() => {
            measure();
        });
        observer.observe(element);

        return () => {
            observer.disconnect();
        };
    }, []);

    const commandStripStatus: 'ready' | 'busy' | 'error' = React.useMemo(() => {
        if (preflightResult?.issues.some(issue => issue.blocking || issue.severity === 'error')) {
            return 'error';
        }
        if (taskRunner.runningTaskCount > 0) {
            return 'busy';
        }
        return 'ready';
    }, [preflightResult, taskRunner.runningTaskCount]);
    const commandStripLeftInsetPx = React.useMemo(
        () => (ps.sidebarCollapsed ? COLLAPSED_EXPLORER_LEFT_INSET_PX : EXPANDED_EXPLORER_LEFT_INSET_PX),
        [ps.sidebarCollapsed]
    );
    React.useEffect(() => {
        const handler = (e: Event) => {
            const customEvent = e as CustomEvent<WorkspaceNavigationAction>;
            const action = customEvent.detail;
            if (action.type === 'open_file') {
                openWorkspaceFile(action.path, action.line, action.readOnly);
            } else if (action.type === 'open_diff') {
                wm.setDashboardTab('git');
                window.dispatchEvent(new CustomEvent('tengra:workspace-git-open-diff', { detail: { path: action.path } }));
            }
        };

        window.addEventListener(WORKSPACE_NAVIGATE_EVENT, handler);
        return () => window.removeEventListener(WORKSPACE_NAVIGATE_EVENT, handler);
    }, [openWorkspaceFile, wm]);

    return (
        <div className="h-full flex flex-col bg-background relative overflow-hidden">
            <React.Profiler id="WorkspaceToolbar" onRender={onRender}>
                <WorkspaceToolbar
                    workspaceName={workspace.title}
                    onNameChange={title => {
                        void handleUpdateWorkspace({ title });
                    }}
                    handleRunWorkspace={() => {
                        performanceMonitor.mark('workspace:terminal:requested'); 
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
                />
            </React.Profiler>

            <div className="flex-1 flex overflow-hidden relative">
                <React.Profiler id="WorkspaceExplorerPanel" onRender={onRender}>
                    <WorkspaceExplorerPanel
                        workspaceId={workspace.id}
                        workspacePath={workspace.path}
                        ps={ps}
                        wm={wm}
                        language={language}
                        activeFilePath={wm.activeTab?.path}
                        onMove={handleExplorerMove}
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
                        saveActiveTab={wm.saveActiveTab}
                        workspace={workspace}
                        handleUpdateWorkspace={handleUpdateWorkspace}
                        onAddMount={() => ps.setShowMountModal(true)}
                        onUploadLogo={() => {
                            void handleManualLogoUpload();
                        }}
                        t={t}
                        language={language}
                        setDashboardTab={wm.setDashboardTab}
                        onDeleteWorkspace={onDeleteWorkspace}
                        selectedEntry={ps.selectedEntries[0]}
                        onOpenFile={openWorkspaceFile}
                        editorBottomInsetPx={
                            ps.showTerminal
                                ? Math.max(0, ps.terminalHeight + commandStripHeightPx - 1)
                                : 0
                        }
                    />
                </React.Profiler>

                <React.Profiler id="WorkspaceSidebar" onRender={onRender}>
                    <WorkspaceSidebar
                        workspace={workspace}
                        showAgentPanel={ps.showAgentPanel}
                        agentPanelWidth={ps.agentPanelWidth}
                        setAgentPanelWidth={ps.setAgentPanelWidth}
                        t={t}
                        language={language}
                        onSourceClick={handleSidebarSourceClick}
                    />
                </React.Profiler>
            </div>

            <React.Profiler id="WorkspaceTerminalLayer" onRender={onRender}>
                <WorkspaceTerminalLayer
                    showTerminal={ps.showTerminal} 
                    isMaximizedTerminal={tl.isMaximizedTerminal}
                    isResizingTerminal={tl.isResizingTerminal}
                    sidebarCollapsed={ps.sidebarCollapsed}
                    terminalHeight={ps.terminalHeight} 
                    dockedTerminalRightInsetPx={tl.dockedTerminalRightInsetPx}
                    dockedTerminalBottomOffsetPx={Math.max(0, commandStripHeightPx - 1)}
                    lastExpandedTerminalHeightRef={tl.lastExpandedTerminalHeightRef}
                    setShowTerminal={ps.setShowTerminal}
                    setIsMaximizedTerminal={tl.setIsMaximizedTerminal}
                    setIsResizingTerminal={tl.setIsResizingTerminal} 
                    setTerminalHeight={ps.setTerminalHeight}
                    workspaceId={workspace.id}
                    workspacePath={workspacePath}
                    activeFilePath={wm.activeTab?.path}
                    activeFileContent={wm.activeTab?.content}
                    activeFileType={wm.activeTab?.type}
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
                submitEntryModal={submitEntryModal}
                entryBusy={entryBusy}
                language={language}
                handleUpdateWorkspace={handleUpdateWorkspace}
            />
            {taskRunner.tasks.length > 0 && (
                <div className="border-t border-border/30 bg-background/70 px-3 py-2">
                    <div className="flex items-center gap-2 overflow-x-auto">
                        {taskRunner.tasks.map(task => {
                            const latestLine = task.output.trim().split(/\r?\n/).filter(Boolean).slice(-1)[0] ?? '';
                            return (
                                <div
                                    key={task.id}
                                    className="min-w-220 max-w-320 rounded-lg border border-border/40 bg-background/80 px-3 py-2"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="truncate text-11 font-semibold text-foreground">
                                                {task.command}
                                            </div>
                                            {latestLine && (
                                                <div className="truncate text-10 text-muted-foreground">
                                                    {latestLine}
                                                </div>
                                            )}
                                        </div>
                                        {task.status === 'running' && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    void taskRunner.stopTask(task.id);
                                                }}
                                                className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                                                title={t('common.stop')}
                                            >
                                                <Square className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            <div ref={commandStripRef} className="relative">
                <div
                    role="presentation"
                    aria-hidden="true"
                    className="absolute bottom-full z-20 h-3 cursor-ns-resize"
                    style={{
                        left: `${commandStripLeftInsetPx}px`,
                        right: 0,
                    }}
                    onMouseDown={tl.handleCommandStripResizeStart}
                />
                <CommandStrip
                    className="transition-[margin] duration-200"
                    language={language}
                    branchName={currentBranchName}
                    branches={availableBranches}
                    isBranchLoading={isBranchLoading}
                    isBranchSwitching={isBranchSwitching}
                    notificationCount={ps.notifications.length}
                    status={commandStripStatus}
                    activeFilePath={wm.activeTab?.path}
                    activeFileContent={wm.activeTab?.content}
                    activeFileType={wm.activeTab?.type}
                    runningTaskCount={taskRunner.runningTaskCount}
                    onRunWorkspace={() => {
                        void taskRunner.runDefaultTask();
                    }}
                    onBranchSelect={handleBranchSelect}
                    onCommandClick={() => {
                        qs.setShowQuickSwitch(true);
                        qs.setQuickSwitchQuery('');
                        qs.setQuickSwitchIndex(0);
                    }}
                    onQuickSwitchClick={() => {
                        qs.setShowQuickSwitch(true);
                        qs.setQuickSwitchQuery('');
                        qs.setQuickSwitchIndex(0);
                    }}
                    style={{
                        marginLeft: `${commandStripLeftInsetPx}px`,
                    }}
                />
            </div>

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
