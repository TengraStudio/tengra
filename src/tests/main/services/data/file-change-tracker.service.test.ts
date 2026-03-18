import * as fs from 'fs/promises';

import { DatabaseService } from '@main/services/data/database.service';
import { FileChangeTracker } from '@main/services/data/file-change-tracker.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { JsonObject } from '@shared/types/common';
import { FileDiff } from '@shared/types/file-diff';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('uuid', () => ({
    v4: vi.fn(() => 'diff-id-001'),
}));

vi.mock('fs/promises', () => ({
    writeFile: vi.fn().mockResolvedValue(undefined),
}));

interface TrackerTestContext {
    tracker: FileChangeTracker;
    ensureFileDiffTableMock: ReturnType<typeof vi.fn>;
    storeFileDiffMock: ReturnType<typeof vi.fn>;
    getFileDiffMock: ReturnType<typeof vi.fn>;
    emitMock: ReturnType<typeof vi.fn>;
}

const createTracker = (overrides?: {
    ensureFileDiffTable?: ReturnType<typeof vi.fn>;
    getFileDiff?: ReturnType<typeof vi.fn>;
    storeFileDiff?: ReturnType<typeof vi.fn>;
}): TrackerTestContext => {
    const ensureFileDiffTableMock = overrides?.ensureFileDiffTable ?? vi.fn().mockResolvedValue(undefined);
    const storeFileDiffMock = overrides?.storeFileDiff ?? vi.fn().mockResolvedValue(undefined);
    const getFileDiffMock = overrides?.getFileDiff ?? vi.fn().mockResolvedValue(null);
    const emitMock = vi.fn();

    const databaseService = {
        ensureFileDiffTable: ensureFileDiffTableMock,
        storeFileDiff: storeFileDiffMock,
        getFileDiff: getFileDiffMock,
    } as never as DatabaseService;

    const eventBusService = {
        emit: emitMock,
    } as never as EventBusService;

    return {
        tracker: new FileChangeTracker(databaseService, eventBusService),
        ensureFileDiffTableMock,
        storeFileDiffMock,
        getFileDiffMock,
        emitMock,
    };
};

describe('FileChangeTracker', () => {
    let context: TrackerTestContext;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
        vi.spyOn(Date, 'now').mockReturnValue(1_717_171_717_000);
        context = createTracker();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── Initialization & Lifecycle ──────────────────────────────────

    describe('initialize', () => {
        it('creates the diff table on first initialization', async () => {
            await context.tracker.initialize();

            expect(context.ensureFileDiffTableMock).toHaveBeenCalledTimes(1);
        });

        it('skips re-initialization when already initialized', async () => {
            await context.tracker.initialize();
            await context.tracker.initialize();

            expect(context.ensureFileDiffTableMock).toHaveBeenCalledTimes(1);
        });

        it('propagates database errors during initialization', async () => {
            const failingContext = createTracker({
                ensureFileDiffTable: vi.fn().mockRejectedValue(new Error('DB connection failed')),
            });

            await expect(failingContext.tracker.initialize()).rejects.toThrow('DB connection failed');
        });
    });

    describe('cleanup', () => {
        it('resets initialized state so next operation re-initializes', async () => {
            await context.tracker.initialize();
            await context.tracker.cleanup();

            // After cleanup, trackFileChange should trigger re-initialization
            await context.tracker.trackFileChange('/repo/file.ts', 'a', 'b', {
                aiSystem: 'chat',
            });

            expect(context.ensureFileDiffTableMock).toHaveBeenCalledTimes(2);
        });
    });

    // ── Change Tracking ─────────────────────────────────────────────

    describe('trackFileChange', () => {
        it('persists generated diffs while preserving metadata integrity', async () => {
            const metadata: JsonObject = {
                source: 'unit-test',
                nested: { audit: 'AUD-TEST-008' },
            };

            const result = await context.tracker.trackFileChange(
                '/repo/file.ts',
                'old line\n',
                'new line\n',
                {
                    aiSystem: 'chat',
                    chatSessionId: 'chat-1',
                    changeReason: 'update',
                    metadata,
                }
            );

            expect(result).not.toBeNull();
            expect(context.ensureFileDiffTableMock).toHaveBeenCalledTimes(1);
            expect(context.storeFileDiffMock).toHaveBeenCalledTimes(1);

            const storedDiff = context.storeFileDiffMock.mock.calls[0]?.[0] as FileDiff;
            expect(storedDiff).toMatchObject({
                id: 'diff-id-001',
                chatSessionId: 'chat-1',
                aiSystem: 'chat',
                filePath: '/repo/file.ts',
                beforeContent: 'old line\n',
                afterContent: 'new line\n',
                timestamp: 1_717_171_717_000,
                changeReason: 'update',
                metadata,
            });
            expect(String(storedDiff.diffContent)).toContain('-old line');
            expect(String(storedDiff.diffContent)).toContain('+new line');
            expect(context.emitMock).toHaveBeenCalledWith('file-changed', {
                path: '/repo/file.ts',
                type: 'update',
            });
            expect(result).toEqual(storedDiff);
        });

        it('skips diff persistence when file contents are unchanged', async () => {
            const result = await context.tracker.trackFileChange('/repo/file.ts', 'same', 'same', {
                aiSystem: 'workspace',
            });

            expect(result).toBeNull();
            expect(context.storeFileDiffMock).not.toHaveBeenCalled();
            expect(context.emitMock).not.toHaveBeenCalled();
        });

        it('auto-initializes when called before explicit initialization', async () => {
            await context.tracker.trackFileChange('/repo/file.ts', 'a', 'b', {
                aiSystem: 'chat',
            });

            expect(context.ensureFileDiffTableMock).toHaveBeenCalledTimes(1);
        });

        it('handles all AI system types', async () => {
            const aiSystems = ['chat', 'workspace', 'council'] as const;

            for (const aiSystem of aiSystems) {
                const ctx = createTracker();
                const result = await ctx.tracker.trackFileChange(
                    '/repo/file.ts',
                    'before',
                    `after-${aiSystem}`,
                    { aiSystem }
                );

                expect(result).not.toBeNull();
                expect(result?.aiSystem).toBe(aiSystem);
            }
        });

        it('works without optional context fields', async () => {
            const result = await context.tracker.trackFileChange(
                '/repo/file.ts',
                'old',
                'new',
                { aiSystem: 'workspace' }
            );

            expect(result).not.toBeNull();
            const storedDiff = context.storeFileDiffMock.mock.calls[0]?.[0] as FileDiff;
            expect(storedDiff.chatSessionId).toBeUndefined();
            expect(storedDiff.changeReason).toBeUndefined();
            expect(storedDiff.metadata).toBeUndefined();
        });

        it('generates valid unified diff format', async () => {
            const result = await context.tracker.trackFileChange(
                '/repo/app.ts',
                'line1\nline2\nline3\n',
                'line1\nmodified\nline3\nnew-line\n',
                { aiSystem: 'chat' }
            );

            expect(result).not.toBeNull();
            const diff = result!.diffContent;
            expect(diff).toContain('---');
            expect(diff).toContain('+++');
            expect(diff).toContain('@@');
            expect(diff).toContain('-line2');
            expect(diff).toContain('+modified');
            expect(diff).toContain('+new-line');
        });

        it('returns null and does not throw when storeDiff fails', async () => {
            const failingContext = createTracker({
                storeFileDiff: vi.fn().mockRejectedValue(new Error('Write failed')),
            });

            const result = await failingContext.tracker.trackFileChange(
                '/repo/file.ts',
                'old',
                'new',
                { aiSystem: 'chat' }
            );

            expect(result).toBeNull();
            expect(failingContext.emitMock).not.toHaveBeenCalled();
        });

        it('stores the resolved file path', async () => {
            const result = await context.tracker.trackFileChange(
                '/absolute/repo/file.ts',
                'a',
                'b',
                { aiSystem: 'chat' }
            );

            expect(result).not.toBeNull();
            const storedDiff = context.storeFileDiffMock.mock.calls[0]?.[0] as FileDiff;
            expect(storedDiff.filePath).toContain('file.ts');
        });
    });

    // ── Diff Statistics ─────────────────────────────────────────────

    describe('getDiffStats', () => {
        it('counts additions and deletions correctly', () => {
            const diffContent = [
                '--- a/file.ts',
                '+++ b/file.ts',
                '@@ -1,3 +1,3 @@',
                '-old line 1',
                '-old line 2',
                '+new line 1',
                '+new line 2',
                '+new line 3',
                ' unchanged',
            ].join('\n');

            const stats = context.tracker.getDiffStats(diffContent);

            expect(stats.additions).toBe(3);
            expect(stats.deletions).toBe(2);
            expect(stats.changes).toBe(5);
        });

        it('excludes --- and +++ header lines from counts', () => {
            const diffContent = [
                '--- a/file.ts',
                '+++ b/file.ts',
                '@@ -1,1 +1,1 @@',
                '-removed',
                '+added',
            ].join('\n');

            const stats = context.tracker.getDiffStats(diffContent);

            expect(stats.additions).toBe(1);
            expect(stats.deletions).toBe(1);
            expect(stats.changes).toBe(2);
        });

        it('returns zeroes for empty diff content', () => {
            const stats = context.tracker.getDiffStats('');

            expect(stats.additions).toBe(0);
            expect(stats.deletions).toBe(0);
            expect(stats.changes).toBe(0);
        });

        it('returns zeroes for context-only diff (no changes)', () => {
            const diffContent = [
                '--- a/file.ts',
                '+++ b/file.ts',
                '@@ -1,2 +1,2 @@',
                ' unchanged line 1',
                ' unchanged line 2',
            ].join('\n');

            const stats = context.tracker.getDiffStats(diffContent);

            expect(stats.additions).toBe(0);
            expect(stats.deletions).toBe(0);
            expect(stats.changes).toBe(0);
        });

        it('handles additions-only diff', () => {
            const diffContent = [
                '--- a/file.ts',
                '+++ b/file.ts',
                '@@ -0,0 +1,2 @@',
                '+new line 1',
                '+new line 2',
            ].join('\n');

            const stats = context.tracker.getDiffStats(diffContent);

            expect(stats.additions).toBe(2);
            expect(stats.deletions).toBe(0);
            expect(stats.changes).toBe(2);
        });

        it('handles deletions-only diff', () => {
            const diffContent = [
                '--- a/file.ts',
                '+++ b/file.ts',
                '@@ -1,3 +0,0 @@',
                '-deleted 1',
                '-deleted 2',
                '-deleted 3',
            ].join('\n');

            const stats = context.tracker.getDiffStats(diffContent);

            expect(stats.additions).toBe(0);
            expect(stats.deletions).toBe(3);
            expect(stats.changes).toBe(3);
        });
    });

    // ── File Revert ─────────────────────────────────────────────────

    describe('revertFileChange', () => {
        it('writes before-content back to disk on successful revert', async () => {
            const mockDiff: FileDiff = {
                id: 'diff-001',
                aiSystem: 'chat',
                filePath: '/repo/reverted.ts',
                beforeContent: 'original content',
                afterContent: 'modified content',
                diffContent: 'some diff',
                timestamp: 1_717_171_717_000,
            };
            const ctx = createTracker({
                getFileDiff: vi.fn().mockResolvedValue(mockDiff),
            });

            const result = await ctx.tracker.revertFileChange('diff-001');

            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();
            expect(fs.writeFile).toHaveBeenCalledWith('/repo/reverted.ts', 'original content', 'utf-8');
        });

        it('returns error when diff ID is not found', async () => {
            const result = await context.tracker.revertFileChange('nonexistent-id');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Diff not found');
            expect(fs.writeFile).not.toHaveBeenCalled();
        });

        it('returns error when filesystem write fails', async () => {
            const mockDiff: FileDiff = {
                id: 'diff-002',
                aiSystem: 'workspace',
                filePath: '/repo/locked.ts',
                beforeContent: 'old content',
                afterContent: 'new content',
                diffContent: 'diff',
                timestamp: 1_717_171_717_000,
            };
            const ctx = createTracker({
                getFileDiff: vi.fn().mockResolvedValue(mockDiff),
            });
            vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error('Permission denied'));

            const result = await ctx.tracker.revertFileChange('diff-002');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Permission denied');
        });

        it('returns error when getFileDiff throws', async () => {
            const ctx = createTracker({
                getFileDiff: vi.fn().mockRejectedValue(new Error('DB read error')),
            });

            const result = await ctx.tracker.revertFileChange('diff-003');

            expect(result.success).toBe(false);
            expect(result.error).toBe('DB read error');
        });
    });

    // ── Integration: trackFileChange + getDiffStats ─────────────────

    describe('end-to-end diff flow', () => {
        it('produces accurate stats from a tracked change', async () => {
            const result = await context.tracker.trackFileChange(
                '/repo/component.tsx',
                'const a = 1;\nconst b = 2;\nconst c = 3;\n',
                'const a = 1;\nconst b = 42;\nconst d = 4;\n',
                { aiSystem: 'council', changeReason: 'refactor' }
            );

            expect(result).not.toBeNull();
            const stats = context.tracker.getDiffStats(result!.diffContent);

            expect(stats.additions).toBeGreaterThan(0);
            expect(stats.deletions).toBeGreaterThan(0);
            expect(stats.changes).toBe(stats.additions + stats.deletions);
        });
    });
});
