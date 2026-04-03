import { useCallback, useEffect, useMemo, useState } from 'react';

import {
    pushNotification,
    useNotificationCenterStore,
} from '@/store/notification-center.store';
import {
    selectWorkspaceShellState,
    setWorkspaceShellState,
    useUiLayoutStore,
    WorkspaceShellState,
} from '@/store/ui-layout.store';
import {
    setWorkspaceExplorerLastSelectedEntry,
    setWorkspaceExplorerSelectedEntries,
    useWorkspaceExplorerStore,
} from '@/store/workspace-explorer.store';
import { WorkspaceEntry } from '@/types';
import { translateErrorMessage } from '@/utils/error-handler.util';
import { appLogger } from '@/utils/renderer-logger';

export function useWorkspaceState(workspaceId: string) {
    const selectedEntries = useWorkspaceExplorerStore(
        workspaceId,
        snapshot => snapshot.selectedEntries
    );
    const lastSelectedEntry = useWorkspaceExplorerStore(
        workspaceId,
        snapshot => snapshot.lastSelectedEntry
    );
    const persistedWorkspaceShell = useUiLayoutStore(snapshot =>
        selectWorkspaceShellState(snapshot, workspaceId)
    );
    const [sidebarCollapsed, setSidebarCollapsedState] = useState(
        persistedWorkspaceShell.sidebarCollapsed
    );
    const [showAgentPanel, setShowAgentPanelState] = useState(
        persistedWorkspaceShell.showAgentPanel
    );
    const [agentPanelWidth, setAgentPanelWidthState] = useState(persistedWorkspaceShell.agentPanelWidth);
    const [showTerminal, setShowTerminalState] = useState(
        persistedWorkspaceShell.showTerminal
    );
    const [terminalHeight, setTerminalHeightState] = useState(persistedWorkspaceShell.terminalHeight);
    const [terminalFloating, setTerminalFloatingState] = useState(
        persistedWorkspaceShell.terminalFloating
    );
    const [terminalMaximized, setTerminalMaximizedState] = useState(
        persistedWorkspaceShell.terminalMaximized
    );

    const [showMountModal, setShowMountModal] = useState(false);
    const [showLogoModal, setShowLogoModal] = useState(false);
    const [entryModal, setEntryModal] = useState<{
        type: 'createFile' | 'createFolder' | 'rename' | 'delete';
        entry: WorkspaceEntry;
    } | null>(null);
    const [entryName, setEntryName] = useState('');

    const activeNotifications = useNotificationCenterStore(snapshot => snapshot.active);
    const notifications = useMemo(
        () =>
            activeNotifications.map(notification => ({
                id: notification.id,
                type: notification.type === 'warning' ? 'info' : notification.type,
                message: notification.message,
            })),
        [activeNotifications]
    );

    useEffect(() => {
        setSidebarCollapsedState(persistedWorkspaceShell.sidebarCollapsed);
        setShowAgentPanelState(persistedWorkspaceShell.showAgentPanel);
        setAgentPanelWidthState(persistedWorkspaceShell.agentPanelWidth);
        setShowTerminalState(persistedWorkspaceShell.showTerminal);
        setTerminalHeightState(persistedWorkspaceShell.terminalHeight);
        setTerminalFloatingState(persistedWorkspaceShell.terminalFloating);
        setTerminalMaximizedState(persistedWorkspaceShell.terminalMaximized);
    }, [persistedWorkspaceShell]);

    const setSidebarCollapsed = useCallback((collapsed: boolean) => {
        setSidebarCollapsedState(collapsed);
        setWorkspaceShellState(workspaceId, { sidebarCollapsed: collapsed });
    }, [workspaceId]);

    const setShowAgentPanel = useCallback((show: boolean) => {
        setShowAgentPanelState(show);
        setWorkspaceShellState(workspaceId, { showAgentPanel: show });
    }, [workspaceId]);

    const setAgentPanelWidth = useCallback((width: number) => {
        const nextWidth = Math.max(260, Math.min(640, Math.floor(width)));
        setAgentPanelWidthState(nextWidth);
        setWorkspaceShellState(workspaceId, { agentPanelWidth: nextWidth });
    }, [workspaceId]);

    const setShowTerminal = useCallback((show: boolean) => {
        setShowTerminalState(show);
        setWorkspaceShellState(workspaceId, { showTerminal: show });
    }, [workspaceId]);

    const setTerminalHeight = useCallback((height: number) => {
        const nextHeight = Math.max(150, Math.min(900, Math.floor(height)));
        setTerminalHeightState(nextHeight);
        setWorkspaceShellState(workspaceId, { terminalHeight: nextHeight });
    }, [workspaceId]);

    const setTerminalLayoutState = useCallback((
        update: Partial<Pick<
            WorkspaceShellState,
            'terminalFloating' | 'terminalMaximized'
        >>
    ) => {
        const nextFloating = update.terminalFloating ?? terminalFloating;
        const nextMaximized = update.terminalMaximized ?? terminalMaximized;
        setTerminalFloatingState(nextFloating);
        setTerminalMaximizedState(nextMaximized);
        setWorkspaceShellState(workspaceId, {
            terminalFloating: nextFloating,
            terminalMaximized: nextMaximized,
        });
    }, [terminalFloating, terminalMaximized, workspaceId]);

    const notify = useCallback((type: 'success' | 'error' | 'info', message: string) => {
        const resolvedMessage = type === 'error' ? translateErrorMessage(message) : message;
        pushNotification({
            type,
            message: resolvedMessage,
            source: 'workspace',
        });
    }, []);

    const logActivity = useCallback((title: string, detail?: string) => {
        appLogger.warn('Activity', `${title}: ${detail}`);
    }, []);

    const setSelectedEntries = useCallback(
        (update: WorkspaceEntry[] | ((prevState: WorkspaceEntry[]) => WorkspaceEntry[])) => {
            setWorkspaceExplorerSelectedEntries(workspaceId, update);
        },
        [workspaceId]
    );

    const setLastSelectedEntry = useCallback(
        (entry: WorkspaceEntry | null) => {
            setWorkspaceExplorerLastSelectedEntry(workspaceId, entry);
        },
        [workspaceId]
    );

    return {
        selectedEntries,
        setSelectedEntries,
        lastSelectedEntry,
        setLastSelectedEntry,
        sidebarCollapsed,
        setSidebarCollapsed,
        showAgentPanel,
        setShowAgentPanel,
        agentPanelWidth,
        setAgentPanelWidth,
        showTerminal,
        setShowTerminal,
        terminalHeight,
        setTerminalHeight,
        terminalFloating,
        terminalMaximized,
        setTerminalLayoutState,
        showMountModal,
        setShowMountModal,
        showLogoModal,
        setShowLogoModal,
        entryModal,
        setEntryModal,
        entryName,
        setEntryName,
        notifications,
        notify,
        logActivity,
    };
}
