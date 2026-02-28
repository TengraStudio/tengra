import { registerGitIpc } from '@main/ipc/git';
import { IpcMainInvokeEvent } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ipcMainHandlers, fsPromisesMock } = vi.hoisted(() => ({
    ipcMainHandlers: new Map<string, (...args: unknown[]) => Promise<unknown>>(),
    fsPromisesMock: {
        readdir: vi.fn(),
        stat: vi.fn(),
        readFile: vi.fn(),
        mkdir: vi.fn(),
        chmod: vi.fn(),
        writeFile: vi.fn(),
    },
}));

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
            ipcMainHandlers.set(channel, handler);
        }),
        removeHandler: vi.fn(),
    },
}));

vi.mock('fs', () => ({
    promises: fsPromisesMock,
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('@main/utils/ipc-batch.util', () => ({
    registerBatchableHandler: vi.fn(),
}));

vi.mock('@main/utils/ipc-wrapper.util', () => ({
    createIpcHandler: (_name: string, handler: (...args: unknown[]) => unknown) => async (...args: unknown[]) => handler(...args),
    createSafeIpcHandler: (_name: string, handler: (...args: unknown[]) => unknown, defaultValue: unknown) => async (...args: unknown[]) => {
        try {
            return await handler(...args);
        } catch {
            return defaultValue;
        }
    },
    createValidatedIpcHandler: (
        _name: string,
        handler: (...args: unknown[]) => unknown,
        options?: { argsSchema?: { parse: (args: unknown[]) => unknown[] }; defaultValue?: unknown }
    ) => async (event: unknown, ...args: unknown[]) => {
        try {
            const parsedArgs = options?.argsSchema ? options.argsSchema.parse(args) : args;
            return await handler(event, ...(parsedArgs as unknown[]));
        } catch {
            if (options && Object.prototype.hasOwnProperty.call(options, 'defaultValue')) {
                return options.defaultValue;
            }
            throw new Error('Validation failed');
        }
    },
}));


vi.mock('@main/utils/rate-limiter.util', () => ({
    withRateLimit: vi.fn(async (_bucket: string, fn: () => Promise<unknown>) => await fn()),
}));

describe('Git IPC Integration', () => {
    const executeRaw = vi.fn(async (_cwd: string, command: string) => {
        if (command === 'status --porcelain=1') {
            return {
                success: true,
                stdout: 'UU src/conflict.ts\nAA src/both-added.ts\n M src/clean-change.ts\n',
            };
        }

        if (command.startsWith('stash list')) {
            return {
                success: true,
                stdout: 'stash@{0}|abc123|Jane|2026-01-01T00:00:00.000Z|WIP on feature\n',
            };
        }

        if (command.startsWith('blame --line-porcelain')) {
            return {
                success: true,
                stdout: [
                    'abc12345 1 1 1',
                    'author Jane',
                    'author-time 1700000000',
                    'summary Initial commit',
                    '\tconst foo = 1;',
                ].join('\n'),
            };
        }

        if (command.startsWith('show -s --format=')) {
            return {
                success: true,
                stdout:
                    'abc12345\x1fJane\x1fjane@example.com\x1f2026-01-01T00:00:00.000Z\x1fCommit title\x1fCommit body',
            };
        }

        if (command.startsWith('show --name-only')) {
            return { success: true, stdout: 'src/a.ts\nsrc/b.ts\n' };
        }

        if (command === 'rev-parse --verify REBASE_HEAD') {
            return { success: true, stdout: 'abc12345' };
        }

        if (command === 'rev-parse --abbrev-ref HEAD') {
            return { success: true, stdout: 'feature/new-ui' };
        }

        if (command === 'submodule status --recursive') {
            return { success: true, stdout: ' 1234567 deps/lib (heads/main)\n' };
        }

        if (command.includes('config -f .gitmodules')) {
            return {
                success: true,
                stdout: [
                    'submodule.lib.path=deps/lib',
                    'submodule.lib.url=https://example.com/lib.git',
                    'submodule.lib.branch=main',
                ].join('\n'),
            };
        }

        if (command === 'for-each-ref --format="%(refname:short)" refs/heads') {
            return { success: true, stdout: 'feature/abc\nrelease/1.0\nhotfix/urgent\nmain\n' };
        }

        if (command === 'rev-parse --git-dir') {
            return { success: true, stdout: '.git\n' };
        }

        if (command === 'rev-list --count HEAD') {
            return { success: true, stdout: '5' };
        }

        if (command.startsWith('shortlog -sne --since=')) {
            return {
                success: true,
                stdout: '  3 Jane <jane@example.com>\n  2 John <john@example.com>\n',
            };
        }

        if (command.includes('--pretty=format: --name-only')) {
            return { success: true, stdout: 'src/a.ts\nsrc/a.ts\nsrc/b.ts\n' };
        }

        if (command.includes('--pretty=format:"%ad" --date=short')) {
            return { success: true, stdout: '2026-01-01\n2026-01-01\n2026-01-02\n' };
        }

        return { success: true, stdout: '' };
    });

    const mockGitService = {
        executeRaw,
        cancelOperation: vi.fn(() => true),
        getStatus: vi.fn(async () => []),
        getLog: vi.fn(async () => []),
        getFileDiff: vi.fn(async () => ({ success: true, original: '', modified: '' })),
        getUnifiedDiff: vi.fn(async () => ({ success: true, diff: '' })),
        getCommitDiff: vi.fn(async () => ({ success: true, diff: '' })),
        stageFile: vi.fn(async () => ({ success: true })),
        unstageFile: vi.fn(async () => ({ success: true })),
        checkout: vi.fn(async () => ({ success: true })),
        commit: vi.fn(async () => ({ success: true })),
        push: vi.fn(async () => ({ success: true })),
        pull: vi.fn(async () => ({ success: true })),
    } as never;

    beforeEach(() => {
        ipcMainHandlers.clear();
        vi.clearAllMocks();

        fsPromisesMock.readdir.mockResolvedValue([
            {
                name: 'pre-commit',
                isFile: () => true,
            },
        ] as never);
        fsPromisesMock.stat.mockResolvedValue({
            mode: 0o100755,
            size: 64,
            mtime: new Date('2026-01-01T00:00:00.000Z'),
        } as never);
        fsPromisesMock.readFile.mockResolvedValue('#!/usr/bin/env sh\necho ok\n');
        fsPromisesMock.mkdir.mockResolvedValue(undefined);
        fsPromisesMock.chmod.mockResolvedValue(undefined);
        fsPromisesMock.writeFile.mockResolvedValue(undefined);

        registerGitIpc(() => null, mockGitService);
    });

    it('registers advanced Git handlers', () => {
        expect(ipcMainHandlers.has('git:getConflicts')).toBe(true);
        expect(ipcMainHandlers.has('git:getStashes')).toBe(true);
        expect(ipcMainHandlers.has('git:getBlame')).toBe(true);
        expect(ipcMainHandlers.has('git:getRebaseStatus')).toBe(true);
        expect(ipcMainHandlers.has('git:getSubmodules')).toBe(true);
        expect(ipcMainHandlers.has('git:getFlowStatus')).toBe(true);
        expect(ipcMainHandlers.has('git:getHooks')).toBe(true);
        expect(ipcMainHandlers.has('git:getRepositoryStats')).toBe(true);
        expect(ipcMainHandlers.has('git:runControlledOperation')).toBe(true);
        expect(ipcMainHandlers.has('git:cancelOperation')).toBe(true);
    });

    it('supports controlled operation execution and cancellation', async () => {
        const runHandler = ipcMainHandlers.get('git:runControlledOperation')!;
        const cancelHandler = ipcMainHandlers.get('git:cancelOperation')!;

        const runResult = await runHandler(
            {} as IpcMainInvokeEvent,
            'C:/repo',
            'rebase --continue',
            'op-1',
            5000
        );
        const cancelResult = await cancelHandler({} as IpcMainInvokeEvent, 'op-1');

        expect(runResult.success).toBe(true);
        expect(mockGitService.executeRaw).toHaveBeenCalledWith(
            'C:/repo',
            'rebase --continue',
            { operationId: 'op-1', timeoutMs: 5000 }
        );
        expect(cancelResult.success).toBe(true);
        expect(mockGitService.cancelOperation).toHaveBeenCalledWith('op-1');
    });

    it('parses conflict entries and analytics', async () => {
        const handler = ipcMainHandlers.get('git:getConflicts')!;
        const result = await handler({} as IpcMainInvokeEvent, 'C:/repo');

        expect(result.success).toBe(true);
        expect(result.conflicts).toHaveLength(2);
        expect(result.analytics.UU).toBe(1);
        expect(result.analytics.AA).toBe(1);
        expect(result.conflicts[0].path).toBe('src/conflict.ts');
    });

    it('returns stash list and supports export', async () => {
        const listHandler = ipcMainHandlers.get('git:getStashes')!;
        const exportHandler = ipcMainHandlers.get('git:exportStash')!;

        const listResult = await listHandler({} as IpcMainInvokeEvent, 'C:/repo');
        const exportResult = await exportHandler(
            {} as IpcMainInvokeEvent,
            'C:/repo',
            'stash@{0}'
        );

        expect(listResult.success).toBe(true);
        expect(listResult.stashes[0].ref).toBe('stash@{0}');
        expect(exportResult.success).toBe(true);
    });

    it('rejects invalid stash ref payloads with fallback', async () => {
        const handler = ipcMainHandlers.get('git:applyStash')!;
        const result = await handler({} as IpcMainInvokeEvent, 'C:/repo', 'stash@invalid', true);

        expect(result.success).toBe(false);
    });

    it('parses blame lines and commit details', async () => {
        const blameHandler = ipcMainHandlers.get('git:getBlame')!;
        const commitDetailsHandler = ipcMainHandlers.get('git:getCommitDetails')!;

        const blameResult = await blameHandler(
            {} as IpcMainInvokeEvent,
            'C:/repo',
            'src/index.ts'
        );
        const detailsResult = await commitDetailsHandler(
            {} as IpcMainInvokeEvent,
            'C:/repo',
            'abc12345'
        );

        expect(blameResult.success).toBe(true);
        expect(blameResult.lines[0].author).toBe('Jane');
        expect(blameResult.lines[0].content).toContain('const foo = 1;');
        expect(detailsResult.success).toBe(true);
        expect(detailsResult.details.files).toContain('src/a.ts');
    });

    it('returns rebase status and flow summaries', async () => {
        const rebaseHandler = ipcMainHandlers.get('git:getRebaseStatus')!;
        const flowHandler = ipcMainHandlers.get('git:getFlowStatus')!;

        const rebaseResult = await rebaseHandler({} as IpcMainInvokeEvent, 'C:/repo');
        const flowResult = await flowHandler({} as IpcMainInvokeEvent, 'C:/repo');

        expect(rebaseResult.success).toBe(true);
        expect(rebaseResult.inRebase).toBe(true);
        expect(rebaseResult.currentBranch).toBe('feature/new-ui');

        expect(flowResult.success).toBe(true);
        expect(flowResult.byType.feature).toContain('feature/abc');
        expect(flowResult.byType.release).toContain('release/1.0');
    });

    it('returns submodule metadata and hook diagnostics', async () => {
        const submoduleHandler = ipcMainHandlers.get('git:getSubmodules')!;
        const hooksHandler = ipcMainHandlers.get('git:getHooks')!;

        const submoduleResult = await submoduleHandler({} as IpcMainInvokeEvent, 'C:/repo');
        const hooksResult = await hooksHandler({} as IpcMainInvokeEvent, 'C:/repo');

        expect(submoduleResult.success).toBe(true);
        expect(submoduleResult.submodules[0].path).toBe('deps/lib');
        expect(submoduleResult.submodules[0].url).toContain('example.com');

        expect(hooksResult.success).toBe(true);
        expect(hooksResult.hooks[0].name).toBe('pre-commit');
        expect(hooksResult.hooks[0].executable).toBe(true);
    });

    it('computes repository stats and exports CSV', async () => {
        const statsHandler = ipcMainHandlers.get('git:getRepositoryStats')!;
        const exportHandler = ipcMainHandlers.get('git:exportRepositoryStats')!;

        const statsResult = await statsHandler({} as IpcMainInvokeEvent, 'C:/repo', 30);
        const exportResult = await exportHandler({} as IpcMainInvokeEvent, 'C:/repo', 30);

        expect(statsResult.success).toBe(true);
        expect(statsResult.stats.totalCommits).toBe(5);
        expect(statsResult.stats.authorStats[0].commits).toBe(3);
        expect(statsResult.stats.fileStats[0].file).toBe('src/a.ts');
        expect(statsResult.stats.activity['2026-01-01']).toBe(2);

        expect(exportResult.success).toBe(true);
        expect(exportResult.export.authorsCsv).toContain('commits,author');
        expect(exportResult.export.authorsCsv).toContain('Jane');
    });
});
