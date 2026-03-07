import { useCallback, useMemo } from 'react';

import { cn } from '@/lib/utils';

import { TERMINAL_WORKSPACE_ISSUES_TAB_ID } from '../constants/terminal-panel-constants';
import { DEFAULT_SPLIT_PRESETS } from '../utils/split-config';

import type { TerminalPanelCoreResult } from './useTerminalPanelCore';

/**
 * Hook for terminal panel tab interactions and derived state.
 * Handles tab drag/drop, selection, pane activation, layout classes,
 * and derived computations like semantic counts and backend categorization.
 */
 
export function useTerminalPanelBehavior(core: TerminalPanelCoreResult) {
    const {
        activeTabId, setActiveTabId,
        draggingTabId, setDraggingTabId,
        setDragOverTabId,
        setIsGalleryView,
        setIsSearchOpen,
        setIsSemanticPanelOpen,
        setIsMultiplexerOpen,
        setIsRecordingPanelOpen,
        semanticIssuesByTab,
        splitLayout, backends, recording, tabActions,
    } = core;

    const { splitView, setSplitView, setSplitFocusedPane, splitFocusedPane, splitPresets } = splitLayout;

    // --- Tab drag/drop handlers ---
    const handleTabDragStart = useCallback(
        (event: React.DragEvent<HTMLButtonElement>, tabId: string) => {
            setDraggingTabId(tabId);
            setDragOverTabId(tabId);
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', tabId);
        },
        [setDraggingTabId, setDragOverTabId]
    );

    const handleTabDragOver = useCallback(
        (event: React.DragEvent<HTMLButtonElement>, tabId: string) => {
            if (!draggingTabId || draggingTabId === tabId) {
                return;
            }
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            setDragOverTabId(tabId);
        },
        [draggingTabId, setDragOverTabId]
    );

    const resetTabDragState = useCallback(() => {
        setDraggingTabId(null);
        setDragOverTabId(null);
    }, [setDraggingTabId, setDragOverTabId]);

    const handleTabDrop = useCallback(
        (event: React.DragEvent<HTMLButtonElement>, tabId: string) => {
            event.preventDefault();
            const sourceId = draggingTabId || event.dataTransfer.getData('text/plain');
            if (!sourceId || sourceId === tabId) {
                resetTabDragState();
                return;
            }
            tabActions.reorderTabs(sourceId, tabId);
            resetTabDragState();
        },
        [draggingTabId, tabActions, resetTabDragState]
    );

    // --- Tab select ---
    const handleTabSelect = useCallback(
        (tabId: string) => {
            if (tabId === TERMINAL_WORKSPACE_ISSUES_TAB_ID) {
                setActiveTabId(tabId);
                setSplitView(null);
                setIsGalleryView(false);
                setIsSearchOpen(false);
                setIsSemanticPanelOpen(false);
                core.commandTools.setIsCommandHistoryOpen(false);
                core.commandTools.setIsTaskRunnerOpen(false);
                setIsMultiplexerOpen(false);
                setIsRecordingPanelOpen(false);
                return;
            }
            setActiveTabId(tabId);
            if (!splitView) {
                return;
            }
            if (splitView.primaryId === tabId) {
                setSplitFocusedPane('primary');
                return;
            }
            if (splitView.secondaryId === tabId) {
                setSplitFocusedPane('secondary');
                return;
            }
            setSplitView(prev => {
                if (!prev) {
                    return prev;
                }
                return splitFocusedPane === 'primary'
                    ? { ...prev, primaryId: tabId }
                    : { ...prev, secondaryId: tabId };
            });
        },
        [
            setActiveTabId,
            core.commandTools,
            setSplitFocusedPane,
            setSplitView,
            splitFocusedPane,
            splitView,
            setIsGalleryView,
            setIsSearchOpen,
            setIsSemanticPanelOpen,
            setIsMultiplexerOpen,
            setIsRecordingPanelOpen,
        ]
    );

    // --- Pane activate ---
    const handlePaneActivate = useCallback(
        (tabId: string) => {
            setActiveTabId(tabId);
            if (!splitView) {
                return;
            }
            setSplitFocusedPane(splitView.primaryId === tabId ? 'primary' : 'secondary');
        },
        [setActiveTabId, splitView, setSplitFocusedPane]
    );

    // --- Tab layout class ---
    const getTabLayoutClass = useCallback(
        (tabId: string) => {
            if (!splitView) {
                return tabId === activeTabId ? 'absolute inset-0' : 'absolute inset-0';
            }

            if (tabId === splitView.primaryId) {
                if (splitView.orientation === 'vertical') {
                    return cn(
                        'absolute inset-y-0 left-0 w-1/2 border-r border-border/60',
                        activeTabId === tabId && 'ring-1 ring-inset ring-primary/40'
                    );
                }
                return cn(
                    'absolute inset-x-0 top-0 h-1/2 border-b border-border/60',
                    activeTabId === tabId && 'ring-1 ring-inset ring-primary/40'
                );
            }

            if (tabId === splitView.secondaryId) {
                if (splitView.orientation === 'vertical') {
                    return cn(
                        'absolute inset-y-0 right-0 w-1/2',
                        activeTabId === tabId && 'ring-1 ring-inset ring-primary/40'
                    );
                }
                return cn(
                    'absolute inset-x-0 bottom-0 h-1/2',
                    activeTabId === tabId && 'ring-1 ring-inset ring-primary/40'
                );
            }

            return 'absolute inset-0';
        },
        [activeTabId, splitView]
    );

    // --- Semantic issues ---
    const activeSemanticIssues = activeTabId ? (semanticIssuesByTab[activeTabId] ?? []) : [];
    const activeSemanticErrorCount = activeSemanticIssues.filter(
        issue => issue.severity === 'error'
    ).length;
    const activeSemanticWarningCount = activeSemanticIssues.filter(
        issue => issue.severity === 'warning'
    ).length;

    // --- Backend categorization ---
    const resolvedDefaultBackendId = backends.resolveDefaultBackendId(backends.availableBackends);
    const backendCategories = useMemo(() => {
        const selectable: typeof backends.availableBackends = [];
        const launchable: typeof backends.availableBackends = [];
        let integrated: (typeof backends.availableBackends)[number] | undefined;
        let defaultName = 'Unknown';

        for (const backend of backends.availableBackends) {
            if (!backend.available) {
                continue;
            }
            selectable.push(backend);
            if (backend.id === 'node-pty') {
                integrated = backend;
            } else {
                launchable.push(backend);
            }
            if (backend.id === resolvedDefaultBackendId) {
                defaultName = backend.name;
            }
        }

        return {
            selectableBackends: selectable,
            integratedBackend: integrated,
            launchableExternalBackends: launchable,
            defaultBackendName: defaultName,
        };
    }, [backends, resolvedDefaultBackendId]);

    // --- Misc derived ---
    const isLoadingLaunchOptions = backends.isLoadingShells || backends.isLoadingBackends;
    const hasRemoteConnections = backends.remoteSshProfiles.length > 0 || backends.remoteDockerContainers.length > 0;
    const splitPresetOptions = useMemo(
        () => [...DEFAULT_SPLIT_PRESETS, ...splitPresets],
        [splitPresets]
    );

    const terminalChromeStyle = {
        backgroundColor: `hsl(var(--background) / ${core.terminalAppearance.surfaceOpacity})`,
        backdropFilter: `blur(${core.terminalAppearance.surfaceBlur}px)`,
    };

    const selectedRecordingText = recording.selectedRecording
        ? recording.selectedRecording.events
            .filter(event => event.type === 'data')
            .map(event => event.data)
            .join('')
            .slice(-24000)
        : '';
    const activeRecordingLabel = recording.activeRecordingTabId
        ? core.tabById.get(recording.activeRecordingTabId)?.name ?? recording.activeRecordingTabId
        : null;

    return {
        // Tab interactions
        handleTabDragStart,
        handleTabDragOver,
        resetTabDragState,
        handleTabDrop,
        handleTabSelect,
        handlePaneActivate,
        getTabLayoutClass,
        // Semantic
        activeSemanticIssues,
        activeSemanticErrorCount,
        activeSemanticWarningCount,
        // Backend categories
        resolvedDefaultBackendId,
        ...backendCategories,
        // Misc
        isLoadingLaunchOptions,
        hasRemoteConnections,
        splitPresetOptions,
        terminalChromeStyle,
        selectedRecordingText,
        activeRecordingLabel,
    };
}

/** Return type of the behavior hook */
export type TerminalPanelBehaviorResult = ReturnType<typeof useTerminalPanelBehavior>;
