import { useCallback, useEffect, useState } from 'react';

interface UseWorkspaceBranchStateOptions {
    workspacePath?: string;
    enabled?: boolean;
    notify: (type: 'success' | 'error' | 'info', message: string) => void;
    t: (path: string, options?: Record<string, string | number>) => string;
}

interface WorkspaceBranchSnapshot {
    branchName: string;
    branches: string[];
}

async function loadWorkspaceBranchSnapshot(workspacePath: string): Promise<WorkspaceBranchSnapshot> {
    const repoResult = await window.electron.git.isRepository(workspacePath);
    if (!repoResult.isRepository) {
        return { branchName: 'N/A', branches: [] };
    }

    const [branchResult, branchesResult] = await Promise.all([
        window.electron.git.getBranch(workspacePath),
        window.electron.git.getBranches(workspacePath),
    ]);

    return {
        branchName: branchResult.success ? (branchResult.branch ?? 'main') : 'main',
        branches: branchesResult.success ? (branchesResult.branches ?? []) : [],
    };
}

export function useWorkspaceBranchState({
    workspacePath,
    enabled = true,
    notify,
    t,
}: UseWorkspaceBranchStateOptions) {
    const [currentBranchName, setCurrentBranchName] = useState('main');
    const [availableBranches, setAvailableBranches] = useState<string[]>([]);
    const [isBranchLoading, setIsBranchLoading] = useState(false);
    const [isBranchSwitching, setIsBranchSwitching] = useState(false);

    const refreshBranchState = useCallback(async () => {
        if (!enabled) {
            setIsBranchLoading(false);
            return;
        }
        if (!workspacePath) {
            setCurrentBranchName('main');
            setAvailableBranches([]);
            return;
        }

        setIsBranchLoading(true);
        try {
            const snapshot = await loadWorkspaceBranchSnapshot(workspacePath);
            setCurrentBranchName(snapshot.branchName);
            setAvailableBranches(snapshot.branches);
        } catch (error) {
            window.electron.log.error(
                'useWorkspaceBranchState: Failed to load branch data',
                error as Error
            );
            setAvailableBranches([]);
        } finally {
            setIsBranchLoading(false);
        }
    }, [enabled, workspacePath]);

    useEffect(() => {
        if (!enabled) {
            setCurrentBranchName('main');
            setAvailableBranches([]);
            setIsBranchLoading(false);
            return;
        }
        void refreshBranchState();
    }, [enabled, refreshBranchState]);

    const handleBranchSelect = useCallback(
        async (branch: string) => {
            if (!enabled) {
                return;
            }
            if (!workspacePath || branch === currentBranchName) {
                return;
            }

            setIsBranchSwitching(true);
            try {
                const result = await window.electron.git.checkout(workspacePath, branch);
                if (!result.success) {
                    notify('error', result.error ?? t('workspace.branchSwitchFailed'));
                    return;
                }

                setCurrentBranchName(branch);
                notify('success', t('workspace.branchSwitched', { branch }));
                await refreshBranchState();
            } catch (error) {
                window.electron.log.error(
                    'useWorkspaceBranchState: Failed to switch workspace branch',
                    error as Error
                );
                notify('error', t('workspace.branchSwitchFailed'));
            } finally {
                setIsBranchSwitching(false);
            }
        },
        [currentBranchName, enabled, notify, workspacePath, refreshBranchState, t]
    );

    return {
        currentBranchName,
        availableBranches,
        isBranchLoading,
        isBranchSwitching,
        handleBranchSelect,
    };
}
