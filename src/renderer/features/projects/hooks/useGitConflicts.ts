import { useCallback, useState } from 'react';

import { GitConflict } from '../components/git/types';

type InvokeGitFn = <T>(channel: string, ...args: (string | number | boolean)[]) => Promise<T>;

/**
 * Hook for git conflict operations
 */
export function useGitConflicts(
    canRun: boolean,
    projectPath: string | undefined,
    invokeGit: InvokeGitFn
) {
    const [conflicts, setConflicts] = useState<GitConflict[]>([]);
    const [conflictAnalytics, setConflictAnalytics] = useState<Record<string, number>>({});

    const fetchConflicts = useCallback(async () => {
        if (!canRun || !projectPath) {
            return;
        }
        const response = await invokeGit<{ success: boolean; conflicts?: GitConflict[]; analytics?: Record<string, number> }>(
            'git:getConflicts',
            projectPath
        );
        if (response.success) {
            setConflicts(response.conflicts ?? []);
            setConflictAnalytics(response.analytics ?? {});
        }
    }, [canRun, projectPath, invokeGit]);

    const resolveConflict = useCallback(
        async (filePath: string, strategy: 'ours' | 'theirs' | 'manual') => {
            if (!canRun || !projectPath) {
                return false;
            }
            const response = await invokeGit<{ success: boolean }>(
                'git:resolveConflict',
                projectPath,
                filePath,
                strategy
            );
            await fetchConflicts();
            return response.success;
        },
        [canRun, projectPath, invokeGit, fetchConflicts]
    );

    const openMergeTool = useCallback(
        async (filePath?: string) => {
            if (!canRun || !projectPath) {
                return false;
            }
            const response = await invokeGit<{ success: boolean }>(
                'git:openMergeTool',
                projectPath,
                filePath ?? ''
            );
            await fetchConflicts();
            return response.success;
        },
        [canRun, projectPath, invokeGit, fetchConflicts]
    );

    return {
        conflicts,
        conflictAnalytics,
        fetchConflicts,
        resolveConflict,
        openMergeTool,
    };
}
