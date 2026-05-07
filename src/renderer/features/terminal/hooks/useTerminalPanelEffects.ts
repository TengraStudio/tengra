/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useEffect } from 'react';

import { createTerminalShortcutEventHandler } from '../utils/terminal-event-handlers';

import { useTerminalBootstrapEffects } from './useTerminalBootstrapEffects';
import { useTerminalLifecycle } from './useTerminalLifecycle';
import type { TerminalPanelCoreResult } from './useTerminalPanelCore';

/**
 * Runs all side-effect hooks for the terminal panel.
 * Handles ref syncing, panel reset, search, shortcuts, and lifecycle.
 */
 
export function useTerminalPanelEffects(core: TerminalPanelCoreResult): void {
    const {
        isOpen, tabs, activeTabId, setActiveTabId,
        setIsSearchOpen, setIsGalleryView, setIsAppearanceMenuOpen,
        setIsSemanticPanelOpen, setIsRecordingPanelOpen,
        isSearchOpen, terminalContextMenu, setTerminalContextMenu,
        tabsRef, activeTabIdRef, isCreatingRef, hasAutoCreatedRef,
        displayTabs, workspaceIssuesTab,
        splitLayout, search, backends, shortcuts,
        recording, tabActions, searchActions, panelToggles,
        parseSemanticChunk,
    } = core;

    const {
        setSplitView, splitView,
    } = splitLayout;

    const {
        searchQuery, searchUseRegex, searchActiveMatchIndex,
        searchStatus, searchInputRef,
        setSearchStatus, setSearchMatches, setSearchActiveMatchIndex,
    } = search;

    const {
        collectActiveSearchMatches, resetActiveSearchCursor,
    } = searchActions;

    // --- Refs sync ---
    useEffect(() => {
        tabsRef.current = tabs;
    }, [tabs, tabsRef]);

    useEffect(() => {
        activeTabIdRef.current =
            activeTabId && tabs.some(tab => tab.id === activeTabId) ? activeTabId : null;
    }, [activeTabId, tabs, activeTabIdRef]);

    // --- Panel close reset ---
    useEffect(() => {
        if (!isOpen) {
            hasAutoCreatedRef.current = false;
            isCreatingRef.current = false;
            setIsSearchOpen(false);
            setIsGalleryView(false);
            setIsAppearanceMenuOpen(false);
            setIsSemanticPanelOpen(false);
            core.commandTools.setIsCommandHistoryOpen(false);
            core.commandTools.setIsTaskRunnerOpen(false);
            setIsRecordingPanelOpen(false);
            setSearchStatus('idle');
            setSplitView(null);
            recording.completeRecording();
            recording.stopReplay();
        }
    }, [recording, isOpen, core.commandTools, setIsAppearanceMenuOpen, setIsGalleryView, setIsRecordingPanelOpen, setIsSearchOpen, setIsSemanticPanelOpen, setSearchStatus, setSplitView, hasAutoCreatedRef, isCreatingRef]);

    // --- Bootstrap ---
    useTerminalBootstrapEffects({
        isOpen,
        tabsLength: tabs.length,
        tabsRef,
        availableShells: backends.availableShells,
        availableBackends: backends.availableBackends,
        isLoadingShells: backends.isLoadingShells,
        isLoadingBackends: backends.isLoadingBackends,
        isLoadingRemoteConnections: backends.isLoadingRemoteConnections,
        isNewTerminalMenuOpen: core.isNewTerminalMenuOpen,
        isCreatingRef,
        hasAutoCreatedRef,
        fetchDiscoverySnapshot: backends.fetchDiscoverySnapshot,
        fetchRemoteConnections: backends.fetchRemoteConnections,
        resolveDefaultBackendId: backends.resolveDefaultBackendId,
        createTerminal: tabActions.createTerminal,
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
            if (workspaceIssuesTab) {
                setActiveTabId(workspaceIssuesTab.id);
                return;
            }
            setActiveTabId(tabs[tabs.length - 1]?.id ?? null);
        }
    }, [activeTabId, displayTabs, workspaceIssuesTab, setActiveTabId, tabs, setIsGalleryView, setIsSemanticPanelOpen]);

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
    }, [activeTabId, splitView, tabs, setSplitView]);

    // --- Terminal lifecycle ---
    useTerminalLifecycle({
        parseSemanticChunk,
        recordingCaptureRef: recording.recordingCaptureRef,
        completeRecording: recording.completeRecording,
        createDefaultTerminal: tabActions.createDefaultTerminal,
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
    }, [terminalContextMenu, setTerminalContextMenu]);

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
    }, [isSearchOpen, searchInputRef]);

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
        setSearchActiveMatchIndex,
        setSearchMatches,
        setSearchStatus,
    ]);

    // --- Reset search on tab change ---
    useEffect(() => {
        setSearchStatus('idle');
        setSearchMatches([]);
        setSearchActiveMatchIndex(-1);
        resetActiveSearchCursor();
    }, [activeTabId, resetActiveSearchCursor, setSearchStatus, setSearchMatches, setSearchActiveMatchIndex]);

    // --- Reset search on regex toggle ---
    useEffect(() => {
        setSearchStatus('idle');
        setSearchMatches([]);
        setSearchActiveMatchIndex(-1);
        resetActiveSearchCursor();
    }, [resetActiveSearchCursor, searchUseRegex, setSearchStatus, setSearchMatches, setSearchActiveMatchIndex]);

    // --- Shortcut event handler ---
    useEffect(() => {
        const handleShortcut = createTerminalShortcutEventHandler({
            isOpen,
            isSearchOpen,
            shortcutBindings: shortcuts.shortcutBindings,
            activeTabIdRef,
            hideTerminalPanel: panelToggles.hideTerminalPanel,
            createDefaultTerminal: tabActions.createDefaultTerminal,
            closeTab: tabActions.closeTab,
            closeTerminalSearch: searchActions.closeTerminalSearch,
            openTerminalSearch: searchActions.openTerminalSearch,
            handleSplitTerminal: core.splitActions.handleSplitTerminal,
            handleDetachTerminal: core.splitActions.handleDetachTerminal,
        });

        window.addEventListener('keydown', handleShortcut);
        return () => window.removeEventListener('keydown', handleShortcut);
    }, [
        tabActions.closeTab,
        searchActions.closeTerminalSearch,
        tabActions.createDefaultTerminal,
        core.splitActions.handleDetachTerminal,
        core.splitActions.handleSplitTerminal,
        panelToggles.hideTerminalPanel,
        isOpen,
        isSearchOpen,
        searchActions.openTerminalSearch,
        shortcuts.shortcutBindings,
        activeTabIdRef,
    ]);
}

