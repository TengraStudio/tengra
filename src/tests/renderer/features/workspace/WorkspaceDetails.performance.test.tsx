import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceDetails } from '@/features/workspace/components/WorkspaceDetails';
import { Workspace } from '@/types';

const renderCounters = vi.hoisted(() => ({
    toolbar: 0,
    explorer: 0,
    sidebar: 0,
}));

const chatStreamStore = vi.hoisted(() => {
    let messageCount = 0;
    const listeners = new Set<() => void>();

    return {
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        getSnapshot() {
            return messageCount;
        },
        pushMessage() {
            messageCount += 1;
            listeners.forEach(listener => {
                listener();
            });
        },
        reset() {
            messageCount = 0;
            listeners.clear();
        },
    };
});

const workspaceControllerState = vi.hoisted(() => ({
    ps: {
        showTerminal: false,
        setShowTerminal: vi.fn(),
        terminalHeight: 320,
        setTerminalHeight: vi.fn(),
        showAgentPanel: true,
        setShowAgentPanel: vi.fn(),
        sidebarCollapsed: false,
        setSidebarCollapsed: vi.fn(),
        agentPanelWidth: 350,
        setAgentPanelWidth: vi.fn(),
        agentChatMessage: '',
        setAgentChatMessage: vi.fn(),
        notifications: [],
        selectedEntries: [],
        setSelectedEntries: vi.fn(),
        showMountModal: false,
        setShowMountModal: vi.fn(),
        showLogoModal: false,
        setShowLogoModal: vi.fn(),
        notify: vi.fn(),
    },
    wm: {
        dashboardTab: 'overview' as const,
        setDashboardTab: vi.fn(),
        openTabs: [],
        activeTabId: null,
        setActiveEditorTabId: vi.fn(),
        closeTab: vi.fn(),
        togglePinTab: vi.fn(),
        closeAllTabs: vi.fn(),
        closeTabsToRight: vi.fn(),
        closeOtherTabs: vi.fn(),
        copyTabAbsolutePath: vi.fn().mockResolvedValue(undefined),
        copyTabRelativePath: vi.fn().mockResolvedValue(undefined),
        revealTabInExplorer: vi.fn(),
        activeTab: null,
        updateTabContent: vi.fn(),
        mounts: [{ id: 'mount-1' }],
        openFile: vi.fn(),
        moveEntry: vi.fn(),
    },
    handleUpdateWorkspace: vi.fn().mockResolvedValue(undefined),
    submitEntryModal: vi.fn().mockResolvedValue(undefined),
    entryBusy: false,
    t: (key: string) => key,
    onRender: vi.fn(),
}));

const workspaceMainHandlers = vi.hoisted(() => ({
    onUploadLogo: null as (() => void) | null,
    onGenerateLogo: null as (() => void) | null,
}));

vi.mock('@renderer/features/workspace/workspace-shell/WorkspaceToolbar', async () => {
    const React = await vi.importActual<typeof import('react')>('react');

    return {
        WorkspaceToolbar: () => {
            renderCounters.toolbar += 1;
            return React.createElement('div', { 'data-testid': 'workspace-toolbar' });
        },
    };
});

vi.mock('@renderer/features/workspace/workspace-explorer/WorkspaceExplorerPanel', async () => {
    const React = await vi.importActual<typeof import('react')>('react');

    return {
        WorkspaceExplorerPanel: () => {
            renderCounters.explorer += 1;
            return React.createElement('div', { 'data-testid': 'workspace-explorer' });
        },
    };
});

vi.mock('@renderer/features/workspace/workspace-shell/WorkspaceSidebar', async () => {
    const React = await vi.importActual<typeof import('react')>('react');

    return {
        WorkspaceSidebar: () => {
            renderCounters.sidebar += 1;
            const messageCount = React.useSyncExternalStore(
                chatStreamStore.subscribe,
                chatStreamStore.getSnapshot,
                chatStreamStore.getSnapshot
            );
            return React.createElement(
                'div',
                { 'data-testid': 'workspace-sidebar' },
                `messages:${messageCount}`
            );
        },
    };
});

vi.mock('@renderer/features/workspace/workspace-shell/WorkspaceMain', async () => {
    const React = await vi.importActual<typeof import('react')>('react');
    return {
        WorkspaceMain: (props: { onUploadLogo: () => void; onGenerateLogo?: () => void }) => {
            workspaceMainHandlers.onUploadLogo = props.onUploadLogo;
            workspaceMainHandlers.onGenerateLogo = props.onGenerateLogo ?? null;
            return React.createElement(
                'div',
                { 'data-testid': 'workspace-main' },
                React.createElement(
                    'button',
                    {
                        type: 'button',
                        'data-testid': 'workspace-main-upload-logo',
                        onClick: props.onUploadLogo,
                    },
                    'upload-logo'
                ),
                React.createElement(
                    'button',
                    {
                        type: 'button',
                        'data-testid': 'workspace-main-generate-logo',
                        onClick: () => {
                            props.onGenerateLogo?.();
                        },
                    },
                    'generate-logo'
                )
            );
        },
    };
});

vi.mock('@renderer/features/workspace/workspace-shell/WorkspaceTerminalLayer', async () => {
    const React = await vi.importActual<typeof import('react')>('react');
    return {
        WorkspaceTerminalLayer: () =>
            React.createElement('div', { 'data-testid': 'workspace-terminal-layer' }),
    };
});

vi.mock('@renderer/features/workspace/workspace-shell/WorkspaceDialogs', () => ({
    WorkspaceDialogs: () => null,
}));

vi.mock('@renderer/features/workspace/workspace-shell/CommandStrip', () => ({
    CommandStrip: () => null,
}));

vi.mock('@renderer/features/workspace/workspace-shell/ShortcutHelpOverlay', () => ({
    ShortcutHelpOverlay: () => null,
}));

vi.mock('@renderer/features/workspace/workspace-shell/WorkspaceNotifications', () => ({
    WorkspaceNotifications: () => null,
}));

vi.mock('@renderer/features/workspace/workspace-shell/WorkspaceQuickSwitch', () => ({
    WorkspaceQuickSwitch: () => null,
}));

vi.mock('@/features/workspace/hooks/useWorkspaceWorkspaceController', () => ({
    useWorkspaceDetailsController: () => workspaceControllerState,
}));

vi.mock('@/features/workspace/hooks/useTerminalLayout', () => ({
    useTerminalLayout: () => ({ 
        isMaximizedTerminal: false,
        setIsMaximizedTerminal: vi.fn(),
        isResizingTerminal: false,
        setIsResizingTerminal: vi.fn(), 
        dockedTerminalRightInsetPx: 0,
        lastExpandedTerminalHeightRef: { current: 320 },
        handleCommandStripResizeStart: vi.fn(),
    }),
}));

vi.mock('@/features/workspace/hooks/useQuickSwitch', () => ({
    useQuickSwitch: () => ({
        showShortcutHelp: false,
        setShowShortcutHelp: vi.fn(),
        showQuickSwitch: false,
        setShowQuickSwitch: vi.fn(),
        quickSwitchItems: [],
        quickSwitchQuery: '',
        setQuickSwitchQuery: vi.fn(),
        quickSwitchIndex: 0,
        setQuickSwitchIndex: vi.fn(),
    }),
}));

vi.mock('@/features/workspace/hooks/useWorkspaceBranchState', () => ({
    useWorkspaceBranchState: () => ({
        currentBranchName: 'main',
        availableBranches: ['main'],
        isBranchLoading: false,
        isBranchSwitching: false,
        handleBranchSelect: vi.fn(),
    }),
}));

vi.mock('@/features/workspace/hooks/useWorkspaceShortcuts', () => ({
    useWorkspaceShortcuts: () => undefined,
}));

vi.mock('@/features/workspace/hooks/useWorkspaceTaskRunner', () => ({
    useWorkspaceTaskRunner: () => ({
        tasks: [],
        runningTaskCount: 0,
        runDefaultTask: vi.fn(),
        stopTask: vi.fn(),
    }),
}));

vi.mock('@/hooks/useRenderTracker', () => ({
    useRenderTracker: () => undefined,
}));

vi.mock('@/hooks/useWorkspaceProfiler', () => ({
    useWorkspaceProfiler: () => ({
        onRender: vi.fn(),
    }),
}));

const workspaceFixture: Workspace = {
    id: 'workspace-performance',
    title: 'Performance Workspace',
    description: 'Perf regression fixture',
    path: 'C:\\workspaces\\performance',
    mounts: [
        {
            id: 'mount-1',
            name: 'Local',
            type: 'local',
            rootPath: 'C:\\workspaces\\performance',
        },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    chatIds: [],
    councilConfig: {
        enabled: false,
        members: [],
        consensusThreshold: 0.7,
    },
    status: 'active',
};

describe('WorkspaceDetails performance boundaries', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        renderCounters.toolbar = 0;
        renderCounters.explorer = 0;
        renderCounters.sidebar = 0;
        chatStreamStore.reset();

        Object.defineProperty(window, 'electron', {
            value: {
                workspace: {
                    setActive: vi.fn().mockResolvedValue({ rootPath: workspaceFixture.path }),
                    clearActive: vi.fn().mockResolvedValue({ rootPath: null }),
                    uploadLogo: vi.fn().mockResolvedValue('C:\\workspaces\\performance\\.tengra\\logo.png'),
                },
            },
            configurable: true,
            writable: true,
        });

        window.requestAnimationFrame = vi.fn(() => 1);
        window.cancelAnimationFrame = vi.fn();
        workspaceMainHandlers.onUploadLogo = null;
        workspaceMainHandlers.onGenerateLogo = null;
    });

    it('keeps toolbar and explorer stable during chat-stream-only updates', () => {
        render(
            <WorkspaceDetails
                workspace={workspaceFixture}
                onBack={vi.fn()}
                onDeleteWorkspace={vi.fn()}
                language="en"
                tabs={[]}
                activeTabId={null}
                setTabs={vi.fn()}
                setActiveTabId={vi.fn()}
            />
        );

        expect(screen.getByTestId('workspace-toolbar')).toBeInTheDocument();
        expect(screen.getByTestId('workspace-explorer')).toBeInTheDocument();
        expect(screen.getByTestId('workspace-sidebar')).toHaveTextContent('messages:0');
        expect(renderCounters.toolbar).toBe(1);
        expect(renderCounters.explorer).toBe(1);
        expect(renderCounters.sidebar).toBe(1);

        act(() => {
            chatStreamStore.pushMessage();
        });

        expect(screen.getByTestId('workspace-sidebar')).toHaveTextContent('messages:1');
        expect(renderCounters.toolbar).toBe(1);
        expect(renderCounters.explorer).toBe(1);
        expect(renderCounters.sidebar).toBe(2);
    });

    it('uploads logo directly from workspace header flow and updates workspace data', async () => {
        render(
            <WorkspaceDetails
                workspace={workspaceFixture}
                onBack={vi.fn()}
                onDeleteWorkspace={vi.fn()}
                language="en"
                tabs={[]}
                activeTabId={null}
                setTabs={vi.fn()}
                setActiveTabId={vi.fn()}
            />
        );

        fireEvent.click(screen.getByTestId('workspace-main-upload-logo'));

        await waitFor(() => {
            expect(workspaceControllerState.handleUpdateWorkspace).toHaveBeenCalledWith(
                expect.objectContaining({
                    logo: 'C:\\workspaces\\performance\\.tengra\\logo.png',
                    updatedAt: expect.any(Number),
                })
            );
        });
    });

    it('keeps generator modal path available from workspace header flow', () => {
        render(
            <WorkspaceDetails
                workspace={workspaceFixture}
                onBack={vi.fn()}
                onDeleteWorkspace={vi.fn()}
                language="en"
                tabs={[]}
                activeTabId={null}
                setTabs={vi.fn()}
                setActiveTabId={vi.fn()}
            />
        );

        fireEvent.click(screen.getByTestId('workspace-main-generate-logo'));

        expect(workspaceControllerState.ps.setShowLogoModal).toHaveBeenCalledWith(true);
    });
});
