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
     * Includes request/response logging interceptor for all API calls.
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

        // Request logging interceptor
        const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const requestHeaders = fetchOptions.headers ? JSON.stringify(fetchOptions.headers) : '{}';
        const requestBody = fetchOptions.body ? (typeof fetchOptions.body === 'string' ? fetchOptions.body.substring(0, 500) : '[Binary/Stream]') : '';
        
        appLogger.debug('HTTP', `[${requestId}] --> ${method} ${url}`);
        appLogger.debug('HTTP', `[${requestId}] Headers: ${requestHeaders}`);
        if (requestBody) {
            appLogger.debug('HTTP', `[${requestId}] Body: ${requestBody}${requestBody.length >= 500 ? '...' : ''}`);
        }
        
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
                if (timeoutId) clearTimeout(timeoutId);
                const errName = (error as Error).name;
                const errMsg = getErrorMessage(error);

                // Don't retry if aborted by user (though here we control the signal)
                if (errName === 'AbortError' && !errMsg.includes('timeout')) {
                    throw error;
                }

                if (isLastAttempt) {
                    const duration = Date.now() - startTime;
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
