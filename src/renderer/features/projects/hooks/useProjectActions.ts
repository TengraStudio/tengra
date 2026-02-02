import { Project } from '@/types';

export interface ProjectActionsProps {
    project: Project
    notify: (type: 'success' | 'error' | 'info', message: string) => void
    t: (key: string) => string
    onUpdateProject?: (updates: Partial<Project>) => Promise<void>
    agentChatMessage?: string
}

export function useProjectActions({
    project: _project,
    notify,
    t,
    onUpdateProject,
    agentChatMessage: _agentChatMessage,
}: ProjectActionsProps) {
    const handleUpdateProject = async (updates: Partial<Project>) => {
        try {
            if (onUpdateProject) {
                await onUpdateProject(updates);
            }
        } catch (error) {
            console.error('[ProjectActions] Update failed:', error);
            notify('error', t('projectDashboard.updateFailed'));
        }
    };

    return {
        handleUpdateProject
    };
}
