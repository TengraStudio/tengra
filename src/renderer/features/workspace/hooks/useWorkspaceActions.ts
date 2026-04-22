/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useWorkspaceSelection } from '@/context/WorkspaceContext';
import { Workspace } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

export interface WorkspaceActionsProps {
    workspace: Workspace; 
    t: (key: string) => string;
    onUpdateWorkspace?: (updates: Partial<Workspace>) => Promise<void>;
}

export function useWorkspaceActions({
    workspace, 
    onUpdateWorkspace,
}: WorkspaceActionsProps) {
    const { selectedWorkspace, setSelectedWorkspace, loadWorkspaces } = useWorkspaceSelection();

    const handleUpdateWorkspace = async (updates: Partial<Workspace>) => {
        try {
            let persistedWorkspace: Workspace | null = null;
            if (onUpdateWorkspace) {
                await onUpdateWorkspace(updates);
            } else {
                persistedWorkspace = await window.electron.db.updateWorkspace(workspace.id, updates);
            }
            if (selectedWorkspace?.id === workspace.id) {
                const nextWorkspace = {
                    ...selectedWorkspace,
                    ...(persistedWorkspace ?? {}),
                    ...updates,
                };
                setSelectedWorkspace({
                    ...nextWorkspace,
                });
            }
            await loadWorkspaces();
        } catch (error) {
            appLogger.error('WorkspaceActions', 'Update failed', error as Error);
        }
    };

    return {
        handleUpdateWorkspace,
    };
}
