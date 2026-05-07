/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useState } from 'react';

import { Workspace, WorkspaceMount } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

export interface WorkspaceListActionsOptions {
    filteredWorkspaces: Workspace[]
}

export const useWorkspaceListActions = ({ filteredWorkspaces }: WorkspaceListActionsOptions) => {
    const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
    const [deletingWorkspace, setDeletingWorkspace] = useState<Workspace | null>(null);
    const [isArchiving, setIsArchiving] = useState<Workspace | null>(null);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [isBulkArchiving, setIsBulkArchiving] = useState(false);
    const [editForm, setEditForm] = useState({ title: '', description: '' });
    const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<Set<string>>(new Set());

    const handleEditClick = (workspace: Workspace, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingWorkspace(workspace);
        setEditForm({ title: workspace.title, description: workspace.description });
    };

    const handleDeleteClick = (workspace: Workspace, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeletingWorkspace(workspace);
    };

    const handleUpdateWorkspace = async () => {
        if (!editingWorkspace) { return; }
        try {
            await window.electron.db.updateWorkspace(editingWorkspace.id, editForm);
            setEditingWorkspace(null);
        } catch (error) {
            appLogger.error('WorkspaceListActions', 'Failed to update workspace', error as Error);
        }
    };

    const handleDeleteWorkspace = async (deleteFiles: boolean = false) => {
        if (!deletingWorkspace) { return; }
        try {
            await window.electron.db.deleteWorkspace(deletingWorkspace.id, deleteFiles);
            setDeletingWorkspace(null);
        } catch (error) {
            appLogger.error('WorkspaceListActions', 'Failed to delete workspace', error as Error);
        }
    };

    const handleArchiveWorkspace = async () => {
        if (!isArchiving) { return; }
        try {
            const newStatus = isArchiving.status === 'archived' ? 'active' : 'archived';
            await window.electron.db.archiveWorkspace(isArchiving.id, newStatus === 'archived');
            setIsArchiving(null);
        } catch (error) {
            appLogger.error('WorkspaceListActions', 'Failed to archive workspace', error as Error);
        }
    };

    const handleBulkDelete = async (deleteFiles: boolean = false) => {
        if (selectedWorkspaceIds.size === 0) { return; }
        try {
            await window.electron.db.bulkDeleteWorkspaces(Array.from(selectedWorkspaceIds), deleteFiles);
            setSelectedWorkspaceIds(new Set());
            setIsBulkDeleting(false);
        } catch (error) {
            appLogger.error('WorkspaceListActions', 'Failed to bulk delete workspaces', error as Error);
        }
    };

    const handleBulkArchive = async (isArchived: boolean = true) => {
        if (selectedWorkspaceIds.size === 0) { return; }
        try {
            await window.electron.db.bulkArchiveWorkspaces(Array.from(selectedWorkspaceIds), isArchived);
            setSelectedWorkspaceIds(new Set());
            setIsBulkArchiving(false);
        } catch (error) {
            appLogger.error('WorkspaceListActions', 'Failed to bulk archive workspaces', error as Error);
        }
    };

    const toggleWorkspaceSelection = (id: string) => {
        const next = new Set(selectedWorkspaceIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedWorkspaceIds(next);
    };

    const toggleSelectAll = () => {
        if (selectedWorkspaceIds.size === filteredWorkspaces.length) {
            setSelectedWorkspaceIds(new Set());
        } else {
            setSelectedWorkspaceIds(new Set(filteredWorkspaces.map(p => p.id)));
        }
    };

    const handleWizardCreate = async (path: string, name: string, description: string, userMounts?: WorkspaceMount[]) => {
        try {
            const mounts = userMounts && userMounts.length > 0 ? userMounts : [{
                id: `local-${Date.now()}`,
                name: name,
                type: 'local' as const,
                rootPath: path
            }];
            await window.electron.db.createWorkspace(name, path, description, mounts);
            return true;
        } catch (error) {
            appLogger.error('WorkspaceListActions', 'Failed to register workspace', error as Error);
            return false;
        }
    };

    return {
        state: {
            editingWorkspace,
            deletingWorkspace,
            isArchiving,
            isBulkDeleting,
            isBulkArchiving,
            editForm,
            selectedWorkspaceIds
        },
        actions: {
            setEditingWorkspace,
            setDeletingWorkspace,
            setIsArchiving,
            setIsBulkDeleting,
            setIsBulkArchiving,
            setEditForm,
            handleEditClick,
            handleDeleteClick,
            handleUpdateWorkspace,
            handleDeleteWorkspace,
            handleArchiveWorkspace,
            handleBulkDelete,
            handleBulkArchive,
            toggleWorkspaceSelection,
            toggleSelectAll,
            handleWizardCreate
        }
    };
};

