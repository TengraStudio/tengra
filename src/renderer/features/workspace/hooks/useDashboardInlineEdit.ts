import { useState } from 'react';

import { Workspace } from '@/types';

interface UseDashboardInlineEditProps {
    workspace: Workspace;
    onUpdate?: (updates: Partial<Workspace>) => Promise<void>;
}

export const useDashboardInlineEdit = ({ workspace, onUpdate }: UseDashboardInlineEditProps) => {
    const [isEditingName, setIsEditingName] = useState(false);
    const [isEditingDesc, setIsEditingDesc] = useState(false);
    const [editName, setEditName] = useState(workspace.title);
    const [editDesc, setEditDesc] = useState(workspace.description);

    const [prevWorkspace, setPrevWorkspace] = useState({ title: workspace.title, description: workspace.description });

    if (workspace.title !== prevWorkspace.title || workspace.description !== prevWorkspace.description) {
        setPrevWorkspace({ title: workspace.title, description: workspace.description });
        setEditName(workspace.title);
        setEditDesc(workspace.description);
    }

    const handleSaveName = async () => {
        if (!editName.trim() || editName === workspace.title) {
            setIsEditingName(false);
            setEditName(workspace.title);
            return;
        }
        try {
            await onUpdate?.({ title: editName });
            setIsEditingName(false);
        } catch (error) {
            setEditName(workspace.title);
            window.electron.log.error('Failed to update name', error);
        }
    };

    const handleSaveDesc = async () => {
        if (editDesc === workspace.description) {
            setIsEditingDesc(false);
            return;
        }
        try {
            await onUpdate?.({ description: editDesc });
            setIsEditingDesc(false);
        } catch (error) {
            setEditDesc(workspace.description);
            window.electron.log.error('Failed to update description', error);
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

