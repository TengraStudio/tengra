import { useCallback, useState } from 'react';

import { GitFlowStatus, GitHookInfo, GitRebasePlanCommit, GitRepositoryStats, GitSubmodule } from '../components/git/types';

type InvokeGitFn = <T>(channel: string, ...args: (string | number | boolean)[]) => Promise<T>;

const DEFAULT_FLOW_STATUS: GitFlowStatus = {
    currentBranch: '',
    byType: {
        feature: [],
        release: [],
        hotfix: [],
        support: [],
    },
    branches: [],
};

/**
 * Hook for advanced git operations: rebase, submodules, git-flow, hooks, and stats
 */
export function useGitAdvancedOperations(
    canRun: boolean,
    projectPath: string | undefined,
    invokeGit: InvokeGitFn
) {
    const [rebasePlan, setRebasePlan] = useState<GitRebasePlanCommit[]>([]);
    const [submodules, setSubmodules] = useState<GitSubmodule[]>([]);
    const [flowStatus, setFlowStatus] = useState<GitFlowStatus>(DEFAULT_FLOW_STATUS);
    const [hooks, setHooks] = useState<GitHookInfo[]>([]);
    const [hookTemplates, setHookTemplates] = useState<string[]>([]);
    const [hookValidation, setHookValidation] = useState<{
        hookName: string;
        hasShebang: boolean;
        executable: boolean;
        valid: boolean;
    } | null>(null);
    const [hookTestOutput, setHookTestOutput] = useState<{ stdout: string; stderr: string } | null>(null);
    const [stats, setStats] = useState<GitRepositoryStats | null>(null);

    const fetchRebasePlan = useCallback(
        async (ontoBranch: string) => {
            if (!canRun || !projectPath || !ontoBranch.trim()) {
                return;
            }
            const response = await invokeGit<{ success: boolean; plan?: GitRebasePlanCommit[] }>(
                'git:getRebasePlan',
                projectPath,
                ontoBranch
            );
            if (response.success) {
                setRebasePlan(response.plan ?? []);
            }
        },
        [canRun, projectPath, invokeGit]
    );

    const runRebaseAction = useCallback(
        async (action: 'continue' | 'abort' | 'skip') => {
            if (!canRun || !projectPath) {
                return false;
            }
            const response = await invokeGit<{ success: boolean }>(
                'git:runRebaseAction',
                projectPath,
                action
            );
            return response.success;
        },
        [canRun, projectPath, invokeGit]
    );

    const fetchSubmodules = useCallback(async () => {
        if (!canRun || !projectPath) {
            return;
        }
        const response = await invokeGit<{ success: boolean; submodules?: GitSubmodule[] }>(
            'git:getSubmodules',
            projectPath
        );
        if (response.success) {
            setSubmodules(response.submodules ?? []);
        }
    }, [canRun, projectPath, invokeGit]);

    const runSubmoduleAction = useCallback(
        async (
            action: 'init' | 'update' | 'sync' | 'deinit',
            modulePath?: string
        ) => {
            if (!canRun || !projectPath) {
                return false;
            }
            const response = await invokeGit<{ success: boolean }>(
                'git:runSubmoduleAction',
                projectPath,
                action,
                modulePath ?? ''
            );
            await fetchSubmodules();
            return response.success;
        },
        [canRun, projectPath, invokeGit, fetchSubmodules]
    );

    const fetchFlowStatus = useCallback(async () => {
        if (!canRun || !projectPath) {
            return;
        }
        const response = await invokeGit<{ success: boolean; flowStatus?: GitFlowStatus }>(
            'git:getFlowStatus',
            projectPath
        );
        if (response.success && response.flowStatus) {
            setFlowStatus(response.flowStatus);
        }
    }, [canRun, projectPath, invokeGit]);

    const startFlowBranch = useCallback(
        async (branchType: 'feature' | 'release' | 'hotfix', branchName: string) => {
            if (!canRun || !projectPath || !branchName.trim()) {
                return false;
            }
            const response = await invokeGit<{ success: boolean }>(
                'git:startFlowBranch',
                projectPath,
                branchType,
                branchName
            );
            await fetchFlowStatus();
            return response.success;
        },
        [canRun, projectPath, invokeGit, fetchFlowStatus]
    );

    const finishFlowBranch = useCallback(
        async (branchType: 'feature' | 'release' | 'hotfix', branchName: string) => {
            if (!canRun || !projectPath || !branchName.trim()) {
                return false;
            }
            const response = await invokeGit<{ success: boolean }>(
                'git:finishFlowBranch',
                projectPath,
                branchType,
                branchName
            );
            await fetchFlowStatus();
            return response.success;
        },
        [canRun, projectPath, invokeGit, fetchFlowStatus]
    );

    const fetchHooks = useCallback(async () => {
        if (!canRun || !projectPath) {
            return;
        }
        const response = await invokeGit<{ success: boolean; hooks?: GitHookInfo[]; templates?: string[] }>(
            'git:getHooks',
            projectPath
        );
        if (response.success) {
            setHooks(response.hooks ?? []);
            setHookTemplates(response.templates ?? []);
        }
    }, [canRun, projectPath, invokeGit]);

    const installHook = useCallback(
        async (hookName: string, templateName: string) => {
            if (!canRun || !projectPath || !hookName.trim()) {
                return false;
            }
            const response = await invokeGit<{ success: boolean }>(
                'git:installHook',
                projectPath,
                hookName,
                templateName
            );
            await fetchHooks();
            return response.success;
        },
        [canRun, projectPath, invokeGit, fetchHooks]
    );

    const validateHook = useCallback(
        async (hookName: string) => {
            if (!canRun || !projectPath || !hookName.trim()) {
                return;
            }
            const response = await invokeGit<{
                success: boolean;
                validation?: { hookName: string; hasShebang: boolean; executable: boolean; valid: boolean };
            }>('git:validateHook', projectPath, hookName);
            if (response.success && response.validation) {
                setHookValidation(response.validation);
            }
        },
        [canRun, projectPath, invokeGit]
    );

    const testHook = useCallback(
        async (hookName: string) => {
            if (!canRun || !projectPath || !hookName.trim()) {
                return;
            }
            const response = await invokeGit<{ success: boolean; stdout?: string; stderr?: string }>(
                'git:testHook',
                projectPath,
                hookName
            );
            if (response.success) {
                setHookTestOutput({ stdout: response.stdout ?? '', stderr: response.stderr ?? '' });
            }
        },
        [canRun, projectPath, invokeGit]
    );

    const exportHooks = useCallback(async () => {
        const zipData = hooks.map(h => ({ name: h.name, installed: h.installed }));
        const blob = new Blob([JSON.stringify({ hooks: zipData }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'git-hooks.json';
        anchor.click();
        URL.revokeObjectURL(url);
    }, [hooks]);

    const fetchStats = useCallback(
        async (fromDate?: string, toDate?: string) => {
            if (!canRun || !projectPath) {
                return;
            }
            const response = await invokeGit<{ success: boolean; stats?: GitRepositoryStats }>(
                'git:getStats',
                projectPath,
                fromDate ?? '',
                toDate ?? ''
            );
            if (response.success && response.stats) {
                setStats(response.stats);
            }
        },
        [canRun, projectPath, invokeGit]
    );

    const exportStats = useCallback(() => {
        if (!stats) {
            return;
        }
        const blob = new Blob([JSON.stringify(stats, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'git-stats.json';
        anchor.click();
        URL.revokeObjectURL(url);
    }, [stats]);

    return {
        rebasePlan,
        submodules,
        flowStatus,
        hooks,
        hookTemplates,
        hookValidation,
        hookTestOutput,
        stats,
        fetchRebasePlan,
        runRebaseAction,
        fetchSubmodules,
        runSubmoduleAction,
        fetchFlowStatus,
        startFlowBranch,
        finishFlowBranch,
        fetchHooks,
        installHook,
        validateHook,
        testHook,
        exportHooks,
        fetchStats,
        exportStats,
    };
}
