export class JobSchedulerService {
    private tasks: Map<string, NodeJS.Timeout> = new Map();

    /**
     * Schedules a task to run after a delay (debounce).
     * If a task with the same key is already scheduled, it is cancelled and replaced.
     */
    schedule(key: string, task: () => Promise<void>, delay: number = 2000) {
        if (this.tasks.has(key)) {
            clearTimeout(this.tasks.get(key));
        }

        const timeout = setTimeout(async () => {
            this.tasks.delete(key);
            try {
                await task();
            } catch (error) {
                console.error(`[JobScheduler] Task ${key} failed:`, error);
            }
        }, delay);

        this.tasks.set(key, timeout);
    }

    /**
     * Cancel a specific task if pending.
     */
    cancel(key: string) {
        if (this.tasks.has(key)) {
            clearTimeout(this.tasks.get(key));
            this.tasks.delete(key);
        }
    }
}
