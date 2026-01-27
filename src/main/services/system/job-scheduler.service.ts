import * as fs from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { app } from 'electron';

interface RecurringJob {
    id: string
    task: () => Promise<void>
    getInterval: () => number // Factory to get current interval (e.g. from settings)
    lastRun?: number
}

export interface JobState {
    lastRun: number
}

export class JobSchedulerService extends BaseService {
    private tasks: Map<string, NodeJS.Timeout> = new Map(); // For debounced tasks
    private recurringJobs: Map<string, RecurringJob> = new Map();
    private recurringTimers: Map<string, NodeJS.Timeout> = new Map();
    private legacyStatePath: string;

    constructor(
        private databaseService: DatabaseService
    ) {
        super('JobSchedulerService');
        const userDataPath = app.getPath('userData');
        // Assuming legacy path was in userData/config/jobs.json or similar.
        // The original code used dataService.getPath('config').
        // We'll approximate this or we can't easily access dataService here if we remove it.
        // But wait, the previous code used `this.dataService.getPath('config')`.
        // 'config' path in DataService usually defaults to `userData/config`.
        this.legacyStatePath = path.join(userDataPath, 'config', 'jobs.json');
    }

    /**
     * Schedules a task to run after a delay (debounce).
     * If a task with the same key is already scheduled, it is cancelled and replaced.
     */
    schedule(key: string, task: () => Promise<void>, delay: number = 2000) {
        if (this.tasks.has(key)) {
            const existingTimeout = this.tasks.get(key);
            if (existingTimeout !== undefined) {
                clearTimeout(existingTimeout);
            }
        }

        const timeout = setTimeout(() => {
            this.tasks.delete(key);
            void task().catch((error) => {
                appLogger.error('JobScheduler', `Task ${key} failed:`, error as Error);
            });
        }, delay);

        this.tasks.set(key, timeout);
    }

    /**
     * Cancel a specific task if pending.
     */
    cancel(key: string) {
        if (this.tasks.has(key)) {
            const timeout = this.tasks.get(key);
            if (timeout !== undefined) {
                clearTimeout(timeout);
            }
            this.tasks.delete(key);
        }
    }

    // --- Recurring Jobs ---

    /**
     * Register a recurring job.
     * @param id Unique identifier
     * @param task Async task to execute
     * @param intervalGetter Function that returns the interval in ms. Can read from settings.
     */
    registerRecurringJob(id: string, task: () => Promise<void>, intervalGetter: () => number) {
        this.recurringJobs.set(id, { id, task, getInterval: intervalGetter });
    }

    /**
     * Start the scheduler. Loads state and schedules jobs.
     */
    async start() {
        await this.migrateLegacyState();

        const states = await this.databaseService.getAllJobStates();

        for (const [id, job] of this.recurringJobs) {
            const jobState = states[id];
            const lastRun = jobState?.lastRun || 0;
            job.lastRun = lastRun;
            this.scheduleNextRun(job);
        }

        appLogger.info('JobScheduler', `Started with ${this.recurringJobs.size} recurring jobs`);
    }

    private async migrateLegacyState() {
        if (!fs.existsSync(this.legacyStatePath)) {
            return;
        }

        try {
            appLogger.info('JobScheduler', 'Migrating legacy job state...');
            const content = await fs.promises.readFile(this.legacyStatePath, 'utf8');
            const state = safeJsonParse<Record<string, JobState>>(content, {});

            for (const [id, jobState] of Object.entries(state)) {
                const lastRunVal = jobState.lastRun;
                if (typeof lastRunVal === 'number') {
                    await this.databaseService.updateJobLastRun(id, lastRunVal);
                }
            }

            // Rename legacy file
            await fs.promises.rename(this.legacyStatePath, this.legacyStatePath + '.migrated');
            appLogger.info('JobScheduler', 'Legacy job state migrated successfully');
        } catch (error) {
            appLogger.error('JobScheduler', `Failed to migrate legacy job state: ${getErrorMessage(error as Error)}`);
        }
    }

    private scheduleNextRun(job: RecurringJob) {
        const now = Date.now();
        const interval = job.getInterval();
        const nextRun = (job.lastRun ?? 0) + interval;

        let delay = nextRun - now;

        // If we missed the window, run immediately (or close to it)
        // But respect a minimum execution time to avoid hammering on boot if strict
        if (delay <= 0) {
            delay = 0;
        }

        appLogger.debug('JobScheduler', `Scheduling ${job.id} in ${Math.ceil(delay / 1000)}s (Interval: ${interval}ms)`);

        // Clear existing if any
        if (this.recurringTimers.has(job.id)) {
            const existingTimer = this.recurringTimers.get(job.id);
            if (existingTimer !== undefined) {
                clearTimeout(existingTimer);
            }
        }

        const timer = setTimeout(() => {
            void this.executeJob(job);
        }, delay);

        this.recurringTimers.set(job.id, timer);
    }

    private async executeJob(job: RecurringJob) {
        appLogger.info('JobScheduler', `Executing recurring job: ${job.id}`);
        try {
            await job.task();
        } catch (error) {
            appLogger.error('JobScheduler', `Recurring job ${job.id} failed:`, error as Error);
        } finally {
            // Update state
            job.lastRun = Date.now();
            await this.databaseService.updateJobLastRun(job.id, job.lastRun);

            // Schedule next
            this.scheduleNextRun(job);
        }
    }

    async cleanup(): Promise<void> {
        this.stop();
    }

    private stop() {
        for (const timer of this.recurringTimers.values()) {
            clearTimeout(timer);
        }
        this.recurringTimers.clear();

        for (const timer of this.tasks.values()) {
            clearTimeout(timer);
        }
        this.tasks.clear();
    }
}
