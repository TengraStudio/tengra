import { UsageTrackingService } from '@main/services/analysis/usage-tracking.service';
import { AppSettings } from '@shared/types/settings';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fs/promises
vi.mock('fs/promises', () => ({
    access: vi.fn(),
    readFile: vi.fn(),
    rename: vi.fn(),
}));

// Mock the logger
vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

import * as fsPromises from 'fs/promises';

interface MockDatabaseService {
    addUsageRecord: ReturnType<typeof vi.fn>;
    getUsageCount: ReturnType<typeof vi.fn>;
    cleanupUsageRecords: ReturnType<typeof vi.fn>;
}

function createMockDatabaseService(): MockDatabaseService {
    return {
        addUsageRecord: vi.fn().mockResolvedValue(undefined),
        getUsageCount: vi.fn().mockResolvedValue(0),
        cleanupUsageRecords: vi.fn().mockResolvedValue(undefined),
    };
}

type PeriodLimitConfig = {
    enabled: boolean;
    type: 'requests' | 'percentage';
    value: number;
};

function createSettings(copilotLimits?: {
    hourly?: PeriodLimitConfig;
    daily?: PeriodLimitConfig;
    weekly?: PeriodLimitConfig;
}): AppSettings {
    return {
        modelUsageLimits: copilotLimits ? { copilot: copilotLimits } : undefined,
    } as AppSettings;
}

describe('UsageTrackingService', () => {
    let service: UsageTrackingService;
    let mockDb: MockDatabaseService;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));

        mockDb = createMockDatabaseService();

        // No legacy file by default
        vi.mocked(fsPromises.access).mockRejectedValue(new Error('ENOENT'));

        // Cast needed because UsageTrackingService expects full DatabaseService
        service = new UsageTrackingService(mockDb as never as ConstructorParameters<typeof UsageTrackingService>[0]);

        // Wait for constructor's async initialize to complete
        await vi.runAllTimersAsync();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('constructor and initialization', () => {
        it('should create service and call cleanup on init', async () => {
            expect(service).toBeDefined();
            expect(mockDb.cleanupUsageRecords).toHaveBeenCalledTimes(1);
        });

        it('should pass one-week-ago timestamp to cleanupUsageRecords', async () => {
            const now = Date.now();
            const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
            expect(mockDb.cleanupUsageRecords).toHaveBeenCalledWith(oneWeekAgo);
        });

        it('should not migrate when no legacy file exists', async () => {
            expect(mockDb.addUsageRecord).not.toHaveBeenCalled();
            expect(vi.mocked(fsPromises.rename)).not.toHaveBeenCalled();
        });
    });

    describe('legacy data migration', () => {
        it('should migrate weekly records from legacy file', async () => {
            vi.clearAllMocks();
            const legacyData = JSON.stringify({
                hourly: [{ timestamp: 100, provider: 'h-prov', model: 'h-model' }],
                daily: [{ timestamp: 200, provider: 'd-prov', model: 'd-model' }],
                weekly: [
                    { timestamp: 1000, provider: 'copilot', model: 'gpt-4' },
                    { timestamp: 2000, provider: 'ollama', model: 'llama3' },
                ],
            });

            vi.mocked(fsPromises.access).mockResolvedValue(undefined);
            vi.mocked(fsPromises.readFile).mockResolvedValue(legacyData);
            vi.mocked(fsPromises.rename).mockResolvedValue(undefined);

            const freshDb = createMockDatabaseService();
            new UsageTrackingService(freshDb as never as ConstructorParameters<typeof UsageTrackingService>[0]);
            await vi.runAllTimersAsync();

            expect(freshDb.addUsageRecord).toHaveBeenCalledTimes(2);
            expect(freshDb.addUsageRecord).toHaveBeenCalledWith({
                provider: 'copilot',
                model: 'gpt-4',
                timestamp: 1000,
            });
            expect(freshDb.addUsageRecord).toHaveBeenCalledWith({
                provider: 'ollama',
                model: 'llama3',
                timestamp: 2000,
            });
        });

        it('should rename legacy file after migration', async () => {
            vi.clearAllMocks();
            vi.mocked(fsPromises.access).mockResolvedValue(undefined);
            vi.mocked(fsPromises.readFile).mockResolvedValue(JSON.stringify({ weekly: [] }));
            vi.mocked(fsPromises.rename).mockResolvedValue(undefined);

            const freshDb = createMockDatabaseService();
            new UsageTrackingService(freshDb as never as ConstructorParameters<typeof UsageTrackingService>[0]);
            await vi.runAllTimersAsync();

            expect(vi.mocked(fsPromises.rename)).toHaveBeenCalledTimes(1);
            const renameCall = vi.mocked(fsPromises.rename).mock.calls[0];
            expect(renameCall[1]).toContain('.migrated');
        });

        it('should handle empty weekly array in legacy data', async () => {
            vi.clearAllMocks();
            vi.mocked(fsPromises.access).mockResolvedValue(undefined);
            vi.mocked(fsPromises.readFile).mockResolvedValue(JSON.stringify({ weekly: [] }));
            vi.mocked(fsPromises.rename).mockResolvedValue(undefined);

            const freshDb = createMockDatabaseService();
            new UsageTrackingService(freshDb as never as ConstructorParameters<typeof UsageTrackingService>[0]);
            await vi.runAllTimersAsync();

            expect(freshDb.addUsageRecord).not.toHaveBeenCalled();
        });

        it('should handle malformed legacy JSON gracefully', async () => {
            vi.clearAllMocks();
            vi.mocked(fsPromises.access).mockResolvedValue(undefined);
            vi.mocked(fsPromises.readFile).mockResolvedValue('not valid json{{{');
            vi.mocked(fsPromises.rename).mockResolvedValue(undefined);

            const freshDb = createMockDatabaseService();
            new UsageTrackingService(freshDb as never as ConstructorParameters<typeof UsageTrackingService>[0]);
            await vi.runAllTimersAsync();

            // safeJsonParse returns default => empty weekly => no records added
            expect(freshDb.addUsageRecord).not.toHaveBeenCalled();
        });

        it('should handle read error gracefully without throwing', async () => {
            vi.clearAllMocks();
            vi.mocked(fsPromises.access).mockResolvedValue(undefined);
            vi.mocked(fsPromises.readFile).mockRejectedValue(new Error('Permission denied'));

            const freshDb = createMockDatabaseService();
            new UsageTrackingService(freshDb as never as ConstructorParameters<typeof UsageTrackingService>[0]);
            await vi.runAllTimersAsync();

            // Should not throw; error is caught internally
            expect(freshDb.addUsageRecord).not.toHaveBeenCalled();
        });

        it('should handle missing weekly key in legacy data', async () => {
            vi.clearAllMocks();
            vi.mocked(fsPromises.access).mockResolvedValue(undefined);
            vi.mocked(fsPromises.readFile).mockResolvedValue(JSON.stringify({ hourly: [], daily: [] }));
            vi.mocked(fsPromises.rename).mockResolvedValue(undefined);

            const freshDb = createMockDatabaseService();
            new UsageTrackingService(freshDb as never as ConstructorParameters<typeof UsageTrackingService>[0]);
            await vi.runAllTimersAsync();

            expect(freshDb.addUsageRecord).not.toHaveBeenCalled();
        });
    });

    describe('recordUsage', () => {
        it('should add a usage record with current timestamp', async () => {
            const now = Date.now();
            await service.recordUsage('copilot', 'gpt-4');

            expect(mockDb.addUsageRecord).toHaveBeenCalledWith({
                provider: 'copilot',
                model: 'gpt-4',
                timestamp: now,
            });
        });

        it('should handle different providers and models', async () => {
            await service.recordUsage('ollama', 'llama3');
            await service.recordUsage('openai', 'gpt-3.5-turbo');

            expect(mockDb.addUsageRecord).toHaveBeenCalledTimes(2);
            expect(mockDb.addUsageRecord).toHaveBeenCalledWith(
                expect.objectContaining({ provider: 'ollama', model: 'llama3' })
            );
            expect(mockDb.addUsageRecord).toHaveBeenCalledWith(
                expect.objectContaining({ provider: 'openai', model: 'gpt-3.5-turbo' })
            );
        });

        it('should propagate database errors', async () => {
            mockDb.addUsageRecord.mockRejectedValue(new Error('DB write failed'));
            await expect(service.recordUsage('copilot', 'gpt-4')).rejects.toThrow('DB write failed');
        });

        it('should handle empty string provider and model', async () => {
            await service.recordUsage('', '');
            expect(mockDb.addUsageRecord).toHaveBeenCalledWith(
                expect.objectContaining({ provider: '', model: '' })
            );
        });
    });

    describe('getUsageCount', () => {
        it('should query hourly usage with correct since timestamp', async () => {
            const now = Date.now();
            const oneHourAgo = now - 60 * 60 * 1000;

            mockDb.getUsageCount.mockResolvedValue(5);
            const count = await service.getUsageCount('hourly');

            expect(count).toBe(5);
            expect(mockDb.getUsageCount).toHaveBeenCalledWith(oneHourAgo, undefined, undefined);
        });

        it('should query daily usage with correct since timestamp', async () => {
            const now = Date.now();
            const oneDayAgo = now - 24 * 60 * 60 * 1000;

            mockDb.getUsageCount.mockResolvedValue(50);
            const count = await service.getUsageCount('daily');

            expect(count).toBe(50);
            expect(mockDb.getUsageCount).toHaveBeenCalledWith(oneDayAgo, undefined, undefined);
        });

        it('should query weekly usage with correct since timestamp', async () => {
            const now = Date.now();
            const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

            mockDb.getUsageCount.mockResolvedValue(200);
            const count = await service.getUsageCount('weekly');

            expect(count).toBe(200);
            expect(mockDb.getUsageCount).toHaveBeenCalledWith(oneWeekAgo, undefined, undefined);
        });

        it('should pass provider filter to database', async () => {
            await service.getUsageCount('hourly', 'copilot');
            expect(mockDb.getUsageCount).toHaveBeenCalledWith(
                expect.any(Number),
                'copilot',
                undefined
            );
        });

        it('should pass both provider and model filters to database', async () => {
            await service.getUsageCount('daily', 'copilot', 'gpt-4');
            expect(mockDb.getUsageCount).toHaveBeenCalledWith(
                expect.any(Number),
                'copilot',
                'gpt-4'
            );
        });

        it('should propagate database errors', async () => {
            mockDb.getUsageCount.mockRejectedValue(new Error('DB read failed'));
            await expect(service.getUsageCount('hourly')).rejects.toThrow('DB read failed');
        });
    });

    describe('checkLimit', () => {
        it('should allow when no limits are configured', async () => {
            const settings = createSettings();
            const result = await service.checkLimit(settings, 'copilot', 'gpt-4');
            expect(result).toEqual({ allowed: true });
        });

        it('should allow when provider is not copilot', async () => {
            const settings = createSettings({
                hourly: { enabled: true, type: 'requests', value: 10 },
            });
            const result = await service.checkLimit(settings, 'ollama', 'llama3');
            expect(result).toEqual({ allowed: true });
        });

        it('should allow when copilot limits are undefined', async () => {
            const settings = { modelUsageLimits: {} } as AppSettings;
            const result = await service.checkLimit(settings, 'copilot', 'gpt-4');
            expect(result).toEqual({ allowed: true });
        });

        it('should allow when usage is below hourly request limit', async () => {
            mockDb.getUsageCount.mockResolvedValue(5);
            const settings = createSettings({
                hourly: { enabled: true, type: 'requests', value: 10 },
            });
            const result = await service.checkLimit(settings, 'copilot', 'gpt-4');
            expect(result).toEqual({ allowed: true });
        });

        it('should deny when hourly request limit is reached', async () => {
            mockDb.getUsageCount.mockResolvedValue(10);
            const settings = createSettings({
                hourly: { enabled: true, type: 'requests', value: 10 },
            });
            const result = await service.checkLimit(settings, 'copilot', 'gpt-4');
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Hourly');
            expect(result.reason).toContain('10/10');
            expect(result.reason).toContain('requests');
        });

        it('should deny when hourly request limit is exceeded', async () => {
            mockDb.getUsageCount.mockResolvedValue(15);
            const settings = createSettings({
                hourly: { enabled: true, type: 'requests', value: 10 },
            });
            const result = await service.checkLimit(settings, 'copilot', 'gpt-4');
            expect(result.allowed).toBe(false);
        });

        it('should skip disabled period limits', async () => {
            mockDb.getUsageCount.mockResolvedValue(100);
            const settings = createSettings({
                hourly: { enabled: false, type: 'requests', value: 10 },
            });
            const result = await service.checkLimit(settings, 'copilot', 'gpt-4');
            expect(result).toEqual({ allowed: true });
            expect(mockDb.getUsageCount).not.toHaveBeenCalled();
        });

        it('should check daily limits', async () => {
            mockDb.getUsageCount.mockResolvedValue(50);
            const settings = createSettings({
                daily: { enabled: true, type: 'requests', value: 50 },
            });
            const result = await service.checkLimit(settings, 'copilot', 'gpt-4');
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Daily');
        });

        it('should check weekly limits', async () => {
            mockDb.getUsageCount.mockResolvedValue(200);
            const settings = createSettings({
                weekly: { enabled: true, type: 'requests', value: 200 },
            });
            const result = await service.checkLimit(settings, 'copilot', 'gpt-4');
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Weekly');
        });

        it('should check periods in order and stop at first exceeded', async () => {
            // Hourly at limit, daily not
            mockDb.getUsageCount.mockResolvedValueOnce(10); // hourly check
            const settings = createSettings({
                hourly: { enabled: true, type: 'requests', value: 10 },
                daily: { enabled: true, type: 'requests', value: 1000 },
            });
            const result = await service.checkLimit(settings, 'copilot', 'gpt-4');
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Hourly');
            // Should only check hourly, not daily
            expect(mockDb.getUsageCount).toHaveBeenCalledTimes(1);
        });

        it('should handle percentage-based limits with quota', async () => {
            mockDb.getUsageCount.mockResolvedValue(40);
            const settings = createSettings({
                hourly: { enabled: true, type: 'percentage', value: 50 },
            });
            const quota = { remaining: 80, limit: 100 };
            const result = await service.checkLimit(settings, 'copilot', 'gpt-4', quota);

            // limitValue = Math.round(80 * (50 / 100)) = 40
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('%');
        });

        it('should allow percentage-based limit when usage is under quota', async () => {
            mockDb.getUsageCount.mockResolvedValue(10);
            const settings = createSettings({
                hourly: { enabled: true, type: 'percentage', value: 50 },
            });
            const quota = { remaining: 80, limit: 100 };
            const result = await service.checkLimit(settings, 'copilot', 'gpt-4', quota);

            // limitValue = Math.round(80 * (50 / 100)) = 40, usage 10 < 40
            expect(result.allowed).toBe(true);
        });

        it('should return 0 limit for percentage type when no quota provided', async () => {
            mockDb.getUsageCount.mockResolvedValue(0);
            const settings = createSettings({
                hourly: { enabled: true, type: 'percentage', value: 50 },
            });
            // No quota provided
            const result = await service.checkLimit(settings, 'copilot', 'gpt-4');

            // limitValue = 0 (no quota), usage 0 >= 0 => denied
            expect(result.allowed).toBe(false);
        });

        it('should allow all periods when usage is under all limits', async () => {
            mockDb.getUsageCount
                .mockResolvedValueOnce(5)   // hourly
                .mockResolvedValueOnce(20)  // daily
                .mockResolvedValueOnce(50); // weekly
            const settings = createSettings({
                hourly: { enabled: true, type: 'requests', value: 10 },
                daily: { enabled: true, type: 'requests', value: 100 },
                weekly: { enabled: true, type: 'requests', value: 500 },
            });
            const result = await service.checkLimit(settings, 'copilot', 'gpt-4');
            expect(result).toEqual({ allowed: true });
            expect(mockDb.getUsageCount).toHaveBeenCalledTimes(3);
        });

        it('should query usage with copilot provider filter', async () => {
            mockDb.getUsageCount.mockResolvedValue(0);
            const settings = createSettings({
                hourly: { enabled: true, type: 'requests', value: 10 },
            });
            await service.checkLimit(settings, 'copilot', 'gpt-4');
            expect(mockDb.getUsageCount).toHaveBeenCalledWith(expect.any(Number), 'copilot', undefined);
        });
    });

    describe('checkLimit - edge cases', () => {
        it('should handle zero value limit (always denied)', async () => {
            mockDb.getUsageCount.mockResolvedValue(0);
            const settings = createSettings({
                hourly: { enabled: true, type: 'requests', value: 0 },
            });
            const result = await service.checkLimit(settings, 'copilot', 'gpt-4');
            expect(result.allowed).toBe(false);
        });

        it('should handle percentage with zero remaining quota', async () => {
            mockDb.getUsageCount.mockResolvedValue(0);
            const settings = createSettings({
                daily: { enabled: true, type: 'percentage', value: 50 },
            });
            const quota = { remaining: 0, limit: 100 };
            const result = await service.checkLimit(settings, 'copilot', 'gpt-4', quota);

            // limitValue = Math.round(0 * (50/100)) = 0, usage 0 >= 0 => denied
            expect(result.allowed).toBe(false);
        });

        it('should handle percentage at 100% of remaining quota', async () => {
            mockDb.getUsageCount.mockResolvedValue(79);
            const settings = createSettings({
                daily: { enabled: true, type: 'percentage', value: 100 },
            });
            const quota = { remaining: 80, limit: 100 };
            const result = await service.checkLimit(settings, 'copilot', 'gpt-4', quota);

            // limitValue = Math.round(80 * (100/100)) = 80, usage 79 < 80 => allowed
            expect(result.allowed).toBe(true);
        });

        it('should handle undefined period limits in copilot config', async () => {
            const settings = createSettings({});
            const result = await service.checkLimit(settings, 'copilot', 'gpt-4');
            expect(result).toEqual({ allowed: true });
        });

        it('should capitalize period name correctly in denial reason', async () => {
            mockDb.getUsageCount.mockResolvedValue(10);
            const settings = createSettings({
                hourly: { enabled: true, type: 'requests', value: 10 },
            });
            const result = await service.checkLimit(settings, 'copilot', 'gpt-4');
            expect(result.reason).toMatch(/^Hourly limit reached/);
        });
    });

    describe('initialization error handling', () => {
        it('should handle cleanup failure during initialization gracefully', async () => {
            vi.clearAllMocks();
            vi.mocked(fsPromises.access).mockRejectedValue(new Error('ENOENT'));

            const failingDb = createMockDatabaseService();
            failingDb.cleanupUsageRecords.mockRejectedValue(new Error('DB error'));

            // Should not throw
            new UsageTrackingService(failingDb as never as ConstructorParameters<typeof UsageTrackingService>[0]);
            await vi.runAllTimersAsync();

            expect(failingDb.cleanupUsageRecords).toHaveBeenCalled();
        });

        it('should handle migration addUsageRecord failure gracefully', async () => {
            vi.clearAllMocks();
            vi.mocked(fsPromises.access).mockResolvedValue(undefined);
            vi.mocked(fsPromises.readFile).mockResolvedValue(
                JSON.stringify({ weekly: [{ timestamp: 1000, provider: 'copilot', model: 'gpt-4' }] })
            );

            const failingDb = createMockDatabaseService();
            failingDb.addUsageRecord.mockRejectedValue(new Error('DB insert failed'));

            // Should not throw
            new UsageTrackingService(failingDb as never as ConstructorParameters<typeof UsageTrackingService>[0]);
            await vi.runAllTimersAsync();

            expect(failingDb.addUsageRecord).toHaveBeenCalled();
        });
    });
});
