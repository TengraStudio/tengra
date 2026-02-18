import { DatabaseService } from '@main/services/data/database.service';
import { FileChangeTracker } from '@main/services/data/file-change-tracker.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { JsonObject } from '@shared/types/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('uuid', () => ({
    v4: vi.fn(() => 'diff-id-001'),
}));

interface TrackerTestContext {
    tracker: FileChangeTracker;
    ensureFileDiffTableMock: ReturnType<typeof vi.fn>;
    storeFileDiffMock: ReturnType<typeof vi.fn>;
    emitMock: ReturnType<typeof vi.fn>;
}

const createTracker = (): TrackerTestContext => {
    const ensureFileDiffTableMock = vi.fn().mockResolvedValue(undefined);
    const storeFileDiffMock = vi.fn().mockResolvedValue(undefined);
    const getFileDiffMock = vi.fn().mockResolvedValue(null);
    const emitMock = vi.fn();

    const databaseService = {
        ensureFileDiffTable: ensureFileDiffTableMock,
        storeFileDiff: storeFileDiffMock,
        getFileDiff: getFileDiffMock,
    } as unknown as DatabaseService;

    const eventBusService = {
        emit: emitMock,
    } as unknown as EventBusService;

    return {
        tracker: new FileChangeTracker(databaseService, eventBusService),
        ensureFileDiffTableMock,
        storeFileDiffMock,
        emitMock,
    };
};

describe('FileChangeTracker', () => {
    let context: TrackerTestContext;

    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(Date, 'now').mockReturnValue(1_717_171_717_000);
        context = createTracker();
    });

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

        const storedDiff = context.storeFileDiffMock.mock.calls[0]?.[0];
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
            aiSystem: 'project',
        });

        expect(result).toBeNull();
        expect(context.storeFileDiffMock).not.toHaveBeenCalled();
        expect(context.emitMock).not.toHaveBeenCalled();
    });
});
