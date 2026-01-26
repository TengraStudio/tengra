import { CommonBatches } from '@renderer/utils/ipc-batch.util';
import { Project } from '@shared/types/project';
import { useCallback, useEffect, useState } from 'react';

export function useGitData(project: Project) {
    const [gitData, setGitData] = useState<{
        branch: string | null
        isClean: boolean | null
        lastCommit: { hash: string; message: string; author: string; relativeTime: string } | null
        recentCommits: Array<{ hash: string; message: string; author: string; date: string }>
        isRepository: boolean
        loading: boolean
        changedFiles: Array<{ status: string; path: string; staged: boolean }>
        stagedFiles: Array<{ status: string; path: string; staged: boolean }>
        unstagedFiles: Array<{ status: string; path: string; staged: boolean }>
    }>({
        branch: null,
        isClean: null,
        lastCommit: null,
        recentCommits: [],
        isRepository: false,
        loading: false,
        changedFiles: [],
        stagedFiles: [],
        unstagedFiles: []
    });
    const [selectedFile, setSelectedFile] = useState<{ path: string; staged: boolean } | null>(null);
    const [fileDiff, setFileDiff] = useState<{ original: string; modified: string } | null>(null);
    const [loadingDiff, setLoadingDiff] = useState(false);

    // Additional Git State
    const [branches, setBranches] = useState<string[]>([]);
    const [remotes, setRemotes] = useState<Array<{ name: string; url: string; fetch: boolean; push: boolean }>>([]);
    const [trackingInfo, setTrackingInfo] = useState<{ tracking: string | null; ahead: number; behind: number } | null>(null);
    const [diffStats, setDiffStats] = useState<{
        staged: { added: number; deleted: number; files: number };
        unstaged: { added: number; deleted: number; files: number };
        total: { added: number; deleted: number; files: number }
    } | null>(null);
    const [commitStats, setCommitStats] = useState<Record<string, number>>({});
    const [commitMessage, setCommitMessage] = useState('');
    const [isCommitting, setIsCommitting] = useState(false);
    const [isPushing, setIsPushing] = useState(false);
    const [isPulling, setIsPulling] = useState(false);
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    const fetchGitData = useCallback(async () => {
        if (!project.path) { return; }

        setGitData(prev => ({ ...prev, loading: true }));
        try {
            // Check if it's a git repository
            const repoCheck = await window.electron.git.isRepository(project.path);
            if (!repoCheck.isRepository) {
                setGitData({
                    branch: null,
                    isClean: null,
                    lastCommit: null,
                    recentCommits: [],
                    isRepository: false,
                    loading: false,
                    changedFiles: [],
                    stagedFiles: [],
                    unstagedFiles: []
                });
                return;
            }

            // Use batching for efficient git data loading
            const batchedGitData = await CommonBatches.loadProjectData(project.path);

            // Load additional data that requires parameters
            const [recentCommitsResult, detailedStatus, remotesResult, trackingResult, diffStatsResult, commitStatsResult] = await Promise.all([
                window.electron.git.getRecentCommits(project.path, 10),
                window.electron.git.getDetailedStatus(project.path),
                window.electron.git.getRemotes(project.path),
                window.electron.git.getTrackingInfo(project.path),
                window.electron.git.getDiffStats(project.path),
                window.electron.git.getCommitStats(project.path, 365)
            ]);

            setGitData({
                branch: batchedGitData.branch?.success ? (batchedGitData.branch.branch ?? null) : null,
                isClean: batchedGitData.status?.success ? (batchedGitData.status.isClean ?? null) : null,
                lastCommit: batchedGitData.lastCommit?.success && batchedGitData.lastCommit.hash
                    ? {
                        hash: batchedGitData.lastCommit.hash,
                        message: batchedGitData.lastCommit.message ?? '',
                        author: batchedGitData.lastCommit.author ?? '',
                        relativeTime: batchedGitData.lastCommit.relativeTime ?? ''
                    }
                    : null,
                recentCommits: recentCommitsResult.success ? (recentCommitsResult.commits ?? []) : [],
                isRepository: true,
                loading: false,
                changedFiles: detailedStatus.success ? (detailedStatus.allFiles ?? []) : [],
                stagedFiles: detailedStatus.success ? (detailedStatus.stagedFiles ?? []) : [],
                unstagedFiles: detailedStatus.success ? (detailedStatus.unstagedFiles ?? []) : []
            });

            setBranches(batchedGitData.branches?.success ? (batchedGitData.branches.branches ?? []) : []);
            setRemotes(remotesResult.success ? (remotesResult.remotes ?? []) : []);
            setTrackingInfo(trackingResult.success ? { tracking: trackingResult.tracking ?? null, ahead: trackingResult.ahead ?? 0, behind: trackingResult.behind ?? 0 } : null);
            setDiffStats(diffStatsResult.success ? {
                staged: diffStatsResult.staged ?? { added: 0, deleted: 0, files: 0 },
                unstaged: diffStatsResult.unstaged ?? { added: 0, deleted: 0, files: 0 },
                total: diffStatsResult.total ?? { added: 0, deleted: 0, files: 0 }
            } : null);
            setCommitStats(commitStatsResult.success ? (commitStatsResult.commitCounts ?? {}) : {});
        } catch (error) {
            window.electron.log.error('Failed to fetch git data', error as Error);
            setGitData(prev => ({ ...prev, loading: false }));
        }
    }, [project.path]);

    const loadFileDiff = useCallback(async (filePath: string, staged: boolean) => {
        if (!project.path) { return; }

        setLoadingDiff(true);
        try {
            const result = await window.electron.git.getFileDiff(project.path, filePath, staged);
            if (result.success) {
                setFileDiff({
                    original: result.original,
                    modified: result.modified
                });
            }
        } catch (error) {
            window.electron.log.error('Failed to load file diff', error as Error);
        } finally {
            setLoadingDiff(false);
        }
    }, [project.path]);

    const handleGitFileSelect = useCallback(async (file: { status: string; path: string; staged: boolean }) => {
        setSelectedFile(file);
        await loadFileDiff(file.path, file.staged);
    }, [loadFileDiff]);

    const handleStageFile = useCallback(async (filePath: string) => {
        if (!project.path) { return; }

        try {
            const result = await window.electron.git.stageFile(project.path, filePath);
            if (result.success) {
                await fetchGitData();
                // Update selected file if it's the same
                if (selectedFile?.path === filePath) {
                    setSelectedFile({ ...selectedFile, staged: true });
                    await loadFileDiff(filePath, true);
                }
            }
        } catch (error) {
            window.electron.log.error('Failed to stage file', error as Error);
        }
    }, [project.path, fetchGitData, selectedFile, loadFileDiff]);

    const handleUnstageFile = useCallback(async (filePath: string) => {
        if (!project.path) { return; }

        try {
            const result = await window.electron.git.unstageFile(project.path, filePath);
            if (result.success) {
                await fetchGitData();
                // Update selected file if it's the same
                if (selectedFile?.path === filePath) {
                    setSelectedFile({ ...selectedFile, staged: false });
                    await loadFileDiff(filePath, false);
                }
            }
        } catch (error) {
            window.electron.log.error('Failed to unstage file', error as Error);
        }
    }, [project.path, fetchGitData, selectedFile, loadFileDiff]);

    const handleCheckout = useCallback(async (branch: string) => {
        if (!project.path) { return; }

        setIsCheckingOut(true);
        try {
            const result = await window.electron.git.checkout(project.path, branch);
            if (result.success) {
                await fetchGitData();
            } else {
                window.electron.log.error('Failed to checkout branch', new Error(result.error ?? 'Unknown error'));
            }
        } catch (error) {
            window.electron.log.error('Failed to checkout branch', error as Error);
        } finally {
            setIsCheckingOut(false);
        }
    }, [project.path, fetchGitData]);

    const handleCommit = useCallback(async () => {
        if (!project.path || !commitMessage.trim()) { return; }

        setIsCommitting(true);
        try {
            const result = await window.electron.git.commit(project.path, commitMessage.trim());
            if (result.success) {
                setCommitMessage('');
                await fetchGitData();
            } else {
                window.electron.log.error('Failed to commit', new Error(result.error ?? 'Unknown error'));
            }
        } catch (error) {
            window.electron.log.error('Failed to commit', error as Error);
        } finally {
            setIsCommitting(false);
        }
    }, [project.path, commitMessage, fetchGitData]);

    const handlePush = useCallback(async () => {
        if (!project.path) { return; }

        setIsPushing(true);
        try {
            const result = await window.electron.git.push(project.path, 'origin');
            if (result.success) {
                await fetchGitData();
            } else {
                window.electron.log.error('Failed to push', new Error(result.error ?? 'Unknown error'));
            }
        } catch (error) {
            window.electron.log.error('Failed to push', error as Error);
        } finally {
            setIsPushing(false);
        }
    }, [project.path, fetchGitData]);

    const handlePull = useCallback(async () => {
        if (!project.path) { return; }

        setIsPulling(true);
        try {
            const result = await window.electron.git.pull(project.path);
            if (result.success) {
                await fetchGitData();
            } else {
                window.electron.log.error('Failed to pull', new Error(result.error ?? 'Unknown error'));
            }
        } catch (error) {
            window.electron.log.error('Failed to pull', error as Error);
        } finally {
            setIsPulling(false);
        }
    }, [project.path, fetchGitData]);

    const [selectedCommit, setSelectedCommit] = useState<{ hash: string; message: string; author: string; date: string } | null>(null);
    const [commitDiff, setCommitDiff] = useState<string | null>(null);

    const handleCommitSelect = useCallback(async (commit: { hash: string; message: string; author: string; date: string } | null) => {
        if (!project.path) { return; }
        setSelectedCommit(commit);
        if (!commit) {
            setCommitDiff(null);
            return;
        }
        setLoadingDiff(true);
        try {
            const result = await window.electron.git.getCommitDiff(project.path, commit.hash);
            if (result.success) {
                setCommitDiff(result.diff);
            }
        } catch (error) {
            window.electron.log.error('Failed to load commit diff', error as Error);
        } finally {
            setLoadingDiff(false);
        }
    }, [project.path]);

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
        commitStats,
        commitMessage,
        setCommitMessage,
        isCommitting,
        isPushing,
        isPulling,
        isCheckingOut,
        fetchGitData,
        handleGitFileSelect,
        handleStageFile,
        handleUnstageFile,
        handleCheckout,
        handleCommit,
        handlePush,
        handlePull,
        handleCommitSelect
    };
}
