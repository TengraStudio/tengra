import { useWorkspaceSelection } from '@/context/WorkspaceContext';
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
    const { selectedWorkspace, setSelectedWorkspace, loadWorkspaces } = useWorkspaceSelection();

    const handleUpdateWorkspace = async (updates: Partial<Workspace>) => {
        try {
            let persistedWorkspace: Workspace | null = null;
            if (onUpdateWorkspace) {
                await onUpdateWorkspace(updates);
            } else {
                persistedWorkspace = await window.electron.db.updateWorkspace(workspace.id, updates);
            }
            if (selectedWorkspace?.id === workspace.id) {
                const nextWorkspace = {
                    ...selectedWorkspace,
                    ...(persistedWorkspace ?? {}),
                    ...updates,
                };
                setSelectedWorkspace({
                    ...nextWorkspace,
                });
            }
            await loadWorkspaces();
        } catch (error) {
            appLogger.error('WorkspaceActions', 'Update failed', error as Error);
            notify('error', t('workspaceDashboard.updateFailed'));
        }
    };

    return {
        handleUpdateWorkspace,
    };
}
