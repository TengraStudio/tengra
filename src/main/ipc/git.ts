import { GitService } from '@main/services/project/git.service';
import { registerBatchableHandler } from '@main/utils/ipc-batch.util';
import { withRateLimit } from '@main/utils/rate-limiter.util';
import { getErrorMessage } from '@shared/utils/error.util';
import { ipcMain } from 'electron';

export function registerGitIpc(gitService: GitService) {
    registerStatusHandlers(gitService);
    registerHistoryHandlers(gitService);
    registerDiffHandlers(gitService);
    registerActionHandlers(gitService);
    registerGitBatchHandlers(gitService);
}

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
                files: result.map(file => ({ path: file.path, status: file.status }))
            };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    });

    registerBatchableHandler('git:getLastCommit', async (_event, ...args) => {
        const cwd = args[0] as string;
        try {
            const result = await gitService.executeRaw(cwd, 'log -1 --pretty=format:"%H|%s|%an|%ar|%aI"');
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
            const result = await gitService.executeRaw(cwd, 'branch -a --format="%(refname:short)"');
            if (result.success && result.stdout) {
                const branches = result.stdout.trim().split('\n').filter(b => b.length > 0);
                return { success: true, branches };
            }
            return { success: true, branches: [] };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    });
}

function registerStatusHandlers(gitService: GitService) {
    // Note: getBranch, getStatus, getBranches are registered in registerGitBatchHandlers
    // to support batching optimization

    // Check if directory is a git repository
    ipcMain.handle('git:isRepository', async (_event, cwd: string) => {
        try {
            const result = await gitService.executeRaw(cwd, 'rev-parse --git-dir');
            return { success: true, isRepository: result.success };
        } catch {
            return { success: false, isRepository: false };
        }
    });

    // Get remote info
    ipcMain.handle('git:getRemotes', async (_event, cwd: string) => {
        try {
            const result = await gitService.executeRaw(cwd, 'remote -v');
            if (result.success && result.stdout) {
                return { success: true, remotes: parseRemotes(result.stdout) };
            }
            return { success: true, remotes: [] };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error), remotes: [] };
        }
    });


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
                    if (type === '(fetch)') { remote.fetch = true; }
                    if (type === '(push)') { remote.push = true; }
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
    ipcMain.handle('git:getTrackingInfo', async (_event, cwd: string) => {
        try {
            const branchResult = await gitService.executeRaw(cwd, 'rev-parse --abbrev-ref HEAD');
            if (!branchResult.success || !branchResult.stdout) {
                return { success: true, tracking: null, ahead: 0, behind: 0 };
            }

            const branch = branchResult.stdout.trim();
            const trackingResult = await gitService.executeRaw(cwd, `rev-parse --abbrev-ref ${branch}@{upstream}`);

            if (!trackingResult.success || !trackingResult.stdout) {
                return { success: true, tracking: null, ahead: 0, behind: 0 };
            }

            const tracking = trackingResult.stdout.trim();
            const countsResult = await gitService.executeRaw(cwd, `rev-list --left-right --count ${branch}...${tracking}`);

            return parseTrackingCounts(countsResult, tracking);
        } catch {
            return { success: true, tracking: null, ahead: 0, behind: 0 };
        }
    });
}

function parseTrackingCounts(result: { success: boolean; stdout?: string }, tracking: string) {
    if (result.success && result.stdout) {
        const parts = result.stdout.trim().split('\t');
        const ahead = parseInt(parts[0] ?? '0');
        const behind = parseInt(parts[1] ?? '0');
        return { success: true, tracking, ahead: isNaN(ahead) ? 0 : ahead, behind: isNaN(behind) ? 0 : behind };
    }
    return { success: true, tracking, ahead: 0, behind: 0 };
}

function registerHistoryHandlers(gitService: GitService) {
    // Get last commit info
    ipcMain.handle('git:getLastCommit', async (_event, cwd: string) => {
        try {
            const result = await gitService.executeRaw(cwd, 'log -1 --pretty=format:"%h|%s|%an|%ar|%cI"');
            if (result.success && result.stdout) {
                const parts = result.stdout.trim().split('|');
                const [hash, message, author, relativeTime, date] = parts;
                return {
                    success: true,
                    hash: hash,
                    message: message,
                    author: author,
                    relativeTime: relativeTime,
                    date: date
                };
            }
            return { success: false, error: 'No commits found' };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    });

    // Get recent commits
    ipcMain.handle('git:getRecentCommits', async (_event, cwd: string, count: number = 10) => {
        try {
            const result = await gitService.getLog(cwd, count);
            return { success: true, commits: result };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error), commits: [] };
        }
    });

    // Get commit statistics
    ipcMain.handle('git:getCommitStats', async (_event, cwd: string, days: number = 365) => {
        try {
            const result = await gitService.executeRaw(cwd, `log --since="${days} days ago" --pretty=format:"%ad" --date=short`);
            if (result.success && result.stdout) {
                const dates = result.stdout.split('\n').filter(line => line.trim());
                const commitCounts: Record<string, number> = {};

                dates.forEach(date => {
                    commitCounts[date] = (commitCounts[date] ?? 0) + 1;
                });

                return { success: true, commitCounts };
            }
            return { success: true, commitCounts: {} };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error), commitCounts: {} };
        }
    });
}

function registerDiffHandlers(gitService: GitService) {
    // Get file diff
    ipcMain.handle('git:getFileDiff', async (_event, cwd: string, filePath: string, staged: boolean = false) => {
        try {
            const result = await gitService.getFileDiff(cwd, filePath, staged);
            return result;
        } catch (error) {
            return { original: '', modified: '', success: false, error: getErrorMessage(error as Error) };
        }
    });

    // Get unified diff
    ipcMain.handle('git:getUnifiedDiff', async (_event, cwd: string, filePath: string, staged: boolean = false) => {
        try {
            const result = await gitService.getUnifiedDiff(cwd, filePath, staged);
            return result;
        } catch (error) {
            return { diff: '', success: false, error: getErrorMessage(error as Error) };
        }
    });

    // Get commit diff
    ipcMain.handle('git:getCommitDiff', async (_event, cwd: string, hash: string) => {
        try {
            const result = await gitService.getCommitDiff(cwd, hash);
            return result;
        } catch (error) {
            return { diff: '', success: false, error: getErrorMessage(error as Error) };
        }
    });

    // Stage file
    ipcMain.handle('git:stageFile', async (_event, cwd: string, filePath: string) => {
        try {
            const result = await withRateLimit('git', () => gitService.stageFile(cwd, filePath));
            return { success: result.success, error: result.error };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    });

    // Unstage file
    ipcMain.handle('git:unstageFile', async (_event, cwd: string, filePath: string) => {
        try {
            const result = await withRateLimit('git', () => gitService.unstageFile(cwd, filePath));
            return { success: result.success, error: result.error };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    });

    // Get detailed status with file types
    ipcMain.handle('git:getDetailedStatus', async (_event, cwd: string) => {
        try {
            // Get staged files
            const stagedResult = await gitService.executeRaw(cwd, 'diff --cached --name-status');
            // Get unstaged files
            const unstagedResult = await gitService.executeRaw(cwd, 'diff --name-status');

            const parseStatus = (output: string): Array<{ status: string; path: string; staged: boolean }> => {
                if (!output) { return []; }
                return output.split('\n')
                    .filter(line => line.trim())
                    .map(line => {
                        const parts = line.trim().split('\t');
                        const p0 = parts[0];
                        const p1 = parts[1];
                        if (p0 && p1) {
                            return {
                                status: p0,
                                path: p1,
                                staged: false
                            };
                        }
                        return null;
                    })
                    .filter(Boolean) as Array<{ status: string; path: string; staged: boolean }>;
            };

            const stagedFiles = parseStatus(stagedResult.stdout ?? '').map(f => ({ ...f, staged: true }));
            const unstagedFiles = parseStatus(unstagedResult.stdout ?? '');

            return {
                success: true,
                stagedFiles,
                unstagedFiles,
                allFiles: [...stagedFiles, ...unstagedFiles]
            };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error), stagedFiles: [], unstagedFiles: [], allFiles: [] };
        }
    });

    // Get diff statistics
    ipcMain.handle('git:getDiffStats', async (_event, cwd: string) => {
        try {
            const stagedResult = await gitService.executeRaw(cwd, 'diff --cached --numstat');
            const unstagedResult = await gitService.executeRaw(cwd, 'diff --numstat');

            const parseStats = (output: string): { added: number; deleted: number; files: number } => {
                if (!output) { return { added: 0, deleted: 0, files: 0 }; }
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
                    files: stagedStats.files + unstagedStats.files
                }
            };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error), staged: { added: 0, deleted: 0, files: 0 }, unstaged: { added: 0, deleted: 0, files: 0 }, total: { added: 0, deleted: 0, files: 0 } };
        }
    });
}

function registerActionHandlers(gitService: GitService) {
    // Checkout branch
    ipcMain.handle('git:checkout', async (_event, cwd: string, branch: string) => {
        try {
            const result = await withRateLimit('git', () => gitService.checkout(cwd, branch));
            return { success: result.success, error: result.error };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    });

    // Commit changes
    ipcMain.handle('git:commit', async (_event, cwd: string, message: string) => {
        try {
            const result = await withRateLimit('git', () => gitService.commit(cwd, message));
            return { success: result.success, error: result.error };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    });

    // Push to remote
    ipcMain.handle('git:push', async (_event, cwd: string, remote: string = 'origin', branch?: string) => {
        try {
            if (!branch) {
                const branchResult = await gitService.executeRaw(cwd, 'rev-parse --abbrev-ref HEAD');
                branch = branchResult.success && branchResult.stdout ? branchResult.stdout.trim() : 'main';
            }
            const targetBranch = branch;
            const result = await withRateLimit('git', async () => gitService.push(cwd, remote, targetBranch));
            return { success: result.success, error: result.error, stdout: result.stdout, stderr: result.stderr };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    });

    // Pull from remote
    ipcMain.handle('git:pull', async (_event, cwd: string) => {
        try {
            const result = await withRateLimit('git', () => gitService.pull(cwd));
            return { success: result.success, error: result.error, stdout: result.stdout, stderr: result.stderr };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    });
}
