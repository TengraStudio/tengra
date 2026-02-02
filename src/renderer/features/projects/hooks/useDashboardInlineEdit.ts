import { useState } from 'react';

import { Project } from '@/types';

interface UseDashboardInlineEditProps {
    project: Project;
    onUpdate?: (updates: Partial<Project>) => Promise<void>;
}

export const useDashboardInlineEdit = ({ project, onUpdate }: UseDashboardInlineEditProps) => {
    const [isEditingName, setIsEditingName] = useState(false);
    const [isEditingDesc, setIsEditingDesc] = useState(false);
    const [editName, setEditName] = useState(project.title);
    const [editDesc, setEditDesc] = useState(project.description);

    const [prevProject, setPrevProject] = useState({ title: project.title, description: project.description });

    if (project.title !== prevProject.title || project.description !== prevProject.description) {
        setPrevProject({ title: project.title, description: project.description });
        setEditName(project.title);
        setEditDesc(project.description);
    }

    const handleSaveName = async () => {
        if (!editName.trim() || editName === project.title) {
            setIsEditingName(false);
            setEditName(project.title);
            return;
        }
        try {
            await onUpdate?.({ title: editName });
            setIsEditingName(false);
        } catch (error) {
            setEditName(project.title);
            console.error('Failed to update name', error);
        }
    };

    const handleSaveDesc = async () => {
        if (editDesc === project.description) {
            setIsEditingDesc(false);
            return;
        }
        try {
            await onUpdate?.({ description: editDesc });
            setIsEditingDesc(false);
        } catch (error) {
            setEditDesc(project.description);
            console.error('Failed to update description', error);
        }
    };

    return {
        isEditingName,
        setIsEditingName,
        isEditingDesc,
        setIsEditingDesc,
        editName,
        setEditName,
        editDesc,
        setEditDesc,
        handleSaveName,
        handleSaveDesc
    };
};
