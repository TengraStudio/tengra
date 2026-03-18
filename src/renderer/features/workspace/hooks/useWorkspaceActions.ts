import { Workspace } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

export interface WorkspaceActionsProps {
    workspace: Workspace;
    notify: (type: 'success' | 'error' | 'info', message: string) => void;
    t: (key: string) => string;
    onUpdateWorkspace?: (updates: Partial<Workspace>) => Promise<void>;
}

export function useWorkspaceActions({
    workspace,
    notify,
    t,
    onUpdateWorkspace,
}: WorkspaceActionsProps) {
    const handleUpdateWorkspace = async (updates: Partial<Workspace>) => {
        try {
            if (onUpdateWorkspace) {
                await onUpdateWorkspace(updates);
            } else {
                await window.electron.db.updateWorkspace(workspace.id, updates);
            }
        } catch (error) {
            appLogger.error('WorkspaceActions', 'Update failed', error as Error);
            notify('error', t('workspaceDashboard.updateFailed'));
        }
    };

    return {
        handleUpdateWorkspace,
    };
}
