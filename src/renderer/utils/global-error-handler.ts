import { appLogger } from '@/utils/renderer-logger';

const CONTEXT = 'GlobalErrorHandler';

/**
 * Extracts a readable message from an ErrorEvent or unknown error value.
 */
function extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return 'Unknown error';
}

/**
 * Handles uncaught synchronous errors via `window.onerror`.
 * Logs the error with source location details.
 */
function handleWindowError(event: ErrorEvent): void {
    const message = event.error instanceof Error
        ? event.error.message
        : event.message || 'Unknown error';

    const location = event.filename
        ? `${event.filename}:${String(event.lineno)}:${String(event.colno)}`
        : 'unknown location';

    appLogger.error(CONTEXT, `Uncaught error at ${location}: ${message}`, event.error as Error);
}

/**
 * Handles unhandled promise rejections via `window.onunhandledrejection`.
 * Logs the rejection reason with structured context.
 */
function handleUnhandledRejection(event: PromiseRejectionEvent): void {
    const reason: unknown = event.reason;
    const message = extractErrorMessage(reason);

    appLogger.error(
        CONTEXT,
        `Unhandled promise rejection: ${message}`,
        reason instanceof Error ? reason : undefined
    );
}

/**
 * Installs global error handlers for the renderer process.
 * Captures uncaught errors and unhandled promise rejections,
 * routing them through the structured renderer logger.
 *
 * Should be called once, early in the renderer entry point.
 */
export function installGlobalErrorHandlers(): void {
    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    appLogger.info(CONTEXT, 'Global error handlers installed');
}
