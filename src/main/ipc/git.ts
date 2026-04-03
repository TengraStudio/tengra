import path from 'path';

import { registerGitAdvancedIpc } from '@main/ipc/git-advanced';
import { createMainWindowSenderValidator, SenderValidator } from '@main/ipc/sender-validator';
import { appLogger } from '@main/logging/logger';
import { BrainService } from '@main/services/llm/brain.service';
import { LLMService } from '@main/services/llm/llm.service';
import { GitService } from '@main/services/workspace/git.service';
import { registerBatchableHandler } from '@main/utils/ipc-batch.util';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { withRateLimit } from '@main/utils/rate-limiter.util';
import {
    gitTreeStatusPreviewArgsSchema,
    gitTreeStatusPreviewResponseSchema,
} from '@shared/schemas/git.schema';
import { getErrorMessage } from '@shared/utils/error.util';
import { BrowserWindow, ipcMain } from 'electron';
import { z } from 'zod';

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
const TREE_STATUS_PREVIEW_TTL_MS = 30_000;

interface GitTreeStatusPreviewCacheEntry {
    response: z.infer<typeof gitTreeStatusPreviewResponseSchema>;
    timestamp: number;
}

const gitTreeStatusPreviewCache = new Map<string, GitTreeStatusPreviewCacheEntry>();

// --- Schemas ---

const CwdSchema = z.string().min(1).max(MAX_PATH_LENGTH).trim();
const BranchSchema = z.string().min(1).max(MAX_BRANCH_LENGTH).regex(/^[^\s~^:?*\\[\]]+$/).trim();
const CommitMessageSchema = z.string().min(1).max(MAX_COMMIT_MESSAGE_LENGTH);
const HashSchema = z.string().min(1).max(MAX_HASH_LENGTH).regex(/^[a-fA-F0-9]+$/).trim();
const CountSchema = (max: number) => z.number().int().min(1).max(max).optional().default(10);
const PathSchema = z.string().min(1).max(MAX_PATH_LENGTH).trim();

function normalizeGitPath(value: string): string {
    return value.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+$/, '');
}

function buildTreeStatusPreviewEntries(
    entries: Array<{ status: string; path: string; isIgnored: boolean }>,
    relativeTargetPath: string
): Array<{ path: string; statuses: string[]; isDirectory: boolean; isIgnored: boolean }> {
    const normalizedTargetPath = normalizeGitPath(
        relativeTargetPath === '.' ? '' : relativeTargetPath
    );
    const previewEntries = new Map<
        string,
        { statuses: string[]; isDirectory: boolean; isIgnored: boolean }
    >();

    for (const entry of entries) {
        const normalizedEntryPath = normalizeGitPath(entry.path);
        if (!normalizedEntryPath) {
            continue;
        }

        const relativeChildPath = normalizedTargetPath
            ? normalizedEntryPath === normalizedTargetPath
                ? ''
                : normalizedEntryPath.startsWith(`${normalizedTargetPath}/`)
                    ? normalizedEntryPath.slice(normalizedTargetPath.length + 1)
                    : null
            : normalizedEntryPath;

        if (!relativeChildPath) {
            continue;
        }

        const [firstSegment, ...remainingSegments] = relativeChildPath
            .split('/')
            .filter(segment => segment.length > 0);
        if (!firstSegment) {
            continue;
        }

        const childPath = normalizedTargetPath
            ? `${normalizedTargetPath}/${firstSegment}`
            : firstSegment;
        const existing = previewEntries.get(childPath) ?? { statuses: [], isDirectory: false, isIgnored: true };
        existing.statuses.push(entry.status);
        if (remainingSegments.length > 0) {
            existing.isDirectory = true;
        }
        existing.isIgnored = existing.isIgnored && entry.isIgnored;
        previewEntries.set(childPath, existing);
    }

    return Array.from(previewEntries.entries()).map(([path, value]) => ({
        path,
        statuses: Array.from(new Set(value.statuses)),
        isDirectory: value.isDirectory,
        isIgnored: value.isIgnored,
    }));
}

/**
 * Registers IPC handlers for Git operations
 */
export function registerGitIpc(
    getMainWindow: () => BrowserWindow | null,
    gitService: GitService,
    llmService?: LLMService,
    brainService?: BrainService
) {
    const validateSender = createMainWindowSenderValidator(getMainWindow, 'git operation');
    appLogger.debug('GitIPC', 'Registering Git IPC handlers');
    registerStatusHandlers(gitService, validateSender);
    registerHistoryHandlers(gitService, validateSender);
    registerDiffHandlers(gitService, validateSender);
    registerActionHandlers(gitService, validateSender);
    registerGitBatchHandlers(gitService, validateSender);
    registerGitAdvancedIpc(gitService, validateSender, llmService, brainService);
}

/**
 * Registers batchable Git IPC handlers for commonly grouped operations
 * @param gitService - Git service instance for executing git commands
 */
function registerGitBatchHandlers(gitService: GitService, validateSender: SenderValidator) {
    // Register commonly batched git operations
    registerBatchableHandler('git:getBranch', createValidatedIpcHandler('git:getBranch', async (event, cwd: string) => {
        validateSender(event);
        try {
            const result = await gitService.executeRaw(cwd, 'rev-parse --abbrev-ref HEAD');
            if (result.success && result.stdout) {
                return { success: true, branch: result.stdout.trim() };
            }
            return { success: false, error: 'Not a git repository' };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }, {
        defaultValue: { success: false, error: 'Unknown error' },
        argsSchema: z.tuple([CwdSchema])
    }) as never);

    registerBatchableHandler('git:getStatus', createValidatedIpcHandler('git:getStatus', async (event, cwd: string) => {
        validateSender(event);
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
    }, {
        defaultValue: { success: false, error: 'Unknown error' },
        argsSchema: z.tuple([CwdSchema])
    }) as never);

    registerBatchableHandler('git:getLastCommit', createValidatedIpcHandler('git:getLastCommit', async (event, cwd: string) => {
        validateSender(event);
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
    }, {
        defaultValue: { success: false, error: 'Unknown error' },
        argsSchema: z.tuple([CwdSchema])
    }) as never);

    registerBatchableHandler('git:getBranches', createValidatedIpcHandler('git:getBranches', async (event, cwd: string) => {
        validateSender(event);
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
    }, {
        defaultValue: { success: false, error: 'Unknown error' },
        argsSchema: z.tuple([CwdSchema])
    }) as never);
}

/**
 * Registers IPC handlers for repository status queries
 * @param gitService - Git service instance for executing git commands
 */
function registerStatusHandlers(gitService: GitService, validateSender: SenderValidator) {
    ipcMain.handle('git:isRepository', createValidatedIpcHandler('git:isRepository', async (event, cwd: string) => {
        validateSender(event);
        const result = await gitService.executeRaw(cwd, 'rev-parse --git-dir');
        return { success: true, isRepository: result.success };
    }, {
        defaultValue: { success: false, isRepository: false },
        argsSchema: z.tuple([CwdSchema])
    }));

    ipcMain.handle('git:getTreeStatus', createValidatedIpcHandler('git:getTreeStatus', async (event, cwd: string, targetPath?: string) => {
        validateSender(event);
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
    }, {
        defaultValue: { success: false, isRepository: false, entries: [] },
        argsSchema: z.tuple([CwdSchema, z.string().optional()])
    }));

    ipcMain.handle(
        'git:getTreeStatusPreview',
        createValidatedIpcHandler(
            'git:getTreeStatusPreview',
            async (
                event,
                cwd: string,
                targetPath?: string,
                options?: { refresh?: boolean }
            ) => {
                validateSender(event);
                try {
                    const rootResult = await gitService.executeRaw(cwd, 'rev-parse --show-toplevel');
                    if (!rootResult.success || !rootResult.stdout) {
                        return { success: true, isRepository: false, entries: [] };
                    }

                    const repoRoot = rootResult.stdout.trim();
                    const absoluteTarget = path.resolve(targetPath || cwd);
                    const cacheKey = `${repoRoot}::${absoluteTarget}`;
                    const cachedEntry = gitTreeStatusPreviewCache.get(cacheKey);
                    if (
                        options?.refresh !== true &&
                        cachedEntry &&
                        Date.now() - cachedEntry.timestamp < TREE_STATUS_PREVIEW_TTL_MS
                    ) {
                        return cachedEntry.response;
                    }

                    const relativeTarget = path.relative(repoRoot, absoluteTarget).replace(/\\/g, '/');
                    const statusResult = await gitService.executeRaw(
                        repoRoot,
                        'status --porcelain=1 --ignored=matching --untracked-files=all'
                    );
                    const response = {
                        success: true,
                        isRepository: true,
                        repoRoot,
                        targetPath: absoluteTarget,
                        refreshedAt: Date.now(),
                        entries: buildTreeStatusPreviewEntries(
                            parsePorcelainEntries(statusResult.stdout ?? ''),
                            relativeTarget
                        ),
                    };
                    gitTreeStatusPreviewCache.set(cacheKey, {
                        response,
                        timestamp: Date.now(),
                    });
                    return response;
                } catch (error) {
                    return {
                        success: false,
                        isRepository: false,
                        entries: [],
                        error: getErrorMessage(error as Error),
                    };
                }
            },
            {
                defaultValue: { success: false, isRepository: false, entries: [] },
                argsSchema: gitTreeStatusPreviewArgsSchema,
                responseSchema: gitTreeStatusPreviewResponseSchema,
            }
        )
    );

    ipcMain.handle('git:getRemotes', createValidatedIpcHandler('git:getRemotes', async (event, cwd: string) => {
        validateSender(event);
        try {
            const result = await gitService.executeRaw(cwd, 'remote -v');
            if (result.success && result.stdout) {
                return { success: true, remotes: parseRemotes(result.stdout) };
            }
            return { success: true, remotes: [] };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error), remotes: [] };
        }
    }, {
        defaultValue: { success: false, remotes: [] },
        argsSchema: z.tuple([CwdSchema])
    }));

    ipcMain.handle('git:getTrackingInfo', createValidatedIpcHandler('git:getTrackingInfo', async (event, cwd: string) => {
        validateSender(event);
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
    }, {
        defaultValue: { success: true, tracking: null, ahead: 0, behind: 0 },
        argsSchema: z.tuple([CwdSchema])
    }));
}

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
function registerHistoryHandlers(gitService: GitService, validateSender: SenderValidator) {
    ipcMain.handle('git:getRecentCommits', createValidatedIpcHandler('git:getRecentCommits', async (event, cwd: string, count?: number) => {
        validateSender(event);
        const result = await gitService.getLog(cwd, count || 10);
        return { success: true, commits: result };
    }, {
        defaultValue: { success: false, commits: [] },
        argsSchema: z.tuple([CwdSchema, CountSchema(MAX_COMMIT_COUNT)])
    }));

    ipcMain.handle('git:getCommitStats', createValidatedIpcHandler('git:getCommitStats', async (event, cwd: string, days?: number) => {
        validateSender(event);
        const result = await gitService.executeRaw(
            cwd,
            `log --since="${days || 30} days ago" --pretty=format:"%ad" --date=short`
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
    }, {
        defaultValue: { success: false, commitCounts: {} },
        argsSchema: z.tuple([CwdSchema, CountSchema(MAX_STATS_DAYS)])
    }));
}

/**
 * Registers IPC handlers for diff viewing, staging, and unstaging
 * @param gitService - Git service instance for executing git commands
 */
function registerDiffHandlers(gitService: GitService, validateSender: SenderValidator) {
    ipcMain.handle('git:getFileDiff', createValidatedIpcHandler('git:getFileDiff', async (event, cwd: string, filePath: string, staged?: boolean) => {
        validateSender(event);
        const result = await gitService.getFileDiff(cwd, filePath, staged === true);
        return result;
    }, {
        defaultValue: { original: '', modified: '', success: false, error: 'Failed to get diff' },
        argsSchema: z.tuple([CwdSchema, PathSchema, z.boolean().optional()])
    }));

    ipcMain.handle('git:getUnifiedDiff', createValidatedIpcHandler('git:getUnifiedDiff', async (event, cwd: string, filePath: string, staged?: boolean) => {
        validateSender(event);
        const result = await gitService.getUnifiedDiff(cwd, filePath, staged === true);
        return result;
    }, {
        defaultValue: { diff: '', success: false, error: 'Failed to get unified diff' },
        argsSchema: z.tuple([CwdSchema, PathSchema, z.boolean().optional()])
    }));

    ipcMain.handle('git:getCommitDiff', createValidatedIpcHandler('git:getCommitDiff', async (event, cwd: string, hash: string) => {
        validateSender(event);
        const result = await gitService.getCommitDiff(cwd, hash);
        return result;
    }, {
        defaultValue: { diff: '', success: false, error: 'Failed to get commit diff' },
        argsSchema: z.tuple([CwdSchema, HashSchema])
    }));

    ipcMain.handle('git:stageFile', createValidatedIpcHandler('git:stageFile', async (event, cwd: string, filePath: string) => {
        validateSender(event);
        const result = await withRateLimit('git', () => gitService.stageFile(cwd, filePath));
        return { success: result.success, error: result.error };
    }, {
        defaultValue: { success: false, error: 'Failed to stage file' },
        argsSchema: z.tuple([CwdSchema, PathSchema])
    }));

    ipcMain.handle('git:unstageFile', createValidatedIpcHandler('git:unstageFile', async (event, cwd: string, filePath: string) => {
        validateSender(event);
        const result = await withRateLimit('git', () => gitService.unstageFile(cwd, filePath));
        return { success: result.success, error: result.error };
    }, {
        defaultValue: { success: false, error: 'Failed to unstage file' },
        argsSchema: z.tuple([CwdSchema, PathSchema])
    }));

    ipcMain.handle('git:getDetailedStatus', createValidatedIpcHandler('git:getDetailedStatus', async (event, cwd: string) => {
        validateSender(event);
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
    }, {
        defaultValue: { success: false, stagedFiles: [], unstagedFiles: [], allFiles: [] },
        argsSchema: z.tuple([CwdSchema])
    }));

    ipcMain.handle('git:getDiffStats', createValidatedIpcHandler('git:getDiffStats', async (event, cwd: string) => {
        validateSender(event);
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
        defaultValue: {
            success: false,
            staged: { added: 0, deleted: 0, files: 0 },
            unstaged: { added: 0, deleted: 0, files: 0 },
            total: { added: 0, deleted: 0, files: 0 },
        },
        argsSchema: z.tuple([CwdSchema])
    }));
}

/**
 * Registers IPC handlers for git actions (checkout, commit, push, pull)
 * @param gitService - Git service instance for executing git commands
 */
function registerActionHandlers(gitService: GitService, validateSender: SenderValidator) {
    ipcMain.handle('git:checkout', createValidatedIpcHandler('git:checkout', async (event, cwd: string, branch: string) => {
        validateSender(event);
        const result = await withRateLimit('git', () => gitService.checkout(cwd, branch));
        return { success: result.success, error: result.error };
    }, {
        defaultValue: { success: false, error: 'Failed to checkout branch' },
        argsSchema: z.tuple([CwdSchema, BranchSchema])
    }));

    ipcMain.handle('git:commit', createValidatedIpcHandler('git:commit', async (event, cwd: string, message: string) => {
        validateSender(event);
        const result = await withRateLimit('git', () => gitService.commit(cwd, message));
        return { success: result.success, error: result.error };
    }, {
        defaultValue: { success: false, error: 'Failed to commit' },
        argsSchema: z.tuple([CwdSchema, CommitMessageSchema])
    }));

    ipcMain.handle('git:push', createValidatedIpcHandler('git:push', async (event, cwd: string, remoteRaw?: string, branchRaw?: string) => {
        validateSender(event);
        const remote = remoteRaw ?? 'origin';
        let branch = branchRaw;
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
            gitService.push(cwd, remote, branch as string)
        );
        return {
            success: result.success,
            error: result.error,
            stdout: result.stdout,
            stderr: result.stderr,
        };
    }, {
        defaultValue: { success: false, error: 'Failed to push', stdout: undefined, stderr: undefined },
        argsSchema: z.tuple([CwdSchema, BranchSchema.optional(), BranchSchema.optional()])
    }));

    ipcMain.handle('git:pull', createValidatedIpcHandler('git:pull', async (event, cwd: string) => {
        validateSender(event);
        const result = await withRateLimit('git', () => gitService.pull(cwd));
        return {
            success: result.success,
            error: result.error,
            stdout: result.stdout,
            stderr: result.stderr,
        };
    }, {
        defaultValue: { success: false, error: 'Failed to pull', stdout: undefined, stderr: undefined },
        argsSchema: z.tuple([CwdSchema])
    }));
}
