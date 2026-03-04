import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
    pushNotification,
    useNotificationCenterStore,
} from '@/store/notification-center.store';
import { setProjectShellState, useUiLayoutStore } from '@/store/ui-layout.store';
import { WorkspaceEntry } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

const getWorkspaceAgentBridge = () => window.electron.projectAgent;

export function useProjectState() {
    const [selectedEntries, setSelectedEntries] = useState<WorkspaceEntry[]>([]);
    const [lastSelectedEntry, setLastSelectedEntry] = useState<WorkspaceEntry | null>(null);
    const persistedProjectShell = useUiLayoutStore(snapshot => snapshot.projectShell);
    const [sidebarCollapsed, setSidebarCollapsedState] = useState(
        persistedProjectShell.sidebarCollapsed
    );
    const [showAgentPanel, setShowAgentPanel] = useState(false);
    const [agentPanelWidth, setAgentPanelWidthState] = useState(persistedProjectShell.agentPanelWidth);
    const [showTerminal, setShowTerminal] = useState(false);
    const [terminalHeight, setTerminalHeightState] = useState(persistedProjectShell.terminalHeight);
    const [showLogoModal, setShowLogoModal] = useState(false);
    const [agentChatMessage, setAgentChatMessage] = useState('');

    const [showMountModal, setShowMountModal] = useState(false);
    const [entryModal, setEntryModal] = useState<{
        type: 'createFile' | 'createFolder' | 'rename' | 'delete';
        entry: WorkspaceEntry;
    } | null>(null);
    const [entryName, setEntryName] = useState('');

    const activeNotifications = useNotificationCenterStore(snapshot => snapshot.active);
    const recentQuotaInterruptKeysRef = useRef<Set<string>>(new Set());
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
        setSidebarCollapsedState(persistedProjectShell.sidebarCollapsed);
        setAgentPanelWidthState(persistedProjectShell.agentPanelWidth);
        setTerminalHeightState(persistedProjectShell.terminalHeight);
    }, [persistedProjectShell]);

    useEffect(() => {
        const unsubscribe = getWorkspaceAgentBridge().onQuotaInterrupt(payload => {
            const dedupeKey = payload.dedupeKey ?? payload.interruptId;
            if (recentQuotaInterruptKeysRef.current.has(dedupeKey)) {
                return;
            }
            recentQuotaInterruptKeysRef.current.add(dedupeKey);
            if (recentQuotaInterruptKeysRef.current.size > 200) {
                const oldest = recentQuotaInterruptKeysRef.current.values().next().value;
                if (oldest) {
                    recentQuotaInterruptKeysRef.current.delete(oldest);
                }
            }

            const baseMessage = payload.message.trim();
            const selectedInfo = payload.selectedFallback
                ? ` (${payload.selectedFallback.provider}/${payload.selectedFallback.model})`
                : '';
            const finalMessage = payload.blockedByQuota
                ? `Quota interrupt: ${baseMessage}`
                : payload.switched
                    ? `Quota interrupt resolved via fallback${selectedInfo}: ${baseMessage}`
                    : `Quota interrupt: ${baseMessage}`;

            pushNotification({
                type: payload.blockedByQuota ? 'error' : 'warning',
                title: 'Model Quota Interrupt',
                message: finalMessage,
                source: 'project-agent',
            });
        });

        return unsubscribe;
    }, []);

    const setSidebarCollapsed = useCallback((collapsed: boolean) => {
        setSidebarCollapsedState(collapsed);
        setProjectShellState({ sidebarCollapsed: collapsed });
    }, []);

    const setAgentPanelWidth = useCallback((width: number) => {
        const nextWidth = Math.max(260, Math.min(640, Math.floor(width)));
        setAgentPanelWidthState(nextWidth);
        setProjectShellState({ agentPanelWidth: nextWidth });
    }, []);

    const setTerminalHeight = useCallback((height: number) => {
        const nextHeight = Math.max(150, Math.min(900, Math.floor(height)));
        setTerminalHeightState(nextHeight);
        setProjectShellState({ terminalHeight: nextHeight });
    }, []);

    const notify = useCallback((type: 'success' | 'error' | 'info', message: string) => {
        pushNotification({
            type,
            message,
            source: 'workspace',
        });
    }, []);

    const logActivity = useCallback((title: string, detail?: string) => {
        appLogger.warn('Activity', `${title}: ${detail}`);
    }, []);

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
        showLogoModal,
        setShowLogoModal,
        agentChatMessage,
        setAgentChatMessage,
        showMountModal,
        setShowMountModal,
        entryModal,
        setEntryModal,
        entryName,
        setEntryName,
        notifications,
        notify,
        logActivity,
    };
}
