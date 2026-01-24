import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { getErrorMessage } from '@shared/utils/error.util';

export interface HttpRequestOptions extends RequestInit {
    retryCount?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    timeoutMs?: number;
    deduplicate?: boolean; // Enable request deduplication
    deduplicateKey?: string; // Custom key for deduplication
}

interface PendingRequest {
    promise: Promise<Response>;
    timestamp: number;
}

export class HttpService extends BaseService {
    private pendingRequests: Map<string, PendingRequest> = new Map();
    private readonly DEDUPLICATION_WINDOW_MS = 1000; // 1 second window
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor() {
        super('HttpService');

        // Clean up old pending requests periodically
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [key, request] of this.pendingRequests.entries()) {
                if (now - request.timestamp > this.DEDUPLICATION_WINDOW_MS * 2) {
                    this.pendingRequests.delete(key);
                }
            }
        }, 5000);
    }

    override async cleanup(): Promise<void> {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.pendingRequests.clear();
    }

    /**
     * Performs a fetch request with automatic retries and logging.
     * Includes request/response logging interceptor for all API calls.
     * Supports request deduplication to prevent duplicate concurrent requests.
     */
    async fetch(url: string, options: HttpRequestOptions = {}): Promise<Response> {
        const normalized = this.normalizeOptions(options);
        const { deduplicate, deduplicateKey } = normalized;

        const key = (deduplicate) ? (deduplicateKey ?? this.generateRequestKey(url, normalized.fetchOptions)) : '';
        const deduplicated = this.tryDeduplicate(url, key);
        if (deduplicated) {
            return deduplicated;
        }

        const requestId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        this.logRequest(requestId, url, normalized.fetchOptions);

        const startTime = Date.now();
        const requestPromise = this.executeRequestWithRetries(url, {
            ...normalized, requestId, startTime
        });

        if (deduplicate) {
            this.storePendingRequest(key, requestPromise);
        }

        return requestPromise;
    }

    private normalizeOptions(options: HttpRequestOptions) {
        const {
            retryCount = 3,
            initialDelayMs = 500,
            maxDelayMs = 5000,
            timeoutMs = 30000,
            deduplicate = false,
            deduplicateKey,
            ...fetchOptions
        } = options;
        return { retryCount, initialDelayMs, maxDelayMs, timeoutMs, deduplicate, deduplicateKey, fetchOptions };
    }

    private storePendingRequest(key: string, promise: Promise<Response>): void {
        this.pendingRequests.set(key, { promise, timestamp: Date.now() });
        void promise.finally(() => {
            setTimeout(() => { this.pendingRequests.delete(key); }, this.DEDUPLICATION_WINDOW_MS);
        });
    }

    private tryDeduplicate(url: string, key: string): Promise<Response> | null {
        if (!key) { return null; }
        const pending = this.pendingRequests.get(key);
        if (!pending) { return null; }

        const age = Date.now() - pending.timestamp;
        if (age < this.DEDUPLICATION_WINDOW_MS) {
            this.logInfo('HTTP', `Deduplicating request: ${url} (${age}ms old)`);
            return pending.promise;
        }
        this.pendingRequests.delete(key);
        return null;
    }

    private logRequest(requestId: string, url: string, options: RequestInit): void {
        const headers = options.headers ? JSON.stringify(options.headers) : '{}';
        const bodyContent = options.body ? (typeof options.body === 'string' ? options.body.substring(0, 500) : '[Binary/Stream]') : '';
        const httpMethod = options.method ?? 'GET';

        appLogger.debug('HTTP', `[${requestId}] --> ${httpMethod} ${url}`);
        appLogger.debug('HTTP', `[${requestId}] Headers: ${headers}`);
        if (bodyContent) {
            appLogger.debug('HTTP', `[${requestId}] Body: ${bodyContent}${bodyContent.length >= 500 ? '...' : ''}`);
        }
    }

    private async logResponse(requestId: string, url: string, response: Response, startTime: number): Promise<void> {
        const duration = Date.now() - startTime;
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => { responseHeaders[key] = value; });

        appLogger.debug('HTTP', `[${requestId}] <-- ${response.status} ${response.statusText} ${url} (${duration}ms)`);
        appLogger.debug('HTTP', `[${requestId}] Response Headers: ${JSON.stringify(responseHeaders)}`);

        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
            try {
                const text = await response.clone().text();
                const preview = text.substring(0, 500);
                appLogger.debug('HTTP', `[${requestId}] Response Body: ${preview}${text.length >= 500 ? '...' : ''}`);
            } catch { /* ignore */ }
        }
    }

    private generateRequestKey(url: string, options: RequestInit): string {
        const method = options.method ?? 'GET';
        const body = options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : '';
        return `${method}:${url}:${body}`;
    }

    private async executeRequestWithRetries(
        url: string,
        params: {
            fetchOptions: RequestInit;
            retryCount: number;
            initialDelayMs: number;
            maxDelayMs: number;
            timeoutMs: number;
            requestId: string;
            startTime: number;
        }
    ): Promise<Response> {
        const { fetchOptions, retryCount, initialDelayMs, maxDelayMs, timeoutMs, requestId, startTime } = params;
        let currentDelay = initialDelayMs;

        for (let attempt = 0; attempt <= retryCount; attempt++) {
            const isLastAttempt = (attempt === retryCount);
            const controller = new AbortController();

            // Respect external signal if present
            const externalSignal = fetchOptions.signal;
            if (externalSignal) {
                if (externalSignal.aborted) {
                    throw externalSignal.reason || new Error('Aborted');
                }
                externalSignal.addEventListener('abort', () => controller.abort(externalSignal.reason), { once: true });
            }

            const timeoutId = setTimeout(() => controller.abort(new Error('Request timed out')), timeoutMs);

            try {
                const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
                clearTimeout(timeoutId);
                await this.logResponse(requestId, url, response, startTime);

                if (this.shouldRetryStatus(response.status) && !isLastAttempt) {
                    throw new Error(`Server returned ${response.status}`);
                }
                return response;
            } catch (error: unknown) {
                clearTimeout(timeoutId);
                if (this.isUserAbort(error)) { throw error; }

                if (isLastAttempt) {
                    this.logFailure({
                        requestId,
                        url,
                        method: fetchOptions.method ?? 'GET',
                        attempt,
                        retryCount,
                        startTime,
                        error
                    });
                    throw error;
                }

                appLogger.warn('HTTP', `[${requestId}] Request to ${url} failed (Attempt ${attempt + 1}). Retrying in ${currentDelay}ms... Reason: ${getErrorMessage(error)}`);
                await this.delay(currentDelay);
                currentDelay = Math.min(currentDelay * 2, maxDelayMs);
            }
        }
        throw new Error('Unreachable code in HttpService');
    }

    private shouldRetryStatus(status: number): boolean {
        return status >= 500;
    }

    private isUserAbort(error: unknown): boolean {
        const err = error as Error;
        return err.name === 'AbortError' && !getErrorMessage(error).includes('timeout');
    }

    private logFailure(params: {
        requestId: string,
        url: string,
        method: string,
        attempt: number,
        retryCount: number,
        startTime: number,
        error: unknown
    }): void {
        const { requestId, url, method, attempt, retryCount, startTime, error } = params;
        const duration = Date.now() - startTime;
        appLogger.error('HTTP', `[${requestId}] <-- FAILED ${method} ${url} (Attempt ${attempt + 1}/${retryCount + 1}) (${duration}ms): ${getErrorMessage(error)}`);
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
