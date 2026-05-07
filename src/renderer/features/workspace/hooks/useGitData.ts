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
    loadFileDiff: (filePath: string, staged: boolean) => Promise<void>
) => {
    const [commitMessage, setCommitMessage] = useState('');
    const [isCommitting, setIsCommitting] = useState(false);
    const [isPushing, setIsPushing] = useState(false);
    const [isPulling, setIsPulling] = useState(false);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [lastActionError, setLastActionError] = useState<string | null>(null);

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

    const handlePull = useCallback(async () => {
        if (!workspacePath) { return; }
        setIsPulling(true);
        try {
            const result = await window.electron.git.pull(workspacePath);
            if (result.success) {
                setLastActionError(null);
                await fetchGitData();
            } else {
                setLastActionError(result.error ?? 'Failed to pull');
                appLogger.error('useGitData', 'Failed to pull', new Error(result.error ?? 'Unknown error'));
            }
        } catch (e) {
            appLogger.error('useGitData', 'Failed to pull', e as Error);
            setLastActionError((e as Error).message);
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
        handleCheckout,
        handleCommit,
        handlePush,
        handlePull
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
    const [sectionStates, setSectionStates] = useState<GitSectionStates>(createGitSectionStates(false));
    const [commitsOffset, setCommitsOffset] = useState(0);
    const [hasMoreCommits, setHasMoreCommits] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

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
            }));
        }
    }, [workspace.path]);

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
        handleCheckout,
        handleCommit,
        handlePush,
        handlePull,
        lastActionError,
    } = useGitOperations(workspace.path, fetchGitData, selectedFile, setSelectedFile, loadFileDiff);

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
        handleCheckout,
        handleCommit,
        handlePush,
        handlePull,
        handleCommitSelect,
        handleLoadMoreCommits
    };
}

