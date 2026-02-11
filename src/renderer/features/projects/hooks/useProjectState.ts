import { useCallback, useState } from 'react';

import { WorkspaceEntry } from '@/types';

export function useProjectState() {
    const [selectedEntries, setSelectedEntries] = useState<WorkspaceEntry[]>([]);
    const [lastSelectedEntry, setLastSelectedEntry] = useState<WorkspaceEntry | null>(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [showAgentPanel, setShowAgentPanel] = useState(false);
    const [agentPanelWidth, setAgentPanelWidth] = useState(380);
    const [showTerminal, setShowTerminal] = useState(false);
    const [terminalHeight, setTerminalHeight] = useState(250);
    const [showLogoModal, setShowLogoModal] = useState(false);
    const [agentChatMessage, setAgentChatMessage] = useState('');

    const [showMountModal, setShowMountModal] = useState(false);
    const [entryModal, setEntryModal] = useState<{
        type: 'createFile' | 'createFolder' | 'rename' | 'delete';
        entry: WorkspaceEntry;
    } | null>(null);
    const [entryName, setEntryName] = useState('');

    const [notifications, setNotifications] = useState<
        { id: string; type: 'success' | 'error' | 'info'; message: string }[]
    >([]);

    const notify = useCallback((type: 'success' | 'error' | 'info', message: string) => {
        const id = Math.random().toString(36).substr(2, 9);
        setNotifications(prev => [...prev, { id, type, message }]);
        setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000);
    }, []);

    const logActivity = useCallback((title: string, detail?: string) => {
        console.warn(`[Activity] ${title}: ${detail}`);
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
