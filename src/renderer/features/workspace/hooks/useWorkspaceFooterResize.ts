/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useRef } from 'react';

import { TERMINAL_WORKSPACE_ISSUES_TAB_ID } from '@/features/terminal/constants/terminal-panel-constants';
import type { TerminalTab } from '@/types';

const MIN_TERMINAL_HEIGHT = 150;
const DRAG_OPEN_ACTIVATION_PX = 10;

interface UseWorkspaceFooterResizeParams {
    showTerminal: boolean;
    setShowTerminal: (show: boolean) => void;
    setIsMaximizedTerminal: React.Dispatch<React.SetStateAction<boolean>>;
    setIsResizingTerminal: React.Dispatch<React.SetStateAction<boolean>>;
    setTerminalHeight: (height: number) => void;
    calculateTerminalHeight: (clientY: number) => number;
    lastExpandedTerminalHeightRef: React.MutableRefObject<number>;
    activeTabId: string | null;
    setActiveTabId: (id: string | null) => void;
    tabs: TerminalTab[];
}

function isInteractiveResizeTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) {
        return false;
    }
    return Boolean(
        target.closest(
            'button, a, input, textarea, select, [role="button"], [data-radix-popper-content-wrapper]'
        )
    );
}

export function useWorkspaceFooterResize({
    showTerminal,
    setShowTerminal,
    setIsMaximizedTerminal,
    setIsResizingTerminal,
    setTerminalHeight,
    calculateTerminalHeight,
    lastExpandedTerminalHeightRef,
    activeTabId,
    setActiveTabId,
    tabs,
}: UseWorkspaceFooterResizeParams) {
    const footerResizeCleanupRef = useRef<(() => void) | null>(null);

    const stopWorkspaceFooterResize = useCallback(() => {
        footerResizeCleanupRef.current?.();
        footerResizeCleanupRef.current = null;
        setIsResizingTerminal(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }, [setIsResizingTerminal]);

    const handleWorkspaceFooterResizeStart = useCallback(
        (e: React.MouseEvent) => {
            if (e.button !== 0) {
                return;
            }
            if (isInteractiveResizeTarget(e.target)) {
                return;
            }
            e.preventDefault();

            footerResizeCleanupRef.current?.();
            footerResizeCleanupRef.current = null;

            const startY = e.clientY;
            let isActivated = false;

            const activateResize = (clientY: number) => {
                if (isActivated) {
                    return;
                }
                isActivated = true;
                const nextHeight = calculateTerminalHeight(clientY);
                setTerminalHeight(nextHeight);
                lastExpandedTerminalHeightRef.current = Math.max(nextHeight, MIN_TERMINAL_HEIGHT);
                setIsMaximizedTerminal(false);
                setIsResizingTerminal(true);
                if (!showTerminal) {
                    setShowTerminal(true);
                    
                    // If we are opening the terminal via mouse interaction, 
                    // ensure we start on a terminal tab, not the problems/issues tab.
                    if (activeTabId === TERMINAL_WORKSPACE_ISSUES_TAB_ID && tabs.length > 0) {
                        setActiveTabId(tabs[tabs.length - 1].id);
                    }
                }
                document.body.style.cursor = 'ns-resize';
                document.body.style.userSelect = 'none';
            };

            const hMove = (event: MouseEvent) => {
                if (!isActivated) {
                    const upwardDelta = startY - event.clientY;
                    if (upwardDelta < DRAG_OPEN_ACTIVATION_PX) {
                        return;
                    }
                    activateResize(event.clientY);
                }
                const nextHeight = calculateTerminalHeight(event.clientY);
                setTerminalHeight(nextHeight);
                if (nextHeight >= MIN_TERMINAL_HEIGHT) {
                    lastExpandedTerminalHeightRef.current = nextHeight;
                }
            };
            const hUp = () => {
                stopWorkspaceFooterResize();
            };

            window.addEventListener('mousemove', hMove);
            window.addEventListener('mouseup', hUp, { once: true });

            footerResizeCleanupRef.current = () => {
                window.removeEventListener('mousemove', hMove);
                window.removeEventListener('mouseup', hUp);
            };
        },
        [
            calculateTerminalHeight,
            setTerminalHeight,
            showTerminal,
            setShowTerminal,
            stopWorkspaceFooterResize,
            setIsMaximizedTerminal,
            setIsResizingTerminal,
            lastExpandedTerminalHeightRef,
            activeTabId,
            setActiveTabId,
            tabs,
        ]
    );

    return {
        stopWorkspaceFooterResize,
        handleWorkspaceFooterResizeStart
    };
}

