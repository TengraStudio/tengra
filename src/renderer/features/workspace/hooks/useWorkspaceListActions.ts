import { useState } from 'react';

import { Project, WorkspaceMount } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

export interface ProjectListActionsOptions {
    filteredProjects: Project[]
}

export const useProjectListActions = ({ filteredProjects }: ProjectListActionsOptions) => {
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [deletingProject, setDeletingProject] = useState<Project | null>(null);
    const [isArchiving, setIsArchiving] = useState<Project | null>(null);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [isBulkArchiving, setIsBulkArchiving] = useState(false);
    const [editForm, setEditForm] = useState({ title: '', description: '' });
    const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());

    const handleEditClick = (project: Project, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingProject(project);
        setEditForm({ title: project.title, description: project.description });
    };

    const handleDeleteClick = (project: Project, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeletingProject(project);
    };

    const handleUpdateProject = async () => {
        if (!editingProject) { return; }
        try {
            await window.electron.db.updateWorkspace(editingProject.id, editForm);
            setEditingProject(null);
        } catch (error) {
            appLogger.error('ProjectListActions', 'Failed to update project', error as Error);
        }
    };

    const handleDeleteProject = async (deleteFiles: boolean = false) => {
        if (!deletingProject) { return; }
        try {
            await window.electron.db.deleteWorkspace(deletingProject.id, deleteFiles);
            setDeletingProject(null);
        } catch (error) {
            appLogger.error('ProjectListActions', 'Failed to delete project', error as Error);
        }
    };

    const handleArchiveProject = async () => {
        if (!isArchiving) { return; }
        try {
            const newStatus = isArchiving.status === 'archived' ? 'active' : 'archived';
            await window.electron.db.archiveWorkspace(isArchiving.id, newStatus === 'archived');
            setIsArchiving(null);
        } catch (error) {
            appLogger.error('ProjectListActions', 'Failed to archive project', error as Error);
        }
    };

    const handleBulkDelete = async (deleteFiles: boolean = false) => {
        if (selectedProjectIds.size === 0) { return; }
        try {
            await window.electron.db.bulkDeleteWorkspaces(Array.from(selectedProjectIds), deleteFiles);
            setSelectedProjectIds(new Set());
            setIsBulkDeleting(false);
        } catch (error) {
            appLogger.error('ProjectListActions', 'Failed to bulk delete projects', error as Error);
        }
    };

    const handleBulkArchive = async (isArchived: boolean = true) => {
        if (selectedProjectIds.size === 0) { return; }
        try {
            await window.electron.db.bulkArchiveWorkspaces(Array.from(selectedProjectIds), isArchived);
            setSelectedProjectIds(new Set());
            setIsBulkArchiving(false);
        } catch (error) {
            appLogger.error('ProjectListActions', 'Failed to bulk archive projects', error as Error);
        }
    };

    const toggleProjectSelection = (id: string) => {
        const next = new Set(selectedProjectIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedProjectIds(next);
    };

    const toggleSelectAll = () => {
        if (selectedProjectIds.size === filteredProjects.length) {
            setSelectedProjectIds(new Set());
        } else {
            setSelectedProjectIds(new Set(filteredProjects.map(p => p.id)));
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
            await window.electron.db.createWorkspace(name, path, description, JSON.stringify(mounts));
            return true;
        } catch (error) {
            appLogger.error('ProjectListActions', 'Failed to register project', error as Error);
            return false;
        }
    };

    return {
        state: {
            editingProject,
            deletingProject,
            isArchiving,
            isBulkDeleting,
            isBulkArchiving,
            editForm,
            selectedProjectIds
        },
        actions: {
            setEditingProject,
            setDeletingProject,
            setIsArchiving,
            setIsBulkDeleting,
            setIsBulkArchiving,
            setEditForm,
            handleEditClick,
            handleDeleteClick,
            handleUpdateProject,
            handleDeleteProject,
            handleArchiveProject,
            handleBulkDelete,
            handleBulkArchive,
            toggleProjectSelection,
            toggleSelectAll,
            handleWizardCreate
        }
    };
};
