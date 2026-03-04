import React from 'react';

import { useCommandStripResize } from './useCommandStripResize';

const MIN_TERMINAL_HEIGHT = 150;
const FLOATING_TERMINAL_MAX_WIDTH_PX = 980;
const AGENT_PANEL_VISIBLE_WIDTH_PX = 350;
const EXPANDED_EXPLORER_LEFT_INSET_PX = 18 * 16 + 8;
const COLLAPSED_EXPLORER_LEFT_INSET_PX = 8;

/** Minimum height for the resizable handle when floating. */
export const MIN_RESIZABLE_TERMINAL_HEIGHT = 56;

/** Bottom offset for docked terminal positioning. */
export const DOCKED_TERMINAL_BOTTOM_OFFSET_PX = 31;

interface UseTerminalLayoutParams {
    showTerminal: boolean;
    setShowTerminal: (show: boolean) => void;
    terminalHeight: number;
    setTerminalHeight: (height: number) => void;
    showAgentPanel: boolean;
    sidebarCollapsed: boolean;
    tabsCount: number;
}

/**
 * Manages terminal layout state, resize behaviour, and related side-effects.
 */
export function useTerminalLayout({
    showTerminal,
    setShowTerminal,
    terminalHeight,
    setTerminalHeight,
    showAgentPanel,
    sidebarCollapsed,
    tabsCount,
}: UseTerminalLayoutParams) {
    const [isMaximizedTerminal, setIsMaximizedTerminal] = React.useState(false);
    const [isResizingTerminal, setIsResizingTerminal] = React.useState(false);
    const [isFloatingTerminal, setIsFloatingTerminal] = React.useState(false);
    const [viewportWidth, setViewportWidth] = React.useState(() => window.innerWidth);
    const prevTabsCountRef = React.useRef(tabsCount);
    const lastExpandedTerminalHeightRef = React.useRef(
        Math.max(terminalHeight, MIN_TERMINAL_HEIGHT)
    );

    const calculateTerminalHeight = React.useCallback((clientY: number) => {
        const minHeight = MIN_TERMINAL_HEIGHT;
        const maxHeight = window.innerHeight * 0.8;
        return Math.min(Math.max(minHeight, window.innerHeight - clientY - 32), maxHeight);
    }, []);

    const { stopCommandStripResize, handleCommandStripResizeStart } = useCommandStripResize({
        showTerminal,
        setShowTerminal,
        setIsMaximizedTerminal,
        setIsFloatingTerminal,
        setIsResizingTerminal,
        setTerminalHeight,
        calculateTerminalHeight,
        lastExpandedTerminalHeightRef,
    });

    const dockedTerminalRightInsetPx = React.useMemo(() => {
        const baseInset = 8;
        if (!showAgentPanel) {
            return baseInset;
        }
        return AGENT_PANEL_VISIBLE_WIDTH_PX + baseInset;
    }, [showAgentPanel]);

    const workspaceLeftInsetPx = React.useMemo(
        () =>
            sidebarCollapsed
                ? COLLAPSED_EXPLORER_LEFT_INSET_PX
                : EXPANDED_EXPLORER_LEFT_INSET_PX,
        [sidebarCollapsed]
    );

    const floatingTerminalLayout = React.useMemo(() => {
        const availableWidthPx = Math.max(
            0,
            viewportWidth - workspaceLeftInsetPx - dockedTerminalRightInsetPx
        );
        const widthPx = Math.min(FLOATING_TERMINAL_MAX_WIDTH_PX, availableWidthPx);
        const leftPx = workspaceLeftInsetPx + Math.max(0, (availableWidthPx - widthPx) / 2);
        return { leftPx, widthPx };
    }, [dockedTerminalRightInsetPx, viewportWidth, workspaceLeftInsetPx]);

    // Close terminal when all tabs are removed
    React.useEffect(() => {
        const prevTabsCount = prevTabsCountRef.current;
        prevTabsCountRef.current = tabsCount;
        if (showTerminal && prevTabsCount > 0 && tabsCount === 0) {
            setShowTerminal(false);
            setIsMaximizedTerminal(false);
        }
    }, [showTerminal, tabsCount, setShowTerminal]);

    // Reset floating/maximized state when terminal is hidden
    React.useEffect(() => {
        if (!showTerminal) {
            setIsMaximizedTerminal(false);
            setIsFloatingTerminal(false);
            stopCommandStripResize();
        }
    }, [showTerminal, stopCommandStripResize]);

    // Keep last expanded height in sync
    React.useEffect(() => {
        if (terminalHeight >= MIN_TERMINAL_HEIGHT) {
            lastExpandedTerminalHeightRef.current = terminalHeight;
        }
    }, [terminalHeight]);

    // Cleanup on unmount
    React.useEffect(() => {
        return () => {
            stopCommandStripResize();
        };
    }, [stopCommandStripResize]);

    // Track viewport width for floating layout
    React.useEffect(() => {
        const onResize = () => {
            setViewportWidth(window.innerWidth);
        };
        window.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('resize', onResize);
        };
    }, []);

    // Collapse floating terminal when viewport is too narrow
    React.useEffect(() => {
        if (isFloatingTerminal && floatingTerminalLayout.widthPx < 320) {
            setIsFloatingTerminal(false);
        }
    }, [floatingTerminalLayout.widthPx, isFloatingTerminal]);

    return {
        isMaximizedTerminal,
        setIsMaximizedTerminal,
        isResizingTerminal,
        setIsResizingTerminal,
        isFloatingTerminal,
        setIsFloatingTerminal,
        lastExpandedTerminalHeightRef,
        dockedTerminalRightInsetPx,
        floatingTerminalLayout,
        handleCommandStripResizeStart,
    };
}
