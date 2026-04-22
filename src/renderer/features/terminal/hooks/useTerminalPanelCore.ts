/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useTranslation } from '@renderer/i18n';
import { type Terminal as XTerm } from '@xterm/xterm';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useTheme } from '@/hooks/useTheme';
import type { TerminalTab } from '@/types';

import type { TerminalPanelProps } from '../components/TerminalPanel';
import {
    DEFAULT_TERMINAL_APPEARANCE,
    TERMINAL_APPEARANCE_STORAGE_KEY,
    TERMINAL_PASTE_HISTORY_LIMIT,
    TERMINAL_PASTE_HISTORY_STORAGE_KEY,
    TERMINAL_PREFERRED_BACKEND_STORAGE_KEY,
    TERMINAL_SEARCH_HISTORY_LIMIT,
    TERMINAL_SEARCH_HISTORY_STORAGE_KEY,
    TERMINAL_SHORTCUTS_STORAGE_KEY,
    TERMINAL_SPLIT_ANALYTICS_STORAGE_KEY,
    TERMINAL_SPLIT_LAYOUT_STORAGE_KEY,
    TERMINAL_SPLIT_PRESETS_STORAGE_KEY,
    TERMINAL_SYNC_INPUT_STORAGE_KEY,
    TERMINAL_WORKSPACE_ISSUES_TAB_ID,
} from '../constants/terminal-panel-constants';
import { TERMINAL_SPLIT_PRESET_LIMIT } from '../utils/split-config';

import { useTerminalAI } from './useTerminalAI';
import { useTerminalAiActions } from './useTerminalAiActions';
import { useTerminalAppearance } from './useTerminalAppearance';
import { useTerminalBackendsAndRemote } from './useTerminalBackendsAndRemote';
import { useTerminalClipboardActions } from './useTerminalClipboardActions';
import { useTerminalCommandTools } from './useTerminalCommandTools';
import { useTerminalInputBroadcast } from './useTerminalInputBroadcast';
import { useTerminalPanelToggles } from './useTerminalPanelToggles';
import { useTerminalPasteHistory } from './useTerminalPasteHistory';
import { useTerminalPreferenceActions } from './useTerminalPreferenceActions';
import { useTerminalRecording } from './useTerminalRecording';
import { useTerminalSearch } from './useTerminalSearch';
import { useTerminalSearchActions } from './useTerminalSearchActions';
import { useTerminalSemanticAnalysis } from './useTerminalSemanticAnalysis';
import { useTerminalShortcuts } from './useTerminalShortcuts';
import { useTerminalSplitActions } from './useTerminalSplitActions';
import { useTerminalSplitLayout } from './useTerminalSplitLayout';
import { useTerminalState } from './useTerminalState';
import { useTerminalTabActions } from './useTerminalTabActions';

/**
 * Core orchestrator hook that composes all terminal panel sub-hooks.
 * Returns all state and actions needed by the terminal panel.
 */

export function useTerminalPanelCore(props: TerminalPanelProps) {
    const {
        isOpen, onToggle,
        isMaximized: isMaximizedProp = false,
        onMaximizeChange: onMaximizeChangeProp,
        workspaceId, workspacePath,
        activeFilePath, activeFileContent, activeFileType,
        tabs, activeTabId,
        setTabs, setActiveTabId,
        onOpenFile,
    } = props;

    const { t } = useTranslation();
    const { theme } = useTheme();

    const {
        isMaximizedLocal, setIsMaximizedLocal,
        isNewTerminalMenuOpen, setIsNewTerminalMenuOpen,
        terminalContextMenu, setTerminalContextMenu,
        draggingTabId, setDraggingTabId,
        dragOverTabId, setDragOverTabId,
        isSearchOpen, setIsSearchOpen,
        isGalleryView, setIsGalleryView,
        isAppearanceMenuOpen, setIsAppearanceMenuOpen,
        isSemanticPanelOpen, setIsSemanticPanelOpen,
        isRecordingPanelOpen, setIsRecordingPanelOpen,
        isAiPanelOpen, setIsAiPanelOpen,
    } = useTerminalState();

    const isMaximized = onMaximizeChangeProp ? isMaximizedProp : isMaximizedLocal;
    const setIsMaximized = onMaximizeChangeProp ?? setIsMaximizedLocal;

    const splitLayout = useTerminalSplitLayout({
        tabs,
        syncInputStorageKey: TERMINAL_SYNC_INPUT_STORAGE_KEY,
        splitPresetsStorageKey: TERMINAL_SPLIT_PRESETS_STORAGE_KEY,
        splitLayoutStorageKey: TERMINAL_SPLIT_LAYOUT_STORAGE_KEY,
        splitAnalyticsStorageKey: TERMINAL_SPLIT_ANALYTICS_STORAGE_KEY,
        splitPresetLimit: TERMINAL_SPLIT_PRESET_LIMIT,
    });

    const { semanticIssuesByTab, parseSemanticChunk, clearSemanticIssues } =
        useTerminalSemanticAnalysis({ tabs });

    const search = useTerminalSearch({
        storageKey: TERMINAL_SEARCH_HISTORY_STORAGE_KEY,
        historyLimit: TERMINAL_SEARCH_HISTORY_LIMIT,
    });

    const backends = useTerminalBackendsAndRemote({
        preferredBackendStorageKey: TERMINAL_PREFERRED_BACKEND_STORAGE_KEY,
    });

    const { terminalAppearance, setTerminalAppearance } = useTerminalAppearance({
        storageKey: TERMINAL_APPEARANCE_STORAGE_KEY,
        defaultAppearance: DEFAULT_TERMINAL_APPEARANCE,
    });

    useEffect(() => {
        setTerminalAppearance(() => DEFAULT_TERMINAL_APPEARANCE);
    }, [setTerminalAppearance]);

    const { pasteHistory, setPasteHistory } = useTerminalPasteHistory({
        storageKey: TERMINAL_PASTE_HISTORY_STORAGE_KEY,
        historyLimit: TERMINAL_PASTE_HISTORY_LIMIT,
    });

    const shortcuts = useTerminalShortcuts({ storageKey: TERMINAL_SHORTCUTS_STORAGE_KEY });
    const ai = useTerminalAI();

    const tabsRef = useRef<TerminalTab[]>(tabs);
    const activeTabIdRef = useRef<string | null>(activeTabId);
    const terminalInstancesRef = useRef<Record<string, XTerm | null>>({});
    const appearanceImportInputRef = useRef<HTMLInputElement | null>(null);
    const shortcutImportInputRef = useRef<HTMLInputElement | null>(null);
    const isCreatingRef = useRef(false);
    const hasAutoCreatedRef = useRef(false);

    const workspaceIssuesTab = useMemo<TerminalTab | null>(() => {
        if (!workspacePath) {
            return null;
        }
        return {
            id: TERMINAL_WORKSPACE_ISSUES_TAB_ID,
            name: t('terminal.workspaceIssuesTabTitle'),
            type: 'panel',
            status: 'idle',
            history: [],
            command: '',
            metadata: { panelType: 'workspace-issues', closable: false },
        };
    }, [workspacePath, t]);

    const displayTabs = useMemo(
        () => (workspaceIssuesTab ? [workspaceIssuesTab, ...tabs] : tabs),
        [workspaceIssuesTab, tabs]
    );
    const hasActiveSession = Boolean(activeTabId && tabs.some(tab => tab.id === activeTabId));

    const tabById = useMemo(() => {
        const lookup = new Map<string, TerminalTab>();
        for (const tab of tabs) {
            lookup.set(tab.id, tab);
        }
        return lookup;
    }, [tabs]);

    const recording = useTerminalRecording({
        tabs, activeTabId,
        setIsRecordingPanelOpen,
    });

    const tabActions = useTerminalTabActions({
        tabs, tabsRef, activeTabIdRef, workspacePath,
        availableShells: backends.availableShells,
        availableBackends: backends.availableBackends,
        setTabs, setActiveTabId, setIsNewTerminalMenuOpen,
        fetchAvailableShells: backends.fetchAvailableShells,
        fetchAvailableBackends: backends.fetchAvailableBackends,
        resolveDefaultBackendId: backends.resolveDefaultBackendId,
        clearSemanticIssues,
        completeRecording: recording.completeRecording,
        recordingCaptureRef: recording.recordingCaptureRef,
        onToggle, workspaceIssuesTab,
    });

    const inputBroadcast = useTerminalInputBroadcast({
        activeTabIdRef,
        isSynchronizedInputEnabled: splitLayout.isSynchronizedInputEnabled,
        splitView: splitLayout.splitView,
    });

    const clipboard = useTerminalClipboardActions({
        activeTabIdRef, terminalInstancesRef,
        writeInputToTargetSessions: inputBroadcast.writeInputToTargetSessions,
        setTerminalContextMenu, setPasteHistory,
        t,
    });

    const aiActions = useTerminalAiActions({
        activeTabId, tabById, workspacePath,
        writeCommandToActiveTerminal: inputBroadcast.writeCommandToActiveTerminal,
        setAiPanelMode: ai.setAiPanelMode,
        setAiSelectedIssue: ai.setAiSelectedIssue,
        setAiIsLoading: ai.setAiIsLoading,
        setAiResult: ai.setAiResult,
        setIsAiPanelOpen,
    });

    const preferences = useTerminalPreferenceActions({
        theme, terminalAppearance, setTerminalAppearance,
        shortcutPreset: shortcuts.shortcutPreset,
        shortcutBindings: shortcuts.shortcutBindings,
        setShortcutPreset: shortcuts.setShortcutPreset,
        setShortcutBindings: shortcuts.setShortcutBindings,
        appearanceImportInputRef, shortcutImportInputRef, t,
    });

    const splitActions = useTerminalSplitActions({
        t,
        tabsRef, activeTabIdRef,
        availableShells: backends.availableShells,
        availableBackends: backends.availableBackends,
        splitView: splitLayout.splitView,
        splitPresets: splitLayout.splitPresets,
        setSplitView: splitLayout.setSplitView,
        setSplitFocusedPane: splitLayout.setSplitFocusedPane,
        setSplitPresets: splitLayout.setSplitPresets,
        setSplitAnalytics: splitLayout.setSplitAnalytics,
        setIsSynchronizedInputEnabled: splitLayout.setIsSynchronizedInputEnabled,
        setTerminalContextMenu,
        createTerminal: tabActions.createTerminal,
        resolveDefaultBackendId: backends.resolveDefaultBackendId,
        completeRecording: recording.completeRecording,
        recordingCaptureRef: recording.recordingCaptureRef,
        onToggle, workspaceIssuesTab, setTabs, setActiveTabId,
    });
    const commandTools = useTerminalCommandTools({
        hasActiveSession, activeTabIdRef, workspacePath,
        writeCommandToActiveTerminal: inputBroadcast.writeCommandToActiveTerminal,
        onBeforeOpen: () => {
            setTerminalContextMenu(null);
            setIsSearchOpen(false);
            setIsGalleryView(false);
            setIsSemanticPanelOpen(false);
            setIsRecordingPanelOpen(false);
        },
    });

    const searchActions = useTerminalSearchActions({
        activeTabIdRef,
        searchQuery: search.searchQuery,
        searchUseRegex: search.searchUseRegex,
        searchMatches: search.searchMatches,
        searchActiveMatchIndex: search.searchActiveMatchIndex,
        searchHistory: search.searchHistory,
        searchHistoryIndex: search.searchHistoryIndex,
        searchCursorRef: search.searchCursorRef,
        searchInputRef: search.searchInputRef,
        hasActiveSession,
        getActiveTerminalInstance: clipboard.getActiveTerminalInstance,
        setSearchQuery: search.setSearchQuery,
        setSearchUseRegex: search.setSearchUseRegex,
        setSearchStatus: search.setSearchStatus,
        setSearchMatches: search.setSearchMatches,
        setSearchActiveMatchIndex: search.setSearchActiveMatchIndex,
        setSearchHistory: search.setSearchHistory,
        setSearchHistoryIndex: search.setSearchHistoryIndex,
        setIsSearchOpen,
        setIsGalleryView,
        setIsSemanticPanelOpen,
        setIsCommandHistoryOpen: commandTools.setIsCommandHistoryOpen,
        setIsTaskRunnerOpen: commandTools.setIsTaskRunnerOpen,
        setIsRecordingPanelOpen,
        setTerminalContextMenu,
    });

    const panelToggles = useTerminalPanelToggles({
        hasActiveSession, onToggle,
        completeRecording: recording.completeRecording,
        stopReplay: recording.stopReplay,
        setTerminalContextMenu, setIsNewTerminalMenuOpen,
        setIsSearchOpen, setIsGalleryView,
        setIsAppearanceMenuOpen, setIsSemanticPanelOpen,
        setIsCommandHistoryOpen: commandTools.setIsCommandHistoryOpen,
        setIsTaskRunnerOpen: commandTools.setIsTaskRunnerOpen,
        setIsRecordingPanelOpen,
        clearSemanticIssues, activeTabIdRef,
    });
 
    const setTerminalInstance = useCallback((id: string, terminal: XTerm | null) => {
        if (terminal) {
            terminalInstancesRef.current[id] = terminal;
            return;
        }
        delete terminalInstancesRef.current[id];
    }, []);

    return {
        // Props passthrough
        isOpen, onToggle,
        workspaceId, workspacePath, activeFilePath, activeFileContent, activeFileType,
        tabs, activeTabId,
        setTabs, setActiveTabId, onOpenFile,
        // Core
        t, theme,
        // UI state
        isNewTerminalMenuOpen, setIsNewTerminalMenuOpen,
        terminalContextMenu, setTerminalContextMenu,
        draggingTabId, setDraggingTabId,
        dragOverTabId, setDragOverTabId,
        isSearchOpen, setIsSearchOpen,
        isGalleryView, setIsGalleryView,
        isAppearanceMenuOpen, setIsAppearanceMenuOpen,
        isSemanticPanelOpen, setIsSemanticPanelOpen,
        isRecordingPanelOpen, setIsRecordingPanelOpen,
        isAiPanelOpen, setIsAiPanelOpen,
        isMaximized, setIsMaximized,
        // Split
        splitLayout,
        // Semantic
        semanticIssuesByTab, parseSemanticChunk, clearSemanticIssues,
        // Search
        search,
        // Backends
        backends,
        // Appearance
        terminalAppearance,
        // Paste
        pasteHistory,
        // Shortcuts
        shortcuts,
        // AI
        ai,
        // Refs
        tabsRef, activeTabIdRef, terminalInstancesRef,
        appearanceImportInputRef, shortcutImportInputRef,
        isCreatingRef, hasAutoCreatedRef,
        // Computed
        workspaceIssuesTab, displayTabs, hasActiveSession, tabById,
        // Sub-hook results
        recording, tabActions, inputBroadcast, clipboard,
        aiActions, preferences, splitActions,
        commandTools, searchActions, panelToggles, 
        setTerminalInstance,
    };
}

/** Return type of the core terminal panel hook */
export type TerminalPanelCoreResult = ReturnType<typeof useTerminalPanelCore>;
