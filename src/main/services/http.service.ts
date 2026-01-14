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
        const {
            retryCount = 3,
            initialDelayMs = 500,
            maxDelayMs = 5000,
            timeoutMs = 30000,
            deduplicate = false,
            deduplicateKey,
            ...fetchOptions
        } = options;

        // Request deduplication
        if (deduplicate) {
            const key = deduplicateKey || this.generateRequestKey(url, fetchOptions);
            const pending = this.pendingRequests.get(key);

            if (pending) {
                const age = Date.now() - pending.timestamp;
                if (age < this.DEDUPLICATION_WINDOW_MS) {
                    this.logInfo('HTTP', `Deduplicating request: ${url} (${age}ms old)`);
                    return pending.promise;
                } else {
                    // Request is too old, remove it
                    this.pendingRequests.delete(key);
                }
            }
        }

        // Method and delay are used for logging below
        void fetchOptions.method; // GET by default
        void initialDelayMs; // Used in executeRequestWithRetries

        // Request logging interceptor
        const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const requestHeaders = fetchOptions.headers ? JSON.stringify(fetchOptions.headers) : '{}';
        const requestBody = fetchOptions.body ? (typeof fetchOptions.body === 'string' ? fetchOptions.body.substring(0, 500) : '[Binary/Stream]') : '';

        const httpMethod = fetchOptions.method || 'GET';
        appLogger.debug('HTTP', `[${requestId}] --> ${httpMethod} ${url}`);
        appLogger.debug('HTTP', `[${requestId}] Headers: ${requestHeaders}`);
        if (requestBody) {
            appLogger.debug('HTTP', `[${requestId}] Body: ${requestBody}${requestBody.length >= 500 ? '...' : ''}`);
        }

        const startTime = Date.now();

        // Create the request promise
        const requestPromise = this.executeRequestWithRetries(
            url,
            fetchOptions,
            retryCount,
            initialDelayMs,
            maxDelayMs,
            timeoutMs,
            requestId,
            startTime
        );

        // Store pending request for deduplication
        if (deduplicate) {
            const key = deduplicateKey || this.generateRequestKey(url, fetchOptions);
            this.pendingRequests.set(key, {
                promise: requestPromise,
                timestamp: Date.now()
            });

            // Clean up after request completes
            requestPromise.finally(() => {
                setTimeout(() => {
                    this.pendingRequests.delete(key);
                }, this.DEDUPLICATION_WINDOW_MS);
            });
        }

        return requestPromise;
    }

    /**
     * Generates a unique key for request deduplication
     */
    private generateRequestKey(url: string, options: RequestInit): string {
        const method = options.method || 'GET';
        const body = options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : '';
        return `${method}:${url}:${body}`;
    }

    /**
     * Executes the actual HTTP request with retries
     */
    private async executeRequestWithRetries(
        url: string,
        fetchOptions: RequestInit,
        retryCount: number,
        initialDelayMs: number,
        maxDelayMs: number,
        timeoutMs: number,
        requestId: string,
        startTime: number
    ): Promise<Response> {
        let currentDelay = initialDelayMs;
        // Method is used internally for request execution

        // Note: Request logging is done in the main fetch() method before calling this

        for (let attempt = 0; attempt <= retryCount; attempt++) {
            const isLastAttempt = attempt === retryCount;
            let controller: AbortController | null = null;
            let timeoutId: NodeJS.Timeout | null = null;

            try {
                // Setup Timeout
                controller = new AbortController();
                timeoutId = setTimeout(() => controller?.abort(), timeoutMs);

                // Merge signals (if user provided one, we need to respect it too, but for simplicity here we override)
                const requestInit = {
                    ...fetchOptions,
                    signal: controller.signal
                };

                const response = await fetch(url, requestInit);

                // Success
                if (timeoutId) {clearTimeout(timeoutId);}
                const duration = Date.now() - startTime;

                // Response logging interceptor
                const responseHeaders: Record<string, string> = {};
                response.headers.forEach((value, key) => {
                    responseHeaders[key] = value;
                });

                appLogger.debug('HTTP', `[${requestId}] <-- ${response.status} ${response.statusText} ${url} (${duration}ms)`);
                appLogger.debug('HTTP', `[${requestId}] Response Headers: ${JSON.stringify(responseHeaders)}`);

                // Log response body for non-streaming responses (first 500 chars)
                if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
                    try {
                        const clonedResponse = response.clone();
                        const text = await clonedResponse.text();
                        const preview = text.substring(0, 500);
                        appLogger.debug('HTTP', `[${requestId}] Response Body: ${preview}${text.length >= 500 ? '...' : ''}`);
                    } catch {
                        // Ignore errors reading response body
                    }
                }

                if (!response.ok && response.status >= 500 && !isLastAttempt) {
                    // Server error, worth retrying
                    throw new Error(`Server returned ${response.status}`);
                }

                return response;

            } catch (error: unknown) {
                if (timeoutId) {clearTimeout(timeoutId);}
                const errName = (error as Error).name;
                const errMsg = getErrorMessage(error);

                // Don't retry if aborted by user (though here we control the signal)
                if (errName === 'AbortError' && !errMsg.includes('timeout')) {
                    throw error;
                }

                if (isLastAttempt) {
                    const duration = Date.now() - startTime;
                    const method = fetchOptions.method || 'GET';
                    appLogger.error('HTTP', `[${requestId}] <-- FAILED ${method} ${url} (Attempt ${attempt + 1}/${retryCount + 1}) (${duration}ms): ${errMsg}`);
                    throw error;
                }

                appLogger.warn('HTTP', `[${requestId}] Request to ${url} failed (Attempt ${attempt + 1}). Retrying in ${currentDelay}ms... Reason: ${errMsg}`);

                // Wait and Backoff
                await this.delay(currentDelay);
                currentDelay = Math.min(currentDelay * 2, maxDelayMs);
            }
        }

        throw new Error('Unreachable code in HttpService');
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
