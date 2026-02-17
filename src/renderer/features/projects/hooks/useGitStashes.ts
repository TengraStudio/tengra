import { useCallback, useState } from 'react';

import { GitStash } from '../components/git/types';

type InvokeGitFn = <T>(channel: string, ...args: (string | number | boolean)[]) => Promise<T>;

/**
 * Hook for git stash operations
 */
export function useGitStashes(
    canRun: boolean,
    projectPath: string | undefined,
    invokeGit: InvokeGitFn
) {
    const [stashes, setStashes] = useState<GitStash[]>([]);

    const fetchStashes = useCallback(async () => {
        if (!canRun || !projectPath) {
            return;
        }
        const response = await invokeGit<{ success: boolean; stashes?: GitStash[] }>(
            'git:getStashes',
            projectPath
        );
        if (response.success) {
            setStashes(response.stashes ?? []);
        }
    }, [canRun, projectPath, invokeGit]);

    const createStash = useCallback(
        async (message: string, includeUntracked = true) => {
            if (!canRun || !projectPath) {
                return false;
            }
            const response = await invokeGit<{ success: boolean }>(
                'git:createStash',
                projectPath,
                message,
                includeUntracked
            );
            await fetchStashes();
            return response.success;
        },
        [canRun, projectPath, invokeGit, fetchStashes]
    );

    const applyStash = useCallback(
        async (stashRef: string, pop: boolean) => {
            if (!canRun || !projectPath) {
                return false;
            }
            const response = await invokeGit<{ success: boolean }>(
                'git:applyStash',
                projectPath,
                stashRef,
                pop
            );
            await fetchStashes();
            return response.success;
        },
        [canRun, projectPath, invokeGit, fetchStashes]
    );

    const dropStash = useCallback(
        async (stashRef: string) => {
            if (!canRun || !projectPath) {
                return false;
            }
            const response = await invokeGit<{ success: boolean }>('git:dropStash', projectPath, stashRef);
            await fetchStashes();
            return response.success;
        },
        [canRun, projectPath, invokeGit, fetchStashes]
    );

    const exportStash = useCallback(
        async (stashRef: string) => {
            if (!canRun || !projectPath) {
                return;
            }
            const response = await invokeGit<{ success: boolean; patch?: string }>(
                'git:exportStash',
                projectPath,
                stashRef
            );
            if (!response.success) {
                return;
            }
            // Download the patch
            const blob = new Blob([response.patch ?? ''], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `${stashRef.replace(/[{}@]/g, '_')}.patch`;
            anchor.click();
            URL.revokeObjectURL(url);
        },
        [canRun, projectPath, invokeGit]
    );

    return {
        stashes,
        fetchStashes,
        createStash,
        applyStash,
        dropStash,
        exportStash,
    };
}
