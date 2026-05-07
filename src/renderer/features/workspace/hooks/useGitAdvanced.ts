/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useMemo, useState } from 'react';

import {
    GitBlameLine,
    GitCommitDetails,
    GitConflict,
    GitRemoteLinkSet,
} from '../components/git/types';
import { buildGitRemoteLinks } from '../utils/git-remote-links';

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
export function useGitAdvanced(workspacePath?: string) {
    const [isLoading, setIsLoading] = useState(false);
    const [blameLines, setBlameLines] = useState<GitBlameLine[]>([]);
    const [commitDetails, setCommitDetails] = useState<GitCommitDetails | null>(null);
    const [rebaseStatus, setRebaseStatus] = useState<RebaseStatus>(DEFAULT_REBASE_STATUS);
    const [remoteLinks, setRemoteLinks] = useState<GitRemoteLinkSet[]>([]);
    const [currentBranch, setCurrentBranch] = useState<string | null>(null);
    const [trackingSummary, setTrackingSummary] = useState<{ tracking: string | null; ahead: number; behind: number }>({
        tracking: null,
        ahead: 0,
        behind: 0,
    });

    const canRun = useMemo(() => !!workspacePath && workspacePath.trim().length > 0, [workspacePath]);

    // Compose sub-hooks
    const conflictsHook = useGitConflicts(canRun, workspacePath);
    const stashesHook = useGitStashes(canRun, workspacePath);
    const advancedOpsHook = useGitAdvancedOperations(canRun, workspacePath);

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
            if (!canRun || !workspacePath || !filePath.trim()) {
                return;
            }
            const response = await window.electron.git.getBlame(
                workspacePath,
                filePath
            );
            if (response.success) {
                setBlameLines(response.lines ?? []);
            }
        },
        [canRun, workspacePath]
    );

    const loadCommitDetails = useCallback(
        async (commitHash: string) => {
            if (!canRun || !workspacePath || !commitHash.trim()) {
                return;
            }
            const response = await window.electron.git.getCommitDetails(
                workspacePath,
                commitHash
            );
            if (response.success && response.details) {
                setCommitDetails(response.details);
            }
        },
        [canRun, workspacePath]
    );

    const fetchRebaseStatus = useCallback(async () => {
        if (!canRun || !workspacePath) {
            return;
        }
        const response = await window.electron.git.getRebaseStatus(workspacePath);
        if (response.success) {
            setRebaseStatus({
                inRebase: response.inRebase ?? false,
                currentBranch: response.currentBranch ?? null,
                conflictCount: response.conflictCount ?? 0,
                conflicts: response.conflicts ?? [],
            });
        }
    }, [canRun, workspacePath]);

    const fetchRemoteLinks = useCallback(async () => {
        if (!canRun || !workspacePath) {
            return;
        }
        const [remotesResponse, branchResponse, trackingResponse] = await Promise.all([
            window.electron.git.getRemotes(workspacePath),
            window.electron.git.getBranch(workspacePath),
            window.electron.git.getTrackingInfo(workspacePath),
        ]);
        const branch = branchResponse.success ? branchResponse.branch ?? null : null;
        setCurrentBranch(branch);
        setTrackingSummary({
            tracking: trackingResponse.success ? trackingResponse.tracking ?? null : null,
            ahead: trackingResponse.success ? trackingResponse.ahead ?? 0 : 0,
            behind: trackingResponse.success ? trackingResponse.behind ?? 0 : 0,
        });
        setRemoteLinks(buildGitRemoteLinks(remotesResponse.remotes ?? [], branch));
    }, [canRun, workspacePath]);

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
                fetchRemoteLinks(),
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
        fetchRemoteLinks,
    ]);

    const {
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
    } = advancedOpsHook;

    return {
        isLoading,
        conflicts: conflictsHook.conflicts,
        conflictAnalytics: conflictsHook.conflictAnalytics,
        stashes: stashesHook.stashes,
        blameLines,
        commitDetails,
        rebaseStatus,
        remoteLinks,
        currentBranch,
        trackingSummary,
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
        fetchRemoteLinks,
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
        setOperationTimeoutMs,
        cancelActiveOperation,
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

