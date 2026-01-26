import { useState } from 'react';

import { Project, WorkspaceMount } from '@/types';

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
            await window.electron.db.updateProject(editingProject.id, editForm);
            setEditingProject(null);
        } catch (error) {
            console.error('Failed to update project:', error);
        }
    };

    const handleDeleteProject = async (deleteFiles: boolean = false) => {
        if (!deletingProject) { return; }
        try {
            await window.electron.db.deleteProject(deletingProject.id, deleteFiles);
            setDeletingProject(null);
        } catch (error) {
            console.error('Failed to delete project:', error);
        }
    };

    const handleArchiveProject = async () => {
        if (!isArchiving) { return; }
        try {
            const newStatus = isArchiving.status === 'archived' ? 'active' : 'archived';
            await window.electron.db.archiveProject(isArchiving.id, newStatus === 'archived');
            setIsArchiving(null);
        } catch (error) {
            console.error('Failed to archive project:', error);
        }
    };

    const handleBulkDelete = async (deleteFiles: boolean = false) => {
        if (selectedProjectIds.size === 0) { return; }
        try {
            await window.electron.db.bulkDeleteProjects(Array.from(selectedProjectIds), deleteFiles);
            setSelectedProjectIds(new Set());
            setIsBulkDeleting(false);
        } catch (error) {
            console.error('Failed to bulk delete projects:', error);
        }
    };

    const handleBulkArchive = async (isArchived: boolean = true) => {
        if (selectedProjectIds.size === 0) { return; }
        try {
            await window.electron.db.bulkArchiveProjects(Array.from(selectedProjectIds), isArchived);
            setSelectedProjectIds(new Set());
            setIsBulkArchiving(false);
        } catch (error) {
            console.error('Failed to bulk archive projects:', error);
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
            await window.electron.db.createProject(name, path, description, JSON.stringify(mounts));
            return true;
        } catch (error) {
            console.error('Failed to register project:', error);
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
