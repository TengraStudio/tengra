import { Resizable } from 're-resizable';
import React from 'react';

import { TerminalPanel } from '@/features/terminal/TerminalPanel';
import { AnimatePresence, motion } from '@/lib/framer-motion-compat';
import { cn } from '@/lib/utils';
import type { TerminalTab } from '@/types';

import {
    DOCKED_TERMINAL_BOTTOM_OFFSET_PX,
    MIN_RESIZABLE_TERMINAL_HEIGHT,
} from '../../hooks/useTerminalLayout';

const MIN_TERMINAL_HEIGHT = 150;

interface WorkspaceTerminalLayerProps {
    showTerminal: boolean;
    isFloatingTerminal: boolean;
    isMaximizedTerminal: boolean;
    isResizingTerminal: boolean;
    sidebarCollapsed: boolean;
    terminalHeight: number;
    floatingTerminalLayout: { leftPx: number; widthPx: number };
    dockedTerminalRightInsetPx: number;
    lastExpandedTerminalHeightRef: React.MutableRefObject<number>;
    setShowTerminal: (show: boolean) => void;
    setIsMaximizedTerminal: React.Dispatch<React.SetStateAction<boolean>>;
    setIsResizingTerminal: React.Dispatch<React.SetStateAction<boolean>>;
    setIsFloatingTerminal: React.Dispatch<React.SetStateAction<boolean>>;
    setTerminalHeight: (height: number) => void;
    projectId: string;
    projectPath: string;
    tabs: TerminalTab[];
    activeTabId: string | null;
    setTabs: (tabs: TerminalTab[] | ((prev: TerminalTab[]) => TerminalTab[])) => void;
    setActiveTabId: (id: string | null) => void;
    onOpenFile: (path: string, line?: number) => void;
}

/** Renders the terminal panel with resizable / floating support. */
export const WorkspaceTerminalLayer: React.FC<WorkspaceTerminalLayerProps> = ({
    showTerminal,
    isFloatingTerminal,
    isMaximizedTerminal,
    isResizingTerminal,
    sidebarCollapsed,
    terminalHeight,
    floatingTerminalLayout,
    dockedTerminalRightInsetPx,
    lastExpandedTerminalHeightRef,
    setShowTerminal,
    setIsMaximizedTerminal,
    setIsResizingTerminal,
    setIsFloatingTerminal,
    setTerminalHeight,
    projectId,
    projectPath,
    tabs,
    activeTabId,
    setTabs,
    setActiveTabId,
    onOpenFile,
}) => (
    <AnimatePresence>
        {showTerminal && (
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                exit={{ opacity: 0, y: 8 }}
                className={cn(
                    'absolute z-30',
                    isFloatingTerminal
                        ? 'z-50'
                        : sidebarCollapsed
                            ? 'left-2'
                            : 'left-[calc(18rem+0.5rem)]'
                )}
                style={
                    isFloatingTerminal
                        ? {
                            left: `${floatingTerminalLayout.leftPx}px`,
                            width: `${floatingTerminalLayout.widthPx}px`,
                            bottom: `${DOCKED_TERMINAL_BOTTOM_OFFSET_PX}px`,
                        }
                        : {
                            right: `${dockedTerminalRightInsetPx}px`,
                            bottom: `${DOCKED_TERMINAL_BOTTOM_OFFSET_PX}px`,
                        }
                }
            >
                <Resizable
                    size={{
                        width: '100%',
                        height: isMaximizedTerminal ? '70vh' : terminalHeight,
                    }}
                    minHeight={isFloatingTerminal ? 220 : MIN_RESIZABLE_TERMINAL_HEIGHT}
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
                        if (!isFloatingTerminal && nextHeight < MIN_TERMINAL_HEIGHT) {
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
                        'border border-border/70 flex flex-col overflow-hidden',
                        isFloatingTerminal
                            ? 'rounded-xl shadow-lg'
                            : 'border-x-0 border-b-0 shadow-none',
                        isResizingTerminal && 'transition-none'
                    )}
                >
                    <div className="flex-1 min-h-0">
                        <TerminalPanel
                            isOpen={showTerminal}
                            onToggle={() => setShowTerminal(false)}
                            isMaximized={isMaximizedTerminal}
                            onMaximizeChange={setIsMaximizedTerminal}
                            isFloating={isFloatingTerminal}
                            onFloatingChange={setIsFloatingTerminal}
                            workspaceId={projectId}
                            workspacePath={projectPath}
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
