import { DataService } from '@main/services/data/data.service'
import { appLogger } from '@main/logging/logger'
import * as fs from 'fs'
import * as path from 'path'

interface RecurringJob {
    id: string
    task: () => Promise<void>
    getInterval: () => number // Factory to get current interval (e.g. from settings)
    lastRun?: number
}

interface JobState {
    lastRun: number
}

export class JobSchedulerService {
    private tasks: Map<string, NodeJS.Timeout> = new Map() // For debounced tasks
    private recurringJobs: Map<string, RecurringJob> = new Map()
    private recurringTimers: Map<string, NodeJS.Timeout> = new Map()
    private stateFilePath: string

    constructor(
        private dataService: DataService
    ) {
        this.stateFilePath = path.join(this.dataService.getPath('config'), 'jobs.json')
        this.ensureConfigDir()
    }

    private ensureConfigDir() {
        const dir = path.dirname(this.stateFilePath)
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }
    }

    /**
     * Schedules a task to run after a delay (debounce).
     * If a task with the same key is already scheduled, it is cancelled and replaced.
     */
    schedule(key: string, task: () => Promise<void>, delay: number = 2000) {
        if (this.tasks.has(key)) {
            clearTimeout(this.tasks.get(key)!)
        }

        const timeout = setTimeout(async () => {
            this.tasks.delete(key)
            try {
                await task()
            } catch (error) {
                appLogger.error('JobScheduler', `Task ${key} failed:`, error as Error)
            }
        }, delay)

        this.tasks.set(key, timeout)
    }

    /**
     * Cancel a specific task if pending.
     */
    cancel(key: string) {
        if (this.tasks.has(key)) {
            clearTimeout(this.tasks.get(key)!)
            this.tasks.delete(key)
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
        this.recurringJobs.set(id, { id, task, getInterval: intervalGetter })
    }

    /**
     * Start the scheduler. Loads state and schedules jobs.
     */
    async start() {
        const state = this.loadState()

        for (const [id, job] of this.recurringJobs) {
            const lastRun = state[id]?.lastRun || 0
            job.lastRun = lastRun
            this.scheduleNextRun(job)
        }

        appLogger.info('JobScheduler', `Started with ${this.recurringJobs.size} recurring jobs`)
    }

    private scheduleNextRun(job: RecurringJob) {
        const now = Date.now()
        const interval = job.getInterval()
        const nextRun = (job.lastRun || 0) + interval

        let delay = nextRun - now

        // If we missed the window, run immediately (or close to it)
        // But respect a minimum execution time to avoid hammering on boot if strict
        // The user said: "Example: 12:00 -> 12:05. If closed and opened, still 12:05"
        // If it's 12:06, we should run immediately.

        if (delay <= 0) {
            delay = 0
        }

        appLogger.debug('JobScheduler', `Scheduling ${job.id} in ${Math.ceil(delay / 1000)}s (Interval: ${interval}ms)`)

        // Clear existing if any
        if (this.recurringTimers.has(job.id)) {
            clearTimeout(this.recurringTimers.get(job.id)!)
        }

        const timer = setTimeout(async () => {
            await this.executeJob(job)
        }, delay)

        this.recurringTimers.set(job.id, timer)
    }

    private async executeJob(job: RecurringJob) {
        appLogger.info('JobScheduler', `Executing recurring job: ${job.id}`)
        try {
            await job.task()
        } catch (error) {
            appLogger.error('JobScheduler', `Recurring job ${job.id} failed:`, error as Error)
        } finally {
            // Update state
            job.lastRun = Date.now()
            this.saveState(job.id, job.lastRun)

            // Schedule next
            this.scheduleNextRun(job)
        }
    }

    private loadState(): Record<string, JobState> {
        try {
            if (fs.existsSync(this.stateFilePath)) {
                return JSON.parse(fs.readFileSync(this.stateFilePath, 'utf8'))
            }
        } catch (e) {
            appLogger.error('JobScheduler', 'Failed to load job state', e as Error)
        }
        return {}
    }

    private saveState(jobId: string, lastRun: number) {
        try {
            const state = this.loadState()
            state[jobId] = { lastRun }
            fs.writeFileSync(this.stateFilePath, JSON.stringify(state, null, 2))
        } catch (e) {
            appLogger.error('JobScheduler', `Failed to save job state for ${jobId}`, e as Error)
        }
    }

    stop() {
        for (const timer of this.recurringTimers.values()) {
            clearTimeout(timer)
        }
        this.recurringTimers.clear()

        for (const timer of this.tasks.values()) {
            clearTimeout(timer)
        }
        this.tasks.clear()
    }
}
