/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useEffect, useState } from 'react';

import { Language, useTranslation } from '@/i18n';
import { Workspace } from '@/types';

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
    const { notify, logActivity } = ps;

    const wm = useWorkspaceManager({ workspace, notify, logActivity, t });

    useEffect(() => {
        const handleProgress = (_event: RendererDataValue, ...args: RendererDataValue[]) => {
            const progress = args[0] as
                | { workspaceId: string; status: string; current: number; total: number }
                | undefined;
            if (progress?.workspaceId === workspace.id) {
                if (progress.status === 'Complete') {
                    ps.notify(
                        'success',
                        t('workspaceDashboard.indexingComplete')
                    );
                } else if (progress.status === 'Failed') {
                    ps.notify('error', t('workspaceDashboard.indexingFailed'));
                } else {
                    // Only notify at start and end
                    if (progress.current === 1) {
                        ps.notify(
                            'info',
                            t('workspaceDashboard.indexingStarted')
                        );
                    }
                }
            }
        };

        const listener = handleProgress as Parameters<typeof window.electron.ipcRenderer.on>[1];

        window.electron.ipcRenderer.on('code:indexing-progress', listener);

        return () => {
            window.electron.ipcRenderer.off('code:indexing-progress', listener);
        };
    }, [workspace.id, ps, t]);

    const { handleUpdateWorkspace } = useWorkspaceActions({
        workspace,
        notify,
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
            notify('error', t('workspace.errors.explorer.validationError'));
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
            notify('error', `${t('common.error')}: ${error}`);
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
