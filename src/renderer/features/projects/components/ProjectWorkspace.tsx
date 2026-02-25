import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { LogoGeneratorModal } from '@renderer/features/projects/components/LogoGeneratorModal';
import { CommandStrip } from '@renderer/features/projects/components/workspace/CommandStrip';
import { WorkspaceMain } from '@renderer/features/projects/components/workspace/WorkspaceMain';
import { WorkspaceModals } from '@renderer/features/projects/components/workspace/WorkspaceModals';
import { WorkspaceNotifications } from '@renderer/features/projects/components/workspace/WorkspaceNotifications';
import { WorkspaceQuickSwitch } from '@renderer/features/projects/components/workspace/WorkspaceQuickSwitch';
import { WorkspaceSidebar } from '@renderer/features/projects/components/workspace/WorkspaceSidebar';
import { WorkspaceToolbar } from '@renderer/features/projects/components/workspace/WorkspaceToolbar';
import { WorkspaceExplorer } from '@renderer/features/projects/components/WorkspaceExplorer';
import { useProjectState } from '@renderer/features/projects/hooks/useProjectState';
import { useProjectWorkspaceController } from '@renderer/features/projects/hooks/useProjectWorkspaceController';
import { useWorkspaceBranchState } from '@renderer/features/projects/hooks/useWorkspaceBranchState';
import { useWorkspaceManager } from '@renderer/features/projects/hooks/useWorkspaceManager';
import { AnimatePresence, motion } from '@renderer/lib/framer-motion-compat';
import { Resizable } from 're-resizable';
import React from 'react';

import { GroupedModels } from '@/features/models/utils/model-fetcher';
import { TerminalPanel } from '@/features/terminal/TerminalPanel';
import { Language } from '@/i18n';
import { cn } from '@/lib/utils';
import {
    AppSettings,
    CodexUsage,
    Message,
    Project,
    QuotaResponse,
    TerminalTab,
    WorkspaceDashboardTab,
    WorkspaceEntry,
} from '@/types';
import { appLogger } from '@/utils/renderer-logger';

// Types are now shared from @/types

const MIN_TERMINAL_HEIGHT = 150;
const MIN_RESIZABLE_TERMINAL_HEIGHT = 56;
const FLOATING_TERMINAL_DEFAULT_HEIGHT = 320;
const FLOATING_TERMINAL_MAX_WIDTH_PX = 980;
const DOCKED_TERMINAL_BOTTOM_OFFSET_PX = 31;
const AGENT_PANEL_VISIBLE_WIDTH_PX = 350;
const EXPANDED_EXPLORER_LEFT_INSET_PX = 18 * 16 + 8;
const COLLAPSED_EXPLORER_LEFT_INSET_PX = 8;

interface ProjectWorkspaceProps {
    project: Project;
    onBack: () => void;
    onDeleteProject?: () => void;
    language: Language;
    // Terminal props passed from parent
    tabs: TerminalTab[];
    activeTabId: string | null;
    setTabs: (tabs: TerminalTab[] | ((prev: TerminalTab[]) => TerminalTab[])) => void;
    setActiveTabId: (id: string | null) => void;
    // AI / Model props
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
    // Optional external control
    activeDashboardTab?: WorkspaceDashboardTab;
    onDashboardTabChange?: (tab: WorkspaceDashboardTab) => void;
}

export const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = ({
    project,
    onBack,
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
    sendMessage,
    messages,
    isLoading,
}) => {
    const { ps, wm, handleUpdateProject, submitEntryModal, entryBusy, t } =
        useProjectWorkspaceController({ project, language });

    const [isMaximizedTerminal, setIsMaximizedTerminal] = React.useState(false);
    const [isResizingTerminal, setIsResizingTerminal] = React.useState(false);
    const [isFloatingTerminal, setIsFloatingTerminal] = React.useState(false);
    const [showShortcutHelp, setShowShortcutHelp] = React.useState(false);
    const [showQuickSwitch, setShowQuickSwitch] = React.useState(false);
    const [quickSwitchQuery, setQuickSwitchQuery] = React.useState('');
    const [quickSwitchIndex, setQuickSwitchIndex] = React.useState(0);
    const [viewportWidth, setViewportWidth] = React.useState(() => window.innerWidth);
    const setShowTerminal = ps.setShowTerminal;
    const setTerminalHeight = ps.setTerminalHeight;
    const showTerminal = ps.showTerminal;
    const prevTabsCountRef = React.useRef(tabs.length);
    const stripResizeCleanupRef = React.useRef<(() => void) | null>(null);
    const lastExpandedTerminalHeightRef = React.useRef(
        Math.max(ps.terminalHeight, MIN_TERMINAL_HEIGHT)
    );
    const dockedTerminalRightInsetPx = React.useMemo(() => {
        const baseInset = 8;
        if (!ps.showAgentPanel) {
            return baseInset;
        }
        // Keep terminal dock width aligned with the actual rendered agent sidebar width.
        return AGENT_PANEL_VISIBLE_WIDTH_PX + baseInset;
    }, [ps.showAgentPanel]);
    const workspaceLeftInsetPx = React.useMemo(
        () =>
            ps.sidebarCollapsed
                ? COLLAPSED_EXPLORER_LEFT_INSET_PX
                : EXPANDED_EXPLORER_LEFT_INSET_PX,
        [ps.sidebarCollapsed]
    );
    const {
        currentBranchName,
        availableBranches,
        isBranchLoading,
        isBranchSwitching,
        handleBranchSelect,
    } = useWorkspaceBranchState({
        projectPath: project.path,
        notify: ps.notify,
        t,
    });
    const floatingTerminalLayout = React.useMemo(() => {
        const availableWidthPx = Math.max(
            0,
            viewportWidth - workspaceLeftInsetPx - dockedTerminalRightInsetPx
        );
        const widthPx = Math.min(FLOATING_TERMINAL_MAX_WIDTH_PX, availableWidthPx);
        const leftPx = workspaceLeftInsetPx + Math.max(0, (availableWidthPx - widthPx) / 2);
        return { leftPx, widthPx };
    }, [dockedTerminalRightInsetPx, viewportWidth, workspaceLeftInsetPx]);
    const quickSwitchItems = React.useMemo(
        () =>
            wm.openTabs
                .map(tab => ({
                    id: tab.id,
                    label: tab.name,
                    path: tab.path,
                }))
                .filter(tab =>
                    `${tab.label} ${tab.path ?? ''}`
                        .toLowerCase()
                        .includes(quickSwitchQuery.trim().toLowerCase())
                )
                .slice(0, 12),
        [quickSwitchQuery, wm.openTabs]
    );

    const calculateTerminalHeight = React.useCallback((clientY: number) => {
        const minHeight = MIN_TERMINAL_HEIGHT;
        const maxHeight = window.innerHeight * 0.8;
        return Math.min(Math.max(minHeight, window.innerHeight - clientY - 32), maxHeight);
    }, []);

    const stopCommandStripResize = React.useCallback(() => {
        stripResizeCleanupRef.current?.();
        stripResizeCleanupRef.current = null;
        setIsResizingTerminal(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }, []);

    const handleCommandStripResizeStart = React.useCallback(
        (e: React.MouseEvent) => {
            if (e.button !== 0) {
                return;
            }
            e.preventDefault();

            stripResizeCleanupRef.current?.();
            stripResizeCleanupRef.current = null;

            const nextHeight = calculateTerminalHeight(e.clientY);
            setTerminalHeight(nextHeight);
            lastExpandedTerminalHeightRef.current = Math.max(nextHeight, MIN_TERMINAL_HEIGHT);
            setIsMaximizedTerminal(false);
            setIsFloatingTerminal(false);
            setIsResizingTerminal(true);
            if (!showTerminal) {
                setShowTerminal(true);
            }

            const hMove = (event: MouseEvent) => {
                const nextHeight = calculateTerminalHeight(event.clientY);
                setTerminalHeight(nextHeight);
                if (nextHeight >= MIN_TERMINAL_HEIGHT) {
                    lastExpandedTerminalHeightRef.current = nextHeight;
                }
            };
            const hUp = () => {
                stopCommandStripResize();
            };

            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
            window.addEventListener('mousemove', hMove);
            window.addEventListener('mouseup', hUp, { once: true });

            stripResizeCleanupRef.current = () => {
                window.removeEventListener('mousemove', hMove);
                window.removeEventListener('mouseup', hUp);
            };
        },
        [
            calculateTerminalHeight,
            setTerminalHeight,
            showTerminal,
            setShowTerminal,
            stopCommandStripResize,
        ]
    );

    React.useEffect(() => {
        const prevTabsCount = prevTabsCountRef.current;
        prevTabsCountRef.current = tabs.length;

        // Close only when we transition from having tabs to none.
        if (showTerminal && prevTabsCount > 0 && tabs.length === 0) {
            setShowTerminal(false);
            setIsMaximizedTerminal(false);
        }
    }, [showTerminal, tabs.length, setShowTerminal]);

    React.useEffect(() => {
        if (!showTerminal) {
            setIsMaximizedTerminal(false);
            setIsFloatingTerminal(false);
            stopCommandStripResize();
        }
    }, [showTerminal, stopCommandStripResize]);

    React.useEffect(() => {
        if (ps.terminalHeight >= MIN_TERMINAL_HEIGHT) {
            lastExpandedTerminalHeightRef.current = ps.terminalHeight;
        }
    }, [ps.terminalHeight]);

    React.useEffect(() => {
        return () => {
            stopCommandStripResize();
        };
    }, [stopCommandStripResize]);

    React.useEffect(() => {
        const onResize = () => {
            setViewportWidth(window.innerWidth);
        };
        window.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('resize', onResize);
        };
    }, []);

    React.useEffect(() => {
        if (isFloatingTerminal && floatingTerminalLayout.widthPx < 320) {
            setIsFloatingTerminal(false);
        }
    }, [floatingTerminalLayout.widthPx, isFloatingTerminal]);

    React.useEffect(() => {
        const onQuickTerminal = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
                return;
            }
            if (event.key !== '`' && event.code !== 'Backquote') {
                return;
            }
            const target = event.target as HTMLElement | null;
            const tagName = target?.tagName?.toLowerCase();
            const isTypingTarget =
                target?.isContentEditable ||
                tagName === 'input' ||
                tagName === 'textarea' ||
                tagName === 'select';
            if (isTypingTarget) {
                return;
            }

            event.preventDefault();

            if (!showTerminal) {
                setIsFloatingTerminal(true);
                setIsMaximizedTerminal(false);
                setShowTerminal(true);
                const fallbackHeight = Math.max(
                    lastExpandedTerminalHeightRef.current,
                    FLOATING_TERMINAL_DEFAULT_HEIGHT
                );
                setTerminalHeight(fallbackHeight);
                return;
            }

            if (isFloatingTerminal) {
                setShowTerminal(false);
                setIsFloatingTerminal(false);
                return;
            }

            setIsFloatingTerminal(true);
        };

        window.addEventListener('keydown', onQuickTerminal);
        return () => {
            window.removeEventListener('keydown', onQuickTerminal);
        };
    }, [isFloatingTerminal, setShowTerminal, setTerminalHeight, showTerminal]);

    React.useEffect(() => {
        const onWorkspaceShortcut = (event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey)) {
                return;
            }
            const key = event.key.toLowerCase();
            const target = event.target as HTMLElement | null;
            const tagName = target?.tagName?.toLowerCase();
            const isTypingTarget =
                target?.isContentEditable || tagName === 'input' || tagName === 'textarea';
            if (isTypingTarget && key !== '/') {
                return;
            }
            if (key === '/') {
                event.preventDefault();
                setShowShortcutHelp(prev => !prev);
                return;
            }
            if (key === 'k') {
                event.preventDefault();
                window.dispatchEvent(new CustomEvent('app:open-command-palette'));
                return;
            }
            if (key === 'p') {
                event.preventDefault();
                setShowQuickSwitch(true);
                setQuickSwitchQuery('');
                setQuickSwitchIndex(0);
                return;
            }
            if (key === 'w' && wm.activeTab) {
                event.preventDefault();
                wm.closeTab(wm.activeTab.id);
            }
        };
        const onEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setShowShortcutHelp(false);
                setShowQuickSwitch(false);
            }
        };
        window.addEventListener('keydown', onWorkspaceShortcut);
        window.addEventListener('keydown', onEscape);
        return () => {
            window.removeEventListener('keydown', onWorkspaceShortcut);
            window.removeEventListener('keydown', onEscape);
        };
    }, [wm]);

    React.useEffect(() => {
        if (!showQuickSwitch) {
            return;
        }
        setQuickSwitchIndex(prev => {
            if (quickSwitchItems.length === 0) {
                return 0;
            }
            return Math.min(prev, quickSwitchItems.length - 1);
        });
    }, [quickSwitchItems, showQuickSwitch]);

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
            {/* Top Toolbar */}
            <WorkspaceToolbar
                project={project}
                projectName={project.title}
                onNameChange={title => {
                    void handleUpdateProject({ title });
                }}
                handleRunProject={() => {
                    setIsFloatingTerminal(false);
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

            <div className="flex-1 flex overflow-hidden relative">
                {/* Left Panel: Explorer */}
                <ProjectExplorerPanel
                    projectId={project.id}
                    ps={ps}
                    wm={wm}
                    language={language}
                    onMove={(entry, targetDirPath) => {
                        void wm.moveEntry(entry, targetDirPath);
                    }}
                />

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
                    project={project}
                    handleUpdateProject={handleUpdateProject}
                    onAddMount={() => ps.setShowMountModal(true)}
                    setShowLogoModal={ps.setShowLogoModal}
                    t={t}
                    language={language}
                    setDashboardTab={wm.setDashboardTab}
                    onDeleteProject={onDeleteProject}
                    selectedEntry={ps.selectedEntries[0]}
                    onOpenFile={openWorkspaceFile}
                />

                <WorkspaceSidebar
                    projectId={project.id}
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
            </div>

            {/* Terminal Layer */}
            <AnimatePresence>
                {ps.showTerminal && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15 }}
                        exit={{ opacity: 0, y: 8 }}
                        className={cn(
                            'absolute z-30',
                            isFloatingTerminal
                                ? 'z-50'
                                : ps.sidebarCollapsed
                                    ? 'left-2'
                                    : 'left-[calc(18rem+0.5rem)]'
                        )}
                        style={
                            isFloatingTerminal
                                ? {
                                    left: `${floatingTerminalLayout.leftPx}px`,
                                    width: `${floatingTerminalLayout.widthPx}px`,
                                    bottom: `${DOCKED_TERMINAL_BOTTOM_OFFSET_PX}px`,
                                }
                                : {
                                    right: `${dockedTerminalRightInsetPx}px`,
                                    bottom: `${DOCKED_TERMINAL_BOTTOM_OFFSET_PX}px`,
                                }
                        }
                    >
                        <Resizable
                            size={{
                                width: isFloatingTerminal ? '100%' : '100%',
                                height: isMaximizedTerminal ? '70vh' : ps.terminalHeight,
                            }}
                            minHeight={isFloatingTerminal ? 220 : MIN_RESIZABLE_TERMINAL_HEIGHT}
                            maxHeight={window.innerHeight * 0.8}
                            enable={{
                                top: !isMaximizedTerminal,
                                right: false,
                                bottom: false,
                                left: false,
                                topRight: false,
                                topLeft: false,
                                bottomRight: false,
                                bottomLeft: false,
                            }}
                            onResizeStart={event => {
                                if ('button' in event && event.button !== 0) {
                                    return false;
                                }
                                setIsResizingTerminal(true);
                                if (isMaximizedTerminal) {
                                    setIsMaximizedTerminal(false);
                                }
                                return true;
                            }}
                            onResize={(_event, _direction, ref) => {
                                const nextHeight = ref.offsetHeight;
                                setTerminalHeight(nextHeight);
                                if (nextHeight >= MIN_TERMINAL_HEIGHT) {
                                    lastExpandedTerminalHeightRef.current = nextHeight;
                                }
                            }}
                            onResizeStop={(_event, _direction, ref) => {
                                setIsResizingTerminal(false);
                                const nextHeight = ref.offsetHeight;
                                if (!isFloatingTerminal && nextHeight < MIN_TERMINAL_HEIGHT) {
                                    setShowTerminal(false);
                                    setIsMaximizedTerminal(false);
                                    setTerminalHeight(lastExpandedTerminalHeightRef.current);
                                    return;
                                }

                                const snappedHeight = Math.max(nextHeight, MIN_TERMINAL_HEIGHT);
                                setTerminalHeight(snappedHeight);
                                lastExpandedTerminalHeightRef.current = snappedHeight;
                            }}
                            handleStyles={{
                                top: {
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '10px',
                                    cursor: 'row-resize',
                                },
                            }}
                            className={cn(
                                'border border-border/70 flex flex-col overflow-hidden',
                                isFloatingTerminal
                                    ? 'rounded-xl shadow-lg'
                                    : 'border-x-0 border-b-0 shadow-none',
                                isResizingTerminal && 'transition-none'
                            )}
                        >
                            <div className="flex-1 min-h-0">
                                <TerminalPanel
                                    isOpen={ps.showTerminal}
                                    onToggle={() => ps.setShowTerminal(false)}
                                    isMaximized={isMaximizedTerminal}
                                    onMaximizeChange={setIsMaximizedTerminal}
                                    isFloating={isFloatingTerminal}
                                    onFloatingChange={setIsFloatingTerminal}
                                    projectId={project.id}
                                    projectPath={project.path}
                                    tabs={tabs}
                                    activeTabId={activeTabId}
                                    setTabs={setTabs}
                                    setActiveTabId={setActiveTabId}
                                    onOpenFile={openWorkspaceFile}
                                />
                            </div>
                        </Resizable>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modals */}
            <WorkspaceModals
                showMountModal={ps.showMountModal}
                setShowMountModal={ps.setShowMountModal}
                mountForm={wm.mountForm}
                setMountForm={wm.setMountForm}
                addMount={() => {
                    void wm.addMount();
                }}
                pickLocalFolder={() => {
                    void wm.pickLocalFolder();
                }}
                entryModal={ps.entryModal}
                closeEntryModal={() => ps.setEntryModal(null)}
                entryName={ps.entryName}
                setEntryName={ps.setEntryName}
                submitEntryModal={() => {
                    void submitEntryModal();
                }}
                entryBusy={entryBusy}
                selectedCount={ps.selectedEntries.length}
                language={language}
            />

            <LogoGeneratorModal
                isOpen={ps.showLogoModal}
                onClose={() => ps.setShowLogoModal(false)}
                project={project}
                onApply={(logoPath: string) => {
                    void handleUpdateProject({ logo: logoPath }).then(() =>
                        ps.setShowLogoModal(false)
                    ).catch(error => {
                        appLogger.error('ProjectWorkspace', 'Failed to apply generated logo', error as Error);
                    });
                }}
                language={language}
            />

            {/* Global Command Strip */}
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
                    setShowQuickSwitch(true);
                    setQuickSwitchQuery('');
                    setQuickSwitchIndex(0);
                }}
                onMouseDown={handleCommandStripResizeStart}
            />

            {showShortcutHelp && (
                <div className="absolute inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-lg rounded-xl border border-border/50 bg-background p-5 space-y-3">
                        <h3 className="text-sm font-semibold">
                            {t('workspace.shortcuts') || 'Workspace Shortcuts'}
                        </h3>
                        <ul className="text-xs text-muted-foreground space-y-2">
                            <li>Ctrl/Cmd + K — {t('shortcuts.commandPalette') || 'Command palette'}</li>
                            <li>Ctrl/Cmd + P — {t('workspace.quickSwitch') || 'Quick switch tabs'}</li>
                            <li>Ctrl/Cmd + W — {t('workspace.closeTab') || 'Close current tab'}</li>
                            <li>Ctrl/Cmd + / — {t('workspace.shortcuts') || 'Toggle this help'}</li>
                            <li>` — {t('workspace.run') || 'Toggle terminal'}</li>
                        </ul>
                    </div>
                </div>
            )}

            {showQuickSwitch && (
                <WorkspaceQuickSwitch
                    isOpen={showQuickSwitch}
                    onClose={() => setShowQuickSwitch(false)}
                    items={quickSwitchItems}
                    query={quickSwitchQuery}
                    onQueryChange={setQuickSwitchQuery}
                    selectedIndex={quickSwitchIndex}
                    onSelectedIndexChange={setQuickSwitchIndex}
                    onSelect={(tabId) => {
                        wm.setActiveEditorTabId(tabId);
                        setShowQuickSwitch(false);
                    }}
                    t={t}
                />
            )}
            <WorkspaceNotifications notifications={ps.notifications} />
        </div>
    );
};

interface ProjectExplorerPanelProps {
    projectId: string;
    ps: ReturnType<typeof useProjectState>;
    wm: ReturnType<typeof useWorkspaceManager>;
    language: Language;
    onMove?: (entry: WorkspaceEntry, targetDirPath: string) => void;
}

function ProjectExplorerPanel({ projectId, ps, wm, language, onMove }: ProjectExplorerPanelProps) {
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // 8px hareket etmeden sürükleme başlamaz
                delay: 250, // 250ms basılı tutmadan sürükleme başlamaz
                tolerance: 5, // Gecikme süresince 5px'den fazla kayarsa iptal eder
            },
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) {
            return;
        }

        const source = active.data.current as WorkspaceEntry;
        const target = over.data.current as { mountId: string; path: string; isDirectory: boolean };

        if (!source || !target?.isDirectory) {
            return;
        }
        if (source.mountId !== target.mountId) {
            return;
        }

        void onMove?.(source, target.path);
    };

    return (
        <div
            className={cn(
                'flex flex-col border-r border-border/40 bg-background/80 backdrop-blur-xl shrink-0 transition-all duration-300 ease-smooth z-20',
                ps.sidebarCollapsed ? 'w-0 overflow-hidden opacity-0' : 'w-72 opacity-100'
            )}
        >
            <div className="flex-1 overflow-hidden">
                <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                    <WorkspaceExplorer
                        projectId={projectId}
                        mounts={wm.mounts}
                        mountStatus={wm.mountStatus}
                        refreshSignal={wm.refreshSignal}
                        onOpenFile={(...args) => {
                            void wm.openFile(...args);
                        }}
                        onSelectEntry={(entry, e) => {
                            ps.setLastSelectedEntry(entry);

                            if (!e || (!e.ctrlKey && !e.metaKey && !e.shiftKey)) {
                                ps.setSelectedEntries([entry]);
                                return;
                            }

                            if (e.shiftKey && ps.lastSelectedEntry?.mountId === entry.mountId) {
                                // For now, Shift+Click just adds to selection if we don't have a flat list
                                // Proper range selection would require a flattened representation of visible tree items
                                ps.setSelectedEntries(prev => {
                                    const exists = prev.some(p => p.mountId === entry.mountId && p.path === entry.path);
                                    if (exists) {
                                        return prev;
                                    }
                                    return [...prev, entry];
                                });
                                return;
                            }

                            ps.setSelectedEntries(prev => {
                                const exists = prev.some(
                                    p => p.mountId === entry.mountId && p.path === entry.path
                                );
                                if (exists) {
                                    return prev.filter(
                                        p => !(p.mountId === entry.mountId && p.path === entry.path)
                                    );
                                }
                                return [...prev, entry];
                            });
                        }}
                        selectedEntries={ps.selectedEntries}
                        onAddMount={() => ps.setShowMountModal(true)}
                        onRemoveMount={(id: string) => {
                            void wm.persistMounts(wm.mounts.filter(m => m.id !== id));
                        }}
                        onEnsureMount={wm.ensureMountReady}
                        onContextAction={action => {
                            ps.setEntryModal({ type: action.type, entry: action.entry });
                            if (action.type !== 'delete') {
                                ps.setEntryName(action.entry.name);
                            }
                        }}
                        variant="panel"
                        language={language}
                        onMove={onMove}
                    />
                </DndContext>
            </div>
        </div>
    );
}
