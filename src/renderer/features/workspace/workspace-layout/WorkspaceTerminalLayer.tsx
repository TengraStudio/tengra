/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Resizable } from 're-resizable';
import React from 'react';

import { TerminalPanel } from '@/features/terminal/TerminalPanel';
import { 
    MIN_RESIZABLE_TERMINAL_HEIGHT,
} from '@/features/workspace/hooks/useTerminalLayout';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';
import type { TerminalTab } from '@/types';

const MIN_TERMINAL_HEIGHT = 150;

interface WorkspaceTerminalLayerProps {
    showTerminal: boolean; 
    isMaximizedTerminal: boolean;
    isResizingTerminal: boolean;
    sidebarCollapsed: boolean;
    terminalHeight: number; 
    lastExpandedTerminalHeightRef: React.MutableRefObject<number>;
    setShowTerminal: (show: boolean) => void;
    setIsMaximizedTerminal: React.Dispatch<React.SetStateAction<boolean>>;
    setIsResizingTerminal: React.Dispatch<React.SetStateAction<boolean>>; 
    setTerminalHeight: (height: number) => void;
    workspaceId: string;
    workspacePath: string;
    activeFilePath?: string;
    activeFileContent?: string;
    activeFileType?: 'code' | 'image' | 'diff';
    activeFileDiff?: { oldValue: string; newValue: string };
    tabs: TerminalTab[];
    activeTabId: string | null;
    setTabs: (tabs: TerminalTab[] | ((prev: TerminalTab[]) => TerminalTab[])) => void;
    setActiveTabId: (id: string | null) => void;
    onOpenFile: (path: string, line?: number) => void;
}

/** Renders the terminal panel with resizable support. */
export const WorkspaceTerminalLayer: React.FC<Omit<WorkspaceTerminalLayerProps, 'dockedTerminalBottomOffsetPx'>> = ({
    showTerminal, 
    isMaximizedTerminal,
    isResizingTerminal,
    sidebarCollapsed: _sidebarCollapsed,
    terminalHeight,
    lastExpandedTerminalHeightRef,
    setShowTerminal,
    setIsMaximizedTerminal,
    setIsResizingTerminal, 
    setTerminalHeight,
    workspaceId,
    workspacePath,
    activeFilePath,
    activeFileContent,
    activeFileType,
    activeFileDiff,
    tabs,
    activeTabId,
    setTabs,
    setActiveTabId,
    onOpenFile,
}) => {

    return (
        <AnimatePresence>
            {showTerminal && (
                <motion.div
                initial={{ opacity: 0, y: 16, scaleY: 0.985 }}
                animate={{ opacity: 1, y: 0, scaleY: 1 }}
                transition={{ type: 'spring', stiffness: 340, damping: 30, mass: 0.85 }}
                exit={{ opacity: 0, y: 10, scaleY: 0.99, transition: { duration: 0.14 } }}
                className={cn(
                    'relative z-30 shrink-0'
                )}
                style={{}}
            >
                <Resizable
                    size={{
                        width: '100%',
                        height: isMaximizedTerminal ? '70vh' : terminalHeight,
                    }}
                    minHeight={MIN_RESIZABLE_TERMINAL_HEIGHT}
                    maxHeight={window.innerHeight * 0.8}
                    enable={{
                        top: !isMaximizedTerminal,
                        right: false,
                        bottom: false,
                        left: false,
                        topRight: false,
                        topLeft: false,
                        bottomRight: false,
                        bottomLeft: false,
                    }}
                    onResizeStart={event => {
                        if ('button' in event && event.button !== 0) {
                            return false;
                        }
                        setIsResizingTerminal(true);
                        if (isMaximizedTerminal) {
                            setIsMaximizedTerminal(false);
                        }
                        return true;
                    }}
                    onResize={(_event, _direction, ref) => {
                        const nextHeight = ref.offsetHeight;
                        setTerminalHeight(nextHeight);
                        if (nextHeight >= MIN_TERMINAL_HEIGHT) {
                            lastExpandedTerminalHeightRef.current = nextHeight;
                        }
                    }}
                    onResizeStop={(_event, _direction, ref) => {
                        setIsResizingTerminal(false);
                        const nextHeight = ref.offsetHeight;
                        if (nextHeight < MIN_TERMINAL_HEIGHT) {
                            setShowTerminal(false);
                            setIsMaximizedTerminal(false);
                            setTerminalHeight(lastExpandedTerminalHeightRef.current);
                            return;
                        }
                        const snappedHeight = Math.max(nextHeight, MIN_TERMINAL_HEIGHT);
                        setTerminalHeight(snappedHeight);
                        lastExpandedTerminalHeightRef.current = snappedHeight;
                    }}
                    handleStyles={{
                        top: {
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '10px',
                            cursor: 'row-resize',
                        },
                    }}
                    className={cn(
                        'border-t border-border/70 flex flex-col overflow-hidden',
                        isResizingTerminal && 'transition-none'
                    )}
                >
                    <div className="flex-1 min-h-0">
                        <TerminalPanel
                            isOpen={showTerminal}
                            onToggle={() => setShowTerminal(false)}
                            isMaximized={isMaximizedTerminal}
                            onMaximizeChange={setIsMaximizedTerminal}
                            workspaceId={workspaceId}
                            workspacePath={workspacePath}
                            activeFilePath={activeFilePath}
                            activeFileContent={activeFileContent}
                            activeFileType={activeFileType}
                            activeFileDiff={activeFileDiff}
                            tabs={tabs}
                            activeTabId={activeTabId}
                            setTabs={setTabs}
                            setActiveTabId={setActiveTabId}
                            onOpenFile={onOpenFile}
                        />
                    </div>
                </Resizable>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

