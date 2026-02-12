import path from 'path';

import { appLogger } from '@main/logging/logger';
import { GitService } from '@main/services/project/git.service';
import { registerBatchableHandler } from '@main/utils/ipc-batch.util';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { withRateLimit } from '@main/utils/rate-limiter.util';
import { getErrorMessage } from '@shared/utils/error.util';
import { ipcMain, IpcMainInvokeEvent } from 'electron';

/** Maximum path length */
const MAX_PATH_LENGTH = 4096;
/** Maximum commit message length */
const MAX_COMMIT_MESSAGE_LENGTH = 72 * 100; // 100 lines of 72 chars
/** Maximum branch name length */
const MAX_BRANCH_LENGTH = 255;
/** Maximum hash length */
const MAX_HASH_LENGTH = 64;
/** Maximum days for stats query */
const MAX_STATS_DAYS = 3650; // 10 years
/** Maximum commit count */
const MAX_COMMIT_COUNT = 1000;

/**
 * Validates a path string
 */
function validatePath(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_PATH_LENGTH) {
        return null;
    }
    return trimmed;
}

/**
 * Validates a branch name
 */
function validateBranchName(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_BRANCH_LENGTH) {
        return null;
    }
    // Basic validation - no spaces, special chars
    if (/[\s~^:?*\\\]]/.test(trimmed) || trimmed.includes('[')) {
        return null;
    }
    return trimmed;
}

/**
 * Validates a commit message
 */
function validateCommitMessage(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    if (!value.trim() || value.length > MAX_COMMIT_MESSAGE_LENGTH) {
        return null;
    }
    return value;
}

/**
 * Validates a git hash
 */
function validateHash(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_HASH_LENGTH) {
        return null;
    }
    // Git hashes are hexadecimal
    if (!/^[a-fA-F0-9]+$/.test(trimmed)) {
        return null;
    }
    return trimmed;
}

/**
 * Validates a numeric count
 */
function validateCount(value: unknown, max: number): number {
    const num = Number(value);
    if (!Number.isInteger(num) || num < 1) {
        return 10; // Default
    }
    return Math.min(num, max);
}

/**
 * Registers IPC handlers for Git operations
 */
export function registerGitIpc(gitService: GitService) {
    appLogger.info('GitIPC', 'Registering Git IPC handlers');
    registerStatusHandlers(gitService);
    registerHistoryHandlers(gitService);
    registerDiffHandlers(gitService);
    registerActionHandlers(gitService);
    registerGitBatchHandlers(gitService);
}

/**
 * Registers batchable Git IPC handlers for commonly grouped operations
 * @param gitService - Git service instance for executing git commands
 */
function registerGitBatchHandlers(gitService: GitService) {
    // Register commonly batched git operations
    registerBatchableHandler('git:getBranch', async (_event, ...args) => {
        const cwd = args[0] as string;
        try {
            const result = await gitService.executeRaw(cwd, 'rev-parse --abbrev-ref HEAD');
            if (result.success && result.stdout) {
                return { success: true, branch: result.stdout.trim() };
            }
            return { success: false, error: 'Not a git repository' };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    });

    registerBatchableHandler('git:getStatus', async (_event, ...args) => {
        const cwd = args[0] as string;
        try {
            const result = await gitService.getStatus(cwd);
            const isClean = result.length === 0;
            return {
                success: true,
                isClean,
                changes: result.length,
                files: result.map(file => ({ path: file.path, status: file.status })),
            };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    });

    registerBatchableHandler('git:getLastCommit', async (_event, ...args) => {
        const cwd = args[0] as string;
        try {
            const result = await gitService.executeRaw(
                cwd,
                'log -1 --pretty=format:"%H|%s|%an|%ar|%aI"'
            );
            if (result.success && result.stdout) {
                const [hash, message, author, relativeTime, date] = result.stdout.trim().split('|');
                return { success: true, hash, message, author, relativeTime, date };
            }
            return { success: false, error: 'No commits found' };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    });

    registerBatchableHandler('git:getBranches', async (_event, ...args) => {
        const cwd = args[0] as string;
        try {
            const result = await gitService.executeRaw(
                cwd,
                'branch -a --format="%(refname:short)"'
            );
            if (result.success && result.stdout) {
                const branches = result.stdout
                    .trim()
                    .split('\n')
                    .filter(b => b.length > 0);
                return { success: true, branches };
            }
            return { success: true, branches: [] };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    });
}

/**
 * Registers IPC handlers for repository status queries
 * @param gitService - Git service instance for executing git commands
 */
function registerStatusHandlers(gitService: GitService) {
    // Note: getBranch, getStatus, getBranches are registered in registerGitBatchHandlers
    // to support batching optimization

    // Check if directory is a git repository
    ipcMain.handle('git:isRepository', createSafeIpcHandler('git:isRepository',
        async (_event: IpcMainInvokeEvent, cwdRaw: unknown) => {
            const cwd = validatePath(cwdRaw);
            if (!cwd) {
                throw new Error('Invalid path');
            }
            const result = await gitService.executeRaw(cwd, 'rev-parse --git-dir');
            return { success: true, isRepository: result.success };
        }, { success: false, isRepository: false }
    ));

    ipcMain.handle('git:getTreeStatus', createSafeIpcHandler('git:getTreeStatus',
        async (_event: IpcMainInvokeEvent, cwdRaw: unknown, targetPathRaw: unknown) => {
            const cwd = validatePath(cwdRaw);
            const targetPath = validatePath(targetPathRaw) ?? '';
            if (!cwd) {
                throw new Error('Invalid path');
            }
        try {
            const rootResult = await gitService.executeRaw(cwd, 'rev-parse --show-toplevel');
            if (!rootResult.success || !rootResult.stdout) {
                return { success: true, isRepository: false, entries: [] };
            }

            const repoRoot = rootResult.stdout.trim();
            const absoluteTarget = path.resolve(targetPath || cwd);
            const relativeTarget = path.relative(repoRoot, absoluteTarget).replace(/\\/g, '/');
            const targetArg =
                relativeTarget && relativeTarget !== '.' ? ` -- "${relativeTarget}"` : '';
            const statusResult = await gitService.executeRaw(
                repoRoot,
                `status --porcelain=1 --ignored=matching --untracked-files=all${targetArg}`
            );

            const entries = parsePorcelainEntries(statusResult.stdout ?? '');

            return {
                success: true,
                isRepository: true,
                repoRoot,
                targetPath: absoluteTarget,
                entries,
            };
        } catch (error) {
            return {
                success: false,
                isRepository: false,
                entries: [],
                error: getErrorMessage(error as Error),
            };
        }
    }, { success: false, isRepository: false, entries: [] }));

    // Get remote info
    ipcMain.handle('git:getRemotes', createSafeIpcHandler('git:getRemotes',
        async (_event: IpcMainInvokeEvent, cwdRaw: unknown) => {
            const cwd = validatePath(cwdRaw);
            if (!cwd) {
                throw new Error('Invalid path');
            }
        try {
            const result = await gitService.executeRaw(cwd, 'remote -v');
            if (result.success && result.stdout) {
                return { success: true, remotes: parseRemotes(result.stdout) };
            }
            return { success: true, remotes: [] };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error), remotes: [] };
        }
    }, { success: false, remotes: [] }));

    /**
     * Parses git remote -v output into structured remote objects
     * @param stdout - Raw stdout from git remote -v command
     */
    function parseRemotes(stdout: string) {
        const remotes: Array<{ name: string; url: string; fetch: boolean; push: boolean }> = [];
        const lines = stdout.split('\n').filter(line => line.trim());
        const remoteMap = new Map<string, { url?: string; fetch: boolean; push: boolean }>();

        lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            const name = parts[0];
            const url = parts[1];
            const type = parts[2];

            if (name && url && type) {
                if (!remoteMap.has(name)) {
                    remoteMap.set(name, { url, fetch: false, push: false });
                }

                const remote = remoteMap.get(name);
                if (remote) {
                    remote.url = url;
                    if (type === '(fetch)') {
                        remote.fetch = true;
                    }
                    if (type === '(push)') {
                        remote.push = true;
                    }
                }
            }
        });

        remoteMap.forEach((value, name) => {
            if (value.url) {
                remotes.push({ name, url: value.url, fetch: value.fetch, push: value.push });
            }
        });
        return remotes;
    }
    // Get tracking branch info (ahead/behind)
    ipcMain.handle('git:getTrackingInfo', createSafeIpcHandler('git:getTrackingInfo',
        async (_event: IpcMainInvokeEvent, cwdRaw: unknown) => {
            const cwd = validatePath(cwdRaw);
            if (!cwd) {
                throw new Error('Invalid path');
            }
            const branchResult = await gitService.executeRaw(cwd, 'rev-parse --abbrev-ref HEAD');
            if (!branchResult.success || !branchResult.stdout) {
                return { success: true, tracking: null, ahead: 0, behind: 0 };
            }

            const branch = branchResult.stdout.trim();
            const trackingResult = await gitService.executeRaw(
                cwd,
                `rev-parse --abbrev-ref ${branch}@{upstream}`
            );

            if (!trackingResult.success || !trackingResult.stdout) {
                return { success: true, tracking: null, ahead: 0, behind: 0 };
            }

            const tracking = trackingResult.stdout.trim();
            const countsResult = await gitService.executeRaw(
                cwd,
                `rev-list --left-right --count ${branch}...${tracking}`
            );

            return parseTrackingCounts(countsResult, tracking);
        }, { success: true, tracking: null, ahead: 0, behind: 0 }
    ));
}

/**
 * Parses git status --porcelain=1 output into structured entries
 * @param output - Raw porcelain status output
 */
function parsePorcelainEntries(
    output: string
): Array<{ status: string; path: string; isIgnored: boolean }> {
    if (!output) {
        return [];
    }

    return output
        .split('\n')
        .map(line => line.trimEnd())
        .filter(line => line.length >= 4)
        .map(line => {
            const status = line.slice(0, 2);
            let filePath = line.slice(3).trim();
            const renameSeparator = ' -> ';
            if (filePath.includes(renameSeparator)) {
                const parts = filePath.split(renameSeparator);
                filePath = parts[parts.length - 1] ?? filePath;
            }

            if (filePath.startsWith('"') && filePath.endsWith('"')) {
                filePath = filePath.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            }

            filePath = filePath.replace(/\\/g, '/');

            return {
                status,
                path: filePath,
                isIgnored: status === '!!',
            };
        })
        .filter(entry => entry.path.length > 0);
}

/**
 * Parses ahead/behind counts from git rev-list --left-right output
 * @param result - Result object from executeRaw containing stdout
 * @param tracking - Name of the tracking branch
 */
function parseTrackingCounts(result: { success: boolean; stdout?: string }, tracking: string) {
    if (result.success && result.stdout) {
        const parts = result.stdout.trim().split('\t');
        const ahead = parseInt(parts[0] ?? '0');
        const behind = parseInt(parts[1] ?? '0');
        return {
            success: true,
            tracking,
            ahead: isNaN(ahead) ? 0 : ahead,
            behind: isNaN(behind) ? 0 : behind,
        };
    }
    return { success: true, tracking, ahead: 0, behind: 0 };
}

/**
 * Registers IPC handlers for commit history and statistics
 * @param gitService - Git service instance for executing git commands
 */
function registerHistoryHandlers(gitService: GitService) {
    // Get last commit info
    ipcMain.handle('git:getLastCommit', createSafeIpcHandler('git:getLastCommit',
        async (_event: IpcMainInvokeEvent, cwdRaw: unknown) => {
            const cwd = validatePath(cwdRaw);
            if (!cwd) {
                throw new Error('Invalid path');
            }
            const result = await gitService.executeRaw(
                cwd,
                'log -1 --pretty=format:"%h|%s|%an|%ar|%cI"'
            );
            if (result.success && result.stdout) {
                const parts = result.stdout.trim().split('|');
                const [hash, message, author, relativeTime, date] = parts;
                return {
                    success: true,
                    hash: hash,
                    message: message,
                    author: author,
                    relativeTime: relativeTime,
                    date: date,
                };
            }
            return { success: false, error: 'No commits found' };
        }, { success: false, error: 'Failed to get last commit' }
    ));

    // Get recent commits
    ipcMain.handle('git:getRecentCommits', createSafeIpcHandler('git:getRecentCommits',
        async (_event: IpcMainInvokeEvent, cwdRaw: unknown, countRaw: unknown) => {
            const cwd = validatePath(cwdRaw);
            if (!cwd) {
                throw new Error('Invalid path');
            }
            const count = validateCount(countRaw, MAX_COMMIT_COUNT);
            const result = await gitService.getLog(cwd, count);
            return { success: true, commits: result };
        }, { success: false, commits: [] }
    ));

    // Get commit statistics
    ipcMain.handle('git:getCommitStats', createSafeIpcHandler('git:getCommitStats',
        async (_event: IpcMainInvokeEvent, cwdRaw: unknown, daysRaw: unknown) => {
            const cwd = validatePath(cwdRaw);
            if (!cwd) {
                throw new Error('Invalid path');
            }
            const days = validateCount(daysRaw, MAX_STATS_DAYS);
            const result = await gitService.executeRaw(
                cwd,
                `log --since="${days} days ago" --pretty=format:"%ad" --date=short`
            );
            if (result.success && result.stdout) {
                const dates = result.stdout.split('\n').filter(line => line.trim());
                const commitCounts: Record<string, number> = {};

                dates.forEach(date => {
                    commitCounts[date] = (commitCounts[date] ?? 0) + 1;
                });

                return { success: true, commitCounts };
            }
            return { success: true, commitCounts: {} };
        }, { success: false, commitCounts: {} }
    ));
}

/**
 * Registers IPC handlers for diff viewing, staging, and unstaging
 * @param gitService - Git service instance for executing git commands
 */
function registerDiffHandlers(gitService: GitService) {
    // Get file diff
    ipcMain.handle('git:getFileDiff', createSafeIpcHandler('git:getFileDiff',
        async (_event: IpcMainInvokeEvent, cwdRaw: unknown, filePathRaw: unknown, stagedRaw: unknown) => {
            const cwd = validatePath(cwdRaw);
            const filePath = validatePath(filePathRaw);
            if (!cwd || !filePath) {
                throw new Error('Invalid path');
            }
            const staged = stagedRaw === true;
            const result = await gitService.getFileDiff(cwd, filePath, staged);
            return result;
        }, { original: '', modified: '', success: false, error: 'Failed to get diff' }
    ));

    // Get unified diff
    ipcMain.handle('git:getUnifiedDiff', createSafeIpcHandler('git:getUnifiedDiff',
        async (_event: IpcMainInvokeEvent, cwdRaw: unknown, filePathRaw: unknown, stagedRaw: unknown) => {
            const cwd = validatePath(cwdRaw);
            const filePath = validatePath(filePathRaw);
            if (!cwd || !filePath) {
                throw new Error('Invalid path');
            }
            const staged = stagedRaw === true;
            const result = await gitService.getUnifiedDiff(cwd, filePath, staged);
            return result;
        }, { diff: '', success: false, error: 'Failed to get unified diff' }
    ));

    // Get commit diff
    ipcMain.handle('git:getCommitDiff', createSafeIpcHandler('git:getCommitDiff',
        async (_event: IpcMainInvokeEvent, cwdRaw: unknown, hashRaw: unknown) => {
            const cwd = validatePath(cwdRaw);
            const hash = validateHash(hashRaw);
            if (!cwd || !hash) {
                throw new Error('Invalid path or hash');
            }
            const result = await gitService.getCommitDiff(cwd, hash);
            return result;
        }, { diff: '', success: false, error: 'Failed to get commit diff' }
    ));

    // Stage file
    ipcMain.handle('git:stageFile', createSafeIpcHandler('git:stageFile',
        async (_event: IpcMainInvokeEvent, cwdRaw: unknown, filePathRaw: unknown) => {
            const cwd = validatePath(cwdRaw);
            const filePath = validatePath(filePathRaw);
            if (!cwd || !filePath) {
                throw new Error('Invalid path');
            }
            const result = await withRateLimit('git', () => gitService.stageFile(cwd, filePath));
            return { success: result.success, error: result.error };
        }, { success: false, error: 'Failed to stage file' }
    ));

    // Unstage file
    ipcMain.handle('git:unstageFile', createSafeIpcHandler('git:unstageFile',
        async (_event: IpcMainInvokeEvent, cwdRaw: unknown, filePathRaw: unknown) => {
            const cwd = validatePath(cwdRaw);
            const filePath = validatePath(filePathRaw);
            if (!cwd || !filePath) {
                throw new Error('Invalid path');
            }
            const result = await withRateLimit('git', () => gitService.unstageFile(cwd, filePath));
            return { success: result.success, error: result.error };
        }, { success: false, error: 'Failed to unstage file' }
    ));

    // Get detailed status with file types
    ipcMain.handle('git:getDetailedStatus', createSafeIpcHandler('git:getDetailedStatus',
        async (_event: IpcMainInvokeEvent, cwdRaw: unknown) => {
            const cwd = validatePath(cwdRaw);
            if (!cwd) {
                throw new Error('Invalid path');
            }
            // Get staged files
            const stagedResult = await gitService.executeRaw(cwd, 'diff --cached --name-status');
            // Get unstaged files
            const unstagedResult = await gitService.executeRaw(cwd, 'diff --name-status');

            const parseStatus = (
                output: string
            ): Array<{ status: string; path: string; staged: boolean }> => {
                if (!output) {
                    return [];
                }
                return output
                    .split('\n')
                    .filter(line => line.trim())
                    .map(line => {
                        const parts = line.trim().split('\t');
                        const p0 = parts[0];
                        const p1 = parts[1];
                        if (p0 && p1) {
                            return {
                                status: p0,
                                path: p1,
                                staged: false,
                            };
                        }
                        return null;
                    })
                    .filter(Boolean) as Array<{ status: string; path: string; staged: boolean }>;
            };

            const stagedFiles = parseStatus(stagedResult.stdout ?? '').map(f => ({
                ...f,
                staged: true,
            }));
            const unstagedFiles = parseStatus(unstagedResult.stdout ?? '');

            return {
                success: true,
                stagedFiles,
                unstagedFiles,
                allFiles: [...stagedFiles, ...unstagedFiles],
            };
        }, { success: false, stagedFiles: [], unstagedFiles: [], allFiles: [] }
    ));

    // Get diff statistics
    ipcMain.handle('git:getDiffStats', createSafeIpcHandler('git:getDiffStats',
        async (_event: IpcMainInvokeEvent, cwdRaw: unknown) => {
            const cwd = validatePath(cwdRaw);
            if (!cwd) {
                throw new Error('Invalid path');
            }
            const stagedResult = await gitService.executeRaw(cwd, 'diff --cached --numstat');
            const unstagedResult = await gitService.executeRaw(cwd, 'diff --numstat');

            const parseStats = (
                output: string
            ): { added: number; deleted: number; files: number } => {
                if (!output) {
                    return { added: 0, deleted: 0, files: 0 };
                }
                const lines = output.split('\n').filter(line => line.trim());
                let added = 0;
                let deleted = 0;

                lines.forEach(line => {
                    const parts = line.trim().split(/\s+/);
                    const p0 = parts[0];
                    const p1 = parts[1];
                    if (p0 && p1) {
                        const add = parseInt(p0) || 0;
                        const del = parseInt(p1) || 0;
                        added += add;
                        deleted += del;
                    }
                });

                return { added, deleted, files: lines.length };
            };

            const stagedStats = parseStats(stagedResult.stdout ?? '');
            const unstagedStats = parseStats(unstagedResult.stdout ?? '');

            return {
                success: true,
                staged: stagedStats,
                unstaged: unstagedStats,
                total: {
                    added: stagedStats.added + unstagedStats.added,
                    deleted: stagedStats.deleted + unstagedStats.deleted,
                    files: stagedStats.files + unstagedStats.files,
                },
            };
        }, {
            success: false,
            staged: { added: 0, deleted: 0, files: 0 },
            unstaged: { added: 0, deleted: 0, files: 0 },
            total: { added: 0, deleted: 0, files: 0 },
        }
    ));
}

/**
 * Registers IPC handlers for git actions (checkout, commit, push, pull)
 * @param gitService - Git service instance for executing git commands
 */
function registerActionHandlers(gitService: GitService) {
    // Checkout branch
    ipcMain.handle('git:checkout', createSafeIpcHandler('git:checkout',
        async (_event: IpcMainInvokeEvent, cwdRaw: unknown, branchRaw: unknown) => {
            const cwd = validatePath(cwdRaw);
            const branch = validateBranchName(branchRaw);
            if (!cwd || !branch) {
                throw new Error('Invalid path or branch name');
            }
            const result = await withRateLimit('git', () => gitService.checkout(cwd, branch));
            return { success: result.success, error: result.error };
        }, { success: false, error: 'Failed to checkout branch' }
    ));

    // Commit changes
    ipcMain.handle('git:commit', createSafeIpcHandler('git:commit',
        async (_event: IpcMainInvokeEvent, cwdRaw: unknown, messageRaw: unknown) => {
            const cwd = validatePath(cwdRaw);
            const message = validateCommitMessage(messageRaw);
            if (!cwd || !message) {
                throw new Error('Invalid path or commit message');
            }
            const result = await withRateLimit('git', () => gitService.commit(cwd, message));
            return { success: result.success, error: result.error };
        }, { success: false, error: 'Failed to commit' }
    ));

    // Push to remote
    ipcMain.handle('git:push', createSafeIpcHandler('git:push',
        async (_event: IpcMainInvokeEvent, cwdRaw: unknown, remoteRaw: unknown, branchRaw: unknown) => {
            const cwd = validatePath(cwdRaw);
            if (!cwd) {
                throw new Error('Invalid path');
            }
            const remote = validateBranchName(remoteRaw) ?? 'origin';
            let branch = validateBranchName(branchRaw);
            if (!branch) {
                const branchResult = await gitService.executeRaw(
                    cwd,
                    'rev-parse --abbrev-ref HEAD'
                );
                branch =
                    branchResult.success && branchResult.stdout
                        ? branchResult.stdout.trim()
                        : 'main';
            }
            const result = await withRateLimit('git', async () =>
                gitService.push(cwd, remote, branch)
            );
            return {
                success: result.success,
                error: result.error,
                stdout: result.stdout,
                stderr: result.stderr,
            };
        }, { success: false, error: 'Failed to push', stdout: undefined, stderr: undefined }
    ));

    // Pull from remote
    ipcMain.handle('git:pull', createSafeIpcHandler('git:pull',
        async (_event: IpcMainInvokeEvent, cwdRaw: unknown) => {
            const cwd = validatePath(cwdRaw);
            if (!cwd) {
                throw new Error('Invalid path');
            }
            const result = await withRateLimit('git', () => gitService.pull(cwd));
            return {
                success: result.success,
                error: result.error,
                stdout: result.stdout,
                stderr: result.stderr,
            };
        }, { success: false, error: 'Failed to pull', stdout: undefined, stderr: undefined }
    ));
}
