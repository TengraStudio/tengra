/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React from 'react';

import { useCommandStripResize } from './useCommandStripResize';

const MIN_TERMINAL_HEIGHT = 150;
const FLOATING_TERMINAL_MAX_WIDTH_PX = 980;
const AGENT_PANEL_VISIBLE_WIDTH_PX = 350;
export const WORKSPACE_EXPLORER_WIDTH_PX = 18 * 16;
export const EXPANDED_EXPLORER_LEFT_INSET_PX = WORKSPACE_EXPLORER_WIDTH_PX;
export const COLLAPSED_EXPLORER_LEFT_INSET_PX = 0;

/** Minimum height for the resizable handle when floating. */
export const MIN_RESIZABLE_TERMINAL_HEIGHT = 56;

/** Bottom offset for docked terminal positioning. */
export const DOCKED_TERMINAL_BOTTOM_OFFSET_PX = 31;

interface UseTerminalLayoutParams {
    showTerminal: boolean;
    setShowTerminal: (show: boolean) => void;
    terminalHeight: number;
    setTerminalHeight: (height: number) => void;
    initialMaximizedTerminal: boolean;
    onTerminalLayoutStateChange: (update: {
        terminalMaximized?: boolean;
    }) => void;
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
    initialMaximizedTerminal,
    onTerminalLayoutStateChange,
    showAgentPanel,
    sidebarCollapsed,
    tabsCount: _tabsCount,
}: UseTerminalLayoutParams) {
    const [isMaximizedTerminal, setIsMaximizedTerminal] = React.useState(initialMaximizedTerminal);
    const [isResizingTerminal, setIsResizingTerminal] = React.useState(false); 
    const [viewportWidth, setViewportWidth] = React.useState(() => window.innerWidth);
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
        setIsResizingTerminal,
        setTerminalHeight,
        calculateTerminalHeight,
        lastExpandedTerminalHeightRef,
    });

    const dockedTerminalRightInsetPx = React.useMemo(() => {
        const baseInset = 0;
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

    // Reset floating/maximized state when terminal is hidden
    React.useEffect(() => {
        if (!showTerminal) {
            setIsMaximizedTerminal(false); 
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
 
    React.useEffect(() => {
        onTerminalLayoutStateChange({ 
            terminalMaximized: isMaximizedTerminal,
        });
    }, [ 
        isMaximizedTerminal,
        onTerminalLayoutStateChange,
    ]);

    return {
        isMaximizedTerminal,
        setIsMaximizedTerminal,
        isResizingTerminal,
        setIsResizingTerminal, 
        lastExpandedTerminalHeightRef,
        dockedTerminalRightInsetPx,
        floatingTerminalLayout,
        handleCommandStripResizeStart,
    };
}
