export interface GitFile {
    status: string;
    path: string;
    staged: boolean;
}

export interface GitCommitInfo {
    hash: string;
    message: string;
    author: string;
    date: string;
}

export interface GitData {
    branch: string | null;
    isClean: boolean | null;
    lastCommit: { hash: string; message: string; author: string; relativeTime: string } | null;
    recentCommits: GitCommitInfo[];
    isRepository: boolean;
    loading: boolean;
    changedFiles: GitFile[];
    stagedFiles: GitFile[];
    unstagedFiles: GitFile[];
}

export interface TrackingInfo {
    tracking: string | null;
    ahead: number;
    behind: number;
}

export interface Remote {
    name: string;
    url: string;
    fetch: boolean;
    push: boolean;
}

export interface DiffStats {
    staged: { added: number; deleted: number; files: number };
    unstaged: { added: number; deleted: number; files: number };
    total: { added: number; deleted: number; files: number };
}

export interface GitConflict {
    path: string;
    status: string;
    explanation: string;
}

export interface GitStash {
    ref: string;
    hash: string;
    author: string;
    date: string;
    subject: string;
}

export interface GitBlameLine {
    lineNumber: number;
    commit: string;
    author: string;
    authorTime: string;
    summary: string;
    content: string;
}

export interface GitCommitDetails {
    hash: string;
    author: string;
    email: string;
    date: string;
    subject: string;
    body: string;
    files: string[];
}

export interface GitRebasePlanCommit {
    hash: string;
    subject: string;
    author: string;
    date: string;
    action: 'pick';
}

export interface GitSubmodule {
    path: string;
    hash: string;
    state: string;
    descriptor: string;
    url: string;
    branch: string;
}

export interface GitFlowStatus {
    currentBranch: string;
    byType: {
        feature: string[];
        release: string[];
        hotfix: string[];
        support: string[];
    };
    branches: string[];
}

export interface GitHookInfo {
    name: string;
    path: string;
    executable: boolean;
    hasShebang: boolean;
    size: number;
    updatedAt: string;
}

export interface GitRepositoryStats {
    totalCommits: number;
    authorStats: Array<{ commits: number; author: string }>;
    fileStats: Array<{ file: string; commits: number }>;
    activity: Record<string, number>;
    generatedAt: string;
    days: number;
}
