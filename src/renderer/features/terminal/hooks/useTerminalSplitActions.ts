import { type MutableRefObject,useCallback } from 'react';
import { z } from 'zod';

import { invokeTypedIpc } from '@/lib/ipc-client';
import { TerminalTab } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import { promptDialog } from '../utils/dialog';
import {
    createCustomSplitPreset,
    incrementSplitAnalytics,
    type SplitAnalytics,
    type SplitPreset,
    TERMINAL_SPLIT_PRESET_LIMIT,
} from '../utils/split-config';
import type { TerminalIpcContract } from '../utils/terminal-ipc';
import { resolveSecondarySplitTabId } from '../utils/terminal-panel-helpers';

interface SplitView {
    primaryId: string;
    secondaryId: string;
    orientation: 'vertical' | 'horizontal';
}

interface UseTerminalSplitActionsParams {
    tabsRef: MutableRefObject<TerminalTab[]>;
    activeTabIdRef: MutableRefObject<string | null>;
    availableShells: { id: string; name: string }[];
    availableBackends: { id: string; name: string; available: boolean }[];
    splitView: SplitView | null;
    splitPresets: SplitPreset[];
    setSplitView: (fn: SplitView | null | ((prev: SplitView | null) => SplitView | null)) => void;
    setSplitFocusedPane: (pane: 'primary' | 'secondary') => void;
    setSplitPresets: (fn: (prev: SplitPreset[]) => SplitPreset[]) => void;
    setSplitAnalytics: (fn: (prev: SplitAnalytics) => SplitAnalytics) => void;
    setIsSynchronizedInputEnabled: (fn: (prev: boolean) => boolean) => void;
    setTerminalContextMenu: (menu: { x: number; y: number } | null) => void;
    createTerminal: (type: string, backendId?: string) => string;
    resolveDefaultBackendId: (backends: { id: string; name: string; available: boolean }[], preferredId?: string | null) => string | undefined;
    completeRecording: () => void;
    recordingCaptureRef: MutableRefObject<{ tabId: string } | null>;
    onToggle: () => void;
    workspaceIssuesTab: TerminalTab | null;
    setTabs: (fn: (prev: TerminalTab[]) => TerminalTab[]) => void;
    setActiveTabId: (id: string | null) => void;
}

export function useTerminalSplitActions({
    tabsRef,
    activeTabIdRef,
    availableShells,
    availableBackends,
    splitView,
    splitPresets,
    setSplitView,
    setSplitFocusedPane,
    setSplitPresets,
    setSplitAnalytics,
    setIsSynchronizedInputEnabled,
    setTerminalContextMenu,
    createTerminal,
    resolveDefaultBackendId,
    completeRecording,
    recordingCaptureRef,
    onToggle,
    workspaceIssuesTab,
    setTabs,
    setActiveTabId,
}: UseTerminalSplitActionsParams) {
    const updateSplitAnalytics = useCallback(
        (kind: keyof Omit<SplitAnalytics, 'lastSplitActionAt'>) => {
            setSplitAnalytics(prev => incrementSplitAnalytics(prev, kind));
        },
        [setSplitAnalytics]
    );

    const applySplitPreset = useCallback(
        (preset: SplitPreset) => {
            const currentTabs = tabsRef.current;
            if (currentTabs.length === 0) {
                return;
            }

            const activeId = activeTabIdRef.current ?? currentTabs[0]?.id;
            if (!activeId) {
                return;
            }

            let secondaryId = resolveSecondarySplitTabId(currentTabs, activeId);
            if (!secondaryId) {
                const activeTab = currentTabs.find(tab => tab.id === activeId);
                const shellId = activeTab?.type ?? availableShells[0]?.id;
                const backendId = activeTab?.backendId ?? resolveDefaultBackendId(availableBackends);
                if (!shellId) {
                    return;
                }
                secondaryId = createTerminal(shellId, backendId);
            }

            setSplitView({
                primaryId: activeId,
                secondaryId,
                orientation: preset.orientation,
            });
            setSplitFocusedPane('primary');
            updateSplitAnalytics('splitPresetApplyCount');

            if (preset.source === 'custom') {
                setSplitPresets(prev =>
                    prev.map(item =>
                        item.id === preset.id ? { ...item, updatedAt: Date.now() } : item
                    )
                );
            }
        },
        [availableBackends, availableShells, createTerminal, resolveDefaultBackendId, updateSplitAnalytics, tabsRef, activeTabIdRef, setSplitView, setSplitFocusedPane, setSplitPresets]
    );

    const saveCurrentSplitAsPreset = useCallback(() => {
        if (!splitView) {
            return;
        }
        const name = promptDialog('Preset name', `Split ${splitPresets.length + 1}`)?.trim();
        if (!name) {
            return;
        }
        const preset = createCustomSplitPreset(name, splitView.orientation);
        setSplitPresets(prev => [preset, ...prev].slice(0, TERMINAL_SPLIT_PRESET_LIMIT));
    }, [splitPresets.length, splitView, setSplitPresets]);

    const renameSplitPreset = useCallback((presetId: string) => {
        setSplitPresets(prev => {
            const target = prev.find(item => item.id === presetId && item.source === 'custom');
            if (!target) {
                return prev;
            }
            const nextName = promptDialog('Rename preset', target.name)?.trim();
            if (!nextName || nextName === target.name) {
                return prev;
            }
            return prev.map(item =>
                item.id === presetId ? { ...item, name: nextName, updatedAt: Date.now() } : item
            );
        });
    }, [setSplitPresets]);

    const deleteSplitPreset = useCallback((presetId: string) => {
        setSplitPresets(prev => prev.filter(item => item.id !== presetId));
    }, [setSplitPresets]);

    const handleSplitTerminal = useCallback(() => {
        const currentTabs = tabsRef.current;
        if (currentTabs.length === 0) {
            setTerminalContextMenu(null);
            return;
        }

        const activeId = activeTabIdRef.current ?? currentTabs[0]?.id;
        if (!activeId) {
            setTerminalContextMenu(null);
            return;
        }

        let secondaryId = resolveSecondarySplitTabId(currentTabs, activeId);
        if (!secondaryId) {
            const activeTab = currentTabs.find(tab => tab.id === activeId);
            const shellId = activeTab?.type ?? availableShells[0]?.id;
            const backendId = activeTab?.backendId ?? resolveDefaultBackendId(availableBackends);
            if (!shellId) {
                setTerminalContextMenu(null);
                return;
            }
            secondaryId = createTerminal(shellId, backendId);
        }

        setSplitView(prev => ({
            primaryId: activeId,
            secondaryId,
            orientation: prev?.orientation ?? 'vertical',
        }));
        setSplitFocusedPane('primary');
        updateSplitAnalytics('splitCreatedCount');
        setTerminalContextMenu(null);
    }, [availableBackends, availableShells, createTerminal, resolveDefaultBackendId, updateSplitAnalytics, tabsRef, activeTabIdRef, setSplitView, setSplitFocusedPane, setTerminalContextMenu]);

    const handleDetachTerminal = useCallback(async () => {
        const currentTabs = tabsRef.current;
        const currentActiveTabId = activeTabIdRef.current;
        const activeId = currentActiveTabId ?? currentTabs[0]?.id;
        if (!activeId) {
            setTerminalContextMenu(null);
            return;
        }

        const tabToDetach = currentTabs.find(tab => tab.id === activeId);
        if (!tabToDetach) {
            setTerminalContextMenu(null);
            return;
        }

        try {
            const detached = await invokeTypedIpc<TerminalIpcContract, 'terminal:detach'>(
                'terminal:detach',
                [{ sessionId: tabToDetach.id }],
                { responseSchema: z.boolean() }
            );
            if (!detached) {
                return;
            }

            if (recordingCaptureRef.current?.tabId === tabToDetach.id) {
                completeRecording();
            }

            const remainingTabs = currentTabs.filter(tab => tab.id !== tabToDetach.id);
            const nextActiveTabId =
                remainingTabs.length === 0
                    ? null
                    : (remainingTabs[remainingTabs.length - 1]?.id ?? null);

            setTabs(prev => prev.filter(tab => tab.id !== tabToDetach.id));
            setActiveTabId(nextActiveTabId);
            activeTabIdRef.current = nextActiveTabId;

            if (remainingTabs.length === 0 && !workspaceIssuesTab) {
                onToggle();
            }
        } catch (error) {
            appLogger.error('TerminalPanel', 'Failed to detach terminal tab', error as Error);
        } finally {
            setTerminalContextMenu(null);
        }
    }, [completeRecording, onToggle, workspaceIssuesTab, setActiveTabId, setTabs, tabsRef, activeTabIdRef, recordingCaptureRef, setTerminalContextMenu]);

    const closeSplitView = useCallback(() => {
        setSplitView(null);
        updateSplitAnalytics('splitClosedCount');
        setTerminalContextMenu(null);
    }, [updateSplitAnalytics, setSplitView, setTerminalContextMenu]);

    const toggleSplitOrientation = useCallback(() => {
        setSplitView(prev => {
            if (!prev) {
                return prev;
            }
            return {
                ...prev,
                orientation: prev.orientation === 'vertical' ? 'horizontal' : 'vertical',
            };
        });
        updateSplitAnalytics('splitOrientationToggleCount');
        setTerminalContextMenu(null);
    }, [updateSplitAnalytics, setSplitView, setTerminalContextMenu]);

    const toggleSynchronizedInput = useCallback(() => {
        setIsSynchronizedInputEnabled(prev => !prev);
        setTerminalContextMenu(null);
    }, [setIsSynchronizedInputEnabled, setTerminalContextMenu]);

    return {
        updateSplitAnalytics,
        applySplitPreset,
        saveCurrentSplitAsPreset,
        renameSplitPreset,
        deleteSplitPreset,
        handleSplitTerminal,
        handleDetachTerminal,
        closeSplitView,
        toggleSplitOrientation,
        toggleSynchronizedInput,
    };
}
