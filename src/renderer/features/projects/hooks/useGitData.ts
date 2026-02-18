import { Project } from '@shared/types/project';
import { useCallback, useState } from 'react';

import { DiffStats, GitCommitInfo, GitData, GitFile, Remote, TrackingInfo } from '../components/git/types';
import { emptyGitData, fetchFullGitData, GitSectionErrors } from '../utils/git-utils';

const useGitOperations = (projectPath: string | undefined, fetchGitData: () => Promise<void>, selectedFile: GitFile | null, setSelectedFile: (file: GitFile | null) => void, loadFileDiff: (filePath: string, staged: boolean) => Promise<void>) => {
    const [commitMessage, setCommitMessage] = useState('');
    const [isCommitting, setIsCommitting] = useState(false);
    const [isPushing, setIsPushing] = useState(false);
    const [isPulling, setIsPulling] = useState(false);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [lastActionError, setLastActionError] = useState<string | null>(null);

    const handleStageFile = useCallback(async (filePath: string) => {
        if (!projectPath) { return; }
        try {
            const result = await window.electron.git.stageFile(projectPath, filePath);
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
            window.electron.log.error('Failed to stage file', e as Error);
            setLastActionError((e as Error).message);
        }
    }, [projectPath, fetchGitData, selectedFile, loadFileDiff, setSelectedFile]);

    const handleUnstageFile = useCallback(async (filePath: string) => {
        if (!projectPath) { return; }
        try {
            const result = await window.electron.git.unstageFile(projectPath, filePath);
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
            window.electron.log.error('Failed to unstage file', e as Error);
            setLastActionError((e as Error).message);
        }
    }, [projectPath, fetchGitData, selectedFile, loadFileDiff, setSelectedFile]);

    const handleCheckout = useCallback(async (branch: string) => {
        if (!projectPath) { return; }
        setIsCheckingOut(true);
        try {
            const result = await window.electron.git.checkout(projectPath, branch);
            if (result.success) {
                setLastActionError(null);
                await fetchGitData();
            } else {
                setLastActionError(result.error ?? 'Failed to checkout branch');
                window.electron.log.error('Failed to checkout branch', new Error(result.error ?? 'Unknown error'));
            }
        } catch (e) {
            window.electron.log.error('Failed to checkout branch', e as Error);
            setLastActionError((e as Error).message);
        } finally {
            setIsCheckingOut(false);
        }
    }, [projectPath, fetchGitData]);

    const handleCommit = useCallback(async () => {
        if (!projectPath || !commitMessage.trim()) { return; }
        setIsCommitting(true);
        try {
            const result = await window.electron.git.commit(projectPath, commitMessage.trim());
            if (result.success) {
                setLastActionError(null);
                setCommitMessage('');
                await fetchGitData();
            } else {
                setLastActionError(result.error ?? 'Failed to commit');
                window.electron.log.error('Failed to commit', new Error(result.error ?? 'Unknown error'));
            }
        } catch (e) {
            window.electron.log.error('Failed to commit', e as Error);
            setLastActionError((e as Error).message);
        } finally {
            setIsCommitting(false);
        }
    }, [projectPath, commitMessage, fetchGitData]);

    const handlePush = useCallback(async () => {
        if (!projectPath) { return; }
        setIsPushing(true);
        try {
            const result = await window.electron.git.push(projectPath, 'origin');
            if (result.success) {
                setLastActionError(null);
                await fetchGitData();
            } else {
                setLastActionError(result.error ?? 'Failed to push');
                window.electron.log.error('Failed to push', new Error(result.error ?? 'Unknown error'));
            }
        } catch (e) {
            window.electron.log.error('Failed to push', e as Error);
            setLastActionError((e as Error).message);
        } finally {
            setIsPushing(false);
        }
    }, [projectPath, fetchGitData]);

    const handlePull = useCallback(async () => {
        if (!projectPath) { return; }
        setIsPulling(true);
        try {
            const result = await window.electron.git.pull(projectPath);
            if (result.success) {
                setLastActionError(null);
                await fetchGitData();
            } else {
                setLastActionError(result.error ?? 'Failed to pull');
                window.electron.log.error('Failed to pull', new Error(result.error ?? 'Unknown error'));
            }
        } catch (e) {
            window.electron.log.error('Failed to pull', e as Error);
            setLastActionError((e as Error).message);
        } finally {
            setIsPulling(false);
        }
    }, [projectPath, fetchGitData]);

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
    loading: boolean
    error: string | null
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

export function useGitData(project: Project) {
    const [gitData, setGitData] = useState<GitData>(emptyGitData);
    const [selectedFile, setSelectedFile] = useState<GitFile | null>(null);
    const [fileDiff, setFileDiff] = useState<{ original: string; modified: string } | null>(null);
    const [loadingDiff, setLoadingDiff] = useState(false);

    // Git State
    const [branches, setBranches] = useState<string[]>([]);
    const [remotes, setRemotes] = useState<Remote[]>([]);
    const [trackingInfo, setTrackingInfo] = useState<TrackingInfo | null>(null);
    const [diffStats, setDiffStats] = useState<DiffStats | null>(null);
    const [commitStats, setCommitStats] = useState<Record<string, number>>({});
    const [sectionStates, setSectionStates] = useState<GitSectionStates>(createGitSectionStates(false));

    const fetchGitData = useCallback(async () => {
        if (!project.path) { return; }
        setGitData(prev => ({ ...prev, loading: true }));
        setSectionStates(createGitSectionStates(true));
        try {
            const data = await fetchFullGitData(project.path);
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
            setCommitStats(data.commitStats);
            setSectionStates(createGitSectionStates(false, data.sectionErrors));
        } catch (error) {
            window.electron.log.error('Failed to fetch git data', error as Error);
            setGitData(prev => ({ ...prev, loading: false }));
            setSectionStates(createGitSectionStates(false, {
                status: 'fetch-failed',
                actions: 'fetch-failed',
                remotes: 'fetch-failed',
                commits: 'fetch-failed',
                changes: 'fetch-failed',
            }));
        }
    }, [project.path]);

    const loadFileDiff = useCallback(async (filePath: string, staged: boolean) => {
        if (!project.path) { return; }
        setLoadingDiff(true);
        try {
            const result = await window.electron.git.getFileDiff(project.path, filePath, staged);
            if (result.success) {
                setFileDiff({ original: result.original, modified: result.modified });
            }
        } catch (error) {
            window.electron.log.error('Failed to load file diff', error as Error);
        } finally {
            setLoadingDiff(false);
        }
    }, [project.path]);

    const handleGitFileSelect = useCallback(async (file: GitFile) => {
        setSelectedFile(file);
        await loadFileDiff(file.path, file.staged);
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
    } = useGitOperations(project.path, fetchGitData, selectedFile, setSelectedFile, loadFileDiff);

    const [selectedCommit, setSelectedCommit] = useState<GitCommitInfo | null>(null);
    const [commitDiff, setCommitDiff] = useState<string | null>(null);

    const handleCommitSelect = useCallback(async (commit: GitCommitInfo | null) => {
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
        } catch (e) {
            window.electron.log.error('Failed to load commit diff', e as Error);
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
        lastActionError,
        sectionStates,
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
