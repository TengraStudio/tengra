import { BaseService } from './base.service';
import { appLogger } from '../logging/logger';
import { getErrorMessage } from '../../shared/utils/error.util';

export interface HttpRequestOptions extends RequestInit {
    retryCount?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    timeoutMs?: number;
}

export class HttpService extends BaseService {
    constructor() {
        super('HttpService');
    }

    /**
     * Performs a fetch request with automatic retries and logging.
     */
    async fetch(url: string, options: HttpRequestOptions = {}): Promise<Response> {
        const {
            retryCount = 3,
            initialDelayMs = 500,
            maxDelayMs = 5000,
            timeoutMs = 30000,
            ...fetchOptions
        } = options;

        const method = fetchOptions.method || 'GET';
        let currentDelay = initialDelayMs;

        // Log Request
        appLogger.debug('HTTP', `--> ${method} ${url}`);
        const startTime = Date.now();

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
                if (timeoutId) clearTimeout(timeoutId);
                const duration = Date.now() - startTime;

                if (!response.ok && response.status >= 500 && !isLastAttempt) {
                    // Server error, worth retrying
                    throw new Error(`Server returned ${response.status}`);
                }

                appLogger.debug('HTTP', `<-- ${response.status} ${response.statusText} ${url} (${duration}ms)`);
                return response;

            } catch (error: unknown) {
                if (timeoutId) clearTimeout(timeoutId);
                const errName = (error as Error).name;
                const errMsg = getErrorMessage(error);

                // Don't retry if aborted by user (though here we control the signal)
                if (errName === 'AbortError' && !errMsg.includes('timeout')) {
                    throw error;
                }

                if (isLastAttempt) {
                    const duration = Date.now() - startTime;
                    appLogger.error('HTTP', `<-- FAILED ${method} ${url} (Attempt ${attempt + 1}/${retryCount + 1}) (${duration}ms): ${errMsg}`);
                    throw error;
                }

                appLogger.warn('HTTP', `Request to ${url} failed (Attempt ${attempt + 1}). Retrying in ${currentDelay}ms... Reason: ${errMsg}`);

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
