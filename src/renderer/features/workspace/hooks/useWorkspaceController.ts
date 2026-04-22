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

import { Language, useTranslation } from '@/i18n';
import { Workspace } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import { useWorkspaceActions } from './useWorkspaceActions';
import { useWorkspaceManager } from './useWorkspaceManager';
import { useWorkspaceState } from './useWorkspaceState';

interface UseWorkspaceDetailsControllerProps {
    workspace: Workspace;
    language: Language;
}

export function useWorkspaceDetailsController({
    workspace,
    language,
}: UseWorkspaceDetailsControllerProps) {
    const { t } = useTranslation(language);
    const ps = useWorkspaceState(workspace.id);
    const {  logActivity } = ps;

    const wm = useWorkspaceManager({ workspace, logActivity, t });

    const { handleUpdateWorkspace } = useWorkspaceActions({
        workspace, 
        t,
    });

    const [entryBusy, setEntryBusy] = useState(false);

    const submitEntryModal = async () => {
        if (!ps.entryModal) {
            return;
        }
        const { type, entry } = ps.entryModal;
        const name = ps.entryName.trim();

        if (type !== 'delete' && !name) {
            return;
        }

        setEntryBusy(true);
        try {
            if (type === 'createFile') {
                const parentPath = entry.isDirectory
                    ? entry.path
                    : entry.path.replace(/[\\/][^\\/]*$/, '');
                const separator = parentPath.includes('\\') ? '\\' : '/';
                const newPath = `${parentPath}${separator}${name}`;
                await wm.createFile(newPath);
            } else if (type === 'createFolder') {
                const parentPath = entry.isDirectory
                    ? entry.path
                    : entry.path.replace(/[\\/][^\\/]*$/, '');
                const separator = parentPath.includes('\\') ? '\\' : '/';
                const newPath = `${parentPath}${separator}${name}`;
                await wm.createFolder(newPath);
            } else if (type === 'rename') {
                await wm.renameEntry(entry, name);
            } else if (type === 'delete') {
                const entriesToDelete = ps.selectedEntries.length > 1 ? ps.selectedEntries : [entry];
                if (entriesToDelete.length > 1) {
                    await wm.bulkDeleteEntries(entriesToDelete);
                } else {
                    await wm.deleteEntry(entry);
                }
                ps.setSelectedEntries([]);
            }
            ps.setEntryModal(null);
            ps.setEntryName('');
        } catch (error) {
            appLogger.error('useWorkspaceController', 'Failed to submit entry modal', error as Error);
        } finally {
            setEntryBusy(false);
        }
    };

    return {
        ps,
        wm,
        handleUpdateWorkspace,
        submitEntryModal,
        entryBusy,
        t,
    };
}
