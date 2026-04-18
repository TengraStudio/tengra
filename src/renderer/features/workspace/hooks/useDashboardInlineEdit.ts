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

import { Workspace } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

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
            appLogger.error('useDashboardInlineEdit', 'Failed to update name', error as Error);
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
            appLogger.error('useDashboardInlineEdit', 'Failed to update description', error as Error);
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

