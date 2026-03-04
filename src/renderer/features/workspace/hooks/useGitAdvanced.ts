import { useCallback, useMemo, useState } from 'react';

import {
    GitBlameLine,
    GitCommitDetails,
    GitConflict,
} from '../components/git/types';

import { useGitAdvancedOperations } from './useGitAdvancedOperations';
import { useGitConflicts } from './useGitConflicts';
import { useGitStashes } from './useGitStashes';

interface RebaseStatus {
    inRebase: boolean;
    currentBranch: string | null;
    conflictCount: number;
    conflicts: GitConflict[];
}

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

/**
 * Advanced Git operations hook that composes multiple specialized git hooks
 */
export function useGitAdvanced(projectPath?: string) {
    const [isLoading, setIsLoading] = useState(false);
    const [blameLines, setBlameLines] = useState<GitBlameLine[]>([]);
    const [commitDetails, setCommitDetails] = useState<GitCommitDetails | null>(null);
    const [rebaseStatus, setRebaseStatus] = useState<RebaseStatus>(DEFAULT_REBASE_STATUS);

    const canRun = useMemo(() => !!projectPath && projectPath.trim().length > 0, [projectPath]);

    const invokeGit = useCallback(
        async <T>(channel: string, ...args: (string | number | boolean)[]) => {
            return await window.electron.ipcRenderer.invoke(channel, ...args) as T;
        },
        []
    );

    // Compose sub-hooks
    const conflictsHook = useGitConflicts(canRun, projectPath, invokeGit);
    const stashesHook = useGitStashes(canRun, projectPath, invokeGit);
    const advancedOpsHook = useGitAdvancedOperations(canRun, projectPath, invokeGit);

    const exportConflictReport = useCallback(() => {
        const payload = {
            generatedAt: new Date().toISOString(),
            analytics: conflictsHook.conflictAnalytics,
            conflicts: conflictsHook.conflicts,
        };
        downloadText('git-conflicts.json', JSON.stringify(payload, null, 2), 'application/json');
    }, [conflictsHook.conflicts, conflictsHook.conflictAnalytics]);

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
            currentBranch?: string;
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

    const refreshAll = useCallback(async () => {
        if (!canRun) {
            return;
        }
        try {
            setIsLoading(true);
            await Promise.all([
                conflictsHook.fetchConflicts(),
                stashesHook.fetchStashes(),
                fetchRebaseStatus(),
                advancedOpsHook.fetchSubmodules(),
                advancedOpsHook.fetchFlowStatus(),
                advancedOpsHook.fetchHooks(),
                advancedOpsHook.fetchStats(),
            ]);
        } finally {
            setIsLoading(false);
        }
    }, [
        canRun,
        conflictsHook,
        stashesHook,
        fetchRebaseStatus,
        advancedOpsHook,
    ]);

    return {
        isLoading,
        conflicts: conflictsHook.conflicts,
        conflictAnalytics: conflictsHook.conflictAnalytics,
        stashes: stashesHook.stashes,
        blameLines,
        commitDetails,
        rebaseStatus,
        rebasePlan: advancedOpsHook.rebasePlan,
        submodules: advancedOpsHook.submodules,
        flowStatus: advancedOpsHook.flowStatus,
        hooks: advancedOpsHook.hooks,
        hookTemplates: advancedOpsHook.hookTemplates,
        hookValidation: advancedOpsHook.hookValidation,
        hookTestOutput: advancedOpsHook.hookTestOutput,
        stats: advancedOpsHook.stats,
        operationTimeoutMs: advancedOpsHook.operationTimeoutMs,
        activeOperationId: advancedOpsHook.activeOperationId,
        lastOperationError: advancedOpsHook.lastOperationError,
        refreshAll,
        fetchConflicts: conflictsHook.fetchConflicts,
        resolveConflict: conflictsHook.resolveConflict,
        openMergeTool: conflictsHook.openMergeTool,
        exportConflictReport,
        fetchStashes: stashesHook.fetchStashes,
        createStash: stashesHook.createStash,
        applyStash: stashesHook.applyStash,
        dropStash: stashesHook.dropStash,
        exportStash: stashesHook.exportStash,
        loadBlame,
        loadCommitDetails,
        fetchRebaseStatus,
        fetchRebasePlan: advancedOpsHook.fetchRebasePlan,
        runRebaseAction: advancedOpsHook.runRebaseAction,
        fetchSubmodules: advancedOpsHook.fetchSubmodules,
        runSubmoduleAction: advancedOpsHook.runSubmoduleAction,
        fetchFlowStatus: advancedOpsHook.fetchFlowStatus,
        startFlowBranch: advancedOpsHook.startFlowBranch,
        finishFlowBranch: advancedOpsHook.finishFlowBranch,
        fetchHooks: advancedOpsHook.fetchHooks,
        installHook: advancedOpsHook.installHook,
        validateHook: advancedOpsHook.validateHook,
        testHook: advancedOpsHook.testHook,
        exportHooks: advancedOpsHook.exportHooks,
        fetchStats: advancedOpsHook.fetchStats,
        exportStats: advancedOpsHook.exportStats,
        setOperationTimeoutMs: advancedOpsHook.setOperationTimeoutMs,
        cancelActiveOperation: advancedOpsHook.cancelActiveOperation,
    };
}
