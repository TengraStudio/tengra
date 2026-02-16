import { useCallback, useMemo, useState } from 'react';

import {
    GitBlameLine,
    GitCommitDetails,
    GitConflict,
    GitFlowStatus,
    GitHookInfo,
    GitRebasePlanCommit,
    GitRepositoryStats,
    GitStash,
    GitSubmodule,
} from '../components/git/types';

interface RebaseStatus {
    inRebase: boolean;
    currentBranch: string | null;
    conflictCount: number;
    conflicts: GitConflict[];
}

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

const DEFAULT_REBASE_STATUS: RebaseStatus = {
    inRebase: false,
    currentBranch: null,
    conflictCount: 0,
    conflicts: [],
};

const downloadText = (filename: string, content: string, mimeType = 'text/plain') => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
};

export function useGitAdvanced(projectPath?: string) {
    const [isLoading, setIsLoading] = useState(false);
    const [conflicts, setConflicts] = useState<GitConflict[]>([]);
    const [conflictAnalytics, setConflictAnalytics] = useState<Record<string, number>>({});
    const [stashes, setStashes] = useState<GitStash[]>([]);
    const [blameLines, setBlameLines] = useState<GitBlameLine[]>([]);
    const [commitDetails, setCommitDetails] = useState<GitCommitDetails | null>(null);
    const [rebaseStatus, setRebaseStatus] = useState<RebaseStatus>(DEFAULT_REBASE_STATUS);
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

    const canRun = useMemo(() => !!projectPath && projectPath.trim().length > 0, [projectPath]);

    const invokeGit = useCallback(
        async <T>(channel: string, ...args: (string | number | boolean)[]) => {
            return await window.electron.invoke<T>(channel, ...args);
        },
        []
    );

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

    const exportConflictReport = useCallback(() => {
        const payload = {
            generatedAt: new Date().toISOString(),
            analytics: conflictAnalytics,
            conflicts,
        };
        downloadText('git-conflicts.json', JSON.stringify(payload, null, 2), 'application/json');
    }, [conflicts, conflictAnalytics]);

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
            await Promise.all([fetchStashes(), fetchConflicts()]);
            return response.success;
        },
        [canRun, projectPath, invokeGit, fetchStashes, fetchConflicts]
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
            downloadText(
                `${stashRef.replace(/[{}@]/g, '_')}.patch`,
                response.patch ?? ''
            );
        },
        [canRun, projectPath, invokeGit]
    );

    const loadBlame = useCallback(
        async (filePath: string) => {
            if (!canRun || !projectPath || !filePath.trim()) {
                return;
            }
            const response = await invokeGit<{ success: boolean; lines?: GitBlameLine[] }>(
                'git:getBlame',
                projectPath,
                filePath
            );
            if (response.success) {
                setBlameLines(response.lines ?? []);
            }
        },
        [canRun, projectPath, invokeGit]
    );

    const loadCommitDetails = useCallback(
        async (commitHash: string) => {
            if (!canRun || !projectPath || !commitHash.trim()) {
                return;
            }
            const response = await invokeGit<{ success: boolean; details?: GitCommitDetails }>(
                'git:getCommitDetails',
                projectPath,
                commitHash
            );
            if (response.success && response.details) {
                setCommitDetails(response.details);
            }
        },
        [canRun, projectPath, invokeGit]
    );

    const fetchRebaseStatus = useCallback(async () => {
        if (!canRun || !projectPath) {
            return;
        }
        const response = await invokeGit<{
            success: boolean;
            inRebase?: boolean;
            currentBranch?: string | null;
            conflictCount?: number;
            conflicts?: GitConflict[];
        }>('git:getRebaseStatus', projectPath);
        if (response.success) {
            setRebaseStatus({
                inRebase: response.inRebase ?? false,
                currentBranch: response.currentBranch ?? null,
                conflictCount: response.conflictCount ?? 0,
                conflicts: response.conflicts ?? [],
            });
        }
    }, [canRun, projectPath, invokeGit]);

    const fetchRebasePlan = useCallback(
        async (baseBranch: string) => {
            if (!canRun || !projectPath) {
                return;
            }
            const response = await invokeGit<{ success: boolean; commits?: GitRebasePlanCommit[] }>(
                'git:getRebasePlan',
                projectPath,
                baseBranch
            );
            if (response.success) {
                setRebasePlan(response.commits ?? []);
            }
        },
        [canRun, projectPath, invokeGit]
    );

    const runRebaseAction = useCallback(
        async (action: 'start' | 'continue' | 'abort', baseBranch?: string) => {
            if (!canRun || !projectPath) {
                return false;
            }

            const channelMap = {
                start: 'git:startRebase',
                continue: 'git:continueRebase',
                abort: 'git:abortRebase',
            } as const;

            const response = action === 'start'
                ? await invokeGit<{ success: boolean }>(channelMap[action], projectPath, baseBranch ?? 'develop')
                : await invokeGit<{ success: boolean }>(channelMap[action], projectPath);

            await Promise.all([fetchRebaseStatus(), fetchConflicts()]);
            return response.success;
        },
        [canRun, projectPath, invokeGit, fetchRebaseStatus, fetchConflicts]
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
            action: 'init' | 'update' | 'sync' | 'add' | 'remove',
            payload?: { recursive?: boolean; remote?: boolean; url?: string; path?: string; branch?: string }
        ) => {
            if (!canRun || !projectPath) {
                return false;
            }

            let response: { success: boolean };
            switch (action) {
                case 'init':
                    response = await invokeGit('git:initSubmodules', projectPath, payload?.recursive === true);
                    break;
                case 'update':
                    response = await invokeGit('git:updateSubmodules', projectPath, payload?.remote === true);
                    break;
                case 'sync':
                    response = await invokeGit('git:syncSubmodules', projectPath);
                    break;
                case 'add':
                    response = await invokeGit(
                        'git:addSubmodule',
                        projectPath,
                        payload?.url ?? '',
                        payload?.path ?? '',
                        payload?.branch ?? ''
                    );
                    break;
                default:
                    response = await invokeGit('git:removeSubmodule', projectPath, payload?.path ?? '');
                    break;
            }

            await fetchSubmodules();
            return response.success;
        },
        [canRun, projectPath, invokeGit, fetchSubmodules]
    );

    const fetchFlowStatus = useCallback(async () => {
        if (!canRun || !projectPath) {
            return;
        }
        const response = await invokeGit<{ success: boolean; currentBranch?: string; byType?: GitFlowStatus['byType']; branches?: string[] }>(
            'git:getFlowStatus',
            projectPath
        );
        if (response.success) {
            setFlowStatus({
                currentBranch: response.currentBranch ?? '',
                byType: response.byType ?? DEFAULT_FLOW_STATUS.byType,
                branches: response.branches ?? [],
            });
        }
    }, [canRun, projectPath, invokeGit]);

    const startFlowBranch = useCallback(
        async (type: 'feature' | 'release' | 'hotfix' | 'support', name: string, base: string) => {
            if (!canRun || !projectPath) {
                return false;
            }
            const response = await invokeGit<{ success: boolean }>(
                'git:startFlowBranch',
                projectPath,
                type,
                name,
                base
            );
            await fetchFlowStatus();
            return response.success;
        },
        [canRun, projectPath, invokeGit, fetchFlowStatus]
    );

    const finishFlowBranch = useCallback(
        async (branch: string, target: string, shouldDelete = true) => {
            if (!canRun || !projectPath) {
                return false;
            }
            const response = await invokeGit<{ success: boolean }>(
                'git:finishFlowBranch',
                projectPath,
                branch,
                target,
                shouldDelete
            );
            await Promise.all([fetchFlowStatus(), fetchConflicts()]);
            return response.success;
        },
        [canRun, projectPath, invokeGit, fetchFlowStatus, fetchConflicts]
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
        async (hookName: string, template?: string) => {
            if (!canRun || !projectPath) {
                return false;
            }
            const response = await invokeGit<{ success: boolean }>(
                'git:installHook',
                projectPath,
                hookName,
                template ?? ''
            );
            await fetchHooks();
            return response.success;
        },
        [canRun, projectPath, invokeGit, fetchHooks]
    );

    const validateHook = useCallback(
        async (hookName: string) => {
            if (!canRun || !projectPath) {
                return;
            }
            const response = await invokeGit<{
                success: boolean;
                validation?: {
                    hookName: string;
                    hasShebang: boolean;
                    executable: boolean;
                    valid: boolean;
                };
            }>('git:validateHook', projectPath, hookName);
            if (response.success && response.validation) {
                setHookValidation(response.validation);
            }
        },
        [canRun, projectPath, invokeGit]
    );

    const testHook = useCallback(
        async (hookName: string) => {
            if (!canRun || !projectPath) {
                return;
            }
            const response = await invokeGit<{ success: boolean; stdout?: string; stderr?: string }>(
                'git:testHook',
                projectPath,
                hookName
            );
            setHookTestOutput({ stdout: response.stdout ?? '', stderr: response.stderr ?? '' });
        },
        [canRun, projectPath, invokeGit]
    );

    const exportHooks = useCallback(async () => {
        if (!canRun || !projectPath) {
            return;
        }
        const response = await invokeGit<{ success: boolean; payload?: unknown }>('git:exportHooks', projectPath);
        if (!response.success) {
            return;
        }
        downloadText('git-hooks.json', JSON.stringify(response.payload ?? {}, null, 2), 'application/json');
    }, [canRun, projectPath, invokeGit]);

    const fetchStats = useCallback(
        async (days = 365) => {
            if (!canRun || !projectPath) {
                return;
            }
            const response = await invokeGit<{ success: boolean; stats?: GitRepositoryStats }>(
                'git:getRepositoryStats',
                projectPath,
                days
            );
            if (response.success && response.stats) {
                setStats(response.stats);
            }
        },
        [canRun, projectPath, invokeGit]
    );

    const exportStats = useCallback(
        async (days = 365) => {
            if (!canRun || !projectPath) {
                return;
            }
            const response = await invokeGit<{
                success: boolean;
                export?: { authorsCsv: string; generatedAt: string; days: number };
            }>('git:exportRepositoryStats', projectPath, days);
            if (!response.success || !response.export) {
                return;
            }
            downloadText('git-author-stats.csv', response.export.authorsCsv, 'text/csv');
        },
        [canRun, projectPath, invokeGit]
    );

    const refreshAll = useCallback(async () => {
        if (!canRun) {
            return;
        }
        setIsLoading(true);
        try {
            await Promise.all([
                fetchConflicts(),
                fetchStashes(),
                fetchRebaseStatus(),
                fetchSubmodules(),
                fetchFlowStatus(),
                fetchHooks(),
                fetchStats(),
            ]);
        } finally {
            setIsLoading(false);
        }
    }, [
        canRun,
        fetchConflicts,
        fetchStashes,
        fetchRebaseStatus,
        fetchSubmodules,
        fetchFlowStatus,
        fetchHooks,
        fetchStats,
    ]);

    return {
        isLoading,
        conflicts,
        conflictAnalytics,
        stashes,
        blameLines,
        commitDetails,
        rebaseStatus,
        rebasePlan,
        submodules,
        flowStatus,
        hooks,
        hookTemplates,
        hookValidation,
        hookTestOutput,
        stats,
        refreshAll,
        fetchConflicts,
        resolveConflict,
        openMergeTool,
        exportConflictReport,
        fetchStashes,
        createStash,
        applyStash,
        dropStash,
        exportStash,
        loadBlame,
        loadCommitDetails,
        fetchRebaseStatus,
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
