import { useEffect } from 'react';

import { Language, useTranslation } from '@/i18n';
import { Project } from '@/types';

import { useProjectActions } from './useProjectActions';
import { useProjectState } from './useProjectState';
import { useWorkspaceManager } from './useWorkspaceManager';

interface UseProjectWorkspaceControllerProps {
    project: Project
    language: Language
}

export function useProjectWorkspaceController({
    project,
    language
}: UseProjectWorkspaceControllerProps) {
    const { t } = useTranslation(language);
    const ps = useProjectState();
    const { notify, logActivity } = ps;

    const wm = useWorkspaceManager({ project, notify, logActivity });

    useEffect(() => {
        const handleProgress = (_event: unknown, ...args: unknown[]) => {
            const progress = args[0] as { projectId: string; status: string; current: number; total: number } | undefined;
            if (progress?.projectId === project.id) {
                if (progress.status === 'Complete') {
                    ps.notify('success', t('projectDashboard.indexingComplete') || 'Indexing complete!');
                } else if (progress.status === 'Failed') {
                    ps.notify('error', t('projectDashboard.indexingFailed') || 'Indexing failed.');
                } else {
                    // Only notify at start and end
                    if (progress.current === 1) {
                        ps.notify('info', t('projectDashboard.indexingStarted') || 'Starting project indexing...');
                    }
                }
            }
        };

        const listener = handleProgress as Parameters<typeof window.electron.ipcRenderer.on>[1];
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


    return {
        ps,
        wm,
        handleUpdateProject,
        t
    };
}
