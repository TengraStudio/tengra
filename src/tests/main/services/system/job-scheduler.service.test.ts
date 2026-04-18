/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { DatabaseService } from '@main/services/data/database.service';
import { JobSchedulerService } from '@main/services/system/job-scheduler.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock modules
vi.mock('@main/logging/logger', () => ({
    appLogger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }
}));

vi.mock('electron', () => ({
    app: { getPath: vi.fn().mockReturnValue('/mock/userData') }
}));

vi.mock('fs', () => ({
    existsSync: vi.fn().mockReturnValue(false),
    promises: {
        readFile: vi.fn(),
        rename: vi.fn()
    }
}));

describe('JobSchedulerService', () => {
    let service: JobSchedulerService;
    let mockDatabaseService: DatabaseService;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();

        mockDatabaseService = {
            getAllJobStates: vi.fn().mockResolvedValue({}),
            updateJobLastRun: vi.fn().mockResolvedValue(undefined),
            getJobState: vi.fn().mockResolvedValue(null)
        } as never as DatabaseService;

        service = new JobSchedulerService(mockDatabaseService);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('schedule', () => {
        it('should schedule a task with debounce', async () => {
            const task = vi.fn().mockResolvedValue(undefined);

            service.schedule('test-key', task, 1000);

            // Task should not run immediately
            expect(task).not.toHaveBeenCalled();

            // Advance time
            await vi.advanceTimersByTimeAsync(1000);

            expect(task).toHaveBeenCalledTimes(1);
        });

        it('should replace existing task with same key', async () => {
            const task1 = vi.fn().mockResolvedValue(undefined);
            const task2 = vi.fn().mockResolvedValue(undefined);

            service.schedule('test-key', task1, 1000);
            service.schedule('test-key', task2, 1000);

            await vi.advanceTimersByTimeAsync(1000);

            expect(task1).not.toHaveBeenCalled();
            expect(task2).toHaveBeenCalledTimes(1);
        });
    });

    describe('cancel', () => {
        it('should cancel a scheduled task', async () => {
            const task = vi.fn().mockResolvedValue(undefined);

            service.schedule('test-key', task, 1000);
            service.cancel('test-key');

            await vi.advanceTimersByTimeAsync(1000);

            expect(task).not.toHaveBeenCalled();
        });

        it('should handle canceling non-existent task gracefully', () => {
            expect(() => service.cancel('non-existent')).not.toThrow();
        });
    });

    describe('registerRecurringJob', () => {
        it('should register a recurring job', () => {
            const task = vi.fn().mockResolvedValue(undefined);
            const intervalGetter = () => 5000;

            service.registerRecurringJob('recurring-test', task, intervalGetter);

            // Job should be registered but not executed yet
            expect(task).not.toHaveBeenCalled();
        });
    });

    describe('start', () => {
        it('should start scheduler and schedule registered jobs', async () => {
            const task = vi.fn().mockResolvedValue(undefined);
            service.registerRecurringJob('test-job', task, () => 1000);

            await service.start();

            // Job should be scheduled to run
            expect(mockDatabaseService.getAllJobStates).toHaveBeenCalled();
        });

        it('should use last run time from database state', async () => {
            const now = Date.now();
            vi.setSystemTime(now);

            (mockDatabaseService.getAllJobStates as ReturnType<typeof vi.fn>).mockResolvedValue({
                'test-job': { lastRun: now - 500 }
            });

            const task = vi.fn().mockResolvedValue(undefined);
            service.registerRecurringJob('test-job', task, () => 1000);

            await service.start();

            // Should not run immediately since lastRun + interval > now
            expect(task).not.toHaveBeenCalled();

            // Advance to when job should run (500ms remaining)
            await vi.advanceTimersByTimeAsync(500);

            expect(task).toHaveBeenCalledTimes(1);
        });
    });

    describe('cleanup', () => {
        it('should clear all timers on cleanup', async () => {
            const task = vi.fn().mockResolvedValue(undefined);
            service.schedule('test-key', task, 5000);
            service.registerRecurringJob('recurring', task, () => 5000);
            await service.start();

            await service.cleanup();

            // Advance time - tasks should not run
            await vi.advanceTimersByTimeAsync(10000);

            // Only the initial recurring job execution might have happened
            // The key point is cleanup clears pending timers
            expect(task.mock.calls.length).toBeLessThanOrEqual(1);
        });
    });
});
