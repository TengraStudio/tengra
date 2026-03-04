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
    const DEFAULT_OPERATION_TIMEOUT_MS = 60000;
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
    const [operationTimeoutMs, setOperationTimeoutMs] = useState(DEFAULT_OPERATION_TIMEOUT_MS);
    const [activeOperationId, setActiveOperationId] = useState<string | null>(null);
    const [lastOperationError, setLastOperationError] = useState<string | null>(null);

    const sanitizeShellArg = useCallback((value: string): string => {
        return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }, []);

    const runControlledOperation = useCallback(
        async (command: string) => {
            if (!canRun || !projectPath) {
                return { success: false, error: 'Project is not ready' };
            }
            const operationId = `git-op-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
            setActiveOperationId(operationId);
            setLastOperationError(null);
            try {
                const response = await invokeGit<{
                    success: boolean;
                    error?: string;
                    stdout?: string;
                    stderr?: string;
                }>(
                    'git:runControlledOperation',
                    projectPath,
                    command,
                    operationId,
                    operationTimeoutMs
                );
                if (!response.success && response.error) {
                    setLastOperationError(response.error);
                }
                return response;
            } finally {
                setActiveOperationId(null);
            }
        },
        [canRun, invokeGit, operationTimeoutMs, projectPath]
    );

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
        async (action: 'continue' | 'abort' | 'skip' | 'start', ontoBranch?: string) => {
            if (!canRun || !projectPath) {
                return false;
            }
            let command = '';
            if (action === 'start') {
                if (!ontoBranch || ontoBranch.trim().length === 0) {
                    return false;
                }
                command = `rebase ${sanitizeShellArg(ontoBranch)}`;
            } else if (action === 'continue') {
                command = 'rebase --continue';
            } else if (action === 'abort') {
                command = 'rebase --abort';
            } else if (action === 'skip') {
                command = 'rebase --skip';
            } else {
                return false;
            }

            const response = await runControlledOperation(command);
            return response.success;
        },
        [canRun, projectPath, runControlledOperation, sanitizeShellArg]
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
            action: 'init' | 'update' | 'sync' | 'deinit' | 'add' | 'remove',
            options?: string | { recursive?: boolean; remote?: boolean; url?: string; path?: string; branch?: string }
        ) => {
            if (!canRun || !projectPath) {
                return false;
            }

            let command = '';
            if (action === 'init') {
                const recursive = typeof options === 'object' ? !!options.recursive : false;
                command = recursive ? 'submodule update --init --recursive' : 'submodule update --init';
            } else if (action === 'update') {
                const remote = typeof options === 'object' ? !!options.remote : false;
                command = remote ? 'submodule update --remote --recursive' : 'submodule update --recursive';
            } else if (action === 'sync') {
                command = 'submodule sync --recursive';
            } else if (action === 'add' && typeof options === 'object') {
                const url = (options.url ?? '').trim();
                const submodulePath = (options.path ?? '').trim();
                if (!url || !submodulePath) {
                    return false;
                }
                const branchArg = options.branch ? ` -b ${sanitizeShellArg(options.branch)}` : '';
                command = `submodule add${branchArg} ${sanitizeShellArg(url)} "${sanitizeShellArg(submodulePath)}"`;
            } else if (action === 'remove' && typeof options === 'object') {
                const submodulePath = (options.path ?? '').trim();
                if (!submodulePath) {
                    return false;
                }
                command = `submodule deinit -f -- "${sanitizeShellArg(submodulePath)}"`;
            } else if (typeof options === 'string' && options.trim().length > 0) {
                command = `submodule ${sanitizeShellArg(action)} -- "${sanitizeShellArg(options)}"`;
            } else {
                return false;
            }

            const response = await runControlledOperation(command);
            await fetchSubmodules();
            return response.success;
        },
        [canRun, fetchSubmodules, projectPath, runControlledOperation, sanitizeShellArg]
    );

    const cancelActiveOperation = useCallback(async () => {
        if (!activeOperationId) {
            return false;
        }
        const response = await invokeGit<{ success: boolean }>('git:cancelOperation', activeOperationId);
        if (!response.success) {
            setLastOperationError('Failed to cancel active Git operation');
        }
        return response.success;
    }, [activeOperationId, invokeGit]);

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
        async (branchType: 'feature' | 'release' | 'hotfix' | 'support', branchName: string, baseBranch?: string) => {
            if (!canRun || !projectPath || !branchName.trim()) {
                return false;
            }
            const response = await invokeGit<{ success: boolean }>(
                'git:startFlowBranch',
                projectPath,
                branchType,
                branchName,
                baseBranch || ''
            );
            await fetchFlowStatus();
            return response.success;
        },
        [canRun, projectPath, invokeGit, fetchFlowStatus]
    );

    const finishFlowBranch = useCallback(
        async (branchName: string, targetBranch?: string, shouldDelete?: boolean) => {
            if (!canRun || !projectPath || !branchName.trim()) {
                return false;
            }
            const response = await invokeGit<{ success: boolean }>(
                'git:finishFlowBranch',
                projectPath,
                branchName,
                targetBranch || '',
                !!shouldDelete
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
        const zipData = hooks.map(h => ({ name: h.name, path: h.path }));
        const blob = new Blob([JSON.stringify({ hooks: zipData }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'git-hooks.json';
        anchor.click();
        URL.revokeObjectURL(url);
    }, [hooks]);

    const fetchStats = useCallback(
        async (days?: number) => {
            if (!canRun || !projectPath) {
                return;
            }
            const response = await invokeGit<{ success: boolean; stats?: GitRepositoryStats }>(
                'git:getRepositoryStats',
                projectPath,
                days || 365
            );
            if (response.success && response.stats) {
                setStats(response.stats);
            }
        },
        [canRun, projectPath, invokeGit]
    );

    const exportStats = useCallback(async (days?: number) => {
        if (!canRun || !projectPath) {
            return;
        }
        const response = await invokeGit<{ success: boolean; export?: { authorsCsv: string } }>(
            'git:exportRepositoryStats',
            projectPath,
            days || 365
        );
        if (response.success && response.export) {
            const blob = new Blob([response.export.authorsCsv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = 'git-stats.csv';
            anchor.click();
            URL.revokeObjectURL(url);
        }
    }, [canRun, projectPath, invokeGit]);

    return {
        rebasePlan,
        submodules,
        flowStatus,
        hooks,
        hookTemplates,
        hookValidation,
        hookTestOutput,
        stats,
        operationTimeoutMs,
        activeOperationId,
        lastOperationError,
        setOperationTimeoutMs,
        cancelActiveOperation,
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
