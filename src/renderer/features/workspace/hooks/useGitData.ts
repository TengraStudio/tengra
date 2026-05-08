/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useState } from 'react';

import type { Workspace } from '@/types';
import { appLogger } from '@/utils/renderer-logger';

import { DiffStats, GitCommitInfo, GitData, GitFile, Remote, TrackingInfo } from '../components/git/types';
import { emptyGitData, fetchFullGitData, GitSectionErrors } from '../utils/git-utils';

const useGitOperations = (
    workspacePath: string | undefined,
    fetchGitData: () => Promise<void>,
    selectedFile: GitFile | null,
    setSelectedFile: (file: GitFile | null) => void,
    loadFileDiff: (filePath: string, staged: boolean) => Promise<void>,
    lastActionError: string | null,
    setLastActionError: (error: string | null) => void
) => {
    const [commitMessage, setCommitMessage] = useState('');
    const [isCommitting, setIsCommitting] = useState(false);
    const [isPushing, setIsPushing] = useState(false);
    const [isPulling, setIsPulling] = useState(false);
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    const handleStageFile = useCallback(async (filePath: string) => {
        if (!workspacePath) { return; }
        try {
            const result = await window.electron.git.stageFile(workspacePath, filePath);
            if (result.success) {
                setLastActionError(null);
                await fetchGitData();
                if (selectedFile?.path === filePath) {
                    setSelectedFile({ ...selectedFile, staged: true });
                    await loadFileDiff(filePath, true);
                }
            } else {
                setLastActionError(result.error ?? 'Failed to stage file');
            }
        } catch (e) {
            appLogger.error('useGitData', 'Failed to stage file', e as Error);
            setLastActionError((e as Error).message);
        }
    }, [workspacePath, fetchGitData, selectedFile, loadFileDiff, setSelectedFile]);

    const handleUnstageFile = useCallback(async (filePath: string) => {
        if (!workspacePath) { return; }
        try {
            const result = await window.electron.git.unstageFile(workspacePath, filePath);
            if (result.success) {
                setLastActionError(null);
                await fetchGitData();
                if (selectedFile?.path === filePath) {
                    setSelectedFile({ ...selectedFile, staged: false });
                    await loadFileDiff(filePath, false);
                }
            } else {
                setLastActionError(result.error ?? 'Failed to unstage file');
            }
        } catch (e) {
            appLogger.error('useGitData', 'Failed to unstage file', e as Error);
            setLastActionError((e as Error).message);
        }
    }, [workspacePath, fetchGitData, selectedFile, loadFileDiff, setSelectedFile]);

    const handleStageAll = useCallback(async () => {
        if (!workspacePath) { return; }
        try {
            const result = await window.electron.git.stageAll(workspacePath);
            if (result.success) {
                setLastActionError(null);
                await fetchGitData();
                if (selectedFile) {
                    setSelectedFile({ ...selectedFile, staged: true });
                    await loadFileDiff(selectedFile.path, true);
                }
            } else {
                setLastActionError(result.error ?? 'Failed to stage all files');
            }
        } catch (e) {
            appLogger.error('useGitData', 'Failed to stage all files', e as Error);
            setLastActionError((e as Error).message);
        }
    }, [workspacePath, fetchGitData, selectedFile, loadFileDiff, setSelectedFile]);

    const handleUnstageAll = useCallback(async () => {
        if (!workspacePath) { return; }
        try {
            const result = await window.electron.git.unstageAll(workspacePath);
            if (result.success) {
                setLastActionError(null);
                await fetchGitData();
                if (selectedFile) {
                    setSelectedFile({ ...selectedFile, staged: false });
                    await loadFileDiff(selectedFile.path, false);
                }
            } else {
                setLastActionError(result.error ?? 'Failed to unstage all files');
            }
        } catch (e) {
            appLogger.error('useGitData', 'Failed to unstage all files', e as Error);
            setLastActionError((e as Error).message);
        }
    }, [workspacePath, fetchGitData, selectedFile, loadFileDiff, setSelectedFile]);

    const handleCheckout = useCallback(async (branch: string) => {
        if (!workspacePath) { return; }
        setIsCheckingOut(true);
        try {
            const result = await window.electron.git.checkout(workspacePath, branch);
            if (result.success) {
                setLastActionError(null);
                await fetchGitData();
            } else {
                setLastActionError(result.error ?? 'Failed to checkout branch');
                appLogger.error('useGitData', 'Failed to checkout branch', new Error(result.error ?? 'Unknown error'));
            }
        } catch (e) {
            appLogger.error('useGitData', 'Failed to checkout branch', e as Error);
            setLastActionError((e as Error).message);
        } finally {
            setIsCheckingOut(false);
        }
    }, [workspacePath, fetchGitData]);

    const handleCommit = useCallback(async () => {
        if (!workspacePath || !commitMessage.trim()) { return; }
        setIsCommitting(true);
        try {
            const result = await window.electron.git.commit(workspacePath, commitMessage.trim());
            if (result.success) {
                setLastActionError(null);
                setCommitMessage('');
                await fetchGitData();
            } else {
                setLastActionError(result.error ?? 'Failed to commit');
                appLogger.error('useGitData', 'Failed to commit', new Error(result.error ?? 'Unknown error'));
            }
        } catch (e) {
            appLogger.error('useGitData', 'Failed to commit', e as Error);
            setLastActionError((e as Error).message);
        } finally {
            setIsCommitting(false);
        }
    }, [workspacePath, commitMessage, fetchGitData]);

    const handlePush = useCallback(async () => {
        if (!workspacePath) { return; }
        setIsPushing(true);
        try {
            const result = await window.electron.git.push(workspacePath, 'origin');
            if (result.success) {
                setLastActionError(null);
                await fetchGitData();
            } else {
                setLastActionError(result.error ?? 'Failed to push');
                appLogger.error('useGitData', 'Failed to push', new Error(result.error ?? 'Unknown error'));
            }
        } catch (e) {
            appLogger.error('useGitData', 'Failed to push', e as Error);
            setLastActionError((e as Error).message);
        } finally {
            setIsPushing(false);
        }
    }, [workspacePath, fetchGitData]);

    const handleSync = useCallback(async () => {
        if (!workspacePath) { return; }
        setIsPulling(true);
        setLastActionError(null);
        try {
            const pullResult = await window.electron.git.pull(workspacePath);
            if (!pullResult.success && pullResult.error && !pullResult.error.toLowerCase().includes("up to date")) {
                setLastActionError(`Pull failed: ${pullResult.error}`);
                await fetchGitData();
                return;
            }
            
            const pushResult = await window.electron.git.push(workspacePath, 'origin');
            if (pushResult.success) {
                setLastActionError(null);
                await fetchGitData();
            } else {
                setLastActionError(`Push failed: ${pushResult.error ?? 'Unknown error'}`);
                await fetchGitData();
            }
        } catch (e) {
            appLogger.error('useGitData', 'Failed to sync', e as Error);
            setLastActionError((e as Error).message);
            await fetchGitData();
        } finally {
            setIsPulling(false);
        }
    }, [workspacePath, fetchGitData]);

    return {
        commitMessage,
        setCommitMessage,
        isCommitting,
        isPushing,
        isPulling,
        isCheckingOut,
        lastActionError,
        handleStageFile,
        handleUnstageFile,
        handleStageAll,
        handleUnstageAll,
        handleCheckout,
        handleCommit,
        handlePush,
        handlePull: handleSync, // Alias handlePull to handleSync for the rest of the app
        handleSync
    };
};

interface GitSectionState {
    loading: boolean;
    error: string | null;
}

interface GitSectionStates {
    status: GitSectionState
    actions: GitSectionState
    remotes: GitSectionState
    commits: GitSectionState
    changes: GitSectionState
    pullRequests: GitSectionState
    issues: GitSectionState
}

const createGitSectionStates = (
    loading: boolean,
    errors?: GitSectionErrors
): GitSectionStates => ({
    status: { loading, error: errors?.status ?? null },
    actions: { loading, error: errors?.actions ?? null },
    remotes: { loading, error: errors?.remotes ?? null },
    commits: { loading, error: errors?.commits ?? null },
    changes: { loading, error: errors?.changes ?? null },
    pullRequests: { loading, error: errors?.pullRequests ?? null },
    issues: { loading, error: errors?.issues ?? null },
});

export function useGitData(workspace: Workspace) {
    const [gitData, setGitData] = useState<GitData>(emptyGitData);
    const [selectedFile, setSelectedFile] = useState<GitFile | null>(null);
    const [fileDiff, setFileDiff] = useState<{ original: string; modified: string } | null>(null);
    const [loadingDiff, setLoadingDiff] = useState(false);

    // Git State
    const [branches, setBranches] = useState<string[]>([]);
    const [remotes, setRemotes] = useState<Remote[]>([]);
    const [trackingInfo, setTrackingInfo] = useState<TrackingInfo | null>(null);
    const [diffStats, setDiffStats] = useState<DiffStats | null>(null);
    const [lastActionError, setLastActionError] = useState<string | null>(null);
    const [sectionStates, setSectionStates] = useState<GitSectionStates>(createGitSectionStates(false));
    const [commitsOffset, setCommitsOffset] = useState(0);
    const [hasMoreCommits, setHasMoreCommits] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [pullRequests, setPullRequests] = useState<any[]>([]);
    const [issues, setIssues] = useState<any[]>([]);
    const [selectedPrNumber, setSelectedPrNumber] = useState<number | null>(null);
    const [prDetails, setPrDetails] = useState<{ pr: any; files: any[]; comments: any[]; reviews: any[]; checks: any[] } | null>(null);
    const [isUpdatingPr, setIsUpdatingPr] = useState(false);

    const fetchGitData = useCallback(async () => {
        if (!workspace.path) { return; }
        setGitData(prev => ({ ...prev, loading: true }));
        setSectionStates(createGitSectionStates(true));
        try {
            const data = await fetchFullGitData(workspace.path);
            if (!data) {
                setGitData(emptyGitData);
                setSectionStates(createGitSectionStates(false));
                return;
            }
            setGitData(data.gitData);
            setBranches(data.branches);
            setRemotes(data.remotes);
            setTrackingInfo(data.trackingInfo);
            setDiffStats(data.diffStats);
            setCommitsOffset(0);
            setHasMoreCommits(true);
            setSectionStates(createGitSectionStates(false, data.sectionErrors));
        } catch (error) {
            appLogger.error('useGitData', 'Failed to fetch git data', error as Error);
            setGitData(prev => ({ ...prev, loading: false }));
            setSectionStates(createGitSectionStates(false, {
                status: 'fetch-failed',
                actions: 'fetch-failed',
                remotes: 'fetch-failed',
                commits: 'fetch-failed',
                changes: 'fetch-failed',
                pullRequests: 'fetch-failed',
                issues: 'fetch-failed',
            }));
        }
    }, [workspace.path]);

    const fetchPullRequests = useCallback(async () => {
        if (!workspace.path || remotes.length === 0) { return; }
        setSectionStates(prev => ({ ...prev, pullRequests: { ...prev.pullRequests, loading: true } }));
        try {
            const result = await import('../utils/git-utils').then(m => m.fetchGitHubData(workspace.path!, remotes, 'pulls'));
            if (result.success && result.data) {
                setPullRequests(result.data);
                setSectionStates(prev => ({ ...prev, pullRequests: { loading: false, error: null } }));
            } else {
                setSectionStates(prev => ({ ...prev, pullRequests: { loading: false, error: result.error ?? 'Failed to fetch PRs' } }));
            }
        } catch (error) {
            appLogger.error('useGitData', 'Failed to fetch PRs', error as Error);
            setSectionStates(prev => ({ ...prev, pullRequests: { loading: false, error: (error as Error).message } }));
        }
    }, [workspace.path, remotes]);

    const fetchIssues = useCallback(async () => {
        if (!workspace.path || remotes.length === 0) { return; }
        setSectionStates(prev => ({ ...prev, issues: { ...prev.issues, loading: true } }));
        try {
            const result = await import('../utils/git-utils').then(m => m.fetchGitHubData(workspace.path!, remotes, 'issues'));
            if (result.success && result.data) {
                setIssues(result.data);
                setSectionStates(prev => ({ ...prev, issues: { loading: false, error: null } }));
            } else {
                setSectionStates(prev => ({ ...prev, issues: { loading: false, error: result.error ?? 'Failed to fetch issues' } }));
            }
        } catch (error) {
            appLogger.error('useGitData', 'Failed to fetch issues', error as Error);
            setSectionStates(prev => ({ ...prev, issues: { loading: false, error: (error as Error).message } }));
        }
    }, [workspace.path, remotes]);

    const handleSelectPr = useCallback(async (prNumber: number | null) => {
        setSelectedPrNumber(prNumber);
        if (prNumber === null) {
            setPrDetails(null);
            return;
        }

        setSectionStates(prev => ({ ...prev, pullRequests: { ...prev.pullRequests, loading: true } }));
        try {
            const result = await import('../utils/git-utils').then(m => m.fetchGitHubPrDetails(workspace.path!, remotes, prNumber));
            if (result.success && result.data) {
                setPrDetails(result.data);
                setSectionStates(prev => ({ ...prev, pullRequests: { loading: false, error: null } }));
            } else {
                setSectionStates(prev => ({ ...prev, pullRequests: { loading: false, error: result.error ?? 'Failed to fetch PR details' } }));
            }
        } catch (error) {
            appLogger.error('useGitData', 'Failed to fetch PR details', error as Error);
            setSectionStates(prev => ({ ...prev, pullRequests: { loading: false, error: (error as Error).message } }));
        }
    }, [workspace.path, remotes]);

    const handleUpdatePrState = useCallback(async (prNumber: number, state: 'open' | 'closed') => {
        setIsUpdatingPr(true);
        try {
            const result = await import('../utils/git-utils').then(m => m.updateGitHubPrState(workspace.path!, remotes, prNumber, state));
            if (result.success) {
                // Refresh list and details
                void fetchPullRequests();
                void handleSelectPr(prNumber);
            } else {
                setLastActionError(result.error ?? 'Failed to update PR state');
            }
        } catch (error) {
            appLogger.error('useGitData', 'Failed to update PR state', error as Error);
            setLastActionError((error as Error).message);
        } finally {
            setIsUpdatingPr(false);
        }
    }, [workspace.path, remotes, fetchPullRequests, handleSelectPr, setLastActionError]);

    const handleMergePr = useCallback(async (prNumber: number) => {
        setIsUpdatingPr(true);
        try {
            const result = await import('../utils/git-utils').then(m => m.mergeGitHubPr(remotes[0]?.url, prNumber));
            if (result.success) {
                void fetchPullRequests();
                void handleSelectPr(prNumber);
            } else {
                setLastActionError(result.error ?? 'Failed to merge PR');
            }
        } catch (error) {
            appLogger.error('useGitData', 'Failed to merge PR', error as Error);
            setLastActionError((error as Error).message);
        } finally {
            setIsUpdatingPr(false);
        }
    }, [remotes, fetchPullRequests, handleSelectPr, setLastActionError]);

    const handleApprovePr = useCallback(async (prNumber: number) => {
        setIsUpdatingPr(true);
        try {
            const result = await import('../utils/git-utils').then(m => m.approveGitHubPr(remotes[0]?.url, prNumber));
            if (result.success) {
                void handleSelectPr(prNumber);
            } else {
                setLastActionError(result.error ?? 'Failed to approve PR');
            }
        } catch (error) {
            appLogger.error('useGitData', 'Failed to approve PR', error as Error);
            setLastActionError((error as Error).message);
        } finally {
            setIsUpdatingPr(false);
        }
    }, [remotes, handleSelectPr, setLastActionError]);

    const loadFileDiff = useCallback(async (filePath: string, staged: boolean) => {
        if (!workspace.path) { return; }
        setLoadingDiff(true);
        try {
            const result = await window.electron.git.getFileDiff(workspace.path, filePath, staged);
            if (result.success) {
                setFileDiff({ original: result.original, modified: result.modified });
            }
        } catch (error) {
            appLogger.error('useGitData', 'Failed to load file diff', error as Error);
        } finally {
            setLoadingDiff(false);
        }
    }, [workspace.path]);

    const handleGitFileSelect = useCallback(async (file: GitFile | null) => {
        setSelectedFile(file);
        if (file) {
            await loadFileDiff(file.path, file.staged);
        } else {
            setFileDiff(null);
        }
    }, [loadFileDiff]);

    const {
        commitMessage,
        setCommitMessage,
        isCommitting,
        isPushing,
        isPulling,
        isCheckingOut,
        handleStageFile,
        handleUnstageFile,
        handleStageAll,
        handleUnstageAll,
        handleCheckout,
        handleCommit,
        handlePush,
        handlePull,
        handleSync
    } = useGitOperations(workspace.path, fetchGitData, selectedFile, setSelectedFile, loadFileDiff, lastActionError, setLastActionError);

    const [selectedCommit, setSelectedCommit] = useState<GitCommitInfo | null>(null);
    const [commitDiff, setCommitDiff] = useState<string | null>(null);

    const handleCommitSelect = useCallback(async (commit: GitCommitInfo | null) => {
        if (!workspace.path) { return; }
        // Toggle selection
        if (selectedCommit?.hash === commit?.hash) {
            setSelectedCommit(null);
            setCommitDiff(null);
            return;
        }
        
        setSelectedCommit(commit);
        if (!commit) {
            setCommitDiff(null);
            return;
        }
        setLoadingDiff(true);
        try {
            const result = await window.electron.git.getCommitDiff(workspace.path, commit.hash);
            if (result.success) {
                setCommitDiff(result.diff);
            }
        } catch (e) {
            appLogger.error('useGitData', 'Failed to load commit diff', e as Error);
        } finally {
            setLoadingDiff(false);
        }
    }, [workspace.path, selectedCommit?.hash]);

    const handleLoadMoreCommits = useCallback(async () => {
        if (!workspace.path || !hasMoreCommits || isLoadingMore) { return; }
        setIsLoadingMore(true);
        try {
            const newOffset = commitsOffset + 20;
            const result = await window.electron.git.getRecentCommits(workspace.path, 20, newOffset);
            if (result.success && result.commits) {
                if (result.commits.length < 20) {
                    setHasMoreCommits(false);
                }
                setGitData(prev => ({
                    ...prev,
                    recentCommits: [...prev.recentCommits, ... (result.commits as GitCommitInfo[])]
                }));
                setCommitsOffset(newOffset);
            } else {
                setHasMoreCommits(false);
            }
        } catch (e) {
            appLogger.error('useGitData', 'Failed to load more commits', e as Error);
            setHasMoreCommits(false);
        } finally {
            setIsLoadingMore(false);
        }
    }, [workspace.path, commitsOffset, hasMoreCommits, isLoadingMore]);

    return {
        gitData,
        selectedFile,
        fileDiff,
        selectedCommit,
        commitDiff,
        loadingDiff,
        branches,
        remotes,
        trackingInfo,
        diffStats,
        commitMessage,
        setCommitMessage,
        isCommitting,
        isPushing,
        isPulling,
        isCheckingOut,
        lastActionError,
        sectionStates,
        isLoadingMore,
        hasMoreCommits,
        fetchGitData,
        handleGitFileSelect,
        handleStageFile,
        handleUnstageFile,
        handleStageAll,
        handleUnstageAll,
        handleCheckout,
        handleCommit,
        handlePush,
        handlePull,
        handleSync,
        handleCommitSelect,
        handleLoadMoreCommits,
        pullRequests,
        issues,
        fetchPullRequests,
        fetchIssues,
        selectedPrNumber,
        prDetails,
        isUpdatingPr,
        handleSelectPr,
        handleUpdatePrState,
        handleMergePr,
        handleApprovePr
    };
}

