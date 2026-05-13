/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import { isAbsolute,join, relative, resolve } from 'path';
import { promisify } from 'util';

import { ipc } from '@main/core/ipc-decorators';
import { BaseService } from '@main/services/base.service';
import { LLMService } from '@main/services/llm/llm.service';
import { withOperationGuard } from '@main/utils/operation-wrapper.util';
import { GIT_CHANNELS } from '@shared/constants';
import { getErrorMessage } from '@shared/utils/error.util';
import { z } from 'zod';

import { AuthService } from '../security/auth.service';

type UnsafeValue = ReturnType<typeof JSON.parse>;

const execFileAsync = promisify(execFile);

// --- Constants ---
const MAX_PATH_LENGTH = 4096;
const MAX_BRANCH_LENGTH = 255;
const TREE_STATUS_PREVIEW_TTL_MS = 30_000;
const CONFLICT_STATUSES = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU']);
const SUPPORTED_HOOKS = ['pre-commit', 'commit-msg', 'pre-push', 'post-merge', 'pre-rebase'] as const;
const HOOK_TEMPLATES: Record<string, string> = {
    'pre-commit': '#!/usr/bin/env sh\n# Prevent committing TODO markers\nif git diff --cached --name-only | xargs grep -n "TODO" >/dev/null 2>&1; then\n  echo "Found TODO markers in staged files."\n  exit 1\nfi\n',
    'commit-msg': '#!/usr/bin/env sh\n# Enforce minimum commit message length\nmsg_file="$1"\nif [ -z "$msg_file" ] || [ ! -f "$msg_file" ]; then\n  exit 0\nfi\nmsg=$(cat "$msg_file")\nif [ ${#msg} -lt 8 ]; then\n  echo "Commit message must be at least 8 characters."\n  exit 1\nfi\n',
    'pre-push': '#!/usr/bin/env sh\n# Run tests before pushing\nnpm test\n',
    'post-merge': '#!/usr/bin/env sh\n# Refresh dependencies on merge\nif [ -f package-lock.json ]; then\n  npm install --ignore-scripts\nfi\n',
    'pre-rebase': '#!/usr/bin/env sh\n# Block rebasing protected branches\nbranch=$(git rev-parse --abbrev-ref HEAD)\nif [ "$branch" = "main" ]; then\n  echo "Do not rebase main directly."\n  exit 1\nfi\n',
};
const CONTROLLED_COMMAND_ALLOWLIST: RegExp[] = [
    /^rebase(?:\s|$)/,
    /^submodule(?:\s|$)/,
    /^stash(?:\s|$)/,
    /^merge(?:\s|$)/,
];

// --- Schemas ---
const BranchSchema = z.string().min(1).max(MAX_BRANCH_LENGTH).regex(/^[^\s~^:?*\\[\]]+$/).trim();
const PathSchema = z.string().min(1).max(MAX_PATH_LENGTH).trim();
const SimpleArgSchema = z.string().max(MAX_PATH_LENGTH);
const ControlledCommandSchema = z.string().max(1024).regex(/^[a-zA-Z0-9\s-]+$/);
const OperationIdSchema = z.string().uuid().or(z.string().min(1));

interface GitExecutionOptions {
    timeoutMs?: number;
    operationId?: string;
}

interface GitExecutionResult {
    success: boolean;
    stdout?: string;
    stderr?: string;
    error?: string;
    timedOut?: boolean;
    cancelled?: boolean;
    lockRecoveryGuidance?: string;
}

export class GitService extends BaseService {
    static readonly serviceName = 'gitService';
    static readonly dependencies = ['llmService', 'authService'] as const;
    private readonly DEFAULT_TIMEOUT_MS = 60000;
    private readonly MIN_TIMEOUT_MS = 1000;
    private readonly MAX_TIMEOUT_MS = 600000;
    private readonly activeOperations = new Map<string, AbortController>();
    private readonly treeStatusPreviewCache = new Map<string, { response: UnsafeValue; timestamp: number }>();

    constructor(
        private readonly llmService?: LLMService,
        private readonly authService?: AuthService
    ) {
        super('GitService');
    }

    private normalizeGitPath(value: string): string {
        return value.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+$/, '');
    }

    private buildTreeStatusPreviewEntries(
        entries: Array<{ status: string; path: string; isIgnored: boolean }>,
        relativeTargetPath: string
    ): Array<{ path: string; statuses: string[]; isDirectory: boolean; isIgnored: boolean }> {
        const normalizedTargetPath = this.normalizeGitPath(
            relativeTargetPath === '.' ? '' : relativeTargetPath
        );
        const previewEntries = new Map<
            string,
            { statuses: string[]; isDirectory: boolean; isIgnored: boolean }
        >();

        for (const entry of entries) {
            const normalizedEntryPath = this.normalizeGitPath(entry.path);
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

    private explainConflictStatus(status: string): string {
        switch (status) {
            case 'DD':
                return 'Both branches deleted this file.';
            case 'AU':
                return 'Added by us, changed by them.';
            case 'UD':
                return 'Changed by us, deleted by them.';
            case 'UA':
                return 'Changed by them, added by us.';
            case 'DU':
                return 'Deleted by us, changed by them.';
            case 'AA':
                return 'Both branches added this file.';
            case 'UU':
                return 'Both branches modified this file.';
            default:
                return 'Unmerged conflict state.';
        }
    }

    private async parseConflicts(cwd: string) {
        const statusResult = await this.executeRaw(cwd, 'status --porcelain=1');
        if (!statusResult.success || !statusResult.stdout) {
            return [];
        }

        return statusResult.stdout
            .split('\n')
            .map(line => line.trimEnd())
            .filter(line => line.length >= 4)
            .map(line => {
                const status = line.slice(0, 2);
                const filePath = line.slice(3).trim();
                return { status, path: filePath };
            })
            .filter(entry => CONFLICT_STATUSES.has(entry.status))
            .map(entry => ({
                ...entry,
                explanation: this.explainConflictStatus(entry.status),
            }));
    }

    private async getGitDirPath(cwd: string): Promise<string | null> {
        const gitDirResult = await this.executeRaw(cwd, 'rev-parse --git-dir');
        if (!gitDirResult.success || !gitDirResult.stdout) {
            return null;
        }
        const rawGitDir = gitDirResult.stdout.trim();
        return isAbsolute(rawGitDir) ? rawGitDir : join(cwd, rawGitDir);
    }

    private async getRebaseStatusInternal(cwd: string) {
        const conflicts = await this.parseConflicts(cwd);
        const rebaseHead = await this.executeRaw(cwd, 'rev-parse --verify REBASE_HEAD');
        const inRebase = rebaseHead.success;
        const currentBranchResult = await this.executeRaw(cwd, 'rev-parse --abbrev-ref HEAD');

        return {
            success: true,
            inRebase,
            currentBranch:
                currentBranchResult.success && currentBranchResult.stdout
                    ? currentBranchResult.stdout.trim()
                    : null,
            conflictCount: conflicts.length,
            conflicts,
        };
    }

    private shellEscapeQuoted(value: string): string {
        if (/[\0\r\n`]/.test(value)) {
            throw new Error('Invalid git argument');
        }
        return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    @ipc(GIT_CHANNELS.GET_CONFLICTS)
    async getConflicts(cwd: string) {
        const conflicts = await this.parseConflicts(cwd);
        const analytics = conflicts.reduce<Record<string, number>>((acc, item) => {
            acc[item.status] = (acc[item.status] ?? 0) + 1;
            return acc;
        }, {});

        return { success: true, conflicts, analytics };
    }

    @ipc(GIT_CHANNELS.RESOLVE_CONFLICT)
    async resolveConflict(cwd: string, filePath: string, strategy: 'ours' | 'theirs' | 'manual') {
        const safePath = this.shellEscapeQuoted(filePath);
        if (strategy === 'ours') {
            await withOperationGuard('git', () =>
                this.executeRaw(cwd, `checkout --ours -- "${safePath}"`)
            );
        } else if (strategy === 'theirs') {
            await withOperationGuard('git', () =>
                this.executeRaw(cwd, `checkout --theirs -- "${safePath}"`)
            );
        }

        const addResult = await withOperationGuard('git', () =>
            this.executeRaw(cwd, `add -- "${safePath}"`)
        );
        return { success: addResult.success, error: addResult.error };
    }

    @ipc(GIT_CHANNELS.OPEN_MERGE_TOOL)
    async openMergeTool(cwd: string, filePath?: string) {
        const command = filePath
            ? `mergetool -- "${this.shellEscapeQuoted(filePath)}"`
            : 'mergetool';
        const result = await withOperationGuard('git', () => this.executeRaw(cwd, command));
        return {
            success: result.success,
            stdout: result.stdout,
            stderr: result.stderr,
            error: result.error,
        };
    }

    @ipc(GIT_CHANNELS.GET_STASHES)
    async getStashes(cwd: string) {
        const result = await this.executeRaw(
            cwd,
            'stash list --date=iso --pretty=format:"%gd|%H|%an|%aI|%s"'
        );
        if (!result.success || !result.stdout) {
            return { success: true, stashes: [] };
        }

        const stashes = result.stdout
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
                const [ref, hash, author, date, ...subjectParts] = line.split('|');
                return {
                    ref,
                    hash,
                    author,
                    date,
                    subject: subjectParts.join('|'),
                };
            });

        return { success: true, stashes };
    }

    @ipc(GIT_CHANNELS.CREATE_STASH)
    async createStash(cwd: string, message?: string, includeUntracked?: boolean) {
        const msg = message ? message.trim() : '';
        const messageArg = msg ? ` -m "${this.shellEscapeQuoted(msg)}"` : '';
        const untrackedArg = includeUntracked ? ' -u' : '';
        const result = await withOperationGuard('git', () =>
            this.executeRaw(cwd, `stash push${untrackedArg}${messageArg}`)
        );
        return { success: result.success, error: result.error, stdout: result.stdout };
    }

    @ipc(GIT_CHANNELS.APPLY_STASH)
    async applyStash(cwd: string, stashRef: string, pop?: boolean) {
        const command = pop ? `stash pop ${stashRef}` : `stash apply ${stashRef}`;
        const result = await withOperationGuard('git', () => this.executeRaw(cwd, command));
        return {
            success: result.success,
            error: result.error,
            stdout: result.stdout,
            stderr: result.stderr,
        };
    }

    @ipc(GIT_CHANNELS.DROP_STASH)
    async dropStash(cwd: string, stashRef: string) {
        const result = await withOperationGuard('git', () =>
            this.executeRaw(cwd, `stash drop ${stashRef}`)
        );
        return { success: result.success, error: result.error, stdout: result.stdout };
    }

    @ipc(GIT_CHANNELS.EXPORT_STASH)
    async exportStash(cwd: string, stashRef: string) {
        const result = await this.executeRaw(cwd, `stash show -p ${stashRef}`);
        return { success: result.success, patch: result.stdout ?? '', error: result.error };
    }

    @ipc(GIT_CHANNELS.GET_REMOTES)
    async getRemotes(cwd: string) {
        try {
            const result = await this.executeRaw(cwd, 'remote -v');
            if (result.success && result.stdout) {
                return { success: true, remotes: this.parseRemotes(result.stdout) };
            }
            return { success: true, remotes: [] };
        } catch (error) {
            this.logError(`Failed to get remotes for ${cwd}`, error as Error);
            return { success: false, error: (error as Error).message };
        }
    }

    @ipc(GIT_CHANNELS.GET_TRACKING_INFO)
    async getTrackingInfo(cwd: string) {
        const branchResult = await this.executeRaw(cwd, 'rev-parse --abbrev-ref HEAD');
        if (!branchResult.success || !branchResult.stdout) {
            return { success: true, tracking: null, ahead: 0, behind: 0 };
        }

        const branch = branchResult.stdout.trim();
        const trackingResult = await this.executeRaw(
            cwd,
            `rev-parse --abbrev-ref ${branch}@{upstream}`
        );

        if (!trackingResult.success || !trackingResult.stdout) {
            return { success: true, tracking: null, ahead: 0, behind: 0 };
        }

        const tracking = trackingResult.stdout.trim();
        const countsResult = await this.executeRaw(
            cwd,
            `rev-list --left-right --count ${branch}...${tracking}`
        );
        return this.parseTrackingCounts(countsResult, tracking);
    }

    @ipc(GIT_CHANNELS.GET_FILE_DIFF)
    async getFileDiff(mountPath: string, filePath: string, staged: boolean = false) {
        try {
            // Find the actual repository root
            let repoRoot: string;
            try {
                const rootResult = await this.executeRaw(mountPath, 'rev-parse --show-toplevel');
                if (!rootResult.success || !rootResult.stdout) {
                    return { success: false, error: 'Not a git repository' };
                }
                repoRoot = rootResult.stdout.trim();
            } catch (e) {
                return { success: false, error: 'Not a git repository' };
            }

            const cwd = repoRoot;

            // For git show, the path must be relative to the repository root.
            const headResult = await this.executeRaw(cwd, `show HEAD:"${filePath}"`);

            return {
                success: headResult.success,
                original: headResult.stdout ?? '',
                modified: ''
            };
        } catch (error) {
            this.logError(`Failed to get file diff for ${filePath}`, error as Error);
            return { success: false, error: (error as Error).message };
        }
    }

    @ipc(GIT_CHANNELS.GET_DETAILED_STATUS)
    async getDetailedStatus(mountPath: string) {
        try {
            // Find the actual repository root
            let repoRoot: string;
            try {
                const rootResult = await this.executeRaw(mountPath, 'rev-parse --show-toplevel');
                if (!rootResult.success || !rootResult.stdout) {
                    return { success: false, error: 'Not a git repository' };
                }
                repoRoot = rootResult.stdout.trim();
            } catch (e) {
                return { success: false, error: 'Not a git repository' };
            }

            const cwd = repoRoot;
            const stagedResult = await this.executeRaw(cwd, 'diff --cached --name-status');
            const unstagedResult = await this.executeRaw(cwd, 'diff --name-status');
            const untrackedResult = await this.executeRaw(cwd, 'ls-files --others --exclude-standard');

            const parseStatus = (output: string, staged: boolean): Array<{ status: string; path: string; staged: boolean }> => {
                if (!output) {return [];}
                return output.split(/\r?\n/).filter(line => line.trim()).map(line => {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 2) {
                        return { status: parts[0], path: parts[1], staged };
                    }
                    return { status: staged ? 'A' : '??', path: parts[0], staged };
                });
            };

            const stagedFiles = parseStatus(stagedResult.stdout || '', true);
            const unstagedFiles = parseStatus(unstagedResult.stdout || '', false);
            const untrackedFiles = (untrackedResult.stdout || '').split(/\r?\n/).filter(l => l.trim()).map(p => ({
                status: '??',
                path: p.trim(),
                staged: false
            }));

            const allFiles = [...stagedFiles, ...unstagedFiles, ...untrackedFiles];

            return {
                success: true,
                staged: stagedFiles,
                unstaged: unstagedFiles,
                untracked: untrackedFiles,
                allFiles,
                stagedFiles,
                unstagedFiles: [...unstagedFiles, ...untrackedFiles]
            };
        } catch (error) {
            this.logError(`Failed to get detailed status for ${mountPath}`, error as Error);
            return { success: false, error: (error as Error).message };
        }
    }

    @ipc(GIT_CHANNELS.GET_DIFF_STATS)
    async getDiffStats(cwd: string) {
        const stagedResult = await this.executeRaw(cwd, 'diff --cached --numstat');
        const unstagedResult = await this.executeRaw(cwd, 'diff --numstat');

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
    }

    @ipc({ 
        channel: GIT_CHANNELS.GET_BRANCH, 
        isBatchable: true,
        argsSchema: z.tuple([PathSchema]),
        defaultValue: { success: false, error: 'Not a git repository' }
    })
    async getBranch(cwd: string) {
        try {
            const result = await this.executeRaw(cwd, 'rev-parse --abbrev-ref HEAD');
            if (result.success && result.stdout) {
                return { success: true, branch: result.stdout.trim() };
            }
            return { success: false, error: 'Not a git repository' };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    @ipc({ 
        channel: GIT_CHANNELS.GET_LAST_COMMIT, 
        isBatchable: true,
        argsSchema: z.tuple([PathSchema]),
        defaultValue: { success: false, error: 'No commits found' }
    })
    async getLastCommit(cwd: string) {
        try {
            const result = await this.executeRaw(
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
    }

    @ipc(GIT_CHANNELS.GET_BLAME)
    async getBlame(cwd: string, filePath: string, lineNumber?: number) {
        try {
            const command = lineNumber !== undefined
                ? `blame -L ${lineNumber},${lineNumber} --porcelain -- "${filePath}"`
                : `blame --line-porcelain -- "${filePath}"`;

            const result = await this.executeRaw(cwd, command);
            if (!result.success || !result.stdout) {
                return { success: false, lines: [], error: result.error ?? 'No blame output' };
            }

            const lines = result.stdout.split('\n');
            const blameLines: Array<{
                lineNumber: number;
                commit: string;
                author: string;
                authorTime: string;
                summary: string;
                content: string;
            }> = [];

            let currentCommit = '';
            let currentLineNumber = 0;
            let currentAuthor = '';
            let currentTime = '';
            let currentSummary = '';

            for (const line of lines) {
                if (/^[0-9a-f]{8,40}\s+\d+\s+\d+/.test(line)) {
                    const headerParts = line.split(' ');
                    currentCommit = headerParts[0] ?? '';
                    currentLineNumber = Number(headerParts[2] ?? '0');
                    currentAuthor = '';
                    currentTime = '';
                    currentSummary = '';
                    continue;
                }

                if (line.startsWith('author ')) {
                    currentAuthor = line.slice('author '.length);
                    continue;
                }

                if (line.startsWith('author-time ')) {
                    const timestamp = Number(line.slice('author-time '.length));
                    currentTime = Number.isFinite(timestamp)
                        ? new Date(timestamp * 1000).toLocaleDateString()
                        : '';
                    continue;
                }

                if (line.startsWith('summary ')) {
                    currentSummary = line.slice('summary '.length);
                    continue;
                }

                if (line.startsWith('\t')) {
                    blameLines.push({
                        lineNumber: currentLineNumber,
                        commit: currentCommit,
                        author: currentAuthor,
                        authorTime: currentTime,
                        summary: currentSummary,
                        content: line.slice(1),
                    });
                }
            }

            return { success: true, lines: blameLines };
        } catch (error) {
            return { success: false, lines: [], error: (error as Error).message };
        }
    }

    @ipc(GIT_CHANNELS.GET_COMMIT_DETAILS)
    async getCommitDetails(cwd: string, hash: string) {
        const detailsResult = await this.executeRaw(
            cwd,
            `show -s --format="%H%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%b" ${hash}`
        );

        if (!detailsResult.success || !detailsResult.stdout) {
            return { success: false, error: detailsResult.error ?? 'Commit not found' };
        }

        const [commitHash, author, email, date, subject, body] =
            detailsResult.stdout.split('\x1f');
        const filesResult = await this.executeRaw(
            cwd,
            `show --name-only --pretty=format: ${hash}`
        );
        const files = (filesResult.stdout ?? '')
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean);

        return {
            success: true,
            details: {
                hash: commitHash,
                author,
                email,
                date,
                subject,
                body,
                files,
            },
        };
    }

    @ipc(GIT_CHANNELS.GET_REBASE_STATUS)
    async getRebaseStatus(cwd: string) {
        return this.getRebaseStatusInternal(cwd);
    }

    @ipc(GIT_CHANNELS.GET_REBASE_PLAN)
    async getRebasePlan(cwd: string, baseBranch: string) {
        const result = await this.executeRaw(
            cwd,
            `log --reverse --pretty=format:"%H|%s|%an|%aI" ${baseBranch}..HEAD`
        );

        if (!result.success || !result.stdout) {
            return { success: true, commits: [] };
        }

        const commits = result.stdout
            .split('\n')
            .filter(Boolean)
            .map(line => {
                const [hash, subject, author, date] = line.split('|');
                return { hash, subject, author, date, action: 'pick' as const };
            });

        return { success: true, commits };
    }

    @ipc(GIT_CHANNELS.GET_SUBMODULES)
    async getSubmodules(cwd: string) {
        const statusResult = await this.executeRaw(cwd, 'submodule status --recursive');
        const configResult = await this.executeRaw(
            cwd,
            'config -f .gitmodules --get-regexp "^submodule\\..*\\.(path|url|branch)$"'
        );
        
        const parseSubmoduleConfig = (output: string): Record<string, { path?: string; url?: string; branch?: string }> => {
            const map: Record<string, { path?: string; url?: string; branch?: string }> = {};
            const lines = output.split('\n').filter(Boolean);

            for (const line of lines) {
                const [key, value] = line.split('=').map(part => part.trim());
                if (!key || !value) {
                    continue;
                }

                const match = key.match(/^submodule\.(.+)\.(path|url|branch)$/);
                if (!match) {
                    continue;
                }

                const name = match[1];
                const field = match[2] as 'path' | 'url' | 'branch';
                map[name] = map[name] ?? {};
                map[name][field] = value;
            }

            return map;
        };

        const configMap = parseSubmoduleConfig(configResult.stdout ?? '');

        if (!statusResult.success || !statusResult.stdout) {
            return { success: true, submodules: [] };
        }

        const submodules = statusResult.stdout
            .split('\n')
            .filter(Boolean)
            .map(line => {
                const prefix = line[0] ?? ' ';
                const normalized = line.slice(1).trim();
                const [hash, pathPart, ...rest] = normalized.split(' ');
                const descriptor = rest.join(' ').trim();
                const byName = Object.values(configMap).find(item => item.path === pathPart);

                return {
                    path: pathPart,
                    hash,
                    state: prefix,
                    descriptor,
                    url: byName?.url ?? '',
                    branch: byName?.branch ?? '',
                };
            });

        return { success: true, submodules };
    }

    @ipc(GIT_CHANNELS.GET_TREE_STATUS)
    async getTreeStatus(cwd: string, targetPath?: string) {
        try {
            const rootResult = await this.executeRaw(cwd, 'rev-parse --show-toplevel');
            if (!rootResult.success || !rootResult.stdout) {
                return { success: true, isRepository: false, entries: [] };
            }

            const repoRoot = rootResult.stdout.trim();
            const absoluteTarget = resolve(targetPath || cwd);
            const relativeTarget = relative(repoRoot, absoluteTarget).replace(/\\/g, '/');
            const targetArg =
                relativeTarget && relativeTarget !== '.' ? ` -- "${relativeTarget}"` : '';
            const statusResult = await this.executeRaw(
                repoRoot,
                `status --porcelain=1 --ignored=matching --untracked-files=all${targetArg}`
            );

            const entries = this.parsePorcelainEntries(statusResult.stdout ?? '');

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
    }

    @ipc(GIT_CHANNELS.GET_TREE_STATUS_PREVIEW)
    async getTreeStatusPreview(cwd: string, targetPath?: string, options?: { refresh?: boolean }) {
        try {
            const rootResult = await this.executeRaw(cwd, 'rev-parse --show-toplevel');
            if (!rootResult.success || !rootResult.stdout) {
                return { success: true, isRepository: false, entries: [] };
            }

            const repoRoot = rootResult.stdout.trim();
            const absoluteTarget = resolve(targetPath || cwd);
            const cacheKey = `${repoRoot}::${absoluteTarget}`;
            const cachedEntry = this.treeStatusPreviewCache.get(cacheKey);
            if (
                options?.refresh !== true &&
                cachedEntry &&
                Date.now() - cachedEntry.timestamp < TREE_STATUS_PREVIEW_TTL_MS
            ) {
                return cachedEntry.response;
            }

            const relativeTarget = relative(repoRoot, absoluteTarget).replace(/\\/g, '/');
            const statusResult = await this.executeRaw(
                repoRoot,
                'status --porcelain=1 --ignored=matching --untracked-files=all'
            );
            const response = {
                success: true,
                isRepository: true,
                repoRoot,
                targetPath: absoluteTarget,
                refreshedAt: Date.now(),
                entries: this.buildTreeStatusPreviewEntries(
                    this.parsePorcelainEntries(statusResult.stdout ?? ''),
                    relativeTarget
                ),
            };
            this.treeStatusPreviewCache.set(cacheKey, {
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
    }

    @ipc(GIT_CHANNELS.GET_GITHUB_DATA)
    async getGitHubData(repoUrl: string, type: 'pulls' | 'issues') {
        try {
            if (!this.authService) {
                return { success: false, error: 'AuthService not available' };
            }

            // Parse GitHub URL
            // Examples:
            // https://github.com/owner/repo.git
            // git@github.com:owner/repo.git
            const githubRegex = /(?:https:\/\/github\.com\/|git@github\.com:)([^/]+)\/([^/.]+)(?:\.git)?/;
            const match = repoUrl.match(githubRegex);

            if (!match) {
                return { success: false, error: 'Not a GitHub repository' };
            }

            const owner = match[1];
            const repo = match[2];

            // Get copilot token
            const account = await this.authService.getActiveAccountFull('copilot');
            if (!account?.accessToken) {
                return { success: false, error: 'No active Copilot account found' };
            }

            const url = `https://api.github.com/repos/${owner}/${repo}/${type}?state=open&per_page=50`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `token ${account.accessToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Tengra-AI-Assistant'
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                return { success: false, error: `GitHub API error: ${errorData.message || response.statusText}` };
            }

            const data = await response.json();
            return { success: true, data };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    @ipc(GIT_CHANNELS.GET_GITHUB_PR_DETAILS)
    async getGitHubPrDetails(repoUrl: string, prNumber: number) {
        try {
            if (!this.authService) {
                return { success: false, error: 'AuthService not available' };
            }

            const githubRegex = /(?:https:\/\/github\.com\/|git@github\.com:)([^/]+)\/([^/.]+)(?:\.git)?/;
            const match = repoUrl.match(githubRegex);
            if (!match) {
                return { success: false, error: 'Not a GitHub repository' };
            }

            const [_, owner, repo] = match;
            const account = await this.authService.getActiveAccountFull('copilot');
            if (!account?.accessToken) {
                return { success: false, error: 'No active Copilot account' };
            }

            const headers = {
                'Authorization': `token ${account.accessToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Tengra-AI-Assistant'
            };

            const [prResponse, filesResponse, commentsResponse, reviewsResponse] = await Promise.all([
                fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, { headers }),
                fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`, { headers }),
                fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`, { headers }),
                fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, { headers })
            ]);

            if (!prResponse.ok) {
                return { success: false, error: `GitHub API error: ${prResponse.statusText}` };
            }

            const pr = await prResponse.json();
            
            // Fetch checks for the head commit
            const checksResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${pr.head.sha}/check-runs`, { headers });
            const checks = checksResponse.ok ? await checksResponse.json() : { check_runs: [] };

            const [files, comments, reviews] = await Promise.all([
                filesResponse.ok ? filesResponse.json() : [],
                commentsResponse.ok ? commentsResponse.json() : [],
                reviewsResponse.ok ? reviewsResponse.json() : []
            ]);

            return { success: true, data: { pr, files, comments, reviews, checks: checks.check_runs } };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    @ipc(GIT_CHANNELS.UPDATE_GITHUB_PR_STATE)
    async updateGitHubPrState(repoUrl: string, prNumber: number, state: 'open' | 'closed') {
        try {
            if (!this.authService) {
                return { success: false, error: 'AuthService not available' };
            }

            const githubRegex = /(?:https:\/\/github\.com\/|git@github\.com:)([^/]+)\/([^/.]+)(?:\.git)?/;
            const match = repoUrl.match(githubRegex);
            if (!match) {
                return { success: false, error: 'Not a GitHub repository' };
            }

            const [_, owner, repo] = match;
            const account = await this.authService.getActiveAccountFull('copilot');
            if (!account?.accessToken) {
                return { success: false, error: 'No active Copilot account' };
            }

            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${account.accessToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Tengra-AI-Assistant'
                },
                body: JSON.stringify({ state })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                return { success: false, error: `GitHub API error: ${errorData.message || response.statusText}` };
            }

            const data = await response.json();
            return { success: true, data };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    @ipc(GIT_CHANNELS.MERGE_GITHUB_PR)
    async mergeGitHubPr(repoUrl: string, prNumber: number) {
        try {
            if (!this.authService) {
                return { success: false, error: 'AuthService not available' };
            }

            const githubRegex = /(?:https:\/\/github\.com\/|git@github\.com:)([^/]+)\/([^/.]+)(?:\.git)?/;
            const match = repoUrl.match(githubRegex);
            if (!match) {
                return { success: false, error: 'Not a GitHub repository' };
            }

            const [_, owner, repo] = match;
            const account = await this.authService.getActiveAccountFull('copilot');
            if (!account?.accessToken) {
                return { success: false, error: 'No active Copilot account' };
            }

            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/merge`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${account.accessToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Tengra-AI-Assistant'
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                return { success: false, error: `GitHub API error: ${errorData.message || response.statusText}` };
            }

            const data = await response.json();
            return { success: true, data };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    @ipc(GIT_CHANNELS.APPROVE_GITHUB_PR)
    async approveGitHubPr(repoUrl: string, prNumber: number) {
        try {
            if (!this.authService) {
                return { success: false, error: 'AuthService not available' };
            }

            const githubRegex = /(?:https:\/\/github\.com\/|git@github\.com:)([^/]+)\/([^/.]+)(?:\.git)?/;
            const match = repoUrl.match(githubRegex);
            if (!match) {
                return { success: false, error: 'Not a GitHub repository' };
            }

            const [_, owner, repo] = match;
            const account = await this.authService.getActiveAccountFull('copilot');
            if (!account?.accessToken) {
                return { success: false, error: 'No active Copilot account' };
            }

            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, {
                method: 'POST',
                headers: {
                    'Authorization': `token ${account.accessToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Tengra-AI-Assistant'
                },
                body: JSON.stringify({ event: 'APPROVE', body: 'Approved via Tengra AI Assistant' })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                return { success: false, error: `GitHub API error: ${errorData.message || response.statusText}` };
            }

            const data = await response.json();
            return { success: true, data };
        } catch (error) {
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    private tokenizeCommand(command: string): string[] {
        const tokens: string[] = [];
        let current = '';
        let inSingle = false;
        let inDouble = false;
        let escaping = false;

        for (const char of command) {
            if (escaping) {
                current += char;
                escaping = false;
                continue;
            }

            if (char === '\\' && inDouble) {
                escaping = true;
                continue;
            }

            if (char === '\'' && !inDouble) {
                inSingle = !inSingle;
                continue;
            }

            if (char === '"' && !inSingle) {
                inDouble = !inDouble;
                continue;
            }

            if (/\s/.test(char) && !inSingle && !inDouble) {
                if (current.length > 0) {
                    tokens.push(current);
                    current = '';
                }
                continue;
            }

            current += char;
        }

        if (current.length > 0) {
            tokens.push(current);
        }
        return tokens;
    }

    private normalizeTimeoutMs(timeoutMs?: number): number {
        if (!Number.isFinite(timeoutMs)) {
            return this.DEFAULT_TIMEOUT_MS;
        }
        const normalizedTimeout = Math.trunc(timeoutMs ?? this.DEFAULT_TIMEOUT_MS);
        return Math.max(this.MIN_TIMEOUT_MS, Math.min(normalizedTimeout, this.MAX_TIMEOUT_MS));
    }

    private getRepositoryLockGuidance(cwd: string): string {
        const lockPath = join(cwd, '.git', 'index.lock');
        return [
            'Repository appears locked by another Git process.',
            '1) Ensure no Git command is still running for this repo.',
            `2) If no process is running, remove lock file: ${lockPath}`,
            '3) Retry the operation.',
        ].join(' ');
    }

    private decorateGitError(error: string, cwd: string): Pick<GitExecutionResult, 'error' | 'lockRecoveryGuidance'> {
        const looksLikeLockError =
            error.includes('index.lock') ||
            error.includes('Unable to create') ||
            error.includes('could not lock');

        if (!looksLikeLockError) {
            return { error };
        }

        const lockRecoveryGuidance = this.getRepositoryLockGuidance(cwd);
        return {
            error: `${error} ${lockRecoveryGuidance}`,
            lockRecoveryGuidance,
        };
    }

    cancelOperation(operationId: string): boolean {
        const normalizedOperationId = operationId.trim();
        if (!normalizedOperationId) {
            return false;
        }
        const controller = this.activeOperations.get(normalizedOperationId);
        if (!controller) {
            return false;
        }
        controller.abort();
        this.activeOperations.delete(normalizedOperationId);
        return true;
    }
    @ipc(GIT_CHANNELS.GET_STAGED_DIFF)
    async getStagedDiff(cwd: string) {
        const { stdout, success, error } = await this.executeArgs(['diff', '--staged'], cwd);
        return { success, diff: stdout ?? '', error };
    }


    private async executeArgs(args: string[], cwd: string, options?: GitExecutionOptions): Promise<GitExecutionResult> {
        const timeoutMs = this.normalizeTimeoutMs(options?.timeoutMs);
        const operationId = options?.operationId?.trim();
        const controller = new AbortController();

        if (operationId) {
            if (this.activeOperations.has(operationId)) {
                return { success: false, error: `Operation already running: ${operationId}` };
            }
            this.activeOperations.set(operationId, controller);
        }

        try {
            const { stdout, stderr } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
                execFile(
                    'git',
                    args,
                    {
                        cwd,
                        shell: false,
                        maxBuffer: 10 * 1024 * 1024,
                        timeout: timeoutMs,
                        signal: controller.signal,
                    },
                    (error, out, err) => {
                        if (error) {
                            reject(error);
                            return;
                        }
                        resolve({ stdout: out, stderr: err });
                    }
                );
            });
            return { success: true, stdout, stderr };
        } catch (error) {
            const baseError = getErrorMessage(error);
            if (controller.signal.aborted) {
                return {
                    success: false,
                    error: `Git operation cancelled${operationId ? `: ${operationId}` : ''}`,
                    cancelled: true,
                };
            }
            const isTimedOut = baseError.includes('timed out');
            const decorated = this.decorateGitError(baseError, cwd);
            return { success: false, ...decorated, timedOut: isTimedOut };
        } finally {
            if (operationId) {
                this.activeOperations.delete(operationId);
            }
        }
    }

    private async execute(command: string, cwd: string, options?: GitExecutionOptions) {
        const args = this.tokenizeCommand(command);
        return await this.executeArgs(args, cwd, options);
    }

    @ipc({
        channel: GIT_CHANNELS.GET_STATUS,
        isBatchable: true,
        argsSchema: z.tuple([PathSchema]),
        defaultValue: { success: false, isClean: false, changes: 0, files: [] }
    })
    async getStatus(cwd: string) {
        const { stdout, success, error } = await this.execute('status --short', cwd);
        if (!success) {
            return { success: false, error: error || 'Failed to get status' };
        }
        if (!stdout) {
            return { success: true, isClean: true, changes: 0, files: [] };
        }

        const files = stdout.split('\n')
            .filter(line => line.trim())
            .map(line => {
                const status = line.substring(0, 2);
                const path = line.substring(3).trim();
                return { path, status };
            });

        return {
            success: true,
            isClean: files.length === 0,
            changes: files.length,
            files,
        };
    }

    @ipc(GIT_CHANNELS.ADD)
    async add(cwd: string, files: string = '.') {
        return await this.executeArgs(['add', '--', files], cwd);
    }

    @ipc(GIT_CHANNELS.COMMIT)
    async commit(cwd: string, message: string) {
        return await this.executeArgs(['commit', '-m', message], cwd);
    }

    @ipc(GIT_CHANNELS.PUSH)
    async push(cwd: string, remote: string = 'origin', branch: string = 'main') {
        return await this.executeArgs(['push', remote, branch], cwd);
    }

    @ipc(GIT_CHANNELS.PULL)
    async pull(cwd: string) {
        return await this.execute('pull', cwd);
    }

    @ipc({
        channel: GIT_CHANNELS.GET_RECENT_COMMITS,
        argsSchema: z.tuple([PathSchema, z.number().int().optional(), z.number().int().optional()]),
        defaultValue: { success: true, commits: [] }
    })
    async getRecentCommits(cwd: string, count: number = 10, skip: number = 0) {
        const safeCwd = cwd?.trim();
        if (!safeCwd) {
            return { success: true, commits: [] };
        }

        const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 10;
        const safeSkip = Number.isFinite(skip) && skip >= 0 ? Math.floor(skip) : 0;
        
        const args = ['log', '-n', `${safeCount}`, '--skip', `${safeSkip}`, '--pretty=format:%h|%s|%an|%cI'];
        const { stdout, success, error } = await this.executeArgs(args, safeCwd);
        if (!success) {
            return { success: false, commits: [], error };
        }
        if (!stdout) {
            return { success: true, commits: [] };
        }

        const commits = stdout.split('\n')
            .filter(Boolean)
            .map(line => {
                const [hash, message, author, date] = line.split('|');
                return { hash, message, author, date };
            });
        
        return { success: true, commits };
    }

    @ipc(GIT_CHANNELS.GET_COMMIT_DIFF)
    async getCommitDiff(cwd: string, hash: string): Promise<{ diff: string; success: boolean; error?: string }> {
        try {
            const { stdout, stderr, success } = await this.execute(`show ${hash}`, cwd);
            if (!success && stderr && !stdout) {
                return { diff: '', success: false, error: stderr };
            }
            return { diff: stdout ?? '', success: true };
        } catch (error) {
            return { diff: '', success: false, error: getErrorMessage(error as Error) };
        }
    }

    @ipc({
        channel: GIT_CHANNELS.GET_BRANCHES,
        isBatchable: true,
        argsSchema: z.tuple([PathSchema]),
        defaultValue: { success: true, branches: [] }
    })
    async getBranches(cwd: string) {
        const result = await this.executeRaw(
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
    }

    @ipc({
        channel: GIT_CHANNELS.GET_FILE_HISTORY,
        argsSchema: z.tuple([PathSchema, PathSchema, z.number().int().optional()]),
        defaultValue: { success: false, commits: [] }
    })
    async getFileHistory(cwd: string, filePath: string, limit: number = 20) {
        const safeCwd = cwd?.trim();
        if (!safeCwd || !filePath) {
            return { success: true, commits: [] };
        }

        const { stdout, success, error } = await this.executeArgs(
            ['log', '-n', `${limit}`, '--pretty=format:%h|%s|%an|%ar|%cI', '--', filePath],
            safeCwd
        );
        if (!success) {
            return { success: false, commits: [], error };
        }
        if (!stdout) {
            return { success: true, commits: [] };
        }

        const commits = stdout.split('\n')
            .filter(line => line.trim())
            .map(line => {
                const [hash, message, author, relativeTime, date] = line.split('|');
                return { hash, message, author, relativeTime, date };
            });

        return { success: true, commits };
    }

    @ipc({
        channel: GIT_CHANNELS.COMPARE_REFS,
        argsSchema: z.tuple([PathSchema, BranchSchema, BranchSchema]),
        defaultValue: { ahead: 0, behind: 0, files: [], success: false }
    })
    async compareRefs(cwd: string, base: string, head: string) {
        const countsResult = await this.executeArgs(['rev-list', '--left-right', '--count', `${base}...${head}`], cwd);
        const diffResult = await this.executeArgs(['diff', '--name-status', `${base}...${head}`], cwd);

        let ahead = 0;
        let behind = 0;
        if (countsResult.success && countsResult.stdout) {
            const parts = countsResult.stdout.trim().split(/[ \t]/).filter(Boolean);
            behind = parseInt(parts[0] || '0', 10);
            ahead = parseInt(parts[1] || '0', 10);
        }

        const files: Array<{ status: string; path: string }> = [];
        if (diffResult.success && diffResult.stdout) {
            diffResult.stdout.split('\n').filter(l => l.trim()).forEach(line => {
                const parts = line.split('\t');
                const status = parts[0];
                const path = parts[1];
                if (status && path) {files.push({ status, path });}
            });
        }

        return { ahead, behind, files, success: true };
    }

    @ipc({
        channel: GIT_CHANNELS.GET_HOTSPOTS,
        argsSchema: z.tuple([PathSchema, z.number().int().optional(), z.number().int().optional()]),
        defaultValue: { success: false, hotspots: [] }
    })
    async getHotspots(cwd: string, limit: number = 10, days: number = 30) {
        const result = await this.executeArgs(
            ['log', `--since=${days} days ago`, '--pretty=format:', '--name-only'],
            cwd
        );

        if (!result.success || !result.stdout) {
            return { success: true, hotspots: [] };
        }

        const counts: Record<string, number> = {};
        result.stdout.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .forEach(file => {
                counts[file] = (counts[file] ?? 0) + 1;
            });

        const hotspots = Object.entries(counts)
            .map(([path, count]) => ({ path, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);

        return { success: true, hotspots };
    }

    @ipc(GIT_CHANNELS.CHECKOUT)
    async checkout(cwd: string, branch: string) {
        return await this.executeArgs(['checkout', branch], cwd);
    }

    @ipc({
        channel: GIT_CHANNELS.CREATE_BRANCH,
        argsSchema: z.tuple([PathSchema, BranchSchema, z.string().optional()]),
        defaultValue: { success: false, error: 'Failed to create branch' }
    })
    async createBranch(cwd: string, name: string, startPoint?: string) {
        const args = ['checkout', '-b', name];
        if (startPoint) {
            args.push(startPoint);
        }
        return await this.executeArgs(args, cwd);
    }

    @ipc({
        channel: GIT_CHANNELS.DELETE_BRANCH,
        argsSchema: z.tuple([PathSchema, BranchSchema, z.boolean().optional()]),
        defaultValue: { success: false, error: 'Failed to delete branch' }
    })
    async deleteBranch(cwd: string, name: string, force: boolean = false) {
        const flag = force ? '-D' : '-d';
        return await this.executeArgs(['branch', flag, name], cwd);
    }

    @ipc({
        channel: GIT_CHANNELS.RENAME_BRANCH,
        argsSchema: z.tuple([PathSchema, BranchSchema, BranchSchema]),
        defaultValue: { success: false, error: 'Failed to rename branch' }
    })
    async renameBranch(cwd: string, oldName: string, newName: string) {
        return await this.executeArgs(['branch', '-m', oldName, newName], cwd);
    }

    @ipc({
        channel: GIT_CHANNELS.SET_UPSTREAM,
        argsSchema: z.tuple([PathSchema, BranchSchema, SimpleArgSchema, BranchSchema]),
        defaultValue: { success: false, error: 'Failed to set upstream' }
    })
    async setUpstream(cwd: string, branch: string, remote: string, upstreamBranch: string) {
        return await this.executeArgs(['branch', '--set-upstream-to', `${remote}/${upstreamBranch}`, branch], cwd);
    }

    @ipc(GIT_CHANNELS.EXECUTE_RAW)
    async executeRaw(cwd: string, command: string, options?: GitExecutionOptions) {
        return await this.execute(command, cwd, options);
    }



    private async getFallbackDiff(cwd: string, filePath: string, staged: boolean): Promise<{ original: string; modified: string; success: boolean }> {
        if (staged) {
            const contentResult = await this.execute(`show : "${filePath}"`, cwd);
            if (contentResult.success && contentResult.stdout) {
                return { original: '', modified: contentResult.stdout, success: true };
            }
        }

        const fullPath = join(cwd, filePath);
        try {
            const currentContent = await fs.readFile(fullPath, 'utf8');
            const headResult = await this.execute(`show HEAD: "${filePath}"`, cwd);

            return {
                original: (headResult.success && headResult.stdout) ? headResult.stdout : '',
                modified: currentContent,
                success: true
            };
        } catch {
            return { original: '', modified: '', success: false };
        }
    }

    private parseUnifiedDiff(stdout: string): { original: string; modified: string; success: boolean } {
        const lines = stdout.split('\n');
        let original = '';
        let modified = '';
        let isContent = false;

        for (const line of lines) {
            if (line.startsWith('@@')) {
                isContent = true;
                continue;
            }
            if (!isContent || line.startsWith('---') || line.startsWith('+++')) {
                continue;
            }

            const { o, m } = this.processDiffLine(line);
            original += o;
            modified += m;
        }

        return { original: original.trim(), modified: modified.trim(), success: true };
    }

    private processDiffLine(line: string): { o: string, m: string } {
        if (line.startsWith('-') && !line.startsWith('--')) {
            return { o: line.substring(1) + '\n', m: '' };
        } else if (line.startsWith('+') && !line.startsWith('++')) {
            return { o: '', m: line.substring(1) + '\n' };
        } else if (line.startsWith(' ')) {
            const context = line.substring(1) + '\n';
            return { o: context, m: context };
        }
        return { o: '', m: '' };
    }

    @ipc(GIT_CHANNELS.GET_UNIFIED_DIFF)
    async getUnifiedDiff(cwd: string, filePath: string, staged: boolean = false): Promise<{ diff: string; success: boolean; error?: string }> {
        try {
            const command = staged ? `diff --cached -- "${filePath}"` : `diff -- "${filePath}"`;

            const { stdout, stderr, success } = await this.execute(command, cwd);

            if (!success && stderr && !stdout) {
                // File might be newly added - return empty diff for now
                return { diff: '', success: true };
            }

            return { diff: stdout ?? '', success: true };
        } catch (error) {
            return { diff: '', success: false, error: getErrorMessage(error) };
        }
    }

    @ipc({
        channel: GIT_CHANNELS.STAGE_FILE,
        argsSchema: z.tuple([PathSchema, PathSchema]),
        defaultValue: { success: false, error: 'Failed to stage file' }
    })
    async stageFile(cwd: string, filePath: string) {
        return await withOperationGuard('git', () => this.executeArgs(['add', '--', filePath], cwd));
    }

    @ipc({
        channel: GIT_CHANNELS.UNSTAGE_FILE,
        argsSchema: z.tuple([PathSchema, PathSchema]),
        defaultValue: { success: false, error: 'Failed to unstage file' }
    })
    async unstageFile(cwd: string, filePath: string) {
        return await withOperationGuard('git', () => this.executeArgs(['reset', 'HEAD', '--', filePath], cwd));
    }

    @ipc(GIT_CHANNELS.STAGE_ALL)
    async stageAll(cwd: string) {
        return await withOperationGuard('git', () => this.executeArgs(['add', '-A'], cwd));
    }

    @ipc(GIT_CHANNELS.UNSTAGE_ALL)
    async unstageAll(cwd: string) {
        return await withOperationGuard('git', () => this.executeArgs(['reset', 'HEAD', '--', '.'], cwd));
    }

    @ipc(GIT_CHANNELS.GET_FLOW_STATUS)
    async getFlowStatus(cwd: string) {
        const currentBranchResult = await this.executeRaw(cwd, 'rev-parse --abbrev-ref HEAD');
        const branchListResult = await this.executeRaw(
            cwd,
            'for-each-ref --format="%(refname:short)" refs/heads'
        );
        const currentBranch =
            currentBranchResult.success && currentBranchResult.stdout
                ? currentBranchResult.stdout.trim()
                : '';
        const branches = (branchListResult.stdout ?? '').split('\n').filter(Boolean);
        const byType = {
            feature: branches.filter(name => name.startsWith('feature/')),
            release: branches.filter(name => name.startsWith('release/')),
            hotfix: branches.filter(name => name.startsWith('hotfix/')),
            support: branches.filter(name => name.startsWith('support/')),
        };

        return { success: true, currentBranch, byType, branches };
    }

    @ipc(GIT_CHANNELS.START_FLOW_BRANCH)
    async startFlowBranch(cwd: string, type: 'feature' | 'release' | 'hotfix' | 'support', name: string, base: string = 'develop') {
        const branchName = `${type}/${name.replace(/\s+/g, '-')}`;
        const checkoutBase = await withOperationGuard('git', () =>
            this.executeRaw(cwd, `checkout ${base}`)
        );
        if (!checkoutBase.success) {
            return {
                success: false,
                error: checkoutBase.error ?? 'Failed to checkout base branch',
            };
        }

        const createBranchResult = await withOperationGuard('git', () =>
            this.executeRaw(cwd, `checkout -b ${branchName}`)
        );
        return { success: createBranchResult.success, branch: branchName, error: createBranchResult.error };
    }

    @ipc(GIT_CHANNELS.FINISH_FLOW_BRANCH)
    async finishFlowBranch(cwd: string, branch: string, target: string = 'develop', shouldDelete: boolean = true) {
        const checkoutTarget = await withOperationGuard('git', () =>
            this.executeRaw(cwd, `checkout ${target}`)
        );
        if (!checkoutTarget.success) {
            return {
                success: false,
                error: checkoutTarget.error ?? 'Failed to checkout target branch',
            };
        }

        const mergeResult = await withOperationGuard('git', () =>
            this.executeRaw(cwd, `merge --no-ff ${branch}`)
        );
        if (!mergeResult.success) {
            return { success: false, error: mergeResult.error ?? 'Merge failed' };
        }

        if (shouldDelete) {
            await withOperationGuard('git', () => this.executeRaw(cwd, `branch -d ${branch}`));
        }

        return { success: true };
    }

    @ipc(GIT_CHANNELS.GET_HOOKS)
    async getHooks(cwd: string) {
        const hooks = await this.listHooks(cwd);
        return {
            success: true,
            hooks,
            templates: SUPPORTED_HOOKS,
        };
    }

    @ipc(GIT_CHANNELS.INSTALL_HOOK)
    async installHook(cwd: string, hookName: typeof SUPPORTED_HOOKS[number], templateRaw?: string) {
        const gitDir = await this.getGitDirPath(cwd);
        if (!gitDir) {
            throw new Error('Not a git repository');
        }

        const hooksDir = join(gitDir, 'hooks');
        await fs.mkdir(hooksDir, { recursive: true });
        const hookPath = join(hooksDir, hookName);
        const template =
            typeof templateRaw === 'string' && templateRaw.trim().length > 0
                ? templateRaw
                : HOOK_TEMPLATES[hookName] ?? '#!/usr/bin/env sh\n';

        await fs.writeFile(hookPath, template, 'utf8');
        await fs.chmod(hookPath, 0o755);

        return { success: true, hookPath };
    }

    @ipc(GIT_CHANNELS.VALIDATE_HOOK)
    async validateHook(cwd: string, hookName: typeof SUPPORTED_HOOKS[number]) {
        const gitDir = await this.getGitDirPath(cwd);
        if (!gitDir) {
            throw new Error('Not a git repository');
        }

        const hookPath = join(gitDir, 'hooks', hookName);
        const stat = await fs.stat(hookPath);
        const content = await fs.readFile(hookPath, 'utf8');
        const hasShebang = content.startsWith('#!');
        const executable = (stat.mode & 0o111) > 0;

        return {
            success: true,
            validation: {
                hookName,
                hasShebang,
                executable,
                valid: hasShebang && executable,
            },
        };
    }

    @ipc(GIT_CHANNELS.TEST_HOOK)
    async testHook(cwd: string, hookName: typeof SUPPORTED_HOOKS[number]) {
        const gitDir = await this.getGitDirPath(cwd);
        if (!gitDir) {
            throw new Error('Not a git repository');
        }

        const hookPath = join(gitDir, 'hooks', hookName);
        try {
            const { stdout, stderr } = await execFileAsync(hookPath, [], { cwd });
            return { success: true, stdout, stderr };
        } catch (error) {
            return {
                success: false,
                stdout: '',
                stderr: getErrorMessage(error as Error),
                error: getErrorMessage(error as Error),
            };
        }
    }

    @ipc(GIT_CHANNELS.GET_REPOSITORY_STATS)
    async getRepositoryStats(cwd: string, days?: number) {
        const safeDays =
            Number.isFinite(days) && (days as number) > 0 ? Math.min(Math.trunc(days as number), 3650) : 365;
        const windowArg = `--since="${safeDays} days ago"`;

        const [totalCommitsResult, authorsResult, filesResult, activityResult] =
            await Promise.all([
                this.executeRaw(cwd, 'rev-list --count HEAD'),
                this.executeRaw(cwd, `shortlog -sne ${windowArg}`),
                this.executeRaw(cwd, `log ${windowArg} --pretty=format: --name-only`),
                this.executeRaw(
                    cwd,
                    `log ${windowArg} --pretty=format:"%ad" --date=short`
                ),
            ]);

        const totalCommits = Number(totalCommitsResult.stdout?.trim() ?? '0') || 0;

        const authorStats = (authorsResult.stdout ?? '')
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => {
                const match = line.match(/^(\d+)\s+(.+)$/);
                return {
                    commits: Number(match?.[1] ?? '0'),
                    author: match?.[2] ?? line,
                };
            })
            .filter(item => item.commits > 0);

        const fileCounts: Record<string, number> = {};
        for (const file of (filesResult.stdout ?? '')
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)) {
            fileCounts[file] = (fileCounts[file] ?? 0) + 1;
        }

        const fileStats = Object.entries(fileCounts)
            .map(([file, commits]) => ({ file, commits }))
            .sort((a, b) => b.commits - a.commits)
            .slice(0, 50);

        const activity: Record<string, number> = {};
        for (const day of (activityResult.stdout ?? '')
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)) {
            activity[day] = (activity[day] ?? 0) + 1;
        }

        return {
            success: true,
            stats: {
                totalCommits,
                authorStats,
                fileStats,
                activity,
                generatedAt: new Date().toISOString(),
                days: safeDays,
            },
        };
    }

    @ipc(GIT_CHANNELS.EXPORT_REPOSITORY_STATS)
    async exportRepositoryStats(cwd: string, days?: number) {
        const safeDays =
            Number.isFinite(days) && (days as number) > 0 ? Math.min(Math.trunc(days as number), 3650) : 365;
        const result = await this.executeRaw(
            cwd,
            `shortlog -sne --since="${safeDays} days ago"`
        );

        return {
            success: true,
            export: {
                generatedAt: new Date().toISOString(),
                days: safeDays,
                authorsCsv: this.parseAuthorsCsv(result.stdout ?? ''),
            },
        };
    }

    @ipc(GIT_CHANNELS.GENERATE_PR_SUMMARY)
    async generatePrSummary(cwd: string, base: string, head: string) {
        try {
            if (!this.llmService) {
                return { success: false, error: 'PR summary generation is unavailable' };
            }

            const diffResult = await this.executeRaw(cwd, `diff --unified=3 ${base}...${head}`);
            if (!diffResult.success || !diffResult.stdout) {
                return { success: false, error: 'Failed to get diff for PR summary' };
            }

            const logResult = await this.executeRaw(cwd, `log ${base}...${head} --oneline`);
            
            const prompt = `Generate a concise and professional Pull Request summary based on the following git diff and commit messages. 
Summary should include:
- A clear title
- High-level overview of changes
- Key features/fixes
- Potential impacts

Commit Messages:
${logResult.stdout || 'No commit messages found'}

Diff:
${diffResult.stdout.substring(0, 20000)} // Limiting diff size for LLM
`;

            const response = await this.llmService.chat([
                { role: 'system', content: 'You are an expert software engineer generating Pull Request summaries.' },
                { role: 'user', content: prompt }
            ], '');

            return { success: true, summary: response.content };
        } catch (error) {
            this.logError(`Failed to generate PR summary: ${getErrorMessage(error as Error)}`);
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }

    @ipc({
        channel: GIT_CHANNELS.RUN_CONTROLLED_OPERATION,
        argsSchema: z.tuple([PathSchema, ControlledCommandSchema, OperationIdSchema.optional(), z.number().int().min(1000).max(600000).optional()]),
        defaultValue: { success: false, error: 'Failed to run controlled operation' }
    })
    async runControlledOperation(cwd: string, command: string, operationId?: string, timeoutMs?: number) {
        if (!this.isControlledCommandAllowed(command)) {
            return {
                success: false,
                error: 'Operation is not allowed for controlled execution',
            };
        }

        return await withOperationGuard('git', () =>
            this.executeRaw(cwd, command, { operationId, timeoutMs })
        );
    }

    @ipc(GIT_CHANNELS.CANCEL_OPERATION)
    ipcCancelOperation(operationId: string) {
        const cancelled = this.cancelOperation(operationId);
        return {
            success: cancelled,
            error: cancelled ? undefined : 'Operation not found',
        };
    }

    private async listHooks(cwd: string) {
        const gitDir = await this.getGitDirPath(cwd);
        if (!gitDir) {
            return [];
        }

        const hooksDir = join(gitDir, 'hooks');
        try {
            const entries = await fs.readdir(hooksDir, { withFileTypes: true });
            const hooks = await Promise.all(
                entries
                    .filter(entry => entry.isFile() && !entry.name.endsWith('.sample'))
                    .map(async entry => {
                        const filePath = join(hooksDir, entry.name);
                        const stat = await fs.stat(filePath);
                        const content = await fs.readFile(filePath, 'utf8');
                        const hasShebang = content.startsWith('#!');
                        const executable = (stat.mode & 0o111) > 0;

                        return {
                            name: entry.name,
                            path: filePath,
                            executable,
                            hasShebang,
                            size: stat.size,
                            updatedAt: stat.mtime.toISOString(),
                        };
                    })
            );

            return hooks;
        } catch {
            return [];
        }
    }

    private parseAuthorsCsv(shortlogOutput: string): string {
        const rows = shortlogOutput
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => {
                const match = line.match(/^(\d+)\s+(.+)$/);
                const commits = match?.[1] ?? '0';
                const author = (match?.[2] ?? line).replace(/"/g, '""');
                return `${commits},"${author}"`;
            });
        return ['commits,author', ...rows].join('\n');
    }

    private isControlledCommandAllowed(command: string): boolean {
        return CONTROLLED_COMMAND_ALLOWLIST.some(pattern => pattern.test(command));
    }

    @ipc({
        channel: GIT_CHANNELS.IS_REPOSITORY,
        argsSchema: z.tuple([PathSchema]),
        defaultValue: { success: true, isRepository: false }
    })
    async isRepository(cwd: string) {
        const result = await this.executeRaw(cwd, 'rev-parse --git-dir');
        return { success: true, isRepository: result.success };
    }

    private parseTrackingCounts(countsResult: UnsafeValue, tracking: string) {
        if (!countsResult.success || !countsResult.stdout) {
            return { success: true, tracking, ahead: 0, behind: 0 };
        }
        const [ahead, behind] = countsResult.stdout.trim().split(/\s+/).map(Number);
        return { success: true, tracking, ahead: ahead || 0, behind: behind || 0 };
    }

    private parsePorcelainEntries(stdout: string) {
        if (!stdout) {
            return [];
        }
        return stdout
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
                const status = line.substring(0, 2);
                const path = line.substring(3).trim();
                const isIgnored = status === '!!';
                return { status, path, isIgnored };
            });
    }

    @ipc(GIT_CHANNELS.GET_COMMIT_STATS)
    async getCommitStats(cwd: string, days: number = 30) {
        const result = await this.executeRaw(
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
    }

    private parseRemotes(stdout: string) {
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

}

