/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback } from 'react';

interface UseTerminalPanelTogglesParams {
    hasActiveSession: boolean;
    onToggle: () => void;
    completeRecording: () => void;
    stopReplay: () => void;
    setTerminalContextMenu: (menu: { x: number; y: number } | null) => void;
    setIsNewTerminalMenuOpen: (open: boolean) => void;
    setIsSearchOpen: (open: boolean) => void;
    setIsGalleryView: (open: boolean | ((prev: boolean) => boolean)) => void;
    setIsAppearanceMenuOpen: (open: boolean) => void;
    setIsSemanticPanelOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
    setIsCommandHistoryOpen: (open: boolean) => void;
    setIsTaskRunnerOpen: (open: boolean) => void; 
    setIsRecordingPanelOpen: (open: boolean) => void;
    clearSemanticIssues: (tabId: string) => void;
    activeTabIdRef: React.MutableRefObject<string | null>;
}

export function useTerminalPanelToggles({
    hasActiveSession,
    onToggle,
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
    setIsRecordingPanelOpen,
    clearSemanticIssues,
    activeTabIdRef,
}: UseTerminalPanelTogglesParams) {
    const hideTerminalPanel = useCallback(() => {
        setTerminalContextMenu(null);
        setIsNewTerminalMenuOpen(false);
        setIsSearchOpen(false);
        setIsGalleryView(false);
        setIsAppearanceMenuOpen(false);
        setIsSemanticPanelOpen(false);
        setIsCommandHistoryOpen(false);
        setIsTaskRunnerOpen(false);
        setIsRecordingPanelOpen(false);
        completeRecording();
        stopReplay();
        onToggle();
    }, [completeRecording, onToggle, stopReplay, setIsCommandHistoryOpen, setIsTaskRunnerOpen, setTerminalContextMenu, setIsNewTerminalMenuOpen, setIsSearchOpen, setIsGalleryView, setIsAppearanceMenuOpen, setIsSemanticPanelOpen, setIsRecordingPanelOpen]);

    const toggleGalleryView = useCallback(() => {
        setTerminalContextMenu(null);
        setIsSearchOpen(false);
        setIsCommandHistoryOpen(false);
        setIsTaskRunnerOpen(false);
        setIsSemanticPanelOpen(false);
        setIsRecordingPanelOpen(false);
        setIsGalleryView(prev => !prev);
    }, [setIsCommandHistoryOpen, setIsTaskRunnerOpen, setTerminalContextMenu, setIsSearchOpen, setIsSemanticPanelOpen, setIsRecordingPanelOpen, setIsGalleryView]);

    const toggleSemanticPanel = useCallback(() => {
        if (!hasActiveSession) {
            return;
        }
        setTerminalContextMenu(null);
        setIsSearchOpen(false);
        setIsCommandHistoryOpen(false);
        setIsTaskRunnerOpen(false);
        setIsRecordingPanelOpen(false);
        setIsSemanticPanelOpen(prev => !prev);
    }, [hasActiveSession, setIsCommandHistoryOpen, setIsTaskRunnerOpen, setTerminalContextMenu, setIsSearchOpen, setIsRecordingPanelOpen, setIsSemanticPanelOpen]);

    const clearActiveSemanticIssues = useCallback(() => {
        if (!activeTabIdRef.current) {
            return;
        }
        clearSemanticIssues(activeTabIdRef.current);
    }, [clearSemanticIssues, activeTabIdRef]);

    const openTerminalContextMenu = useCallback((event: React.MouseEvent) => {
        event.preventDefault();
        setTerminalContextMenu({
            x: Math.min(event.clientX, window.innerWidth - 220),
            y: Math.min(event.clientY, window.innerHeight - 260),
        });
    }, [setTerminalContextMenu]);

    return {
        hideTerminalPanel,
        toggleGalleryView,
        toggleSemanticPanel,
        clearActiveSemanticIssues,
        openTerminalContextMenu,
    };
}
