import { Project } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

export interface ProjectActionsProps {
    project: Project;
    notify: (type: 'success' | 'error' | 'info', message: string) => void;
    t: (key: string) => string;
    onUpdateProject?: (updates: Partial<Project>) => Promise<void>;
    agentChatMessage?: string;
}

export function useProjectActions({
    project,
    notify,
    t,
    onUpdateProject,
    agentChatMessage: _agentChatMessage,
}: ProjectActionsProps) {
    const handleUpdateProject = async (updates: Partial<Project>) => {
        try {
            if (onUpdateProject) {
                await onUpdateProject(updates);
            } else {
                await window.electron.db.updateWorkspace(project.id, updates);
            }
        } catch (error) {
            appLogger.error('ProjectActions', 'Update failed', error as Error);
            notify('error', t('projectDashboard.updateFailed'));
        }
    };

    return {
        handleUpdateProject,
    };
}
