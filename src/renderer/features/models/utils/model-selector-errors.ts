/**
 * @fileoverview Error handling, retry policy, and fallback behavior for Model Selector
 */

import { appLogger } from '@/utils/renderer-logger';

import { ModelSelectorError, ModelSelectorErrorCode,ModelSelectorErrorCodes } from './model-selector-validation';

export const RetryConfig = {
    maxRetries: 3,
    initialDelayMs: 100,
    maxDelayMs: 2000,
    backoffMultiplier: 2,
} as const;

export interface RetryResult<T> {
    success: boolean;
    data?: T;
    error?: ModelSelectorError;
    attempts: number;
}

export function calculateBackoffDelay(attempt: number): number {
    const delay = RetryConfig.initialDelayMs * Math.pow(RetryConfig.backoffMultiplier, attempt);
    return Math.min(delay, RetryConfig.maxDelayMs);
}

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withRetry<T>(
    operation: () => Promise<T>,
    shouldRetry: (error: Error) => boolean = () => true,
    maxRetries: number = RetryConfig.maxRetries
): Promise<RetryResult<T>> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const data = await operation();
            return { success: true, data, attempts: attempt + 1 };
        } catch (error) {
            lastError = error as Error;
            if (attempt < maxRetries && shouldRetry(lastError)) {
                await sleep(calculateBackoffDelay(attempt));
            }
        }
    }
    return {
        success: false,
        error: lastError instanceof ModelSelectorError ? lastError : new ModelSelectorError(lastError?.message ?? 'Operation failed', ModelSelectorErrorCodes.VALIDATION_ERROR, { originalError: lastError }),
        attempts: maxRetries + 1,
    };
}

const NON_RETRYABLE_CODES: readonly ModelSelectorErrorCode[] = [
    ModelSelectorErrorCodes.INVALID_MODEL_ID,
    ModelSelectorErrorCodes.INVALID_PROVIDER,
    ModelSelectorErrorCodes.MODEL_DISABLED,
    ModelSelectorErrorCodes.VALIDATION_ERROR,
] as const;

export function isRetryableError(error: Error): boolean {
    if (error.message.includes('network') || error.message.includes('timeout')) {
        return true;
    }
    if (error instanceof ModelSelectorError) {
        return !NON_RETRYABLE_CODES.includes(error.code as typeof NON_RETRYABLE_CODES[number]);
    }
    return false;
}

export const FallbackStrategies = {
    firstAvailable: <T extends { disabled: boolean }>(models: T[]): T | undefined => {
        return models.find(m => !m.disabled);
    },
    defaultModel: <T>(models: T[], defaultId: string, getId: (model: T) => string): T | undefined => {
        return models.find(m => getId(m) === defaultId);
    },
    mostRecent: <T>(models: T[], recentIds: string[], getId: (model: T) => string): T | undefined => {
        for (const recentId of recentIds) {
            const model = models.find(m => getId(m) === recentId);
            if (model) {
                return model;
            }
        }
        return undefined;
    },
} as const;

export const ErrorMessages: Record<string, string> = {
    [ModelSelectorErrorCodes.INVALID_MODEL_ID]: 'Invalid model selected. Please choose a valid model.',
    [ModelSelectorErrorCodes.INVALID_PROVIDER]: 'Invalid provider. Please select a valid provider.',
    [ModelSelectorErrorCodes.MODEL_NOT_FOUND]: 'Model not found. It may have been removed.',
    [ModelSelectorErrorCodes.INVALID_THINKING_LEVEL]: 'Invalid reasoning level selected.',
    [ModelSelectorErrorCodes.MODEL_DISABLED]: 'This model is currently disabled.',
    [ModelSelectorErrorCodes.CATEGORY_NOT_FOUND]: 'Category not found.',
    [ModelSelectorErrorCodes.VALIDATION_ERROR]: 'Validation error. Please check your selection.',
};

export function getUserErrorMessage(code: string): string {
    return ErrorMessages[code] ?? 'An unexpected error occurred.';
}

export function logModelError(error: Error, context?: Record<string, RendererDataValue>): void {
    appLogger.error('ModelSelector', error.message, error);
    if (context) {
        appLogger.warn('ModelSelector', 'Error context', context);
    }
}

export interface ErrorResponse {
    code: string;
    message: string;
    details?: Record<string, RendererDataValue>;
    recoverable: boolean;
}

export function createErrorResponse(error: ModelSelectorError): ErrorResponse {
    return { code: error.code, message: error.message, details: error.details, recoverable: isRetryableError(error) };
}

export interface ErrorBoundaryFallbackProps {
    error: Error;
    resetErrorBoundary: () => void;
}

export const SearchDebounceConfig = { delayMs: 150, maxWaitMs: 500 } as const;

export function debounce<T extends (...args: RendererDataValue[]) => void>(
    fn: T,
    delay: number = SearchDebounceConfig.delayMs
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<T>) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

export const ThrottleConfig = { intervalMs: 100 } as const;

export function throttle<T extends (...args: RendererDataValue[]) => void>(
    fn: T,
    interval: number = ThrottleConfig.intervalMs
): (...args: Parameters<T>) => void {
    let lastCall = 0;
    return (...args: Parameters<T>) => {
        const now = Date.now();
        if (now - lastCall >= interval) {
            lastCall = now;
            fn(...args);
        }
    };
}
