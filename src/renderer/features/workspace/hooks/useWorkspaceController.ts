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
    const ps = useWorkspaceState();
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
            notify('error', t('workspace.errors.explorer.emptyEntryName'));
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
                let deletedCount = 0;
                for (const item of entriesToDelete) {
                    try {
                        await wm.deleteEntry(item);
                        deletedCount++;
                    } catch (e) {
                        notify(
                            'error',
                            t('workspace.notifications.deleteEntryFailed', {
                                name: item.name,
                                error: String(e),
                            })
                        );
                    }
                }
                if (entriesToDelete.length > 1) {
                    notify('success', t('workspace.notifications.entriesDeleted', { count: deletedCount }));
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
