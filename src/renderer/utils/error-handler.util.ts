import { getErrorMessage } from '@shared/utils/error.util';

interface CustomWindow extends Window {
    showToast?: (options: { type: string; message: string }) => void
}

/**
 * Standardized error handling utilities for the renderer process.
 * Provides consistent error handling patterns matching the main process.
 */

export interface ErrorDisplayOptions {
    /**
     * Whether to show a toast notification
     */
    showToast?: boolean
    /**
     * Whether to log to console
     */
    logToConsole?: boolean
    /**
     * Custom error message override
     */
    customMessage?: string
    /**
     * Whether this is a user-facing error
     */
    userFacing?: boolean
}

/**
 * Maps technical error messages to user-friendly messages
 */
function mapToUserFriendlyMessage(message: string): string {
    if (message.includes('429') || message.includes('rate limit') || message.includes('quota')) {
        return 'Rate limit exceeded. Please wait a moment and try again.';
    }
    if (message.includes('401') || message.includes('unauthorized')) {
        return 'Authentication failed. Please check your API keys.';
    }
    if (message.includes('network') || message.includes('fetch')) {
        return 'Network error. Please check your connection.';
    }
    if (message.includes('timeout')) {
        return 'Request timed out. Please try again.';
    }
    return message;
}

/**
 * Shows toast notification if available
 */
function showErrorToast(message: string): void {
    if (typeof window === 'undefined') {
        return;
    }
    const customWindow = window as unknown as CustomWindow;
    if (customWindow.showToast) {
        customWindow.showToast({ type: 'error', message });
    }
}

/**
 * Standardized error handler for renderer process.
 * Formats errors consistently and provides user-friendly messages.
 * 
 * @param error - The error to handle
 * @param context - Context where the error occurred (e.g., 'ChatManager', 'SettingsPage')
 * @param options - Additional options for error handling
 * @returns Formatted error message
 * 
 * @example
 * ```typescript
 * try {
 *   await window.electron.db.createChat(chat)
 * } catch (error) {
 *   handleError(error, 'ChatManager', { showToast: true })
 * }
 * ```
 */
/**
 * Gets the error message, with custom message taking precedence
 */
function resolveErrorMessage(error: unknown, customMessage?: string): string {
    if (customMessage !== undefined && customMessage !== '') {
        return customMessage;
    }
    return getErrorMessage(error);
}

/**
 * Logs error to console with context
 */
function logError(context: string, error: unknown): void {
    console.error(`[${context}] Error:`, error);
}

export function handleError(
    error: unknown,
    context: string,
    options: ErrorDisplayOptions = {}
): string {
    const { showToast = false, logToConsole = true, customMessage, userFacing = true } = options;

    const message = resolveErrorMessage(error, customMessage);
    
    if (logToConsole) {
        logError(context, error);
    }

    const userMessage = userFacing ? mapToUserFriendlyMessage(message) : message;

    if (showToast) {
        showErrorToast(userMessage);
    }

    return userMessage;
}

/**
 * Wraps an async function with standardized error handling.
 * 
 * @param fn - The async function to wrap
 * @param context - Context for error logging
 * @param options - Error handling options
 * @returns Wrapped function that handles errors
 * 
 * @example
 * ```typescript
 * const safeCreateChat = withErrorHandling(
 *   async (chat) => await window.electron.db.createChat(chat),
 *   'ChatManager',
 *   { showToast: true }
 * )
 * ```
 */
export function withErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    context: string,
    options: ErrorDisplayOptions = {}
): T {
    return (async (...args: Parameters<T>) => {
        try {
            return await fn(...args);
        } catch (error) {
            handleError(error, context, options);
            throw error; // Re-throw to allow caller to handle if needed
        }
    }) as T;
}

/**
 * Creates a safe async handler that returns a default value on error.
 * 
 * @param fn - The async function to wrap
 * @param defaultValue - Value to return on error
 * @param context - Context for error logging
 * @returns Wrapped function that never throws
 * 
 * @example
 * ```typescript
 * const safeGetChats = createSafeHandler(
 *   async () => await window.electron.db.getAllChats(),
 *   [],
 *   'ChatManager'
 * )
 * ```
 */
export function createSafeHandler<TArgs extends unknown[], TReturn>(
    fn: (...args: TArgs) => Promise<TReturn>,
    defaultValue: TReturn,
    context: string
): (...args: TArgs) => Promise<TReturn> {
    return async (...args: TArgs) => {
        try {
            return await fn(...args);
        } catch (error) {
            handleError(error, context, { logToConsole: true, showToast: false });
            return defaultValue;
        }
    };
}

