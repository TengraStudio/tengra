import { Project } from '@shared/types/project';
import { useCallback, useState } from 'react';

import { DiffStats, GitCommitInfo, GitData, GitFile, Remote, TrackingInfo } from '../components/git/types';
import { emptyGitData, fetchFullGitData } from '../utils/git-utils';

const useGitOperations = (projectPath: string | undefined, fetchGitData: () => Promise<void>, selectedFile: GitFile | null, setSelectedFile: (file: GitFile | null) => void, loadFileDiff: (filePath: string, staged: boolean) => Promise<void>) => {
    const [commitMessage, setCommitMessage] = useState('');
    const [isCommitting, setIsCommitting] = useState(false);
    const [isPushing, setIsPushing] = useState(false);
    const [isPulling, setIsPulling] = useState(false);
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    const handleStageFile = useCallback(async (filePath: string) => {
        if (!projectPath) { return; }
        try {
            const result = await window.electron.git.stageFile(projectPath, filePath);
            if (result.success) {
                await fetchGitData();
                if (selectedFile?.path === filePath) {
                    setSelectedFile({ ...selectedFile, staged: true });
                    await loadFileDiff(filePath, true);
                }
            }
        } catch (e) {
            window.electron.log.error('Failed to stage file', e as Error);
        }
    }, [projectPath, fetchGitData, selectedFile, loadFileDiff, setSelectedFile]);

    const handleUnstageFile = useCallback(async (filePath: string) => {
        if (!projectPath) { return; }
        try {
            const result = await window.electron.git.unstageFile(projectPath, filePath);
            if (result.success) {
                await fetchGitData();
                if (selectedFile?.path === filePath) {
                    setSelectedFile({ ...selectedFile, staged: false });
                    await loadFileDiff(filePath, false);
                }
            }
        } catch (e) {
            window.electron.log.error('Failed to unstage file', e as Error);
        }
    }, [projectPath, fetchGitData, selectedFile, loadFileDiff, setSelectedFile]);

    const handleCheckout = useCallback(async (branch: string) => {
        if (!projectPath) { return; }
        setIsCheckingOut(true);
        try {
            const result = await window.electron.git.checkout(projectPath, branch);
            if (result.success) {
                await fetchGitData();
            } else {
                window.electron.log.error('Failed to checkout branch', new Error(result.error ?? 'Unknown error'));
            }
        } catch (e) {
            window.electron.log.error('Failed to checkout branch', e as Error);
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
                setCommitMessage('');
                await fetchGitData();
            } else {
                window.electron.log.error('Failed to commit', new Error(result.error ?? 'Unknown error'));
            }
        } catch (e) {
            window.electron.log.error('Failed to commit', e as Error);
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
                await fetchGitData();
            } else {
                window.electron.log.error('Failed to push', new Error(result.error ?? 'Unknown error'));
            }
        } catch (e) {
            window.electron.log.error('Failed to push', e as Error);
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
                await fetchGitData();
            } else {
                window.electron.log.error('Failed to pull', new Error(result.error ?? 'Unknown error'));
            }
        } catch (e) {
            window.electron.log.error('Failed to pull', e as Error);
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
        handleStageFile,
        handleUnstageFile,
        handleCheckout,
        handleCommit,
        handlePush,
        handlePull
    };
};

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

    const fetchGitData = useCallback(async () => {
        if (!project.path) { return; }
        setGitData(prev => ({ ...prev, loading: true }));
        try {
            const data = await fetchFullGitData(project.path);
            if (!data) {
                setGitData(emptyGitData);
                return;
            }
            setGitData(data.gitData);
            setBranches(data.branches);
            setRemotes(data.remotes);
            setTrackingInfo(data.trackingInfo);
            setDiffStats(data.diffStats);
            setCommitStats(data.commitStats);
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
        handlePull
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
