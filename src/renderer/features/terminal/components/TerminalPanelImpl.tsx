import { useTranslation } from '@renderer/i18n';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';

import { useTheme } from '@/hooks/useTheme';
import { motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';
import { TerminalTab } from '@/types';

import {
    DEFAULT_TERMINAL_APPEARANCE,
    TERMINAL_APPEARANCE_STORAGE_KEY,
    TERMINAL_MANAGER_MODULE_VERSION,
    TERMINAL_PASTE_HISTORY_LIMIT,
    TERMINAL_PASTE_HISTORY_STORAGE_KEY,
    TERMINAL_PREFERRED_BACKEND_STORAGE_KEY,
    TERMINAL_PROJECT_ISSUES_TAB_ID,
    TERMINAL_SEARCH_HISTORY_LIMIT,
    TERMINAL_SEARCH_HISTORY_STORAGE_KEY,
    TERMINAL_SHORTCUTS_STORAGE_KEY,
    TERMINAL_SPLIT_ANALYTICS_STORAGE_KEY,
    TERMINAL_SPLIT_LAYOUT_STORAGE_KEY,
    TERMINAL_SPLIT_PRESETS_STORAGE_KEY,
    TERMINAL_SYNC_INPUT_STORAGE_KEY,
} from '../constants/terminal-panel-constants';
import { useTerminalAI } from '../hooks/useTerminalAI';
import { useTerminalAiActions } from '../hooks/useTerminalAiActions';
import { useTerminalAppearance } from '../hooks/useTerminalAppearance';
import { useTerminalBackendsAndRemote } from '../hooks/useTerminalBackendsAndRemote';
import { useTerminalBootstrapEffects } from '../hooks/useTerminalBootstrapEffects';
import { useTerminalClipboardActions } from '../hooks/useTerminalClipboardActions';
import { useTerminalCommandTools } from '../hooks/useTerminalCommandTools';
import { useTerminalInputBroadcast } from '../hooks/useTerminalInputBroadcast';
import { useTerminalLifecycle } from '../hooks/useTerminalLifecycle';
import { useTerminalMultiplexer } from '../hooks/useTerminalMultiplexer';
import { useTerminalPanelToggles } from '../hooks/useTerminalPanelToggles';
import { useTerminalPasteHistory } from '../hooks/useTerminalPasteHistory';
import { useTerminalPreferenceActions } from '../hooks/useTerminalPreferenceActions';
import { useTerminalRecording } from '../hooks/useTerminalRecording';
import { useTerminalSearch } from '../hooks/useTerminalSearch';
import { useTerminalSearchActions } from '../hooks/useTerminalSearchActions';
import { useTerminalSemanticAnalysis } from '../hooks/useTerminalSemanticAnalysis';
import { useTerminalShortcuts } from '../hooks/useTerminalShortcuts';
import { useTerminalSplitActions } from '../hooks/useTerminalSplitActions';
import { useTerminalSplitLayout } from '../hooks/useTerminalSplitLayout';
import { useTerminalState } from '../hooks/useTerminalState';
import { useTerminalTabActions } from '../hooks/useTerminalTabActions';
import { DEFAULT_SPLIT_PRESETS, TERMINAL_SPLIT_PRESET_LIMIT } from '../utils/split-config';
import { createTerminalShortcutEventHandler } from '../utils/terminal-event-handlers';

import type { TerminalPanelProps } from './TerminalPanel';
import { TerminalPanelOverlaysConnector } from './TerminalPanelOverlaysConnector';
import { TerminalPanelToolbarConnector } from './TerminalPanelToolbarConnector';
import { TerminalProjectIssuesTab } from './TerminalProjectIssuesTab';
import { TerminalSplitView } from './TerminalSplitView';

// eslint-disable-next-line max-lines-per-function
export function TerminalPanelContentImpl({
    isOpen,
    onToggle,
    isMaximized: isMaximizedProp = false,
    onMaximizeChange: onMaximizeChangeProp,
    isFloating = false,
    onFloatingChange,
    projectId,
    projectPath,
    tabs,
    activeTabId,
    setTabs,
    setActiveTabId,
    onOpenFile,
}: TerminalPanelProps) {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const {
        isMaximizedLocal,
        setIsMaximizedLocal,
        isNewTerminalMenuOpen,
        setIsNewTerminalMenuOpen,
        terminalContextMenu,
        setTerminalContextMenu,
        draggingTabId,
        setDraggingTabId,
        dragOverTabId,
        setDragOverTabId,
        isSearchOpen,
        setIsSearchOpen,
        isGalleryView,
        setIsGalleryView,
        isAppearanceMenuOpen,
        setIsAppearanceMenuOpen,
        isSemanticPanelOpen,
        setIsSemanticPanelOpen,
        isMultiplexerOpen,
        setIsMultiplexerOpen,
        isRecordingPanelOpen,
        setIsRecordingPanelOpen,
        isAiPanelOpen,
        setIsAiPanelOpen,
    } = useTerminalState();

    const isMaximized = onMaximizeChangeProp ? isMaximizedProp : isMaximizedLocal;
    const setIsMaximized = onMaximizeChangeProp ?? setIsMaximizedLocal;

    const {
        splitView,
        setSplitView,
        splitFocusedPane,
        setSplitFocusedPane,
        isSynchronizedInputEnabled,
        setIsSynchronizedInputEnabled,
        isSplitPresetMenuOpen,
        setIsSplitPresetMenuOpen,
        splitPresets,
        setSplitPresets,
        splitAnalytics,
        setSplitAnalytics,
    } = useTerminalSplitLayout({
        tabs,
        syncInputStorageKey: TERMINAL_SYNC_INPUT_STORAGE_KEY,
        splitPresetsStorageKey: TERMINAL_SPLIT_PRESETS_STORAGE_KEY,
        splitLayoutStorageKey: TERMINAL_SPLIT_LAYOUT_STORAGE_KEY,
        splitAnalyticsStorageKey: TERMINAL_SPLIT_ANALYTICS_STORAGE_KEY,
        splitPresetLimit: TERMINAL_SPLIT_PRESET_LIMIT,
    });

    const { semanticIssuesByTab, parseSemanticChunk, clearSemanticIssues } =
        useTerminalSemanticAnalysis({ tabs });

    const {
        searchQuery,
        setSearchQuery,
        searchUseRegex,
        setSearchUseRegex,
        searchStatus,
        setSearchStatus,
        searchMatches,
        setSearchMatches,
        searchActiveMatchIndex,
        setSearchActiveMatchIndex,
        searchHistory,
        setSearchHistory,
        searchHistoryIndex,
        setSearchHistoryIndex,
        searchInputRef,
        searchCursorRef,
    } = useTerminalSearch({
        storageKey: TERMINAL_SEARCH_HISTORY_STORAGE_KEY,
        historyLimit: TERMINAL_SEARCH_HISTORY_LIMIT,
    });

    const {
        isLoadingShells,
        isLoadingBackends,
        availableShells,
        availableBackends,
        isLoadingRemoteConnections,
        remoteSshProfiles,
        remoteDockerContainers,
        fetchAvailableShells,
        fetchAvailableBackends,
        fetchRemoteConnections,
        resolveDefaultBackendId,
        persistPreferredBackendId,
    } = useTerminalBackendsAndRemote({
        preferredBackendStorageKey: TERMINAL_PREFERRED_BACKEND_STORAGE_KEY,
    });

    const { terminalAppearance, setTerminalAppearance } = useTerminalAppearance({
        storageKey: TERMINAL_APPEARANCE_STORAGE_KEY,
        defaultAppearance: DEFAULT_TERMINAL_APPEARANCE,
    });

    const { pasteHistory, setPasteHistory } = useTerminalPasteHistory({
        storageKey: TERMINAL_PASTE_HISTORY_STORAGE_KEY,
        historyLimit: TERMINAL_PASTE_HISTORY_LIMIT,
    });

    const { shortcutPreset, setShortcutPreset, shortcutBindings, setShortcutBindings } =
        useTerminalShortcuts({ storageKey: TERMINAL_SHORTCUTS_STORAGE_KEY });

    const {
        aiPanelMode,
        setAiPanelMode,
        aiSelectedIssue,
        setAiSelectedIssue,
        aiIsLoading,
        setAiIsLoading,
        aiResult,
        setAiResult,
    } = useTerminalAI();

    const tabsRef = useRef<TerminalTab[]>(tabs);
    const activeTabIdRef = useRef<string | null>(activeTabId);
    const terminalInstancesRef = useRef<Record<string, XTerm | null>>({});
    const appearanceImportInputRef = useRef<HTMLInputElement | null>(null);
    const shortcutImportInputRef = useRef<HTMLInputElement | null>(null);

    const projectIssuesTab = useMemo<TerminalTab | null>(() => {
        if (!projectPath) {
            return null;
        }
        return {
            id: TERMINAL_PROJECT_ISSUES_TAB_ID,
            name: t('terminal.projectIssuesTabTitle'),
            type: 'panel',
            status: 'idle',
            history: [],
            command: '',
            metadata: {
                panelType: 'project-issues',
                closable: false,
            },
        };
    }, [projectPath, t]);

    const displayTabs = useMemo(
        () => (projectIssuesTab ? [projectIssuesTab, ...tabs] : tabs),
        [projectIssuesTab, tabs]
    );
    const hasActiveSession = Boolean(activeTabId && tabs.some(tab => tab.id === activeTabId));

    const tabById = useMemo(() => {
        const lookup = new Map<string, TerminalTab>();
        for (const tab of tabs) {
            lookup.set(tab.id, tab);
        }
        return lookup;
    }, [tabs]);

    const {
        recordings,
        activeRecordingTabId,
        selectedRecordingId,
        selectedRecording,
        isReplayRunning,
        replayText,
        recordingCaptureRef,
        completeRecording,
        setSelectedRecordingId,
        setReplayText,
        toggleRecording,
        startReplay,
        stopReplay,
        exportRecording,
    } = useTerminalRecording({
        tabs,
        activeTabId,
        setIsRecordingPanelOpen,
    });

    const {
        createTerminal,
        createDefaultTerminal,
        resolvePreferredShellId,
        createRemoteTerminal,
        closeTab,
        reorderTabs,
    } = useTerminalTabActions({
        tabs,
        tabsRef,
        activeTabIdRef,
        projectPath,
        availableShells,
        availableBackends,
        setTabs,
        setActiveTabId,
        setIsNewTerminalMenuOpen,
        fetchAvailableShells,
        fetchAvailableBackends,
        resolveDefaultBackendId,
        clearSemanticIssues,
        completeRecording,
        recordingCaptureRef,
        onToggle,
        projectIssuesTab,
    });

    const { writeInputToTargetSessions, writeCommandToActiveTerminal } =
        useTerminalInputBroadcast({
            activeTabIdRef,
            isSynchronizedInputEnabled,
            splitView,
        });

    const {
        getActiveTerminalInstance,
        handleCopySelection,
        handleCopyWithFormatting,
        handleCopyStripAnsi,
        handlePasteClipboard,
        handlePasteFromHistory,
        handleTestPaste,
        handleSelectAll,
        handleClearOutput,
    } = useTerminalClipboardActions({
        activeTabIdRef,
        terminalInstancesRef,
        writeInputToTargetSessions,
        setTerminalContextMenu,
        setPasteHistory,
    });

    const {
        handleAiExplainError,
        handleAiFixError,
        handleAiApplyFix,
        closeAiPanel,
    } = useTerminalAiActions({
        activeTabId,
        tabById,
        projectPath,
        writeCommandToActiveTerminal,
        setAiPanelMode,
        setAiSelectedIssue,
        setAiIsLoading,
        setAiResult,
        setIsAiPanelOpen,
    });

    const {
        resolvedTerminalAppearance,
        applyAppearancePatch,
        exportAppearancePreferences,
        importAppearancePreferences,
        applyShortcutPreset,
        exportShortcutPreferences,
        importShortcutPreferences,
        shareShortcutPreferences,
        importShortcutShareCode,
    } = useTerminalPreferenceActions({
        theme,
        terminalAppearance,
        setTerminalAppearance,
        shortcutPreset,
        shortcutBindings,
        setShortcutPreset,
        setShortcutBindings,
        appearanceImportInputRef,
        shortcutImportInputRef,
        t,
    });

    const {
        applySplitPreset,
        saveCurrentSplitAsPreset,
        renameSplitPreset,
        deleteSplitPreset,
        handleSplitTerminal,
        handleDetachTerminal,
        closeSplitView,
        toggleSplitOrientation,
        toggleSynchronizedInput,
    } = useTerminalSplitActions({
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
        projectIssuesTab,
        setTabs,
        setActiveTabId,
    });

    const {
        multiplexerMode,
        setMultiplexerMode,
        multiplexerSessionName,
        setMultiplexerSessionName,
        isMultiplexerLoading,
        multiplexerSessions,
        multiplexerError,
        refreshMultiplexerSessions,
        attachMultiplexerSession: attachMultiplexerSessionCommand,
        createMultiplexerSession: createMultiplexerSessionCommand,
    } = useTerminalMultiplexer({
        projectPath,
        activeTabIdRef,
        writeCommandToActiveTerminal,
    });

    const {
        isCommandHistoryOpen,
        setIsCommandHistoryOpen,
        isCommandHistoryLoading,
        commandHistoryQuery,
        setCommandHistoryQuery,
        commandHistoryItems,
        openCommandHistory,
        closeCommandHistory,
        executeHistoryCommand,
        clearCommandHistory,
        isTaskRunnerOpen,
        setIsTaskRunnerOpen,
        isTaskRunnerLoading,
        taskRunnerQuery,
        setTaskRunnerQuery,
        taskRunnerItems,
        openTaskRunner,
        closeTaskRunner,
        executeTaskRunnerEntry,
    } = useTerminalCommandTools({
        hasActiveSession,
        activeTabIdRef,
        projectPath,
        writeCommandToActiveTerminal,
        onBeforeOpen: () => {
            setTerminalContextMenu(null);
            setIsSearchOpen(false);
            setIsGalleryView(false);
            setIsSemanticPanelOpen(false);
            setIsMultiplexerOpen(false);
            setIsRecordingPanelOpen(false);
        },
    });

    const {
        resetActiveSearchCursor,
        collectActiveSearchMatches,
        jumpToSearchMatch,
        runTerminalSearch,
        getSearchMatchLabel,
        stepSearchHistory,
        openTerminalSearch,
        closeTerminalSearch,
        revealSemanticIssue,
    } = useTerminalSearchActions({
        activeTabIdRef,
        searchQuery,
        searchUseRegex,
        searchMatches,
        searchActiveMatchIndex,
        searchHistory,
        searchHistoryIndex,
        searchCursorRef,
        searchInputRef,
        hasActiveSession,
        getActiveTerminalInstance,
        setSearchQuery,
        setSearchUseRegex,
        setSearchStatus,
        setSearchMatches,
        setSearchActiveMatchIndex,
        setSearchHistory,
        setSearchHistoryIndex,
        setIsSearchOpen,
        setIsGalleryView,
        setIsSemanticPanelOpen,
        setIsCommandHistoryOpen,
        setIsTaskRunnerOpen,
        setIsMultiplexerOpen,
        setIsRecordingPanelOpen,
        setTerminalContextMenu,
    });

    const {
        hideTerminalPanel,
        toggleGalleryView,
        toggleFloatingMode,
        toggleSemanticPanel,
        clearActiveSemanticIssues,
        openTerminalContextMenu,
    } = useTerminalPanelToggles({
        hasActiveSession,
        isFloating,
        onToggle,
        onFloatingChange,
        completeRecording,
        stopReplay,
        setTerminalContextMenu,
        setIsNewTerminalMenuOpen,
        setIsSearchOpen,
        setIsGalleryView,
        setIsAppearanceMenuOpen,
        setIsSemanticPanelOpen,
        setIsCommandHistoryOpen,
        setIsTaskRunnerOpen,
        setIsMultiplexerOpen,
        setIsRecordingPanelOpen,
        clearSemanticIssues,
        activeTabIdRef,
    });

    const openMultiplexerPanel = useCallback(() => {
        if (!activeTabIdRef.current) {
            return;
        }
        setTerminalContextMenu(null);
        setIsSearchOpen(false);
        setIsGalleryView(false);
        setIsSemanticPanelOpen(false);
        setIsCommandHistoryOpen(false);
        setIsTaskRunnerOpen(false);
        setIsRecordingPanelOpen(false);
        setIsMultiplexerOpen(true);
        void refreshMultiplexerSessions();
    }, [refreshMultiplexerSessions, setIsCommandHistoryOpen, setIsTaskRunnerOpen]);

    const closeMultiplexerPanel = useCallback(() => {
        setIsMultiplexerOpen(false);
    }, []);

    const attachMultiplexerSession = useCallback(
        async (session: Parameters<typeof attachMultiplexerSessionCommand>[0]) => {
            await attachMultiplexerSessionCommand(session);
            setIsMultiplexerOpen(false);
        },
        [attachMultiplexerSessionCommand]
    );

    const createMultiplexerSession = useCallback(async () => {
        await createMultiplexerSessionCommand();
        setIsMultiplexerOpen(false);
    }, [createMultiplexerSessionCommand]);

    const setTerminalInstance = useCallback((id: string, terminal: XTerm | null) => {
        if (terminal) {
            terminalInstancesRef.current[id] = terminal;
            return;
        }
        delete terminalInstancesRef.current[id];
    }, []);

    const isCreatingRef = useRef(false);
    const hasAutoCreatedRef = useRef(false);

    // --- Refs sync effects ---
    useEffect(() => {
        tabsRef.current = tabs;
    }, [tabs]);

    useEffect(() => {
        activeTabIdRef.current =
            activeTabId && tabs.some(tab => tab.id === activeTabId) ? activeTabId : null;
    }, [activeTabId, tabs]);

    // --- Panel close reset ---
    useEffect(() => {
        if (!isOpen) {
            hasAutoCreatedRef.current = false;
            isCreatingRef.current = false;
            setIsSearchOpen(false);
            setIsGalleryView(false);
            setIsAppearanceMenuOpen(false);
            setIsSemanticPanelOpen(false);
            setIsCommandHistoryOpen(false);
            setIsTaskRunnerOpen(false);
            setIsMultiplexerOpen(false);
            setIsRecordingPanelOpen(false);
            setSearchStatus('idle');
            setSplitView(null);
            completeRecording();
            stopReplay();
        }
    }, [completeRecording, isOpen, stopReplay, setIsCommandHistoryOpen, setIsTaskRunnerOpen]);

    // --- Bootstrap ---
    useTerminalBootstrapEffects({
        isOpen,
        tabsLength: tabs.length,
        tabsRef,
        availableShells,
        availableBackends,
        isLoadingShells,
        isLoadingBackends,
        isLoadingRemoteConnections,
        isNewTerminalMenuOpen,
        isCreatingRef,
        hasAutoCreatedRef,
        fetchAvailableShells,
        fetchAvailableBackends,
        fetchRemoteConnections,
        resolveDefaultBackendId,
        createTerminal,
    });

    // --- displayTabs / activeTab sync ---
    useEffect(() => {
        if (displayTabs.length === 0) {
            if (activeTabId !== null) {
                setActiveTabId(null);
            }
            setIsGalleryView(false);
            setIsSemanticPanelOpen(false);
            return;
        }

        if (!activeTabId || !displayTabs.some(tab => tab.id === activeTabId)) {
            if (tabs.length > 0) {
                setActiveTabId(tabs[tabs.length - 1]?.id ?? null);
                return;
            }
            if (projectIssuesTab) {
                setActiveTabId(projectIssuesTab.id);
                return;
            }
            setActiveTabId(tabs[tabs.length - 1]?.id ?? null);
        }
    }, [activeTabId, displayTabs, projectIssuesTab, setActiveTabId, tabs]);

    // --- splitView sync ---
    useEffect(() => {
        if (!splitView) {
            return;
        }

        const tabIds = new Set(tabs.map(tab => tab.id));
        if (tabs.length < 2) {
            setSplitView(null);
            return;
        }

        let nextPrimaryId = splitView.primaryId;
        if (!tabIds.has(nextPrimaryId)) {
            nextPrimaryId =
                activeTabId && tabIds.has(activeTabId) ? activeTabId : (tabs[0]?.id ?? '');
        }

        let nextSecondaryId = splitView.secondaryId;
        if (!tabIds.has(nextSecondaryId) || nextSecondaryId === nextPrimaryId) {
            const fallbackSecondary = tabs.find(tab => tab.id !== nextPrimaryId)?.id;
            if (!fallbackSecondary) {
                setSplitView(null);
                return;
            }
            nextSecondaryId = fallbackSecondary;
        }

        if (nextPrimaryId !== splitView.primaryId || nextSecondaryId !== splitView.secondaryId) {
            setSplitView({
                primaryId: nextPrimaryId,
                secondaryId: nextSecondaryId,
                orientation: splitView.orientation,
            });
        }
    }, [activeTabId, splitView, tabs]);

    // --- Terminal lifecycle ---
    useTerminalLifecycle({
        parseSemanticChunk,
        recordingCaptureRef,
        completeRecording,
        createDefaultTerminal,
    });

    // --- Context menu close ---
    useEffect(() => {
        if (!terminalContextMenu) {
            return;
        }

        const closeContextMenu = () => {
            setTerminalContextMenu(null);
        };
        const onEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeContextMenu();
            }
        };

        window.addEventListener('mousedown', closeContextMenu);
        window.addEventListener('resize', closeContextMenu);
        window.addEventListener('keydown', onEsc);
        return () => {
            window.removeEventListener('mousedown', closeContextMenu);
            window.removeEventListener('resize', closeContextMenu);
            window.removeEventListener('keydown', onEsc);
        };
    }, [terminalContextMenu]);

    // --- Search focus ---
    useEffect(() => {
        if (!isSearchOpen) {
            return;
        }
        const timer = window.setTimeout(() => {
            searchInputRef.current?.focus();
            searchInputRef.current?.select();
        }, 0);
        return () => {
            window.clearTimeout(timer);
        };
    }, [isSearchOpen]);

    // --- Search query live update ---
    useEffect(() => {
        if (!isSearchOpen) {
            return;
        }
        const rawQuery = searchQuery.trim();
        if (!rawQuery) {
            setSearchMatches([]);
            setSearchStatus('idle');
            setSearchActiveMatchIndex(-1);
            return;
        }
        const { matches, invalidRegex } = collectActiveSearchMatches();
        if (invalidRegex) {
            setSearchStatus('invalid-regex');
            setSearchMatches([]);
            setSearchActiveMatchIndex(-1);
            return;
        }
        setSearchMatches(matches);
        if (matches.length === 0) {
            setSearchStatus('not-found');
            setSearchActiveMatchIndex(-1);
            return;
        }
        if (searchStatus !== 'found') {
            setSearchStatus('idle');
        }
        if (searchActiveMatchIndex >= matches.length) {
            setSearchActiveMatchIndex(-1);
        }
    }, [
        collectActiveSearchMatches,
        isSearchOpen,
        searchActiveMatchIndex,
        searchQuery,
        searchStatus,
    ]);

    // --- Reset search on tab change ---
    useEffect(() => {
        setSearchStatus('idle');
        setSearchMatches([]);
        setSearchActiveMatchIndex(-1);
        resetActiveSearchCursor();
    }, [activeTabId, resetActiveSearchCursor]);

    // --- Reset search on regex toggle ---
    useEffect(() => {
        setSearchStatus('idle');
        setSearchMatches([]);
        setSearchActiveMatchIndex(-1);
        resetActiveSearchCursor();
    }, [resetActiveSearchCursor, searchUseRegex]);

    // --- Shortcut event handler ---
    useEffect(() => {
        const handleShortcut = createTerminalShortcutEventHandler({
            isOpen,
            isSearchOpen,
            shortcutBindings,
            activeTabIdRef,
            hideTerminalPanel,
            createDefaultTerminal,
            closeTab,
            closeTerminalSearch,
            openTerminalSearch,
            handleSplitTerminal,
            handleDetachTerminal,
        });

        window.addEventListener('keydown', handleShortcut);
        return () => window.removeEventListener('keydown', handleShortcut);
    }, [
        closeTab,
        closeTerminalSearch,
        createDefaultTerminal,
        handleDetachTerminal,
        handleSplitTerminal,
        hideTerminalPanel,
        isOpen,
        isSearchOpen,
        openTerminalSearch,
        shortcutBindings,
    ]);

    // --- Tab drag/drop handlers ---
    const handleTabDragStart = useCallback(
        (event: React.DragEvent<HTMLButtonElement>, tabId: string) => {
            setDraggingTabId(tabId);
            setDragOverTabId(tabId);
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', tabId);
        },
        []
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
        [draggingTabId]
    );

    const resetTabDragState = useCallback(() => {
        setDraggingTabId(null);
        setDragOverTabId(null);
    }, []);

    const handleTabDrop = useCallback(
        (event: React.DragEvent<HTMLButtonElement>, tabId: string) => {
            event.preventDefault();
            const sourceId = draggingTabId || event.dataTransfer.getData('text/plain');
            if (!sourceId || sourceId === tabId) {
                resetTabDragState();
                return;
            }
            reorderTabs(sourceId, tabId);
            resetTabDragState();
        },
        [draggingTabId, reorderTabs, resetTabDragState]
    );

    // --- Tab select ---
    const handleTabSelect = useCallback(
        (tabId: string) => {
            if (tabId === TERMINAL_PROJECT_ISSUES_TAB_ID) {
                setActiveTabId(tabId);
                setSplitView(null);
                setIsGalleryView(false);
                setIsSearchOpen(false);
                setIsSemanticPanelOpen(false);
                setIsCommandHistoryOpen(false);
                setIsTaskRunnerOpen(false);
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
            setIsCommandHistoryOpen,
            setIsTaskRunnerOpen,
            setSplitFocusedPane,
            setSplitView,
            splitFocusedPane,
            splitView,
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
        [setActiveTabId, splitView]
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

    // --- Derived values ---
    const activeSemanticIssues = activeTabId ? (semanticIssuesByTab[activeTabId] ?? []) : [];
    const activeSemanticErrorCount = activeSemanticIssues.filter(
        issue => issue.severity === 'error'
    ).length;
    const activeSemanticWarningCount = activeSemanticIssues.filter(
        issue => issue.severity === 'warning'
    ).length;

    const resolvedDefaultBackendId = resolveDefaultBackendId(availableBackends);
    const {
        selectableBackends,
        integratedBackend,
        launchableExternalBackends,
        defaultBackendName,
    } = useMemo(() => {
        const selectable: typeof availableBackends = [];
        const launchable: typeof availableBackends = [];
        let integrated: (typeof availableBackends)[number] | undefined;
        let defaultName = 'Unknown';

        for (const backend of availableBackends) {
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
    }, [availableBackends, resolvedDefaultBackendId]);

    const isLoadingLaunchOptions = isLoadingShells || isLoadingBackends;
    const hasRemoteConnections = remoteSshProfiles.length > 0 || remoteDockerContainers.length > 0;
    const splitPresetOptions = useMemo(
        () => [...DEFAULT_SPLIT_PRESETS, ...splitPresets],
        [splitPresets]
    );

    const terminalChromeStyle = {
        backgroundColor: `hsl(var(--background) / ${terminalAppearance.surfaceOpacity})`,
        backdropFilter: `blur(${terminalAppearance.surfaceBlur}px)`,
    };

    const selectedRecordingText = selectedRecording
        ? selectedRecording.events
            .filter(event => event.type === 'data')
            .map(event => event.data)
            .join('')
            .slice(-24000)
        : '';
    const activeRecordingLabel = activeRecordingTabId
        ? tabById.get(activeRecordingTabId)?.name ?? activeRecordingTabId
        : null;

    return (
        <motion.div
            className="flex flex-col h-full w-full overflow-hidden border border-border/60"
            style={terminalChromeStyle}
            data-terminal-module="terminal-manager"
            data-terminal-module-version={TERMINAL_MANAGER_MODULE_VERSION}
        >
            <TerminalPanelToolbarConnector
                t={t}
                displayTabs={displayTabs}
                activeTabId={activeTabId}
                draggingTabId={draggingTabId}
                dragOverTabId={dragOverTabId}
                handleTabSelect={handleTabSelect}
                closeTab={closeTab}
                handleTabDragStart={handleTabDragStart}
                handleTabDragOver={handleTabDragOver}
                handleTabDrop={handleTabDrop}
                resetTabDragState={resetTabDragState}
                isNewTerminalMenuOpen={isNewTerminalMenuOpen}
                setIsNewTerminalMenuOpen={setIsNewTerminalMenuOpen}
                isLoadingLaunchOptions={isLoadingLaunchOptions}
                availableShells={availableShells}
                selectableBackends={selectableBackends}
                integratedBackend={integratedBackend}
                launchableExternalBackends={launchableExternalBackends}
                defaultBackendName={defaultBackendName}
                resolvedDefaultBackendId={resolvedDefaultBackendId}
                persistPreferredBackendId={persistPreferredBackendId}
                createTerminal={createTerminal}
                resolvePreferredShellId={resolvePreferredShellId}
                isLoadingRemoteConnections={isLoadingRemoteConnections}
                remoteSshProfiles={remoteSshProfiles}
                remoteDockerContainers={remoteDockerContainers}
                hasRemoteConnections={hasRemoteConnections}
                createRemoteTerminal={createRemoteTerminal}
                isSplitPresetMenuOpen={isSplitPresetMenuOpen}
                setIsSplitPresetMenuOpen={setIsSplitPresetMenuOpen}
                splitView={splitView}
                splitPresetOptions={splitPresetOptions}
                splitAnalytics={splitAnalytics}
                isSynchronizedInputEnabled={isSynchronizedInputEnabled}
                saveCurrentSplitAsPreset={saveCurrentSplitAsPreset}
                applySplitPreset={applySplitPreset}
                renameSplitPreset={renameSplitPreset}
                deleteSplitPreset={deleteSplitPreset}
                setSplitAnalytics={setSplitAnalytics}
                toggleSynchronizedInput={toggleSynchronizedInput}
                toggleSplitOrientation={toggleSplitOrientation}
                closeSplitView={closeSplitView}
                isGalleryView={isGalleryView}
                toggleGalleryView={toggleGalleryView}
                onFloatingChange={onFloatingChange}
                toggleFloatingMode={toggleFloatingMode}
                isFloating={isFloating}
                toggleSemanticPanel={toggleSemanticPanel}
                hasActiveSession={hasActiveSession}
                activeSemanticIssuesLength={activeSemanticIssues.length}
                activeSemanticErrorCount={activeSemanticErrorCount}
                openMultiplexerPanel={openMultiplexerPanel}
                isMultiplexerOpen={isMultiplexerOpen}
                toggleRecording={toggleRecording}
                activeRecordingTabId={activeRecordingTabId}
                isMaximized={isMaximized}
                setIsMaximized={setIsMaximized}
                onToggle={onToggle}
                isAppearanceMenuOpen={isAppearanceMenuOpen}
                setIsAppearanceMenuOpen={setIsAppearanceMenuOpen}
                terminalAppearance={terminalAppearance}
                resolvedTerminalAppearance={resolvedTerminalAppearance}
                applyAppearancePatch={applyAppearancePatch}
                exportAppearancePreferences={exportAppearancePreferences}
                importAppearancePreferences={importAppearancePreferences}
                appearanceImportInputRef={appearanceImportInputRef}
                shortcutPreset={shortcutPreset}
                applyShortcutPreset={applyShortcutPreset}
                exportShortcutPreferences={exportShortcutPreferences}
                importShortcutPreferences={importShortcutPreferences}
                shortcutImportInputRef={shortcutImportInputRef}
                shareShortcutPreferences={shareShortcutPreferences}
                importShortcutShareCode={importShortcutShareCode}
            />
            <TerminalSplitView
                onContextMenu={openTerminalContextMenu}
                isGalleryView={isGalleryView}
                tabs={displayTabs}
                activeTabId={activeTabId}
                splitView={splitView}
                getTabLayoutClass={getTabLayoutClass}
                handlePaneActivate={handlePaneActivate}
                closeTab={closeTab}
                handleTabSelect={handleTabSelect}
                setIsGalleryView={setIsGalleryView}
                projectPath={projectPath}
                terminalAppearance={terminalAppearance}
                resolvedTerminalAppearance={resolvedTerminalAppearance}
                setTerminalInstance={setTerminalInstance}
                emptyTitle={t('terminal.noActiveSessions')}
                emptyActionLabel={t('terminal.startNewSession')}
                createDefaultTerminal={createDefaultTerminal}
                renderTabContent={tab =>
                    tab.id === TERMINAL_PROJECT_ISSUES_TAB_ID ? (
                        <TerminalProjectIssuesTab
                            projectId={projectId}
                            projectPath={projectPath}
                            onOpenFile={onOpenFile}
                        />
                    ) : null
                }
            />
            <TerminalPanelOverlaysConnector
                t={t}
                terminalContextMenu={terminalContextMenu}
                displayTabs={displayTabs}
                isGalleryView={isGalleryView}
                hasActiveSession={hasActiveSession}
                isFloating={isFloating}
                projectPath={projectPath}
                splitView={splitView}
                isSynchronizedInputEnabled={isSynchronizedInputEnabled}
                activeRecordingTabId={activeRecordingTabId}
                activeRecordingLabel={activeRecordingLabel}
                pasteHistory={pasteHistory}
                isSemanticPanelOpen={isSemanticPanelOpen}
                activeSemanticIssues={activeSemanticIssues}
                activeSemanticErrorCount={activeSemanticErrorCount}
                activeSemanticWarningCount={activeSemanticWarningCount}
                clearActiveSemanticIssues={clearActiveSemanticIssues}
                revealSemanticIssue={revealSemanticIssue}
                isAiPanelOpen={isAiPanelOpen}
                aiPanelMode={aiPanelMode}
                aiSelectedIssue={aiSelectedIssue}
                aiIsLoading={aiIsLoading}
                aiResult={aiResult}
                closeAiPanel={closeAiPanel}
                handleAiApplyFix={handleAiApplyFix}
                handleAiExplainError={handleAiExplainError}
                handleAiFixError={handleAiFixError}
                handleCopySelection={() => handleCopySelection()}
                handleCopyWithFormatting={() => handleCopyWithFormatting()}
                handleCopyStripAnsi={() => handleCopyStripAnsi()}
                handlePasteClipboard={() => handlePasteClipboard()}
                handleTestPaste={() => handleTestPaste()}
                handleSelectAll={handleSelectAll}
                handleClearOutput={handleClearOutput}
                handlePasteFromHistory={(entry: string) => handlePasteFromHistory(entry)}
                openTerminalSearch={openTerminalSearch}
                toggleSemanticPanel={toggleSemanticPanel}
                toggleGalleryView={toggleGalleryView}
                toggleFloatingMode={toggleFloatingMode}
                onFloatingChange={onFloatingChange}
                openCommandHistory={openCommandHistory}
                openTaskRunner={openTaskRunner}
                openMultiplexerPanel={openMultiplexerPanel}
                toggleRecording={toggleRecording}
                createDefaultTerminal={createDefaultTerminal}
                hideTerminalPanel={hideTerminalPanel}
                handleSplitTerminal={handleSplitTerminal}
                handleDetachTerminal={handleDetachTerminal}
                toggleSynchronizedInput={toggleSynchronizedInput}
                closeSplitView={closeSplitView}
                toggleSplitOrientation={toggleSplitOrientation}
                setTerminalContextMenu={setTerminalContextMenu}
                setIsSearchOpen={setIsSearchOpen}
                setIsGalleryView={setIsGalleryView}
                setIsSemanticPanelOpen={setIsSemanticPanelOpen}
                setIsCommandHistoryOpen={setIsCommandHistoryOpen}
                setIsTaskRunnerOpen={setIsTaskRunnerOpen}
                setIsMultiplexerOpen={setIsMultiplexerOpen}
                setIsRecordingPanelOpen={setIsRecordingPanelOpen}
                isMultiplexerOpen={isMultiplexerOpen}
                multiplexerMode={multiplexerMode}
                multiplexerSessionName={multiplexerSessionName}
                multiplexerSessions={multiplexerSessions}
                isMultiplexerLoading={isMultiplexerLoading}
                multiplexerError={multiplexerError}
                closeMultiplexerPanel={closeMultiplexerPanel}
                setMultiplexerMode={setMultiplexerMode}
                refreshMultiplexerSessions={refreshMultiplexerSessions}
                setMultiplexerSessionName={setMultiplexerSessionName}
                createMultiplexerSession={createMultiplexerSession}
                attachMultiplexerSession={attachMultiplexerSession}
                isRecordingPanelOpen={isRecordingPanelOpen}
                recordings={recordings}
                selectedRecordingId={selectedRecordingId}
                selectedRecording={selectedRecording}
                selectedRecordingText={selectedRecordingText}
                replayText={replayText}
                isReplayRunning={isReplayRunning}
                toggleRecordingForPanel={toggleRecording}
                startReplay={startReplay}
                stopReplay={stopReplay}
                exportRecording={exportRecording}
                setSelectedRecordingId={setSelectedRecordingId}
                setReplayText={setReplayText}
                isSearchOpen={isSearchOpen}
                searchInputRef={searchInputRef}
                searchQuery={searchQuery}
                searchUseRegex={searchUseRegex}
                searchStatus={searchStatus}
                searchMatches={searchMatches}
                searchActiveMatchIndex={searchActiveMatchIndex}
                searchHistory={searchHistory}
                setSearchQuery={setSearchQuery}
                setSearchUseRegex={setSearchUseRegex}
                setSearchStatus={setSearchStatus}
                setSearchMatches={setSearchMatches}
                setSearchActiveMatchIndex={setSearchActiveMatchIndex}
                setSearchHistoryIndex={setSearchHistoryIndex}
                resetActiveSearchCursor={resetActiveSearchCursor}
                runTerminalSearch={runTerminalSearch}
                closeTerminalSearch={closeTerminalSearch}
                stepSearchHistory={stepSearchHistory}
                jumpToSearchMatch={jumpToSearchMatch}
                getSearchMatchLabel={getSearchMatchLabel}
                isCommandHistoryOpen={isCommandHistoryOpen}
                isCommandHistoryLoading={isCommandHistoryLoading}
                commandHistoryQuery={commandHistoryQuery}
                commandHistoryItems={commandHistoryItems}
                setCommandHistoryQuery={setCommandHistoryQuery}
                closeCommandHistory={closeCommandHistory}
                clearCommandHistory={clearCommandHistory}
                executeHistoryCommand={executeHistoryCommand}
                isTaskRunnerOpen={isTaskRunnerOpen}
                isTaskRunnerLoading={isTaskRunnerLoading}
                taskRunnerQuery={taskRunnerQuery}
                taskRunnerItems={taskRunnerItems}
                setTaskRunnerQuery={setTaskRunnerQuery}
                closeTaskRunner={closeTaskRunner}
                executeTaskRunnerEntry={executeTaskRunnerEntry}
            />
        </motion.div>
    );
}
