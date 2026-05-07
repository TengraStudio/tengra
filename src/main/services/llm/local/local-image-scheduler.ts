/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { EventBusService } from '@main/services/system/event-bus.service';
import { getErrorMessage } from '@shared/utils/error.util';
import { v4 as uuidv4 } from 'uuid';

import type {
    GenerationQueueItem,
    ImageGenerationOptions,
    ImageResourceProfile,
    ImageSchedulePriority,
    ImageScheduleTask,
} from './local-image.types';

interface SchedulerDeps {
    eventBusService?: EventBusService;
    generateImage: (options: ImageGenerationOptions, source: 'generate' | 'edit' | 'schedule' | 'batch') => Promise<string>;
    persistState: () => Promise<void>;
}

/** Manages scheduled and queued image generation tasks. */
export class LocalImageScheduler {
    private scheduleTimers: Map<string, NodeJS.Timeout> = new Map();
    private generationQueue: GenerationQueueItem[] = [];
    private queueRunning = false;
    private readonly deps: SchedulerDeps;
    scheduleTasks: ImageScheduleTask[];

    constructor(deps: SchedulerDeps, scheduleTasks: ImageScheduleTask[]) {
        this.deps = deps;
        this.scheduleTasks = scheduleTasks;
    }

    /** Schedule an image generation at a future time. */
    async scheduleGeneration(
        runAt: number,
        options: ImageGenerationOptions,
        scheduling?: { priority?: ImageSchedulePriority; resourceProfile?: ImageResourceProfile }
    ): Promise<ImageScheduleTask> {
        if (!Number.isFinite(runAt)) {
            throw new Error('runAt must be a finite timestamp');
        }
        this.assertNonEmptyText(options.prompt, 'Prompt');
        const task: ImageScheduleTask = {
            id: uuidv4(),
            runAt,
            options,
            priority: scheduling?.priority ?? 'normal',
            resourceProfile: scheduling?.resourceProfile ?? 'balanced',
            status: 'scheduled',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        this.scheduleTasks.push(task);
        await this.deps.persistState();
        this.queueScheduledGeneration(task);
        return task;
    }

    /** List all scheduled tasks sorted by runAt. */
    listScheduledGenerations(): ImageScheduleTask[] {
        return [...this.scheduleTasks].sort((left, right) => left.runAt - right.runAt);
    }

    /** Cancel a scheduled generation. */
    async cancelScheduledGeneration(id: string): Promise<boolean> {
        this.assertNonEmptyText(id, 'Schedule id');
        const task = this.scheduleTasks.find(item => item.id === id);
        if (!task) { return false; }
        task.status = 'canceled';
        task.updatedAt = Date.now();
        const timer = this.scheduleTimers.get(id);
        if (timer) {
            clearTimeout(timer);
            this.scheduleTimers.delete(id);
        }
        this.emitScheduleAlert(task.id, 'canceled', task.options.prompt);
        await this.deps.persistState();
        return true;
    }

    /** Restore scheduled tasks that are still pending. */
    restoreScheduledTasks(): void {
        this.scheduleTasks
            .filter(task => task.status === 'scheduled')
            .forEach(task => this.queueScheduledGeneration(task));
    }

    /** Run a batch of generation requests. */
    async runBatchGeneration(requests: ImageGenerationOptions[]): Promise<string[]> {
        for (const request of requests) {
            this.assertNonEmptyText(request.prompt, 'Prompt');
        }
        const jobs = requests.slice(0, 20).map(r => this.enqueueGeneration(r, 'batch', 'normal', 'balanced'));
        return Promise.all(jobs);
    }

    /** Get queue statistics. */
    getQueueStats(): { queued: number; running: boolean; byPriority: Record<string, number> } {
        const byPriority: Record<string, number> = {};
        this.generationQueue.forEach(item => {
            byPriority[item.priority] = (byPriority[item.priority] ?? 0) + 1;
        });
        return { queued: this.generationQueue.length, running: this.queueRunning, byPriority };
    }

    /** Get schedule analytics. */
    getScheduleAnalytics(): { total: number; byStatus: Record<string, number>; byPriority: Record<string, number> } {
        const byStatus: Record<string, number> = {};
        const byPriority: Record<string, number> = {};
        this.scheduleTasks.forEach(task => {
            byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;
            byPriority[task.priority] = (byPriority[task.priority] ?? 0) + 1;
        });
        return { total: this.scheduleTasks.length, byStatus, byPriority };
    }

    /** Apply a resource profile to generation options. */
    applyResourceProfile(
        options: ImageGenerationOptions,
        resourceProfile: ImageResourceProfile
    ): ImageGenerationOptions {
        if (resourceProfile === 'speed') {
            return {
                ...options,
                steps: Math.max(8, Math.min(options.steps ?? 24, 18)),
                cfgScale: Math.max(5, Math.min(options.cfgScale ?? 7, 8))
            };
        }
        if (resourceProfile === 'quality') {
            return {
                ...options,
                steps: Math.min(60, Math.max(options.steps ?? 24, 32)),
                cfgScale: Math.min(14, Math.max(options.cfgScale ?? 7, 8))
            };
        }
        return options;
    }

    private enqueueGeneration(
        options: ImageGenerationOptions,
        source: 'batch' | 'schedule',
        priority: ImageSchedulePriority,
        resourceProfile: ImageResourceProfile
    ): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            this.generationQueue.push({
                id: uuidv4(),
                options,
                source,
                priority,
                resourceProfile,
                enqueuedAt: Date.now(),
                resolve,
                reject
            });
            if (!this.queueRunning) {
                void this.processQueue();
            }
        });
    }

    private async processQueue(): Promise<void> {
        this.queueRunning = true;
        while (this.generationQueue.length > 0) {
            this.generationQueue.sort((left, right) => {
                const weightDelta = this.getPriorityWeight(right.priority) - this.getPriorityWeight(left.priority);
                if (weightDelta !== 0) { return weightDelta; }
                return left.enqueuedAt - right.enqueuedAt;
            });
            const next = this.generationQueue.shift();
            if (!next) { continue; }
            try {
                const effectiveOptions = this.applyResourceProfile(next.options, next.resourceProfile);
                const imagePath = await this.deps.generateImage(effectiveOptions, next.source);
                next.resolve(imagePath);
            } catch (error) {
                next.reject(error as Error);
            }
        }
        this.queueRunning = false;
    }

    private queueScheduledGeneration(task: ImageScheduleTask): void {
        const delayMs = Math.max(0, task.runAt - Date.now());
        const timer = setTimeout(() => {
            this.scheduleTimers.delete(task.id);
            task.status = 'running';
            task.updatedAt = Date.now();
            void this.enqueueGeneration(task.options, 'schedule', task.priority, task.resourceProfile)
                .then(async imagePath => {
                    task.status = 'completed';
                    task.resultPath = imagePath;
                    task.updatedAt = Date.now();
                    this.emitScheduleAlert(task.id, 'completed', task.options.prompt);
                    await this.deps.persistState();
                })
                .catch(async error => {
                    task.status = 'failed';
                    task.error = getErrorMessage(error as Error);
                    task.updatedAt = Date.now();
                    this.emitScheduleAlert(task.id, 'failed', task.options.prompt, task.error);
                    await this.deps.persistState();
                });
        }, delayMs);
        this.scheduleTimers.set(task.id, timer);
    }

    private getPriorityWeight(priority: ImageSchedulePriority): number {
        if (priority === 'high') { return 3; }
        if (priority === 'normal') { return 2; }
        return 1;
    }

    private emitScheduleAlert(taskId: string, status: 'completed' | 'failed' | 'canceled', prompt: string, error?: string): void {
        if (!this.deps.eventBusService) { return; }
        this.deps.eventBusService.emit('image:schedule-alert', { taskId, status, prompt, error, timestamp: Date.now() });
    }

    private assertNonEmptyText(value: string, fieldName: string): void {
        if (typeof value !== 'string' || value.trim().length === 0) {
            throw new Error(`${fieldName} is required`);
        }
    }
}

