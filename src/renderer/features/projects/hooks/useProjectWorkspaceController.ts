import { useEffect, useState } from 'react';

import { Language, useTranslation } from '@/i18n';
import { CouncilSession, Project } from '@/types';

import { useCouncilWS } from './useCouncilWS';
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

    const [councilSession, setCouncilSession] = useState<CouncilSession | null>(null);
    const { activityLog, setActivityLog } = useCouncilWS({ councilSession, notify });

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

    const { handleUpdateProject, runCouncil } = useProjectActions({
        project,
        notify,
        t,
        agentChatMessage: ps.agentChatMessage,
        setCouncilSession,
        setActivityLog
    });

    useEffect(() => {
        if (wm.dashboardTab === 'council') {
            const timer = setTimeout(() => ps.setViewTab('council'), 0);
            return () => clearTimeout(timer);
        } else if (wm.dashboardTab === 'overview' || wm.dashboardTab === 'editor') {
            const timer = setTimeout(() => ps.setViewTab('editor'), 0);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [wm.dashboardTab, ps]);

    const toggleAgent = (id: string) => {
        ps.setAgents(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
    };

    return {
        ps,
        wm,
        councilSession,
        activityLog,
        setActivityLog,
        handleUpdateProject,
        runCouncil,
        toggleAgent,
        t
    };
}
