/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { SettingsService } from '@main/services/system/settings.service';
import { CronJobEntry } from '@shared/types/settings';

/** Parsed cron schedule components */
interface CronSchedule {
    minute: number[];
    hour: number[];
    dayOfMonth: number[];
    month: number[];
    dayOfWeek: number[];
}

/** Active timer reference for a registered cron job */
interface ActiveCronJob {
    entry: CronJobEntry;
    timerId: ReturnType<typeof setInterval> | null;
}

/**
 * Lightweight cron scheduler that evaluates user-defined cron jobs
 * every 60 seconds and emits notification events on match.
 *
 * No external dependencies — uses a simple minute-granularity tick loop.
 */
export class CronSchedulerService extends BaseService {
    static readonly serviceName = 'cronSchedulerService';
    static readonly dependencies = ['settingsService', 'eventBusService'] as const;
    private activeJobs: Map<string, ActiveCronJob> = new Map();
    private tickTimer: ReturnType<typeof setInterval> | null = null;
    private lastTickMinute: number = -1;

    constructor(
        private settingsService: SettingsService,
        private eventBusService: EventBusService
    ) {
        super('CronSchedulerService');
    }

    /** @see BaseService.initialize */
    async initialize(): Promise<void> {
        this.syncFromSettings();
        this.startTickLoop();
        appLogger.info('CronSchedulerService', 'Initialized');
    }

    /** Reads cron jobs from settings and registers them */
    syncFromSettings(): void {
        const settings = this.settingsService.getSettings();
        const cronJobs = settings.remoteAccounts?.cronJobs ?? [];

        // Clear all and re-register
        this.clearAllJobs();

        const MAX_JOBS = 50;
        for (let i = 0; i < cronJobs.length && i < MAX_JOBS; i++) {
            const job = cronJobs[i];
            if (job.enabled) {
                this.registerJob(job);
            }
        }

        appLogger.info('CronSchedulerService', `Synced ${this.activeJobs.size} active cron jobs`);
    }

    /** Register a single cron job for evaluation */
    private registerJob(entry: CronJobEntry): void {
        // Store the entry — the tick loop will evaluate all jobs each minute
        this.activeJobs.set(entry.id, {
            entry,
            // Placeholder timer ID — we use the central tick loop, not per-job timers
            timerId: null,
        });
    }

    /** Start the central 60-second tick loop */
    private startTickLoop(): void {
        if (this.tickTimer) { return; }

        // Check every 30s to ensure we don't miss a minute boundary
        const TICK_INTERVAL_MS = 30_000;

        this.tickTimer = setInterval(() => {
            this.tick();
        }, TICK_INTERVAL_MS);

        // Also run immediately on startup
        this.tick();
    }

    /** Evaluate all active jobs against the current time */
    private tick(): void {
        const now = new Date();
        const currentMinute = now.getMinutes() + now.getHours() * 60;

        // Prevent double-firing within the same calendar minute
        if (currentMinute === this.lastTickMinute) { return; }
        this.lastTickMinute = currentMinute;

        for (const [jobId, activeJob] of this.activeJobs.entries()) {
            const { entry } = activeJob;

            if (!this.matchesCron(entry.cronExpression, now)) {
                continue;
            }

            appLogger.info('CronSchedulerService', `Cron job triggered: ${entry.label} (${jobId})`);

            this.eventBusService.emit('notification:cron-triggered', {
                cronId: jobId,
                label: entry.label,
                message: this.interpolateMessage(entry.message, now),
                timestamp: Date.now(),
            });
        }
    }

    /** Check whether a cron expression matches a given Date */
    private matchesCron(expression: string, now: Date): boolean {
        const schedule = this.parseCronExpression(expression);
        if (!schedule) { return false; }

        const minute = now.getMinutes();
        const hour = now.getHours();
        const dayOfMonth = now.getDate();
        const month = now.getMonth() + 1;
        const dayOfWeek = now.getDay();

        return (
            schedule.minute.includes(minute) &&
            schedule.hour.includes(hour) &&
            schedule.dayOfMonth.includes(dayOfMonth) &&
            schedule.month.includes(month) &&
            schedule.dayOfWeek.includes(dayOfWeek)
        );
    }

    /**
     * Parse a standard 5-field cron expression.
     * Supports: numbers, ranges (1-5), steps (star/2), commas, and wildcards.
     */
    private parseCronExpression(expression: string): CronSchedule | null {
        const parts = expression.trim().split(/\s+/);
        if (parts.length !== 5) {
            appLogger.warn('CronSchedulerService', `Invalid cron expression (expected 5 fields): ${expression}`);
            return null;
        }

        const minute = this.parseField(parts[0], 0, 59);
        const hour = this.parseField(parts[1], 0, 23);
        const dayOfMonth = this.parseField(parts[2], 1, 31);
        const month = this.parseField(parts[3], 1, 12);
        const dayOfWeek = this.parseField(parts[4], 0, 6);

        if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) {
            return null;
        }

        return { minute, hour, dayOfMonth, month, dayOfWeek };
    }

    /** Parse a single cron field into an array of valid numbers */
    private parseField(field: string, min: number, max: number): number[] | null {
        const values: number[] = [];

        const segments = field.split(',');
        const MAX_SEGMENTS = 30;

        for (let s = 0; s < segments.length && s < MAX_SEGMENTS; s++) {
            const segment = segments[s].trim();

            // Handle step notation: */2, 1-5/2
            const stepMatch = segment.match(/^(.+)\/(\d+)$/);
            const step = stepMatch ? parseInt(stepMatch[2], 10) : 1;
            const base = stepMatch ? stepMatch[1] : segment;

            if (step <= 0 || step > (max - min + 1)) { return null; }

            if (base === '*') {
                for (let v = min; v <= max; v += step) {
                    values.push(v);
                }
            } else {
                const rangeMatch = base.match(/^(\d+)-(\d+)$/);
                if (rangeMatch) {
                    const start = parseInt(rangeMatch[1], 10);
                    const end = parseInt(rangeMatch[2], 10);
                    if (start < min || end > max || start > end) { return null; }
                    for (let v = start; v <= end; v += step) {
                        values.push(v);
                    }
                } else {
                    const num = parseInt(base, 10);
                    if (isNaN(num) || num < min || num > max) { return null; }
                    values.push(num);
                }
            }
        }

        return values.length > 0 ? values : null;
    }

    /** Simple template interpolation for cron messages */
    private interpolateMessage(message: string, now: Date): string {
        return message
            .replace(/\{\{date\}\}/g, now.toLocaleDateString())
            .replace(/\{\{time\}\}/g, now.toLocaleTimeString())
            .replace(/\{\{timestamp\}\}/g, now.toISOString());
    }

    /** Remove all active jobs */
    private clearAllJobs(): void {
        this.activeJobs.clear();
    }

    /** @see BaseService.cleanup */
    async cleanup(): Promise<void> {
        if (this.tickTimer) {
            clearInterval(this.tickTimer);
            this.tickTimer = null;
        }
        this.clearAllJobs();
        this.lastTickMinute = -1;
        appLogger.info('CronSchedulerService', 'Cleaned up');
    }
}

