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
import path from 'path';
import { promisify } from 'util';

import { SenderValidator } from '@main/ipc/sender-validator';
import { appLogger } from '@main/logging/logger';
import { BrainService } from '@main/services/llm/brain.service';
import { LLMService } from '@main/services/llm/llm.service';
import { GitService } from '@main/services/workspace/git.service';
import { createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';
import { withOperationGuard } from '@main/utils/operation-wrapper.util';
import { getErrorMessage } from '@shared/utils/error.util';
import { ipcMain } from 'electron';
import { z } from 'zod';

const execFileAsync = promisify(execFile);

const CONFLICT_STATUSES = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU']);
const SUPPORTED_HOOKS = ['pre-commit', 'commit-msg', 'pre-push', 'post-merge', 'pre-rebase'] as const;

const HOOK_TEMPLATES: Record<string, string> = {
    'pre-commit': '#!/usr/bin/env sh\n# Prevent committing TODO markers\nif git diff --cached --name-only | xargs grep -n "TODO" >/dev/null 2>&1; then\n  echo "Found TODO markers in staged files."\n  exit 1\nfi\n',
    'commit-msg': '#!/usr/bin/env sh\n# Enforce minimum commit message length\nmsg_file="$1"\nif [ -z "$msg_file" ] || [ ! -f "$msg_file" ]; then\n  exit 0\nfi\nmsg=$(cat "$msg_file")\nif [ ${#msg} -lt 8 ]; then\n  echo "Commit message must be at least 8 characters."\n  exit 1\nfi\n',
    'pre-push': '#!/usr/bin/env sh\n# Run tests before pushing\nnpm test\n',
    'post-merge': '#!/usr/bin/env sh\n# Refresh dependencies on merge\nif [ -f package-lock.json ]; then\n  npm install --ignore-scripts\nfi\n',
    'pre-rebase': '#!/usr/bin/env sh\n# Block rebasing protected branches\nbranch=$(git rev-parse --abbrev-ref HEAD)\nif [ "$branch" = "main" ]; then\n  echo "Do not rebase main directly."\n  exit 1\nfi\n',
};

// --- Schemas ---

const MAX_PATH_LENGTH = 4096;
const MAX_BRANCH_LENGTH = 255;
const PathSchema = z.string().min(1).max(MAX_PATH_LENGTH).trim();
const BranchSchema = z.string().min(1).max(MAX_BRANCH_LENGTH).regex(/^[^\s~^:?*\\[\]]+$/).trim();
const FilePathArgSchema = z.string().min(1).max(MAX_PATH_LENGTH).refine(v => !v.includes('\0') && !/[\r\n`]/.test(v), {
    message: 'Invalid file path characters'
});
const SimpleArgSchema = z.string().min(1).max(256).regex(/^[a-zA-Z0-9._/@:+-]+$/).trim();
const StashRefSchema = z.string().regex(/^stash@\{\d+\}$/);
const ConflictStrategySchema = z.enum(['ours', 'theirs', 'manual']);
const FlowTypeSchema = z.enum(['feature', 'release', 'hotfix', 'support']);
const HookNameSchema = z.enum(['pre-commit', 'commit-msg', 'pre-push', 'post-merge', 'pre-rebase']);
const OperationIdSchema = z.string().min(1).max(128).regex(/^[a-zA-Z0-9._:-]+$/).trim();
const ControlledCommandSchema = z.string().min(1).max(2048).trim();

const CONTROLLED_COMMAND_ALLOWLIST: RegExp[] = [
    /^rebase(?:\s|$)/,
    /^submodule(?:\s|$)/,
    /^stash(?:\s|$)/,
    /^merge(?:\s|$)/,
];

/**
 * Escapes a string for use in a double-quoted shell argument.
 */
function shellEscapeQuoted(value: string): string {
    if (/[\0\r\n`]/.test(value)) {
        throw new Error('Invalid git argument');
    }
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Returns a human-readable explanation for a git conflict status code.
 */
function explainConflictStatus(status: string): string {
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

/**
 * Parses git status --porcelain=1 for conflicts.
 */
async function parseConflicts(gitService: GitService, cwd: string) {
    const statusResult = await gitService.executeRaw(cwd, 'status --porcelain=1');
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
            explanation: explainConflictStatus(entry.status),
        }));
}

/**
 * Resolves the absolute path to the .git directory.
 */
async function getGitDirPath(gitService: GitService, cwd: string): Promise<string | null> {
    const gitDirResult = await gitService.executeRaw(cwd, 'rev-parse --git-dir');
    if (!gitDirResult.success || !gitDirResult.stdout) {
        return null;
    }
    const rawGitDir = gitDirResult.stdout.trim();
    return path.isAbsolute(rawGitDir) ? rawGitDir : path.join(cwd, rawGitDir);
}

/**
 * Returns the current rebase status of the repository.
 */
async function getRebaseStatus(gitService: GitService, cwd: string) {
    const conflicts = await parseConflicts(gitService, cwd);
    const rebaseHead = await gitService.executeRaw(cwd, 'rev-parse --verify REBASE_HEAD');
    const inRebase = rebaseHead.success;
    const currentBranchResult = await gitService.executeRaw(cwd, 'rev-parse --abbrev-ref HEAD');

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

/**
 * Parses submodule configuration from git config output.
 */
function parseSubmoduleConfig(output: string): Record<string, { path?: string; url?: string; branch?: string }> {
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
}

/**
 * Lists all active git hooks in the repository.
 */
async function listHooks(gitService: GitService, cwd: string) {
    const gitDir = await getGitDirPath(gitService, cwd);
    if (!gitDir) {
        return [];
    }

    const hooksDir = path.join(gitDir, 'hooks');
    try {
        const entries = await fs.readdir(hooksDir, { withFileTypes: true });
        const hooks = await Promise.all(
            entries
                .filter(entry => entry.isFile() && !entry.name.endsWith('.sample'))
                .map(async entry => {
                    const filePath = path.join(hooksDir, entry.name);
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

/**
 * Parses git shortlog output into a CSV string.
 */
function parseAuthorsCsv(shortlogOutput: string): string {
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

function isControlledCommandAllowed(command: string): boolean {
    return CONTROLLED_COMMAND_ALLOWLIST.some(pattern => pattern.test(command));
}

/**
 * Registers conflict-related IPC handlers.
 */
function registerConflictHandlers(gitService: GitService, validateSender: SenderValidator) {
    ipcMain.handle('git:getConflicts', createValidatedIpcHandler('git:getConflicts', async (event, cwd: string) => {
        validateSender(event);
        const conflicts = await parseConflicts(gitService, cwd);
        const analytics = conflicts.reduce<Record<string, number>>((acc, item) => {
            acc[item.status] = (acc[item.status] ?? 0) + 1;
            return acc;
        }, {});

        return { success: true, conflicts, analytics };
    }, {
        defaultValue: { success: false, conflicts: [], analytics: {} },
        argsSchema: z.tuple([PathSchema])
    }));

    ipcMain.handle('git:resolveConflict', createValidatedIpcHandler('git:resolveConflict', async (event, cwd: string, filePath: string, strategy: 'ours' | 'theirs' | 'manual') => {
        validateSender(event);
        const safePath = shellEscapeQuoted(filePath);
        if (strategy === 'ours') {
            await withOperationGuard('git', () =>
                gitService.executeRaw(cwd, `checkout --ours -- "${safePath}"`)
            );
        } else if (strategy === 'theirs') {
            await withOperationGuard('git', () =>
                gitService.executeRaw(cwd, `checkout --theirs -- "${safePath}"`)
            );
        }

        const addResult = await withOperationGuard('git', () =>
            gitService.executeRaw(cwd, `add -- "${safePath}"`)
        );
        return { success: addResult.success, error: addResult.error };
    }, {
        defaultValue: { success: false, error: 'Failed to resolve conflict' },
        argsSchema: z.tuple([PathSchema, FilePathArgSchema, ConflictStrategySchema])
    }));

    ipcMain.handle('git:openMergeTool', createValidatedIpcHandler('git:openMergeTool', async (event, cwd: string, filePath?: string) => {
        validateSender(event);
        const command = filePath
            ? `mergetool -- "${shellEscapeQuoted(filePath)}"`
            : 'mergetool';
        const result = await withOperationGuard('git', () => gitService.executeRaw(cwd, command));
        return {
            success: result.success,
            stdout: result.stdout,
            stderr: result.stderr,
            error: result.error,
        };
    }, {
        defaultValue: {
            success: false,
            stdout: undefined,
            stderr: undefined,
            error: 'Failed to launch merge tool',
        },
        argsSchema: z.tuple([PathSchema, FilePathArgSchema.optional()])
    }));
}

/**
 * Registers stash-related IPC handlers.
 */
function registerStashHandlers(gitService: GitService, validateSender: SenderValidator) {
    ipcMain.handle('git:getStashes', createValidatedIpcHandler('git:getStashes', async (event, cwd: string) => {
        validateSender(event);
        const result = await gitService.executeRaw(
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
    }, {
        defaultValue: { success: false, stashes: [] },
        argsSchema: z.tuple([PathSchema])
    }));

    ipcMain.handle('git:createStash', createValidatedIpcHandler('git:createStash', async (event, cwd: string, message?: string, includeUntracked?: boolean) => {
        validateSender(event);
        const msg = message ? message.trim() : '';
        const messageArg = msg ? ` -m "${shellEscapeQuoted(msg)}"` : '';
        const untrackedArg = includeUntracked ? ' -u' : '';
        const result = await withOperationGuard('git', () =>
            gitService.executeRaw(cwd, `stash push${untrackedArg}${messageArg}`)
        );
        return { success: result.success, error: result.error, stdout: result.stdout };
    }, {
        defaultValue: { success: false, error: 'Failed to create stash', stdout: undefined },
        argsSchema: z.tuple([PathSchema, z.string().optional(), z.boolean().optional()])
    }));

    ipcMain.handle('git:applyStash', createValidatedIpcHandler('git:applyStash', async (event, cwd: string, stashRef: string, pop?: boolean) => {
        validateSender(event);
        const command = pop ? `stash pop ${stashRef}` : `stash apply ${stashRef}`;
        const result = await withOperationGuard('git', () => gitService.executeRaw(cwd, command));
        return {
            success: result.success,
            error: result.error,
            stdout: result.stdout,
            stderr: result.stderr,
        };
    }, {
        defaultValue: {
            success: false,
            error: 'Failed to apply stash',
            stdout: undefined,
            stderr: undefined,
        },
        argsSchema: z.tuple([PathSchema, StashRefSchema, z.boolean().optional()])
    }));

    ipcMain.handle('git:dropStash', createValidatedIpcHandler('git:dropStash', async (event, cwd: string, stashRef: string) => {
        validateSender(event);
        const result = await withOperationGuard('git', () =>
            gitService.executeRaw(cwd, `stash drop ${stashRef}`)
        );
        return { success: result.success, error: result.error, stdout: result.stdout };
    }, {
        defaultValue: { success: false, error: 'Failed to drop stash', stdout: undefined },
        argsSchema: z.tuple([PathSchema, StashRefSchema])
    }));

    ipcMain.handle('git:exportStash', createValidatedIpcHandler('git:exportStash', async (event, cwd: string, stashRef: string) => {
        validateSender(event);
        const result = await gitService.executeRaw(cwd, `stash show -p ${stashRef}`);
        return { success: result.success, patch: result.stdout ?? '', error: result.error };
    }, {
        defaultValue: { success: false, patch: '', error: 'Failed to export stash' },
        argsSchema: z.tuple([PathSchema, StashRefSchema])
    }));
}

/**
 * Registers blame and commit detail IPC handlers.
 */
function registerBlameAndCommitHandlers(gitService: GitService, validateSender: SenderValidator) {
    ipcMain.handle('git:getBlame', createValidatedIpcHandler('git:getBlame', async (event, cwd: string, filePath: string) => {
        validateSender(event);
        const result = await gitService.executeRaw(
            cwd,
            `blame --line-porcelain -- "${shellEscapeQuoted(filePath)}"`
        );
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
                    ? new Date(timestamp * 1000).toISOString()
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
    }, {
        defaultValue: { success: false, lines: [] },
        argsSchema: z.tuple([PathSchema, FilePathArgSchema])
    }));

    ipcMain.handle('git:getCommitDetails', createValidatedIpcHandler('git:getCommitDetails', async (event, cwd: string, hash: string) => {
        validateSender(event);
        const detailsResult = await gitService.executeRaw(
            cwd,
            `show -s --format="%H%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%b" ${hash}`
        );

        if (!detailsResult.success || !detailsResult.stdout) {
            return { success: false, error: detailsResult.error ?? 'Commit not found' };
        }

        const [commitHash, author, email, date, subject, body] =
            detailsResult.stdout.split('\x1f');
        const filesResult = await gitService.executeRaw(
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
    }, {
        defaultValue: { success: false, error: 'Failed to fetch commit details' },
        argsSchema: z.tuple([PathSchema, SimpleArgSchema])
    }));
}

/**
 * Registers rebase-related IPC handlers.
 */
function registerRebaseHandlers(gitService: GitService, validateSender: SenderValidator) {
    ipcMain.handle('git:getRebaseStatus', createValidatedIpcHandler('git:getRebaseStatus', async (event, cwd: string) => {
        validateSender(event);
        return getRebaseStatus(gitService, cwd);
    }, {
        defaultValue: {
            success: false,
            inRebase: false,
            currentBranch: null,
            conflictCount: 0,
            conflicts: [],
        },
        argsSchema: z.tuple([PathSchema])
    }));

    ipcMain.handle('git:getRebasePlan', createValidatedIpcHandler('git:getRebasePlan', async (event, cwd: string, baseBranch: string) => {
        validateSender(event);
        const result = await gitService.executeRaw(
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
    }, {
        defaultValue: { success: false, commits: [] },
        argsSchema: z.tuple([PathSchema, SimpleArgSchema])
    }));



}

/**
 * Registers submodule-related IPC handlers.
 */
function registerSubmoduleHandlers(gitService: GitService, validateSender: SenderValidator) {
    ipcMain.handle('git:getSubmodules', createValidatedIpcHandler('git:getSubmodules', async (event, cwd: string) => {
        validateSender(event);
        const statusResult = await gitService.executeRaw(cwd, 'submodule status --recursive');
        const configResult = await gitService.executeRaw(
            cwd,
            'config -f .gitmodules --get-regexp "^submodule\\..*\\.(path|url|branch)$"'
        );
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
    }, {
        defaultValue: { success: false, submodules: [] },
        argsSchema: z.tuple([PathSchema])
    }));





}

/**
 * Registers git flow-related IPC handlers.
 */
function registerFlowHandlers(gitService: GitService, validateSender: SenderValidator) {
    ipcMain.handle('git:getFlowStatus', createValidatedIpcHandler('git:getFlowStatus', async (event, cwd: string) => {
        validateSender(event);
        const currentBranchResult = await gitService.executeRaw(cwd, 'rev-parse --abbrev-ref HEAD');
        const branchListResult = await gitService.executeRaw(
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
    }, {
        defaultValue: {
            success: false,
            currentBranch: '',
            byType: { feature: [], release: [], hotfix: [], support: [] },
            branches: [],
        },
        argsSchema: z.tuple([PathSchema])
    }));

    ipcMain.handle('git:startFlowBranch', createValidatedIpcHandler('git:startFlowBranch', async (event, cwd: string, type: 'feature' | 'release' | 'hotfix' | 'support', name: string, baseRaw?: string) => {
        validateSender(event);
        const base = baseRaw ?? 'develop';
        const branchName = `${type}/${name.replace(/\s+/g, '-')}`;
        const checkoutBase = await withOperationGuard('git', () =>
            gitService.executeRaw(cwd, `checkout ${base}`)
        );
        if (!checkoutBase.success) {
            return {
                success: false,
                error: checkoutBase.error ?? 'Failed to checkout base branch',
            };
        }

        const createBranchResult = await withOperationGuard('git', () =>
            gitService.executeRaw(cwd, `checkout -b ${branchName}`)
        );
        return { success: createBranchResult.success, branch: branchName, error: createBranchResult.error };
    }, {
        defaultValue: { success: false, error: 'Failed to start flow branch' },
        argsSchema: z.tuple([PathSchema, FlowTypeSchema, SimpleArgSchema, SimpleArgSchema.optional()])
    }));

    ipcMain.handle('git:finishFlowBranch', createValidatedIpcHandler('git:finishFlowBranch', async (event, cwd: string, branch: string, targetRaw?: string, deleteRaw?: boolean) => {
        validateSender(event);
        const target = targetRaw ?? 'develop';
        const shouldDelete = deleteRaw !== false;
        const checkoutTarget = await withOperationGuard('git', () =>
            gitService.executeRaw(cwd, `checkout ${target}`)
        );
        if (!checkoutTarget.success) {
            return {
                success: false,
                error: checkoutTarget.error ?? 'Failed to checkout target branch',
            };
        }

        const mergeResult = await withOperationGuard('git', () =>
            gitService.executeRaw(cwd, `merge --no-ff ${branch}`)
        );
        if (!mergeResult.success) {
            return { success: false, error: mergeResult.error ?? 'Merge failed' };
        }

        if (shouldDelete) {
            await withOperationGuard('git', () => gitService.executeRaw(cwd, `branch -d ${branch}`));
        }

        return { success: true };
    }, {
        defaultValue: { success: false, error: 'Failed to finish flow branch' },
        argsSchema: z.tuple([PathSchema, SimpleArgSchema, SimpleArgSchema.optional(), z.boolean().optional()])
    }));
}

/**
 * Registers git hook-related IPC handlers.
 */
function registerHookHandlers(gitService: GitService, validateSender: SenderValidator) {
    ipcMain.handle('git:getHooks', createValidatedIpcHandler('git:getHooks', async (event, cwd: string) => {
        validateSender(event);
        const hooks = await listHooks(gitService, cwd);
        return {
            success: true,
            hooks,
            templates: SUPPORTED_HOOKS,
        };
    }, {
        defaultValue: { success: false, hooks: [], templates: [...SUPPORTED_HOOKS] },
        argsSchema: z.tuple([PathSchema])
    }));

    ipcMain.handle('git:installHook', createValidatedIpcHandler('git:installHook', async (event, cwd: string, hookName: 'pre-commit' | 'commit-msg' | 'pre-push' | 'post-merge' | 'pre-rebase', templateRaw?: string) => {
        validateSender(event);
        const gitDir = await getGitDirPath(gitService, cwd);
        if (!gitDir) {
            throw new Error('Not a git repository');
        }

        const hooksDir = path.join(gitDir, 'hooks');
        await fs.mkdir(hooksDir, { recursive: true });
        const hookPath = path.join(hooksDir, hookName);
        const template =
            typeof templateRaw === 'string' && templateRaw.trim().length > 0
                ? templateRaw
                : HOOK_TEMPLATES[hookName] ?? '#!/usr/bin/env sh\n';

        await fs.writeFile(hookPath, template, 'utf8');
        await fs.chmod(hookPath, 0o755);

        return { success: true, hookPath };
    }, {
        defaultValue: { success: false, hookPath: '' },
        argsSchema: z.tuple([PathSchema, HookNameSchema, z.string().optional()])
    }));

    ipcMain.handle('git:validateHook', createValidatedIpcHandler('git:validateHook', async (event, cwd: string, hookName: 'pre-commit' | 'commit-msg' | 'pre-push' | 'post-merge' | 'pre-rebase') => {
        validateSender(event);
        const gitDir = await getGitDirPath(gitService, cwd);
        if (!gitDir) {
            throw new Error('Not a git repository');
        }

        const hookPath = path.join(gitDir, 'hooks', hookName);
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
    }, {
        defaultValue: {
            success: false,
            validation: { hookName: '', hasShebang: false, executable: false, valid: false },
        },
        argsSchema: z.tuple([PathSchema, HookNameSchema])
    }));

    ipcMain.handle('git:testHook', createValidatedIpcHandler('git:testHook', async (event, cwd: string, hookName: 'pre-commit' | 'commit-msg' | 'pre-push' | 'post-merge' | 'pre-rebase') => {
        validateSender(event);
        const gitDir = await getGitDirPath(gitService, cwd);
        if (!gitDir) {
            throw new Error('Not a git repository');
        }

        const hookPath = path.join(gitDir, 'hooks', hookName);
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
    }, {
        defaultValue: { success: false, stdout: '', stderr: '', error: 'Failed to test hook' },
        argsSchema: z.tuple([PathSchema, HookNameSchema])
    }));

}

/**
 * Registers repository stats IPC handlers.
 */
function registerStatsHandlers(gitService: GitService, validateSender: SenderValidator) {
    ipcMain.handle('git:getRepositoryStats', createValidatedIpcHandler('git:getRepositoryStats', async (event, cwd: string, daysRaw?: number) => {
        validateSender(event);
        const days = Number(daysRaw);
        const safeDays =
            Number.isFinite(days) && days > 0 ? Math.min(Math.trunc(days), 3650) : 365;
        const windowArg = `--since="${safeDays} days ago"`;

        const [totalCommitsResult, authorsResult, filesResult, activityResult] =
            await Promise.all([
                gitService.executeRaw(cwd, 'rev-list --count HEAD'),
                gitService.executeRaw(cwd, `shortlog -sne ${windowArg}`),
                gitService.executeRaw(cwd, `log ${windowArg} --pretty=format: --name-only`),
                gitService.executeRaw(
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
    }, {
        defaultValue: {
            success: false,
            stats: {
                totalCommits: 0,
                authorStats: [],
                fileStats: [],
                activity: {},
                generatedAt: '',
                days: 0,
            },
        },
        argsSchema: z.tuple([PathSchema, z.number().optional()])
    }));

    ipcMain.handle('git:exportRepositoryStats', createValidatedIpcHandler('git:exportRepositoryStats', async (event, cwd: string, daysRaw?: number) => {
        validateSender(event);
        const days = Number(daysRaw);
        const safeDays =
            Number.isFinite(days) && days > 0 ? Math.min(Math.trunc(days), 3650) : 365;
        const result = await gitService.executeRaw(
            cwd,
            `shortlog -sne --since="${safeDays} days ago"`
        );

        return {
            success: true,
            export: {
                generatedAt: new Date().toISOString(),
                days: safeDays,
                authorsCsv: parseAuthorsCsv(result.stdout ?? ''),
            },
        };
    }, {
        defaultValue: { success: false, export: { generatedAt: '', days: 0, authorsCsv: '' } },
        argsSchema: z.tuple([PathSchema, z.number().optional()])
    }));
}

/**
 * Registers IPC handlers for branch management
 */
function registerBranchHandlers(gitService: GitService, validateSender: SenderValidator) {
    ipcMain.handle('git:createBranch', createValidatedIpcHandler('git:createBranch', async (event, cwd: string, name: string, startPoint?: string) => {
        validateSender(event);
        return await gitService.createBranch(cwd, name, startPoint);
    }, {
        defaultValue: { success: false, error: 'Failed to create branch' },
        argsSchema: z.tuple([PathSchema, BranchSchema, z.string().optional()])
    }));

    ipcMain.handle('git:deleteBranch', createValidatedIpcHandler('git:deleteBranch', async (event, cwd: string, name: string, force: boolean = false) => {
        validateSender(event);
        return await gitService.deleteBranch(cwd, name, force);
    }, {
        defaultValue: { success: false, error: 'Failed to delete branch' },
        argsSchema: z.tuple([PathSchema, BranchSchema, z.boolean().optional()])
    }));

    ipcMain.handle('git:renameBranch', createValidatedIpcHandler('git:renameBranch', async (event, cwd: string, oldName: string, newName: string) => {
        validateSender(event);
        return await gitService.renameBranch(cwd, oldName, newName);
    }, {
        defaultValue: { success: false, error: 'Failed to rename branch' },
        argsSchema: z.tuple([PathSchema, BranchSchema, BranchSchema])
    }));

    ipcMain.handle('git:setUpstream', createValidatedIpcHandler('git:setUpstream', async (event, cwd: string, branch: string, remote: string, upstreamBranch: string) => {
        validateSender(event);
        return await gitService.setUpstream(cwd, branch, remote, upstreamBranch);
    }, {
        defaultValue: { success: false, error: 'Failed to set upstream' },
        argsSchema: z.tuple([PathSchema, BranchSchema, SimpleArgSchema, BranchSchema])
    }));
}

/**
 * Registers IPC handlers for Pull Requests
 */
const DEFAULT_PR_SUMMARY_MODEL = 'gpt-4o';

function registerPrHandlers(
    gitService: GitService,
    validateSender: SenderValidator,
    llmService?: Pick<LLMService, 'chat'>
) {
    ipcMain.handle('git:generatePrSummary', createValidatedIpcHandler('git:generatePrSummary', async (event, cwd: string, base: string, head: string) => {
        validateSender(event);
        try {
            if (!llmService) {
                return { success: false, error: 'PR summary generation is unavailable' };
            }

            // Get diff between head and base
            const diffResult = await gitService.executeRaw(cwd, `diff --unified=3 ${base}...${head}`);
            if (!diffResult.success || !diffResult.stdout) {
                return { success: false, error: 'Failed to get diff for PR summary' };
            }

            // Get recent commit messages
            const logResult = await gitService.executeRaw(cwd, `log ${base}...${head} --oneline`);
            
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

            const response = await llmService.chat([
                { role: 'system', content: 'You are an expert software engineer generating Pull Request summaries.' },
                { role: 'user', content: prompt }
            ], DEFAULT_PR_SUMMARY_MODEL);

            return { success: true, summary: response.content };
        } catch (error) {
            appLogger.error('GitAdvanced', 'Failed to generate PR summary', error as Error);
            return { success: false, error: getErrorMessage(error as Error) };
        }
    }, {
        defaultValue: { success: false, error: 'Failed to generate PR summary' },
        argsSchema: z.tuple([PathSchema, BranchSchema, BranchSchema])
    }));
}

/**
 * Registers advanced git IPC handlers including conflicts, stashing, blame, rebase, and submodules.
 */
export function registerGitAdvancedIpc(
    gitService: GitService,
    validateSender: SenderValidator,
    llmService?: LLMService,
    _brainService?: BrainService
) {
    appLogger.debug('GitAdvanced', '[IPC] Git-Advanced service registered');

    registerConflictHandlers(gitService, validateSender);
    registerStashHandlers(gitService, validateSender);
    registerBlameAndCommitHandlers(gitService, validateSender);
    registerRebaseHandlers(gitService, validateSender);
    registerSubmoduleHandlers(gitService, validateSender);
    registerFlowHandlers(gitService, validateSender);
    registerHookHandlers(gitService, validateSender);
    registerStatsHandlers(gitService, validateSender);
    registerBranchHandlers(gitService, validateSender);
    registerPrHandlers(gitService, validateSender, llmService);
    registerInvestigationHandlers(gitService, validateSender);

    ipcMain.handle('git:runControlledOperation', createValidatedIpcHandler('git:runControlledOperation', async (event, cwd: string, command: string, operationId?: string, timeoutMs?: number) => {
        validateSender(event);
        const startTime = Date.now();
        try {
            if (!isControlledCommandAllowed(command)) {
                return {
                    success: false,
                    error: 'Operation is not allowed for controlled execution',
                };
            }

            const result = await withOperationGuard('git', () =>
                gitService.executeRaw(cwd, command, { operationId, timeoutMs })
            );
            appLogger.debug('GitAdvanced', `[git:runControlledOperation] Success in ${Date.now() - startTime}ms`);
            return result;
        } catch (error) {
            appLogger.error('GitAdvanced', `[git:runControlledOperation] Failed in ${Date.now() - startTime}ms: ${getErrorMessage(error as Error)}`);
            throw error;
        }
    }, {
        defaultValue: {
            success: false,
            error: 'Failed to run controlled operation',
        },
        argsSchema: z.tuple([PathSchema, ControlledCommandSchema, OperationIdSchema.optional(), z.number().int().min(1000).max(600000).optional()])
    }));

    ipcMain.handle('git:cancelOperation', createValidatedIpcHandler('git:cancelOperation', async (event, operationId: string) => {
        validateSender(event);
        const startTime = Date.now();
        try {
            const cancelled = gitService.cancelOperation(operationId);
            appLogger.debug('GitAdvanced', `[git:cancelOperation] Success in ${Date.now() - startTime}ms`);
            return {
                success: cancelled,
                error: cancelled ? undefined : 'Operation not found',
            };
        } catch (error) {
            appLogger.error('GitAdvanced', `[git:cancelOperation] Failed in ${Date.now() - startTime}ms: ${getErrorMessage(error as Error)}`);
            throw error;
        }
    }, {
        defaultValue: { success: false, error: 'Failed to cancel operation' },
        argsSchema: z.tuple([OperationIdSchema])
    }));
}

/**
 * Registers investigation handlers including file history, ref comparison, and hotspots.
 */
function registerInvestigationHandlers(gitService: GitService, validateSender: SenderValidator) {
    ipcMain.handle('git:getFileHistory', createValidatedIpcHandler('git:getFileHistory', async (event, cwd: string, filePath: string, limit?: number) => {
        validateSender(event);
        const commits = await gitService.getFileLog(cwd, filePath, limit);
        return { success: true, commits };
    }, {
        defaultValue: { success: false, commits: [] },
        argsSchema: z.tuple([PathSchema, PathSchema, z.number().int().optional()])
    }));

    ipcMain.handle('git:compareRefs', createValidatedIpcHandler('git:compareRefs', async (event, cwd: string, base: string, head: string) => {
        validateSender(event);
        const result = await gitService.compareRefs(cwd, base, head);
        return result;
    }, {
        defaultValue: { success: false, ahead: 0, behind: 0, files: [] },
        argsSchema: z.tuple([PathSchema, BranchSchema, BranchSchema])
    }));

    ipcMain.handle('git:getHotspots', createValidatedIpcHandler('git:getHotspots', async (event, cwd: string, limit?: number, days?: number) => {
        validateSender(event);
        const hotspots = await gitService.getHotspots(cwd, limit, days);
        return { success: true, hotspots };
    }, {
        defaultValue: { success: false, hotspots: [] },
        argsSchema: z.tuple([PathSchema, z.number().int().optional(), z.number().int().optional()])
    }));
}
