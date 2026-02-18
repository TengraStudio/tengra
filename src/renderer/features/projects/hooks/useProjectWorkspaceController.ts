import { useEffect, useState } from 'react';

import { Language, useTranslation } from '@/i18n';
import { Project } from '@/types';

import { useProjectActions } from './useProjectActions';
import { useProjectState } from './useProjectState';
import { useWorkspaceManager } from './useWorkspaceManager';

interface UseProjectWorkspaceControllerProps {
    project: Project;
    language: Language;
}

export function useProjectWorkspaceController({
    project,
    language,
}: UseProjectWorkspaceControllerProps) {
    const { t } = useTranslation(language);
    const ps = useProjectState();
    const { notify, logActivity } = ps;

    const wm = useWorkspaceManager({ project, notify, logActivity, t });

    useEffect(() => {
        const handleProgress = (_event: unknown, ...args: unknown[]) => {
            const progress = args[0] as
                | { projectId: string; status: string; current: number; total: number }
                | undefined;
            if (progress?.projectId === project.id) {
                if (progress.status === 'Complete') {
                    ps.notify(
                        'success',
                        t('projectDashboard.indexingComplete') || 'Indexing complete!'
                    );
                } else if (progress.status === 'Failed') {
                    ps.notify('error', t('projectDashboard.indexingFailed') || 'Indexing failed.');
                } else {
                    // Only notify at start and end
                    if (progress.current === 1) {
                        ps.notify(
                            'info',
                            t('projectDashboard.indexingStarted') || 'Starting project indexing...'
                        );
                    }
                }
            }
        };

        const listener = handleProgress as Parameters<typeof window.electron.ipcRenderer.on>[1];

        // Remove any existing listeners first to prevent duplicates
        window.electron.ipcRenderer.removeAllListeners('code:indexing-progress');
        window.electron.ipcRenderer.on('code:indexing-progress', listener);

        return () => {
            window.electron.ipcRenderer.off('code:indexing-progress', listener);
        };
    }, [project.id, ps, t]);

    const { handleUpdateProject } = useProjectActions({
        project,
        notify,
        t,
        agentChatMessage: ps.agentChatMessage,
    });

    const [entryBusy, setEntryBusy] = useState(false);

    const submitEntryModal = async () => {
        if (!ps.entryModal) {
            return;
        }
        const { type, entry } = ps.entryModal;
        const name = ps.entryName.trim();

        if (type !== 'delete' && !name) {
            notify('error', t('workspace.errors.emptyName') || 'Name cannot be empty');
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
                        notify('error', `Failed to delete ${item.name}: ${e}`);
                    }
                }
                if (entriesToDelete.length > 1) {
                    notify('success', `Deleted ${deletedCount} items.`);
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
        handleUpdateProject,
        submitEntryModal,
        entryBusy,
        t,
    };
}
