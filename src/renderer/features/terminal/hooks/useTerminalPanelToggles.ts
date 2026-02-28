import { useCallback } from 'react';

interface UseTerminalPanelTogglesParams {
    hasActiveSession: boolean;
    isFloating: boolean;
    onToggle: () => void;
    onFloatingChange?: (isFloating: boolean) => void;
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
    setIsMultiplexerOpen: (open: boolean) => void;
    setIsRecordingPanelOpen: (open: boolean) => void;
    clearSemanticIssues: (tabId: string) => void;
    activeTabIdRef: React.MutableRefObject<string | null>;
}

export function useTerminalPanelToggles({
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
        setIsMultiplexerOpen(false);
        setIsRecordingPanelOpen(false);
        completeRecording();
        stopReplay();
        onToggle();
    }, [completeRecording, onToggle, stopReplay, setIsCommandHistoryOpen, setIsTaskRunnerOpen, setTerminalContextMenu, setIsNewTerminalMenuOpen, setIsSearchOpen, setIsGalleryView, setIsAppearanceMenuOpen, setIsSemanticPanelOpen, setIsMultiplexerOpen, setIsRecordingPanelOpen]);

    const toggleGalleryView = useCallback(() => {
        setTerminalContextMenu(null);
        setIsSearchOpen(false);
        setIsCommandHistoryOpen(false);
        setIsTaskRunnerOpen(false);
        setIsSemanticPanelOpen(false);
        setIsMultiplexerOpen(false);
        setIsRecordingPanelOpen(false);
        setIsGalleryView(prev => !prev);
    }, [setIsCommandHistoryOpen, setIsTaskRunnerOpen, setTerminalContextMenu, setIsSearchOpen, setIsSemanticPanelOpen, setIsMultiplexerOpen, setIsRecordingPanelOpen, setIsGalleryView]);

    const toggleFloatingMode = useCallback(() => {
        if (!onFloatingChange) {
            return;
        }
        onFloatingChange(!isFloating);
    }, [isFloating, onFloatingChange]);

    const toggleSemanticPanel = useCallback(() => {
        if (!hasActiveSession) {
            return;
        }
        setTerminalContextMenu(null);
        setIsSearchOpen(false);
        setIsCommandHistoryOpen(false);
        setIsTaskRunnerOpen(false);
        setIsMultiplexerOpen(false);
        setIsRecordingPanelOpen(false);
        setIsSemanticPanelOpen(prev => !prev);
    }, [hasActiveSession, setIsCommandHistoryOpen, setIsTaskRunnerOpen, setTerminalContextMenu, setIsSearchOpen, setIsMultiplexerOpen, setIsRecordingPanelOpen, setIsSemanticPanelOpen]);

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
        toggleFloatingMode,
        toggleSemanticPanel,
        clearActiveSemanticIssues,
        openTerminalContextMenu,
    };
}
