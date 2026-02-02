import { CommonBatches } from '@renderer/utils/ipc-batch.util';

import { DiffStats, GitData, Remote, TrackingInfo } from '../components/git/types';

export interface FullGitData {
    gitData: GitData;
    branches: string[];
    remotes: Remote[];
    trackingInfo: TrackingInfo | null;
    diffStats: DiffStats | null;
    commitStats: Record<string, number>;
}

export const emptyGitData: GitData = {
    branch: null,
    isClean: null,
    lastCommit: null,
    recentCommits: [],
    isRepository: false,
    loading: false,
    changedFiles: [],
    stagedFiles: [],
    unstagedFiles: []
};

interface BatchedGitResults {
    branch?: { success: boolean; branch?: string }
    status?: { success: boolean; isClean?: boolean }
    lastCommit?: { success: boolean; hash?: string; message?: string; author?: string; relativeTime?: string }
    branches?: { success: boolean; branches?: string[] }
}

interface DetailedStatusResult {
    success: boolean
    allFiles?: { path: string; status: string; staged: boolean }[]
    stagedFiles?: { path: string; status: string; staged: boolean }[]
    unstagedFiles?: { path: string; status: string; staged: boolean }[]
}

interface RecentCommitsResult {
    success: boolean
    commits?: { hash: string; message: string; author: string; date: string }[]
}

const extractBranch = (batched: BatchedGitResults): string | null => {
    if (!batched.branch?.success) { return null; }
    return batched.branch.branch ?? null;
};

const extractIsClean = (batched: BatchedGitResults): boolean | null => {
    if (!batched.status?.success) { return null; }
    return batched.status.isClean ?? null;
};

const extractLastCommit = (batched: BatchedGitResults) => {
    const lc = batched.lastCommit;
    if (!lc?.success || !lc.hash) { return null; }
    return { hash: lc.hash, message: lc.message ?? '', author: lc.author ?? '', relativeTime: lc.relativeTime ?? '' };
};

const extractRecentCommits = (result: RecentCommitsResult) => {
    if (!result.success || !result.commits) { return []; }
    return result.commits.map(c => ({ hash: c.hash, message: c.message, author: c.author, date: c.date }));
};

const extractChangedFiles = (detailedStatus: DetailedStatusResult) =>
    detailedStatus.success ? (detailedStatus.allFiles ?? []) : [];

const extractStagedFiles = (detailedStatus: DetailedStatusResult) =>
    detailedStatus.success ? (detailedStatus.stagedFiles ?? []) : [];

const extractUnstagedFiles = (detailedStatus: DetailedStatusResult) =>
    detailedStatus.success ? (detailedStatus.unstagedFiles ?? []) : [];

const buildGitData = (
    batched: BatchedGitResults,
    recentCommitsResult: RecentCommitsResult,
    detailedStatus: DetailedStatusResult
): GitData => ({
    branch: extractBranch(batched),
    isClean: extractIsClean(batched),
    lastCommit: extractLastCommit(batched),
    recentCommits: extractRecentCommits(recentCommitsResult),
    isRepository: true,
    loading: false,
    changedFiles: extractChangedFiles(detailedStatus),
    stagedFiles: extractStagedFiles(detailedStatus),
    unstagedFiles: extractUnstagedFiles(detailedStatus)
});

interface RemotesResult { success: boolean; remotes?: Remote[] }
interface TrackingResult { success: boolean; tracking?: string | null; ahead?: number; behind?: number }
interface DiffStatsResult { success: boolean; staged?: { added: number; deleted: number; files: number }; unstaged?: { added: number; deleted: number; files: number }; total?: { added: number; deleted: number; files: number } }
interface CommitStatsResult { success: boolean; commitCounts?: Record<string, number> }

const extractBranches = (batched: BatchedGitResults): string[] =>
    batched.branches?.success ? (batched.branches.branches ?? []) : [];

const extractRemotes = (result: RemotesResult): Remote[] =>
    result.success ? (result.remotes ?? []) : [];

const extractTrackingInfo = (result: TrackingResult): TrackingInfo | null =>
    result.success ? { tracking: result.tracking ?? null, ahead: result.ahead ?? 0, behind: result.behind ?? 0 } : null;

const extractDiffStats = (result: DiffStatsResult): DiffStats | null =>
    result.success ? {
        staged: result.staged ?? { added: 0, deleted: 0, files: 0 },
        unstaged: result.unstaged ?? { added: 0, deleted: 0, files: 0 },
        total: result.total ?? { added: 0, deleted: 0, files: 0 }
    } : null;

const extractCommitStats = (result: CommitStatsResult): Record<string, number> =>
    result.success ? (result.commitCounts ?? {}) : {};

export async function fetchFullGitData(projectPath: string): Promise<FullGitData | null> {
    const repoCheck = await window.electron.git.isRepository(projectPath);
    if (!repoCheck.isRepository) { return null; }

    const batchedGitData = await CommonBatches.loadProjectData(projectPath);

    const [recentCommitsResult, detailedStatus, remotesResult, trackingResult, diffStatsResult, commitStatsResult] = await Promise.all([
        window.electron.git.getRecentCommits(projectPath, 10),
        window.electron.git.getDetailedStatus(projectPath),
        window.electron.git.getRemotes(projectPath),
        window.electron.git.getTrackingInfo(projectPath),
        window.electron.git.getDiffStats(projectPath),
        window.electron.git.getCommitStats(projectPath, 365)
    ]);

    return {
        gitData: buildGitData(batchedGitData, recentCommitsResult, detailedStatus),
        branches: extractBranches(batchedGitData),
        remotes: extractRemotes(remotesResult),
        trackingInfo: extractTrackingInfo(trackingResult),
        diffStats: extractDiffStats(diffStatsResult),
        commitStats: extractCommitStats(commitStatsResult)
    };
}
