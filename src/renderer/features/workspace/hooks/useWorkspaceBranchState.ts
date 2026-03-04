import { useCallback, useEffect, useState } from 'react';

interface UseWorkspaceBranchStateOptions {
    projectPath?: string;
    notify: (type: 'success' | 'error' | 'info', message: string) => void;
    t: (path: string, options?: Record<string, string | number>) => string;
}

interface WorkspaceBranchSnapshot {
    branchName: string;
    branches: string[];
}

async function loadWorkspaceBranchSnapshot(projectPath: string): Promise<WorkspaceBranchSnapshot> {
    const repoResult = await window.electron.git.isRepository(projectPath);
    if (!repoResult.isRepository) {
        return { branchName: 'N/A', branches: [] };
    }

    const [branchResult, branchesResult] = await Promise.all([
        window.electron.git.getBranch(projectPath),
        window.electron.git.getBranches(projectPath),
    ]);

    return {
        branchName: branchResult.success ? (branchResult.branch ?? 'main') : 'main',
        branches: branchesResult.success ? (branchesResult.branches ?? []) : [],
    };
}

export function useWorkspaceBranchState({ projectPath, notify, t }: UseWorkspaceBranchStateOptions) {
    const [currentBranchName, setCurrentBranchName] = useState('main');
    const [availableBranches, setAvailableBranches] = useState<string[]>([]);
    const [isBranchLoading, setIsBranchLoading] = useState(false);
    const [isBranchSwitching, setIsBranchSwitching] = useState(false);

    const refreshBranchState = useCallback(async () => {
        if (!projectPath) {
            setCurrentBranchName('main');
            setAvailableBranches([]);
            return;
        }

        setIsBranchLoading(true);
        try {
            const snapshot = await loadWorkspaceBranchSnapshot(projectPath);
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
    }, [projectPath]);

    useEffect(() => {
        void refreshBranchState();
    }, [refreshBranchState]);

    const handleBranchSelect = useCallback(
        async (branch: string) => {
            if (!projectPath || branch === currentBranchName) {
                return;
            }

            setIsBranchSwitching(true);
            try {
                const result = await window.electron.git.checkout(projectPath, branch);
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
        [currentBranchName, notify, projectPath, refreshBranchState, t]
    );

    return {
        currentBranchName,
        availableBranches,
        isBranchLoading,
        isBranchSwitching,
        handleBranchSelect,
    };
}
