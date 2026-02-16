import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';

import { GitService } from '@main/services/project/git.service';
import { createSafeIpcHandler } from '@main/utils/ipc-wrapper.util';
import { withRateLimit } from '@main/utils/rate-limiter.util';
import { getErrorMessage } from '@shared/utils/error.util';
import { ipcMain, IpcMainInvokeEvent } from 'electron';

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

type ConflictStrategy = 'ours' | 'theirs' | 'manual';
type FlowType = 'feature' | 'release' | 'hotfix' | 'support';

function validatePath(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function validateSimpleArg(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    if (/[^a-zA-Z0-9._/@:+-]/.test(trimmed)) {
        return null;
    }
    return trimmed;
}

function validateFilePathArg(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    if (trimmed.includes('\0') || /[\r\n`]/.test(trimmed)) {
        return null;
    }
    return trimmed;
}

function validateStashRef(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!/^stash@\{\d+\}$/.test(trimmed)) {
        return null;
    }
    return trimmed;
}

function validateConflictStrategy(value: unknown): ConflictStrategy | null {
    if (value === 'ours' || value === 'theirs' || value === 'manual') {
        return value;
    }
    return null;
}

function validateFlowType(value: unknown): FlowType | null {
    if (value === 'feature' || value === 'release' || value === 'hotfix' || value === 'support') {
        return value;
    }
    return null;
}

function shellEscapeQuoted(value: string): string {
    return value.replace(/"/g, '\\"');
}

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

async function getGitDirPath(gitService: GitService, cwd: string): Promise<string | null> {
    const gitDirResult = await gitService.executeRaw(cwd, 'rev-parse --git-dir');
    if (!gitDirResult.success || !gitDirResult.stdout) {
        return null;
    }
    const rawGitDir = gitDirResult.stdout.trim();
    return path.isAbsolute(rawGitDir) ? rawGitDir : path.join(cwd, rawGitDir);
}

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

export function registerGitAdvancedIpc(gitService: GitService) {
    ipcMain.handle(
        'git:getConflicts',
        createSafeIpcHandler(
            'git:getConflicts',
            async (_event: IpcMainInvokeEvent, cwdRaw: unknown) => {
                const cwd = validatePath(cwdRaw);
                if (!cwd) {
                    throw new Error('Invalid path');
                }

                const conflicts = await parseConflicts(gitService, cwd);
                const analytics = conflicts.reduce<Record<string, number>>((acc, item) => {
                    acc[item.status] = (acc[item.status] ?? 0) + 1;
                    return acc;
                }, {});

                return { success: true, conflicts, analytics };
            },
            { success: false, conflicts: [], analytics: {} }
        )
    );

    ipcMain.handle(
        'git:resolveConflict',
        createSafeIpcHandler(
            'git:resolveConflict',
            async (
                _event: IpcMainInvokeEvent,
                cwdRaw: unknown,
                filePathRaw: unknown,
                strategyRaw: unknown
            ) => {
                const cwd = validatePath(cwdRaw);
                const filePath = validateFilePathArg(filePathRaw);
                const strategy = validateConflictStrategy(strategyRaw);
                if (!cwd || !filePath || !strategy) {
                    throw new Error('Invalid conflict resolution payload');
                }

                const safePath = shellEscapeQuoted(filePath);
                if (strategy === 'ours') {
                    await withRateLimit('git', () =>
                        gitService.executeRaw(cwd, `checkout --ours -- "${safePath}"`)
                    );
                } else if (strategy === 'theirs') {
                    await withRateLimit('git', () =>
                        gitService.executeRaw(cwd, `checkout --theirs -- "${safePath}"`)
                    );
                }

                const addResult = await withRateLimit('git', () =>
                    gitService.executeRaw(cwd, `add -- "${safePath}"`)
                );
                return { success: addResult.success, error: addResult.error };
            },
            { success: false, error: 'Failed to resolve conflict' }
        )
    );

    ipcMain.handle(
        'git:openMergeTool',
        createSafeIpcHandler(
            'git:openMergeTool',
            async (_event: IpcMainInvokeEvent, cwdRaw: unknown, filePathRaw?: unknown) => {
                const cwd = validatePath(cwdRaw);
                if (!cwd) {
                    throw new Error('Invalid path');
                }

                const filePath = filePathRaw ? validateFilePathArg(filePathRaw) : null;
                if (filePathRaw && !filePath) {
                    throw new Error('Invalid file path');
                }

                const command = filePath
                    ? `mergetool -- "${shellEscapeQuoted(filePath)}"`
                    : 'mergetool';
                const result = await withRateLimit('git', () => gitService.executeRaw(cwd, command));
                return {
                    success: result.success,
                    stdout: result.stdout,
                    stderr: result.stderr,
                    error: result.error,
                };
            },
            {
                success: false,
                stdout: undefined,
                stderr: undefined,
                error: 'Failed to launch merge tool',
            }
        )
    );

    ipcMain.handle(
        'git:getStashes',
        createSafeIpcHandler(
            'git:getStashes',
            async (_event: IpcMainInvokeEvent, cwdRaw: unknown) => {
                const cwd = validatePath(cwdRaw);
                if (!cwd) {
                    throw new Error('Invalid path');
                }

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
            },
            { success: false, stashes: [] }
        )
    );

    ipcMain.handle(
        'git:createStash',
        createSafeIpcHandler(
            'git:createStash',
            async (
                _event: IpcMainInvokeEvent,
                cwdRaw: unknown,
                messageRaw?: unknown,
                includeUntrackedRaw?: unknown
            ) => {
                const cwd = validatePath(cwdRaw);
                if (!cwd) {
                    throw new Error('Invalid path');
                }

                const message = typeof messageRaw === 'string' ? messageRaw.trim() : '';
                const includeUntracked = includeUntrackedRaw === true;
                const messageArg = message ? ` -m "${shellEscapeQuoted(message)}"` : '';
                const untrackedArg = includeUntracked ? ' -u' : '';
                const result = await withRateLimit('git', () =>
                    gitService.executeRaw(cwd, `stash push${untrackedArg}${messageArg}`)
                );
                return { success: result.success, error: result.error, stdout: result.stdout };
            },
            { success: false, error: 'Failed to create stash', stdout: undefined }
        )
    );

    ipcMain.handle(
        'git:applyStash',
        createSafeIpcHandler(
            'git:applyStash',
            async (
                _event: IpcMainInvokeEvent,
                cwdRaw: unknown,
                stashRefRaw: unknown,
                popRaw?: unknown
            ) => {
                const cwd = validatePath(cwdRaw);
                const stashRef = validateStashRef(stashRefRaw);
                const pop = popRaw === true;
                if (!cwd || !stashRef) {
                    throw new Error('Invalid stash operation payload');
                }

                const command = pop ? `stash pop ${stashRef}` : `stash apply ${stashRef}`;
                const result = await withRateLimit('git', () => gitService.executeRaw(cwd, command));
                return {
                    success: result.success,
                    error: result.error,
                    stdout: result.stdout,
                    stderr: result.stderr,
                };
            },
            {
                success: false,
                error: 'Failed to apply stash',
                stdout: undefined,
                stderr: undefined,
            }
        )
    );

    ipcMain.handle(
        'git:dropStash',
        createSafeIpcHandler(
            'git:dropStash',
            async (_event: IpcMainInvokeEvent, cwdRaw: unknown, stashRefRaw: unknown) => {
                const cwd = validatePath(cwdRaw);
                const stashRef = validateStashRef(stashRefRaw);
                if (!cwd || !stashRef) {
                    throw new Error('Invalid stash ref');
                }

                const result = await withRateLimit('git', () =>
                    gitService.executeRaw(cwd, `stash drop ${stashRef}`)
                );
                return { success: result.success, error: result.error, stdout: result.stdout };
            },
            { success: false, error: 'Failed to drop stash', stdout: undefined }
        )
    );

    ipcMain.handle(
        'git:exportStash',
        createSafeIpcHandler(
            'git:exportStash',
            async (_event: IpcMainInvokeEvent, cwdRaw: unknown, stashRefRaw: unknown) => {
                const cwd = validatePath(cwdRaw);
                const stashRef = validateStashRef(stashRefRaw);
                if (!cwd || !stashRef) {
                    throw new Error('Invalid stash ref');
                }

                const result = await gitService.executeRaw(cwd, `stash show -p ${stashRef}`);
                return { success: result.success, patch: result.stdout ?? '', error: result.error };
            },
            { success: false, patch: '', error: 'Failed to export stash' }
        )
    );

    ipcMain.handle(
        'git:getBlame',
        createSafeIpcHandler(
            'git:getBlame',
            async (_event: IpcMainInvokeEvent, cwdRaw: unknown, filePathRaw: unknown) => {
                const cwd = validatePath(cwdRaw);
                const filePath = validateFilePathArg(filePathRaw);
                if (!cwd || !filePath) {
                    throw new Error('Invalid path');
                }

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
            },
            { success: false, lines: [] }
        )
    );

    ipcMain.handle(
        'git:getCommitDetails',
        createSafeIpcHandler(
            'git:getCommitDetails',
            async (_event: IpcMainInvokeEvent, cwdRaw: unknown, hashRaw: unknown) => {
                const cwd = validatePath(cwdRaw);
                const hash = validateSimpleArg(hashRaw);
                if (!cwd || !hash) {
                    throw new Error('Invalid commit hash');
                }

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
            },
            { success: false, error: 'Failed to fetch commit details' }
        )
    );

    ipcMain.handle(
        'git:getRebaseStatus',
        createSafeIpcHandler(
            'git:getRebaseStatus',
            async (_event: IpcMainInvokeEvent, cwdRaw: unknown) => {
                const cwd = validatePath(cwdRaw);
                if (!cwd) {
                    throw new Error('Invalid path');
                }
                return getRebaseStatus(gitService, cwd);
            },
            {
                success: false,
                inRebase: false,
                currentBranch: null,
                conflictCount: 0,
                conflicts: [],
            }
        )
    );

    ipcMain.handle(
        'git:getRebasePlan',
        createSafeIpcHandler(
            'git:getRebasePlan',
            async (_event: IpcMainInvokeEvent, cwdRaw: unknown, baseBranchRaw: unknown) => {
                const cwd = validatePath(cwdRaw);
                const baseBranch = validateSimpleArg(baseBranchRaw);
                if (!cwd || !baseBranch) {
                    throw new Error('Invalid rebase payload');
                }

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
            },
            { success: false, commits: [] }
        )
    );

    ipcMain.handle(
        'git:startRebase',
        createSafeIpcHandler(
            'git:startRebase',
            async (_event: IpcMainInvokeEvent, cwdRaw: unknown, baseBranchRaw: unknown) => {
                const cwd = validatePath(cwdRaw);
                const baseBranch = validateSimpleArg(baseBranchRaw);
                if (!cwd || !baseBranch) {
                    throw new Error('Invalid rebase payload');
                }

                const result = await withRateLimit('git', () =>
                    gitService.executeRaw(cwd, `rebase ${baseBranch}`)
                );
                return {
                    success: result.success,
                    error: result.error,
                    stdout: result.stdout,
                    stderr: result.stderr,
                };
            },
            {
                success: false,
                error: 'Failed to start rebase',
                stdout: undefined,
                stderr: undefined,
            }
        )
    );

    ipcMain.handle(
        'git:continueRebase',
        createSafeIpcHandler(
            'git:continueRebase',
            async (_event: IpcMainInvokeEvent, cwdRaw: unknown) => {
                const cwd = validatePath(cwdRaw);
                if (!cwd) {
                    throw new Error('Invalid path');
                }

                const result = await withRateLimit('git', () =>
                    gitService.executeRaw(cwd, 'rebase --continue')
                );
                return {
                    success: result.success,
                    error: result.error,
                    stdout: result.stdout,
                    stderr: result.stderr,
                };
            },
            {
                success: false,
                error: 'Failed to continue rebase',
                stdout: undefined,
                stderr: undefined,
            }
        )
    );

    ipcMain.handle(
        'git:abortRebase',
        createSafeIpcHandler(
            'git:abortRebase',
            async (_event: IpcMainInvokeEvent, cwdRaw: unknown) => {
                const cwd = validatePath(cwdRaw);
                if (!cwd) {
                    throw new Error('Invalid path');
                }

                const result = await withRateLimit('git', () =>
                    gitService.executeRaw(cwd, 'rebase --abort')
                );
                return {
                    success: result.success,
                    error: result.error,
                    stdout: result.stdout,
                    stderr: result.stderr,
                };
            },
            {
                success: false,
                error: 'Failed to abort rebase',
                stdout: undefined,
                stderr: undefined,
            }
        )
    );
    ipcMain.handle(
        'git:getSubmodules',
        createSafeIpcHandler(
            'git:getSubmodules',
            async (_event: IpcMainInvokeEvent, cwdRaw: unknown) => {
                const cwd = validatePath(cwdRaw);
                if (!cwd) {
                    throw new Error('Invalid path');
                }

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
            },
            { success: false, submodules: [] }
        )
    );

    ipcMain.handle(
        'git:initSubmodules',
        createSafeIpcHandler(
            'git:initSubmodules',
            async (_event: IpcMainInvokeEvent, cwdRaw: unknown, recursiveRaw?: unknown) => {
                const cwd = validatePath(cwdRaw);
                if (!cwd) {
                    throw new Error('Invalid path');
                }
                const recursive = recursiveRaw === true;
                const result = await withRateLimit('git', () =>
                    gitService.executeRaw(
                        cwd,
                        recursive
                            ? 'submodule update --init --recursive'
                            : 'submodule update --init'
                    )
                );
                return { success: result.success, error: result.error };
            },
            { success: false, error: 'Failed to init submodules' }
        )
    );

    ipcMain.handle(
        'git:updateSubmodules',
        createSafeIpcHandler(
            'git:updateSubmodules',
            async (_event: IpcMainInvokeEvent, cwdRaw: unknown, remoteRaw?: unknown) => {
                const cwd = validatePath(cwdRaw);
                if (!cwd) {
                    throw new Error('Invalid path');
                }
                const remote = remoteRaw === true;
                const result = await withRateLimit('git', () =>
                    gitService.executeRaw(
                        cwd,
                        remote
                            ? 'submodule update --remote --recursive'
                            : 'submodule update --recursive'
                    )
                );
                return { success: result.success, error: result.error };
            },
            { success: false, error: 'Failed to update submodules' }
        )
    );

    ipcMain.handle(
        'git:syncSubmodules',
        createSafeIpcHandler(
            'git:syncSubmodules',
            async (_event: IpcMainInvokeEvent, cwdRaw: unknown) => {
                const cwd = validatePath(cwdRaw);
                if (!cwd) {
                    throw new Error('Invalid path');
                }
                const result = await withRateLimit('git', () =>
                    gitService.executeRaw(cwd, 'submodule sync --recursive')
                );
                return { success: result.success, error: result.error };
            },
            { success: false, error: 'Failed to sync submodules' }
        )
    );

    ipcMain.handle(
        'git:addSubmodule',
        createSafeIpcHandler(
            'git:addSubmodule',
            async (
                _event: IpcMainInvokeEvent,
                cwdRaw: unknown,
                urlRaw: unknown,
                submodulePathRaw: unknown,
                branchRaw?: unknown
            ) => {
                const cwd = validatePath(cwdRaw);
                const url = validateSimpleArg(urlRaw);
                const submodulePath = validateFilePathArg(submodulePathRaw);
                const branch = branchRaw ? validateSimpleArg(branchRaw) : null;
                if (!cwd || !url || !submodulePath) {
                    throw new Error('Invalid submodule payload');
                }

                const branchArg = branch ? ` -b ${branch}` : '';
                const result = await withRateLimit('git', () =>
                    gitService.executeRaw(
                        cwd,
                        `submodule add${branchArg} ${url} "${shellEscapeQuoted(submodulePath)}"`
                    )
                );
                return { success: result.success, error: result.error };
            },
            { success: false, error: 'Failed to add submodule' }
        )
    );

    ipcMain.handle(
        'git:removeSubmodule',
        createSafeIpcHandler(
            'git:removeSubmodule',
            async (_event: IpcMainInvokeEvent, cwdRaw: unknown, submodulePathRaw: unknown) => {
                const cwd = validatePath(cwdRaw);
                const submodulePath = validateFilePathArg(submodulePathRaw);
                if (!cwd || !submodulePath) {
                    throw new Error('Invalid submodule path');
                }

                const safePath = shellEscapeQuoted(submodulePath);
                await withRateLimit('git', () =>
                    gitService.executeRaw(cwd, `submodule deinit -f -- "${safePath}"`)
                );
                const result = await withRateLimit('git', () =>
                    gitService.executeRaw(cwd, `rm -f "${safePath}"`)
                );
                return { success: result.success, error: result.error };
            },
            { success: false, error: 'Failed to remove submodule' }
        )
    );

    ipcMain.handle(
        'git:getFlowStatus',
        createSafeIpcHandler(
            'git:getFlowStatus',
            async (_event: IpcMainInvokeEvent, cwdRaw: unknown) => {
                const cwd = validatePath(cwdRaw);
                if (!cwd) {
                    throw new Error('Invalid path');
                }

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
            },
            {
                success: false,
                currentBranch: '',
                byType: { feature: [], release: [], hotfix: [], support: [] },
                branches: [],
            }
        )
    );

    ipcMain.handle(
        'git:startFlowBranch',
        createSafeIpcHandler(
            'git:startFlowBranch',
            async (
                _event: IpcMainInvokeEvent,
                cwdRaw: unknown,
                typeRaw: unknown,
                nameRaw: unknown,
                baseRaw?: unknown
            ) => {
                const cwd = validatePath(cwdRaw);
                const type = validateFlowType(typeRaw);
                const name = validateSimpleArg(nameRaw);
                const base = validateSimpleArg(baseRaw) ?? 'develop';
                if (!cwd || !type || !name) {
                    throw new Error('Invalid flow payload');
                }

                const branchName = `${type}/${name.replace(/\s+/g, '-')}`;
                const checkoutBase = await withRateLimit('git', () =>
                    gitService.executeRaw(cwd, `checkout ${base}`)
                );
                if (!checkoutBase.success) {
                    return {
                        success: false,
                        error: checkoutBase.error ?? 'Failed to checkout base branch',
                    };
                }

                const createBranch = await withRateLimit('git', () =>
                    gitService.executeRaw(cwd, `checkout -b ${branchName}`)
                );
                return { success: createBranch.success, branch: branchName, error: createBranch.error };
            },
            { success: false, error: 'Failed to start flow branch' }
        )
    );

    ipcMain.handle(
        'git:finishFlowBranch',
        createSafeIpcHandler(
            'git:finishFlowBranch',
            async (
                _event: IpcMainInvokeEvent,
                cwdRaw: unknown,
                branchRaw: unknown,
                targetRaw?: unknown,
                deleteRaw?: unknown
            ) => {
                const cwd = validatePath(cwdRaw);
                const branch = validateSimpleArg(branchRaw);
                const target = validateSimpleArg(targetRaw) ?? 'develop';
                const shouldDelete = deleteRaw !== false;
                if (!cwd || !branch) {
                    throw new Error('Invalid flow finish payload');
                }

                const checkoutTarget = await withRateLimit('git', () =>
                    gitService.executeRaw(cwd, `checkout ${target}`)
                );
                if (!checkoutTarget.success) {
                    return {
                        success: false,
                        error: checkoutTarget.error ?? 'Failed to checkout target branch',
                    };
                }

                const mergeResult = await withRateLimit('git', () =>
                    gitService.executeRaw(cwd, `merge --no-ff ${branch}`)
                );
                if (!mergeResult.success) {
                    return { success: false, error: mergeResult.error ?? 'Merge failed' };
                }

                if (shouldDelete) {
                    await withRateLimit('git', () => gitService.executeRaw(cwd, `branch -d ${branch}`));
                }

                return { success: true };
            },
            { success: false, error: 'Failed to finish flow branch' }
        )
    );

    ipcMain.handle(
        'git:getHooks',
        createSafeIpcHandler(
            'git:getHooks',
            async (_event: IpcMainInvokeEvent, cwdRaw: unknown) => {
                const cwd = validatePath(cwdRaw);
                if (!cwd) {
                    throw new Error('Invalid path');
                }

                const hooks = await listHooks(gitService, cwd);
                return {
                    success: true,
                    hooks,
                    templates: SUPPORTED_HOOKS,
                };
            },
            { success: false, hooks: [], templates: [...SUPPORTED_HOOKS] }
        )
    );

    ipcMain.handle(
        'git:installHook',
        createSafeIpcHandler(
            'git:installHook',
            async (
                _event: IpcMainInvokeEvent,
                cwdRaw: unknown,
                hookNameRaw: unknown,
                templateRaw?: unknown
            ) => {
                const cwd = validatePath(cwdRaw);
                const hookName = validateSimpleArg(hookNameRaw);
                if (!cwd || !hookName) {
                    throw new Error('Invalid hook payload');
                }
                if (!SUPPORTED_HOOKS.includes(hookName as (typeof SUPPORTED_HOOKS)[number])) {
                    throw new Error('Unsupported hook type');
                }

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
            },
            { success: false, hookPath: '' }
        )
    );

    ipcMain.handle(
        'git:validateHook',
        createSafeIpcHandler(
            'git:validateHook',
            async (_event: IpcMainInvokeEvent, cwdRaw: unknown, hookNameRaw: unknown) => {
                const cwd = validatePath(cwdRaw);
                const hookName = validateSimpleArg(hookNameRaw);
                if (!cwd || !hookName) {
                    throw new Error('Invalid hook payload');
                }

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
            },
            {
                success: false,
                validation: { hookName: '', hasShebang: false, executable: false, valid: false },
            }
        )
    );

    ipcMain.handle(
        'git:testHook',
        createSafeIpcHandler(
            'git:testHook',
            async (_event: IpcMainInvokeEvent, cwdRaw: unknown, hookNameRaw: unknown) => {
                const cwd = validatePath(cwdRaw);
                const hookName = validateSimpleArg(hookNameRaw);
                if (!cwd || !hookName) {
                    throw new Error('Invalid hook payload');
                }

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
            },
            { success: false, stdout: '', stderr: '', error: 'Failed to test hook' }
        )
    );

    ipcMain.handle(
        'git:exportHooks',
        createSafeIpcHandler(
            'git:exportHooks',
            async (_event: IpcMainInvokeEvent, cwdRaw: unknown) => {
                const cwd = validatePath(cwdRaw);
                if (!cwd) {
                    throw new Error('Invalid path');
                }

                const hooks = await listHooks(gitService, cwd);
                const payload = {
                    exportedAt: new Date().toISOString(),
                    hooks,
                };

                return { success: true, payload };
            },
            { success: false, payload: { exportedAt: '', hooks: [] } }
        )
    );

    ipcMain.handle(
        'git:getRepositoryStats',
        createSafeIpcHandler(
            'git:getRepositoryStats',
            async (_event: IpcMainInvokeEvent, cwdRaw: unknown, daysRaw?: unknown) => {
                const cwd = validatePath(cwdRaw);
                if (!cwd) {
                    throw new Error('Invalid path');
                }

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
            },
            {
                success: false,
                stats: {
                    totalCommits: 0,
                    authorStats: [],
                    fileStats: [],
                    activity: {},
                    generatedAt: '',
                    days: 0,
                },
            }
        )
    );

    ipcMain.handle(
        'git:exportRepositoryStats',
        createSafeIpcHandler(
            'git:exportRepositoryStats',
            async (_event: IpcMainInvokeEvent, cwdRaw: unknown, daysRaw?: unknown) => {
                const cwd = validatePath(cwdRaw);
                if (!cwd) {
                    throw new Error('Invalid path');
                }

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
            },
            { success: false, export: { generatedAt: '', days: 0, authorsCsv: '' } }
        )
    );
}
