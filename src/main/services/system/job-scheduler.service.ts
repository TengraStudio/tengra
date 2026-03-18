import * as fs from 'fs';
import * as path from 'path';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { app } from 'electron';

interface RecurringJobOptions {
    persistState: boolean
    runOnStart: boolean
    rescheduleOnPowerChange: boolean
}

interface RecurringJob {
    id: string
    task: () => Promise<void>
    getInterval: () => number
    options: RecurringJobOptions
    lastRun?: number
}

export interface JobState {
    lastRun: number
}

const DEFAULT_RECURRING_JOB_OPTIONS: RecurringJobOptions = {
    persistState: true,
    runOnStart: true,
    rescheduleOnPowerChange: true,
};

export class JobSchedulerService extends BaseService {
    private tasks: Map<string, NodeJS.Timeout> = new Map();
    private recurringJobs: Map<string, RecurringJob> = new Map();
    private recurringTimers: Map<string, NodeJS.Timeout> = new Map();
    private persistedStates: Record<string, JobState> = {};
    private started = false;
    private unsubscribePowerState: (() => void) | null = null;
    private legacyStatePath: string;

    constructor(
        private databaseService: DatabaseService,
        private eventBus?: EventBusService
    ) {
        super('JobSchedulerService');
        const userDataPath = app.getPath('userData');
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
    registerRecurringJob(
        id: string,
        task: () => Promise<void>,
        intervalGetter: () => number,
        options?: Partial<RecurringJobOptions>
    ) {
        const existingJob = this.recurringJobs.get(id);
        const job: RecurringJob = {
            id,
            task,
            getInterval: intervalGetter,
            options: {
                ...DEFAULT_RECURRING_JOB_OPTIONS,
                ...(options ?? {}),
            },
            lastRun: existingJob?.lastRun,
        };
        this.recurringJobs.set(id, job);
        this.clearRecurringTimer(id);

        if (this.started) {
            this.prepareJob(job, existingJob);
            this.scheduleNextRun(job);
        }
    }

    unregisterRecurringJob(id: string) {
        this.clearRecurringTimer(id);
        this.recurringJobs.delete(id);
        delete this.persistedStates[id];
    }

    /**
     * Start the scheduler. Loads state and schedules jobs.
     */
    async start() {
        if (this.started) {
            return;
        }

        await this.migrateLegacyState();
        this.persistedStates = await this.loadPersistedStates();
        this.started = true;
        this.bindPowerStateListener();

        for (const job of this.recurringJobs.values()) {
            this.prepareJob(job);
            this.scheduleNextRun(job);
        }

        appLogger.info('JobScheduler', `Started with ${this.recurringJobs.size} recurring jobs`);
    }

    private bindPowerStateListener(): void {
        if (this.unsubscribePowerState || !this.eventBus) {
            return;
        }
        this.unsubscribePowerState = this.eventBus.on('power:state-changed', () => {
            this.reschedulePowerAwareJobs();
        });
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

    private async loadPersistedStates(): Promise<Record<string, JobState>> {
        try {
            return await this.databaseService.getAllJobStates();
        } catch (error) {
            appLogger.warn(
                'JobScheduler',
                `Falling back to in-memory job state only: ${getErrorMessage(error as Error)}`
            );
            return {};
        }
    }

    private prepareJob(job: RecurringJob, existingJob?: RecurringJob): void {
        job.lastRun = this.getInitialLastRun(job, existingJob);
    }

    private getInitialLastRun(job: RecurringJob, existingJob?: RecurringJob): number {
        if (typeof existingJob?.lastRun === 'number') {
            return existingJob.lastRun;
        }

        const persistedJobState = this.persistedStates[job.id];
        if (persistedJobState && typeof persistedJobState.lastRun === 'number') {
            return persistedJobState.lastRun;
        }

        return job.options.runOnStart ? 0 : Date.now();
    }

    private reschedulePowerAwareJobs(): void {
        for (const job of this.recurringJobs.values()) {
            if (!job.options.rescheduleOnPowerChange) {
                continue;
            }
            this.scheduleNextRun(job);
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

        this.clearRecurringTimer(job.id);

        const timer = setTimeout(() => {
            void this.executeJob(job);
        }, delay);

        this.recurringTimers.set(job.id, timer);
    }

    private async executeJob(job: RecurringJob) {
        appLogger.debug('JobScheduler', `Executing recurring job: ${job.id}`);
        try {
            await job.task();
        } catch (error) {
            appLogger.error('JobScheduler', `Recurring job ${job.id} failed:`, error as Error);
        } finally {
            job.lastRun = Date.now();
            if (job.options.persistState) {
                this.persistedStates[job.id] = { lastRun: job.lastRun };
                await this.databaseService.updateJobLastRun(job.id, job.lastRun);
            }

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
        this.unsubscribePowerState?.();
        this.unsubscribePowerState = null;
        this.started = false;
    }

    private clearRecurringTimer(id: string): void {
        const existingTimer = this.recurringTimers.get(id);
        if (existingTimer !== undefined) {
            clearTimeout(existingTimer);
        }
        this.recurringTimers.delete(id);
    }
}
