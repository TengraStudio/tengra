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
