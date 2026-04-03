import { useCallback, useState } from 'react';

import { GitFileHistoryItem, GitFlowStatus, GitHookInfo, GitHotspot, GitRebasePlanCommit, GitRefComparison, GitRepositoryStats, GitSubmodule } from '../components/git/types';

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
    workspacePath: string | undefined,
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
            if (!canRun || !workspacePath) {
                return { success: false, error: 'error.workspace.not_ready' };
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
                    workspacePath,
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
        [canRun, invokeGit, operationTimeoutMs, workspacePath]
    );

    const fetchRebasePlan = useCallback(
        async (ontoBranch: string) => {
            if (!canRun || !workspacePath || !ontoBranch.trim()) {
                return;
            }
            const response = await invokeGit<{ success: boolean; plan?: GitRebasePlanCommit[] }>(
                'git:getRebasePlan',
                workspacePath,
                ontoBranch
            );
            if (response.success) {
                setRebasePlan(response.plan ?? []);
            }
        },
        [canRun, workspacePath, invokeGit]
    );

    const runRebaseAction = useCallback(
        async (action: 'continue' | 'abort' | 'skip' | 'start', ontoBranch?: string) => {
            if (!canRun || !workspacePath) {
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
        [canRun, workspacePath, runControlledOperation, sanitizeShellArg]
    );

    const fetchSubmodules = useCallback(async () => {
        if (!canRun || !workspacePath) {
            return;
        }
        const response = await invokeGit<{ success: boolean; submodules?: GitSubmodule[] }>(
            'git:getSubmodules',
            workspacePath
        );
        if (response.success) {
            setSubmodules(response.submodules ?? []);
        }
    }, [canRun, workspacePath, invokeGit]);

    const runSubmoduleAction = useCallback(
        async (
            action: 'init' | 'update' | 'sync' | 'deinit' | 'add' | 'remove',
            options?: string | { recursive?: boolean; remote?: boolean; url?: string; path?: string; branch?: string }
        ) => {
            if (!canRun || !workspacePath) {
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
        [canRun, fetchSubmodules, workspacePath, runControlledOperation, sanitizeShellArg]
    );

    const cancelActiveOperation = useCallback(async () => {
        if (!activeOperationId) {
            return false;
        }
        const response = await invokeGit<{ success: boolean }>('git:cancelOperation', activeOperationId);
        if (!response.success) {
            setLastOperationError('error.git.cancel_failed');
        }
        return response.success;
    }, [activeOperationId, invokeGit]);

    const fetchFlowStatus = useCallback(async () => {
        if (!canRun || !workspacePath) {
            return;
        }
        const response = await invokeGit<{ success: boolean; flowStatus?: GitFlowStatus }>(
            'git:getFlowStatus',
            workspacePath
        );
        if (response.success && response.flowStatus) {
            setFlowStatus(response.flowStatus);
        }
    }, [canRun, workspacePath, invokeGit]);

    const startFlowBranch = useCallback(
        async (branchType: 'feature' | 'release' | 'hotfix' | 'support', branchName: string, baseBranch?: string) => {
            if (!canRun || !workspacePath || !branchName.trim()) {
                return false;
            }
            const response = await invokeGit<{ success: boolean }>(
                'git:startFlowBranch',
                workspacePath,
                branchType,
                branchName,
                baseBranch || ''
            );
            await fetchFlowStatus();
            return response.success;
        },
        [canRun, workspacePath, invokeGit, fetchFlowStatus]
    );

    const finishFlowBranch = useCallback(
        async (branchName: string, targetBranch?: string, shouldDelete?: boolean) => {
            if (!canRun || !workspacePath || !branchName.trim()) {
                return false;
            }
            const response = await invokeGit<{ success: boolean }>(
                'git:finishFlowBranch',
                workspacePath,
                branchName,
                targetBranch || '',
                !!shouldDelete
            );
            await fetchFlowStatus();
            return response.success;
        },
        [canRun, workspacePath, invokeGit, fetchFlowStatus]
    );

    const fetchHooks = useCallback(async () => {
        if (!canRun || !workspacePath) {
            return;
        }
        const response = await invokeGit<{ success: boolean; hooks?: GitHookInfo[]; templates?: string[] }>(
            'git:getHooks',
            workspacePath
        );
        if (response.success) {
            setHooks(response.hooks ?? []);
            setHookTemplates(response.templates ?? []);
        }
    }, [canRun, workspacePath, invokeGit]);

    const installHook = useCallback(
        async (hookName: string, templateName: string) => {
            if (!canRun || !workspacePath || !hookName.trim()) {
                return false;
            }
            const response = await invokeGit<{ success: boolean }>(
                'git:installHook',
                workspacePath,
                hookName,
                templateName
            );
            await fetchHooks();
            return response.success;
        },
        [canRun, workspacePath, invokeGit, fetchHooks]
    );

    const validateHook = useCallback(
        async (hookName: string) => {
            if (!canRun || !workspacePath || !hookName.trim()) {
                return;
            }
            const response = await invokeGit<{
                success: boolean;
                validation?: { hookName: string; hasShebang: boolean; executable: boolean; valid: boolean };
            }>('git:validateHook', workspacePath, hookName);
            if (response.success && response.validation) {
                setHookValidation(response.validation);
            }
        },
        [canRun, workspacePath, invokeGit]
    );

    const testHook = useCallback(
        async (hookName: string) => {
            if (!canRun || !workspacePath || !hookName.trim()) {
                return;
            }
            const response = await invokeGit<{ success: boolean; stdout?: string; stderr?: string }>(
                'git:testHook',
                workspacePath,
                hookName
            );
            if (response.success) {
                setHookTestOutput({ stdout: response.stdout ?? '', stderr: response.stderr ?? '' });
            }
        },
        [canRun, workspacePath, invokeGit]
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
            if (!canRun || !workspacePath) {
                return;
            }
            const response = await invokeGit<{ success: boolean; stats?: GitRepositoryStats }>(
                'git:getRepositoryStats',
                workspacePath,
                days || 365
            );
            if (response.success && response.stats) {
                setStats(response.stats);
            }
        },
        [canRun, workspacePath, invokeGit]
    );

    const exportStats = useCallback(async (days?: number) => {
        if (!canRun || !workspacePath) {
            return;
        }
        const response = await invokeGit<{ success: boolean; export?: { authorsCsv: string } }>(
            'git:exportRepositoryStats',
            workspacePath,
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
    }, [canRun, workspacePath, invokeGit]);

    const createBranch = useCallback(
        async (name: string, startPoint?: string) => {
            if (!canRun || !workspacePath || !name.trim()) {
                return { success: false, error: 'error.git.invalid_branch_name' };
            }
            return await invokeGit<{ success: boolean; error?: string }>('git:createBranch', workspacePath, name, startPoint || '');
        },
        [canRun, workspacePath, invokeGit]
    );

    const deleteBranch = useCallback(
        async (name: string, force: boolean = false) => {
            if (!canRun || !workspacePath || !name.trim()) {
                return { success: false, error: 'error.git.invalid_branch_name' };
            }
            return await invokeGit<{ success: boolean; error?: string }>('git:deleteBranch', workspacePath, name, force);
        },
        [canRun, workspacePath, invokeGit]
    );

    const renameBranch = useCallback(
        async (oldName: string, newName: string) => {
            if (!canRun || !workspacePath || !oldName.trim() || !newName.trim()) {
                return { success: false, error: 'error.git.invalid_branch_names' };
            }
            return await invokeGit<{ success: boolean; error?: string }>('git:renameBranch', workspacePath, oldName, newName);
        },
        [canRun, workspacePath, invokeGit]
    );

    const setUpstream = useCallback(
        async (branch: string, remote: string, upstreamBranch: string) => {
            if (!canRun || !workspacePath || !branch.trim() || !remote.trim() || !upstreamBranch.trim()) {
                return { success: false, error: 'error.git.invalid_parameters' };
            }
            return await invokeGit<{ success: boolean; error?: string }>('git:setUpstream', workspacePath, branch, remote, upstreamBranch);
        },
        [canRun, workspacePath, invokeGit]
    );

    const generatePrSummary = useCallback(
        async (base: string, head: string) => {
            if (!canRun || !workspacePath || !base.trim() || !head.trim()) {
                return { success: false, error: 'error.git.invalid_branch_names' };
            }
            return await invokeGit<{ success: boolean; summary?: string; error?: string }>('git:generatePrSummary', workspacePath, base, head);
        },
        [canRun, workspacePath, invokeGit]
    );

    const fetchFileHistory = useCallback(
        async (filePath: string, limit?: number) => {
            if (!canRun || !workspacePath || !filePath.trim()) {
                return { success: false, commits: [] };
            }
            return await invokeGit<{ success: boolean; commits: GitFileHistoryItem[] }>('git:getFileHistory', workspacePath, filePath, limit || 20);
        },
        [canRun, workspacePath, invokeGit]
    );

    const compareRefs = useCallback(
        async (base: string, head: string) => {
            if (!canRun || !workspacePath || !base.trim() || !head.trim()) {
                return { success: false, ahead: 0, behind: 0, files: [] };
            }
            return await invokeGit<GitRefComparison>('git:compareRefs', workspacePath, base, head);
        },
        [canRun, workspacePath, invokeGit]
    );

    const fetchHotspots = useCallback(
        async (limit?: number, days?: number) => {
            if (!canRun || !workspacePath) {
                return { success: false, hotspots: [] };
            }
            return await invokeGit<{ success: boolean; hotspots: GitHotspot[] }>('git:getHotspots', workspacePath, limit || 10, days || 30);
        },
        [canRun, workspacePath, invokeGit]
    );



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
        createBranch,
        deleteBranch,
        renameBranch,
        setUpstream,
        generatePrSummary,
        fetchFileHistory,
        compareRefs,
        fetchHotspots,
    };
}
