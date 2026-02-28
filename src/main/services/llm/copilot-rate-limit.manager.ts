import { appLogger } from '@main/logging/logger';
import { AuthService } from '@main/services/security/auth.service';
import { getErrorMessage } from '@shared/utils/error.util';

import {
    CopilotNotificationService,
    CopilotState,
    COPILOT_USER_AGENT,
    GITHUB_RATE_LIMIT_URL
} from './copilot.types';

const SERVICE_NAME = 'CopilotRateLimitManager';

interface RateLimitResponse {
    resources: {
        core: {
            limit: number;
            remaining: number;
            reset: number;
        };
    };
}

/** Low remaining threshold before warning */
const LOW_REMAINING_WARNING_THRESHOLD = 25;
/** Minimum interval between API calls (ms) */
const MIN_API_INTERVAL = 1000;
/** Maximum queued requests */
const MAX_QUEUED_REQUESTS = 30;

/**
 * Manages GitHub API rate limiting, monitoring, and request queuing.
 */
export class CopilotRateLimitManager {
    constructor(
        private state: CopilotState,
        private authService?: AuthService,
        private notificationService?: CopilotNotificationService
    ) {}

    /** Checks GitHub API rate limits */
    async checkRateLimit(silent: boolean = false): Promise<void> {
        try {
            const tokenToCheck = await this.getRateLimitToken(silent);
            if (!tokenToCheck) { return; }

            const response = await fetch(GITHUB_RATE_LIMIT_URL, {
                headers: {
                    'Authorization': `token ${tokenToCheck}`,
                    'Accept': 'application/json',
                    'User-Agent': COPILOT_USER_AGENT
                }
            });

            if (response.ok) {
                await this.handleRateLimitResponse(response, silent);
            } else {
                appLogger.warn(SERVICE_NAME, `Rate limit check failed: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            appLogger.error(SERVICE_NAME, `Failed to check rate limit: ${getErrorMessage(error)}`);
        }
    }

    /** Starts periodic rate limit monitoring */
    startMonitoring(): void {
        if (this.state.rateLimitInterval) {
            clearInterval(this.state.rateLimitInterval);
        }
        void this.checkRateLimit(true).catch(e =>
            appLogger.error(SERVICE_NAME, `Initial rate limit check failed: ${getErrorMessage(e)}`)
        );
        this.state.rateLimitInterval = setInterval(() => { void this.checkRateLimit(true); }, 5 * 60 * 1000);
    }

    /** Stops rate limit monitoring */
    stopMonitoring(): void {
        if (this.state.rateLimitInterval) {
            clearInterval(this.state.rateLimitInterval);
            this.state.rateLimitInterval = null;
        }
    }

    /** Enforces minimum interval between API calls */
    async waitForRateLimit(): Promise<void> {
        const now = Date.now();
        const timeSinceLastCall = now - this.state.lastApiCall;
        if (timeSinceLastCall < MIN_API_INTERVAL) {
            await new Promise(resolve => setTimeout(resolve, MIN_API_INTERVAL - timeSinceLastCall));
        }
        this.state.lastApiCall = Date.now();
    }

    /** Enqueues a request with rate limiting and queue management */
    async enqueueRequest<T>(operation: string, task: () => Promise<T>): Promise<T> {
        if (this.state.pendingQueueSize >= MAX_QUEUED_REQUESTS) {
            this.notificationService?.showNotification(
                'Copilot Queue Full',
                'Too many pending Copilot requests. Please wait a moment and retry.',
                false
            );
            throw new Error('Copilot request queue full');
        }

        this.state.pendingQueueSize += 1;
        const queuedAhead = this.state.pendingQueueSize - 1;
        if (queuedAhead > 0) {
            this.notificationService?.showNotification(
                'Copilot Request Queued',
                `Request queued (${queuedAhead} ahead).`,
                true
            );
        }

        let release!: () => void;
        const gate = new Promise<void>(resolve => { release = resolve; });
        const previous = this.state.requestQueue;
        this.state.requestQueue = previous.then(() => gate).catch(() => gate);

        await previous;
        try {
            appLogger.info(SERVICE_NAME, `Executing queued ${operation} request. Pending: ${this.state.pendingQueueSize}`);
            return await task();
        } finally {
            this.state.pendingQueueSize = Math.max(0, this.state.pendingQueueSize - 1);
            release();
        }
    }

    private async getRateLimitToken(silent: boolean): Promise<string | null> {
        if (!silent) {
            appLogger.info(SERVICE_NAME, 'Checking GitHub API rate limits...');
        }
        if (!this.state.githubToken && this.authService) {
            this.state.githubToken = (await this.authService.getActiveToken('github_token')) ?? null;
        }
        if (!this.state.githubToken) {
            appLogger.warn(SERVICE_NAME, 'Cannot check rate limit: No github_token available.');
        }
        return this.state.githubToken;
    }

    private async handleRateLimitResponse(response: Response, silent: boolean): Promise<void> {
        const data = await response.json() as RateLimitResponse;
        const core = data.resources.core;
        this.state.remainingCalls = core.remaining;

        if (!silent) {
            appLogger.info(SERVICE_NAME,
                `Rate Limits - Limit: ${core.limit}, Remaining: ${core.remaining}, Reset: ${new Date(core.reset * 1000).toLocaleString()}`
            );
        }

        if (core.remaining === 0) {
            this.notifyExhausted(core.reset);
        } else {
            this.state.hasNotifiedExhaustion = false;
            this.notifyLow(core.remaining, core.reset);
        }
    }

    private notifyExhausted(resetTime: number): void {
        if (!this.state.hasNotifiedExhaustion) {
            this.state.hasNotifiedExhaustion = true;
            this.notificationService?.showNotification(
                'Copilot Rate Limit Exhausted',
                `You have 0 requests remaining. Resets at ${new Date(resetTime * 1000).toLocaleTimeString()}`,
                false
            );
        }
    }

    private notifyLow(remaining: number, resetTime: number): void {
        if (remaining > LOW_REMAINING_WARNING_THRESHOLD) {
            this.state.hasNotifiedLowRemaining = false;
            return;
        }
        if (!this.state.hasNotifiedLowRemaining) {
            this.state.hasNotifiedLowRemaining = true;
            this.notificationService?.showNotification(
                'Copilot Rate Limit Warning',
                `${remaining} requests remaining. Reset at ${new Date(resetTime * 1000).toLocaleTimeString()}`,
                false
            );
        }
    }
}
