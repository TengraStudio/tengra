/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { GIT_CHANNELS } from '@shared/constants/ipc-channels';
import {
    GitBlameLine,
    GitCommitDetails,
    GitConflict,
    GitFileHistoryItem,
    GitFlowStatus,
    GitHookInfo,
    GitHotspot,
    GitRebasePlanCommit,
    GitRefComparison,
    GitRepositoryStats,
    GitStash,
    GitSubmodule,
} from '@shared/types/git';
import { IpcRenderer } from 'electron';

export interface GitBridge {
    getBranch: (cwd: string) => Promise<{ success: boolean; branch?: string; error?: string }>;
    getStatus: (cwd: string) => Promise<{
        success: boolean;
        isClean?: boolean;
        changes?: number;
        files?: Array<{ path: string; status: string }>;
        error?: string;
    }>;
    getLastCommit: (cwd: string) => Promise<{
        success: boolean;
        hash?: string;
        message?: string;
        author?: string;
        relativeTime?: string;
        date?: string;
        error?: string;
    }>;
    getRecentCommits: (
        cwd: string,
        count?: number,
        skip?: number
    ) => Promise<{
        success: boolean;
        commits?: Array<{ hash: string; message: string; author: string; date: string }>;
        error?: string;
    }>;
    getFileHistory: (
        cwd: string,
        filePath: string,
        count?: number
    ) => Promise<{
        success: boolean;
        commits?: GitFileHistoryItem[];
        error?: string;
    }>;
    getBranches: (cwd: string) => Promise<{ success: boolean; branches?: string[]; error?: string }>;
    isRepository: (cwd: string) => Promise<{ success: boolean; isRepository?: boolean }>;
    getFileDiff: (
        cwd: string,
        filePath: string,
        staged?: boolean
    ) => Promise<{ original: string; modified: string; success: boolean; error?: string }>;
    getUnifiedDiff: (
        cwd: string,
        filePath: string,
        staged?: boolean
    ) => Promise<{ diff: string; success: boolean; error?: string }>;
    stageFile: (cwd: string, filePath: string) => Promise<{ success: boolean; error?: string }>;
    unstageFile: (cwd: string, filePath: string) => Promise<{ success: boolean; error?: string }>;
    getDetailedStatus: (cwd: string) => Promise<{
        success: boolean;
        staged?: Array<{ path: string; status: string }>;
        unstaged?: Array<{ path: string; status: string }>;
        error?: string;
    }>;
    checkout: (cwd: string, branch: string) => Promise<{ success: boolean; error?: string }>;
    commit: (cwd: string, message: string) => Promise<{ success: boolean; error?: string }>;
    push: (
        cwd: string,
        remote?: string,
        branch?: string
    ) => Promise<{ success: boolean; error?: string; stdout?: string; stderr?: string }>;
    pull: (cwd: string) => Promise<{ success: boolean; error?: string; stdout?: string; stderr?: string }>;
    getRemotes: (cwd: string) => Promise<{
        success: boolean;
        remotes?: Array<{ name: string; url: string; fetch: boolean; push: boolean }>;
        error?: string;
    }>;
    getTrackingInfo: (cwd: string) => Promise<{
        success: boolean;
        tracking?: string | null;
        ahead?: number;
        behind?: number;
    }>;
    getCommitStats: (
        cwd: string,
        days?: number
    ) => Promise<{ success: boolean; commitCounts?: Record<string, number>; error?: string }>;
    getDiffStats: (cwd: string) => Promise<{
        success: boolean;
        staged?: { added: number; deleted: number; files: number };
        unstaged?: { added: number; deleted: number; files: number };
        total?: { added: number; deleted: number; files: number };
        error?: string;
    }>;
    getCommitDiff: (cwd: string, hash: string) => Promise<{ diff: string; success: boolean; error?: string }>;
    getStagedDiff: (cwd: string) => Promise<{ diff: string; success: boolean; error?: string }>;

    getConflicts: (cwd: string) => Promise<{
        success: boolean;
        conflicts?: GitConflict[];
        analytics?: Record<string, number>;
        error?: string;
    }>;
    resolveConflict: (
        cwd: string,
        filePath: string,
        strategy: 'ours' | 'theirs' | 'manual'
    ) => Promise<{ success: boolean; error?: string }>;
    openMergeTool: (cwd: string, filePath?: string) => Promise<{ success: boolean; error?: string }>;
    getBlame: (cwd: string, filePath: string) => Promise<{ success: boolean; lines?: GitBlameLine[]; error?: string }>;
    getCommitDetails: (cwd: string, hash: string) => Promise<{ success: boolean; details?: GitCommitDetails; error?: string }>;
    getRebaseStatus: (cwd: string) => Promise<{
        success: boolean;
        inRebase?: boolean;
        currentBranch?: string;
        conflictCount?: number;
        conflicts?: GitConflict[];
        error?: string;
    }>;
    getStashes: (cwd: string) => Promise<{ success: boolean; stashes?: GitStash[]; error?: string }>;
    createStash: (cwd: string, message: string, includeUntracked?: boolean) => Promise<{ success: boolean; error?: string }>;
    applyStash: (cwd: string, stashRef: string, pop: boolean) => Promise<{ success: boolean; error?: string }>;
    dropStash: (cwd: string, stashRef: string) => Promise<{ success: boolean; error?: string }>;
    exportStash: (cwd: string, stashRef: string) => Promise<{ success: boolean; patch?: string; error?: string }>;
    runControlledOperation: (
        cwd: string,
        command: string,
        operationId: string,
        timeoutMs: number
    ) => Promise<{
        success: boolean;
        error?: string;
        stdout?: string;
        stderr?: string;
    }>;
    getRebasePlan: (cwd: string, ontoBranch: string) => Promise<{ success: boolean; plan?: GitRebasePlanCommit[]; error?: string }>;
    getSubmodules: (cwd: string) => Promise<{ success: boolean; submodules?: GitSubmodule[]; error?: string }>;
    cancelOperation: (operationId: string) => Promise<{ success: boolean; error?: string }>;
    getFlowStatus: (cwd: string) => Promise<{ success: boolean; flowStatus?: GitFlowStatus; error?: string }>;
    startFlowBranch: (
        cwd: string,
        branchType: string,
        branchName: string,
        baseBranch?: string
    ) => Promise<{ success: boolean; error?: string }>;
    finishFlowBranch: (
        cwd: string,
        branchName: string,
        targetBranch?: string,
        shouldDelete?: boolean
    ) => Promise<{ success: boolean; error?: string }>;
    getHooks: (cwd: string) => Promise<{ success: boolean; hooks?: GitHookInfo[]; templates?: string[]; error?: string }>;
    installHook: (cwd: string, hookName: string, templateName: string) => Promise<{ success: boolean; error?: string }>;
    validateHook: (cwd: string, hookName: string) => Promise<{
        success: boolean;
        validation?: { hookName: string; hasShebang: boolean; executable: boolean; valid: boolean };
        error?: string;
    }>;
    testHook: (cwd: string, hookName: string) => Promise<{ success: boolean; stdout?: string; stderr?: string; error?: string }>;
    getRepositoryStats: (cwd: string, days?: number) => Promise<{ success: boolean; stats?: GitRepositoryStats; error?: string }>;
    exportRepositoryStats: (cwd: string, days?: number) => Promise<{ success: boolean; export?: { authorsCsv: string }; error?: string }>;
    createBranch: (cwd: string, name: string, startPoint?: string) => Promise<{ success: boolean; error?: string }>;
    deleteBranch: (cwd: string, name: string, force?: boolean) => Promise<{ success: boolean; error?: string }>;
    renameBranch: (cwd: string, oldName: string, newName: string) => Promise<{ success: boolean; error?: string }>;
    setUpstream: (cwd: string, branch: string, remote: string, upstreamBranch: string) => Promise<{ success: boolean; error?: string }>;
    generatePrSummary: (cwd: string, base: string, head: string) => Promise<{ success: boolean; summary?: string; error?: string }>;
    compareRefs: (cwd: string, base: string, head: string) => Promise<GitRefComparison>;
    getHotspots: (cwd: string, limit?: number, days?: number) => Promise<{ success: boolean; hotspots: GitHotspot[]; error?: string }>;
    getTreeStatusPreview: (cwd: string, directoryPath: string) => Promise<any>;
}

export function createGitBridge(ipc: IpcRenderer): GitBridge {
    return {
        getBranch: cwd => ipc.invoke(GIT_CHANNELS.GET_BRANCH, cwd),
        getStatus: cwd => ipc.invoke(GIT_CHANNELS.GET_STATUS, cwd),
        getLastCommit: cwd => ipc.invoke(GIT_CHANNELS.GET_LAST_COMMIT, cwd),
        getRecentCommits: (cwd, count, skip) => ipc.invoke(GIT_CHANNELS.GET_RECENT_COMMITS, cwd, count, skip),
        getFileHistory: (cwd, filePath, count) =>
            ipc.invoke(GIT_CHANNELS.GET_FILE_HISTORY, cwd, filePath, count),
        getBranches: cwd => ipc.invoke(GIT_CHANNELS.GET_BRANCHES, cwd),
        isRepository: cwd => ipc.invoke(GIT_CHANNELS.IS_REPOSITORY, cwd),
        getFileDiff: (cwd, filePath, staged) => ipc.invoke(GIT_CHANNELS.GET_FILE_DIFF, cwd, filePath, staged),
        getUnifiedDiff: (cwd, filePath, staged) => ipc.invoke(GIT_CHANNELS.GET_UNIFIED_DIFF, cwd, filePath, staged),
        stageFile: (cwd, filePath) => ipc.invoke(GIT_CHANNELS.STAGE_FILE, cwd, filePath),
        unstageFile: (cwd, filePath) => ipc.invoke(GIT_CHANNELS.UNSTAGE_FILE, cwd, filePath),
        getDetailedStatus: cwd => ipc.invoke(GIT_CHANNELS.GET_DETAILED_STATUS, cwd),
        checkout: (cwd, branch) => ipc.invoke(GIT_CHANNELS.CHECKOUT, cwd, branch),
        commit: (cwd, message) => ipc.invoke(GIT_CHANNELS.COMMIT, cwd, message),
        push: (cwd, remote, branch) => ipc.invoke(GIT_CHANNELS.PUSH, cwd, remote, branch),
        pull: cwd => ipc.invoke(GIT_CHANNELS.PULL, cwd),
        getRemotes: cwd => ipc.invoke(GIT_CHANNELS.GET_REMOTES, cwd),
        getTrackingInfo: cwd => ipc.invoke(GIT_CHANNELS.GET_TRACKING_INFO, cwd),
        getCommitStats: (cwd, days) => ipc.invoke(GIT_CHANNELS.GET_COMMIT_STATS, cwd, days),
        getDiffStats: cwd => ipc.invoke(GIT_CHANNELS.GET_DIFF_STATS, cwd),
        getCommitDiff: (cwd, hash) => ipc.invoke(GIT_CHANNELS.GET_COMMIT_DIFF, cwd, hash),
        getStagedDiff: cwd => ipc.invoke(GIT_CHANNELS.GET_STAGED_DIFF, cwd),

        getConflicts: cwd => ipc.invoke(GIT_CHANNELS.GET_CONFLICTS, cwd),
        resolveConflict: (cwd, filePath, strategy) =>
            ipc.invoke(GIT_CHANNELS.RESOLVE_CONFLICT, cwd, filePath, strategy),
        openMergeTool: (cwd, filePath) => ipc.invoke(GIT_CHANNELS.OPEN_MERGE_TOOL, cwd, filePath),
        getBlame: (cwd, filePath) => ipc.invoke(GIT_CHANNELS.GET_BLAME, cwd, filePath),
        getCommitDetails: (cwd, hash) => ipc.invoke(GIT_CHANNELS.GET_COMMIT_DETAILS, cwd, hash),
        getRebaseStatus: cwd => ipc.invoke(GIT_CHANNELS.GET_REBASE_STATUS, cwd),
        getStashes: cwd => ipc.invoke(GIT_CHANNELS.GET_STASHES, cwd),
        createStash: (cwd, message, includeUntracked) =>
            ipc.invoke(GIT_CHANNELS.CREATE_STASH, cwd, message, includeUntracked),
        applyStash: (cwd, stashRef, pop) => ipc.invoke(GIT_CHANNELS.APPLY_STASH, cwd, stashRef, pop),
        dropStash: (cwd, stashRef) => ipc.invoke(GIT_CHANNELS.DROP_STASH, cwd, stashRef),
        exportStash: (cwd, stashRef) => ipc.invoke(GIT_CHANNELS.EXPORT_STASH, cwd, stashRef),
        runControlledOperation: (cwd, command, operationId, timeoutMs) =>
            ipc.invoke(GIT_CHANNELS.RUN_CONTROLLED_OPERATION, cwd, command, operationId, timeoutMs),
        getRebasePlan: (cwd, ontoBranch) => ipc.invoke(GIT_CHANNELS.GET_REBASE_PLAN, cwd, ontoBranch),
        getSubmodules: cwd => ipc.invoke(GIT_CHANNELS.GET_SUBMODULES, cwd),
        cancelOperation: operationId => ipc.invoke(GIT_CHANNELS.CANCEL_OPERATION, operationId),
        getFlowStatus: cwd => ipc.invoke(GIT_CHANNELS.GET_FLOW_STATUS, cwd),
        startFlowBranch: (cwd, branchType, branchName, baseBranch) =>
            ipc.invoke(GIT_CHANNELS.START_FLOW_BRANCH, cwd, branchType, branchName, baseBranch),
        finishFlowBranch: (cwd, branchName, targetBranch, shouldDelete) =>
            ipc.invoke(GIT_CHANNELS.FINISH_FLOW_BRANCH, cwd, branchName, targetBranch, shouldDelete),
        getHooks: cwd => ipc.invoke(GIT_CHANNELS.GET_HOOKS, cwd),
        installHook: (cwd, hookName, templateName) =>
            ipc.invoke(GIT_CHANNELS.INSTALL_HOOK, cwd, hookName, templateName),
        validateHook: (cwd, hookName) => ipc.invoke(GIT_CHANNELS.VALIDATE_HOOK, cwd, hookName),
        testHook: (cwd, hookName) => ipc.invoke(GIT_CHANNELS.TEST_HOOK, cwd, hookName),
        getRepositoryStats: (cwd, days) => ipc.invoke(GIT_CHANNELS.GET_REPOSITORY_STATS, cwd, days),
        exportRepositoryStats: (cwd, days) => ipc.invoke(GIT_CHANNELS.EXPORT_REPOSITORY_STATS, cwd, days),
        createBranch: (cwd, name, startPoint) =>
            ipc.invoke(GIT_CHANNELS.CREATE_BRANCH, cwd, name, startPoint),
        deleteBranch: (cwd, name, force) => ipc.invoke(GIT_CHANNELS.DELETE_BRANCH, cwd, name, force),
        renameBranch: (cwd, oldName, newName) =>
            ipc.invoke(GIT_CHANNELS.RENAME_BRANCH, cwd, oldName, newName),
        setUpstream: (cwd, branch, remote, upstreamBranch) =>
            ipc.invoke(GIT_CHANNELS.SET_UPSTREAM, cwd, branch, remote, upstreamBranch),
        generatePrSummary: (cwd, base, head) =>
            ipc.invoke(GIT_CHANNELS.GENERATE_PR_SUMMARY, cwd, base, head),
        compareRefs: (cwd, base, head) => ipc.invoke(GIT_CHANNELS.COMPARE_REFS, cwd, base, head),
        getHotspots: (cwd, limit, days) => ipc.invoke(GIT_CHANNELS.GET_HOTSPOTS, cwd, limit, days),
        getTreeStatusPreview: (cwd, directoryPath) => ipc.invoke(GIT_CHANNELS.GET_TREE_STATUS_PREVIEW, cwd, directoryPath),
    };
}

