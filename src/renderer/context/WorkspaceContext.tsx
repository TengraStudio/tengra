/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useWorkspaceListManager } from '@renderer/features/workspace/hooks/useWorkspaceListManager';
import { createContext, ReactNode, useContext, useMemo } from 'react';

import { translateErrorMessage } from '@/utils/error-handler.util';

type WorkspaceContextType = ReturnType<typeof useWorkspaceListManager>
type WorkspaceSelectionContextType = Pick<
    WorkspaceContextType,
    'selectedWorkspace' | 'setSelectedWorkspace' | 'loadWorkspaces'
>;
type WorkspaceLibraryContextType = Pick<WorkspaceContextType, 'workspaces'>;
type WorkspaceTerminalContextType = Pick<
    WorkspaceContextType,
    'terminalTabs' | 'setTerminalTabs' | 'activeTerminalId' | 'setActiveTerminalId' | 'handleOpenTerminal'
>;

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);
const WorkspaceSelectionContext = createContext<WorkspaceSelectionContextType | null>(null);
const WorkspaceLibraryContext = createContext<WorkspaceLibraryContextType | null>(null);
const WorkspaceTerminalContext = createContext<WorkspaceTerminalContextType | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
    const workspaceManager = useWorkspaceListManager();

    // Memoize the context value to prevent unnecessary re-renders
    const value = useMemo(() => workspaceManager, [workspaceManager]);
    const selectionValue = useMemo(
        () => ({
            selectedWorkspace: workspaceManager.selectedWorkspace,
            setSelectedWorkspace: workspaceManager.setSelectedWorkspace,
            loadWorkspaces: workspaceManager.loadWorkspaces,
        }),
        [
            workspaceManager.selectedWorkspace,
            workspaceManager.setSelectedWorkspace,
            workspaceManager.loadWorkspaces,
        ]
    );
    const libraryValue = useMemo(
        () => ({
            workspaces: workspaceManager.workspaces,
        }),
        [workspaceManager.workspaces]
    );
    const terminalValue = useMemo(
        () => ({
            terminalTabs: workspaceManager.terminalTabs,
            setTerminalTabs: workspaceManager.setTerminalTabs,
            activeTerminalId: workspaceManager.activeTerminalId,
            setActiveTerminalId: workspaceManager.setActiveTerminalId,
            handleOpenTerminal: workspaceManager.handleOpenTerminal,
        }),
        [
            workspaceManager.terminalTabs,
            workspaceManager.setTerminalTabs,
            workspaceManager.activeTerminalId,
            workspaceManager.setActiveTerminalId,
            workspaceManager.handleOpenTerminal,
        ]
    );

    return (
        <WorkspaceSelectionContext.Provider value={selectionValue}>
            <WorkspaceLibraryContext.Provider value={libraryValue}>
                <WorkspaceTerminalContext.Provider value={terminalValue}>
                    <WorkspaceContext.Provider value={value}>
                        {children}
                    </WorkspaceContext.Provider>
                </WorkspaceTerminalContext.Provider>
            </WorkspaceLibraryContext.Provider>
        </WorkspaceSelectionContext.Provider>
    );
}

export function useWorkspace() {
    const context = useContext(WorkspaceContext);
    if (!context) {
        throw new Error(translateErrorMessage('useWorkspace must be used within a WorkspaceProvider'));
    }
    return context;
}

export function useWorkspaceSelection() {
    const context = useContext(WorkspaceSelectionContext);
    if (!context) {
        throw new Error(translateErrorMessage('useWorkspaceSelection must be used within a WorkspaceProvider'));
    }
    return context;
}

export function useWorkspaceLibrary() {
    const context = useContext(WorkspaceLibraryContext);
    if (!context) {
        throw new Error(translateErrorMessage('useWorkspaceLibrary must be used within a WorkspaceProvider'));
    }
    return context;
}

export function useWorkspaceTerminal() {
    const context = useContext(WorkspaceTerminalContext);
    if (!context) {
        throw new Error(translateErrorMessage('useWorkspaceTerminal must be used within a WorkspaceProvider'));
    }
    return context;
}
