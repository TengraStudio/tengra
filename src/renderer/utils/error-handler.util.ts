import { getErrorMessage, AppErrorCode, OrbitError } from '../../shared/utils/error.util'

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
export function handleError(
    error: unknown,
    context: string,
    options: ErrorDisplayOptions = {}
): string {
    const {
        showToast = false,
        logToConsole = true,
        customMessage,
        userFacing = true
    } = options

    const message = customMessage || getErrorMessage(error)
    // Error code can be used for analytics or error tracking in the future
    void (error instanceof OrbitError ? error.code : AppErrorCode.UNKNOWN)

    if (logToConsole) {
        console.error(`[${context}] Error:`, error)
    }

    // Format user-friendly message
    let userMessage = message

    // Map technical errors to user-friendly messages
    if (userFacing) {
        if (message.includes('429') || message.includes('rate limit') || message.includes('quota')) {
            userMessage = 'Rate limit exceeded. Please wait a moment and try again.'
        } else if (message.includes('401') || message.includes('unauthorized')) {
            userMessage = 'Authentication failed. Please check your API keys.'
        } else if (message.includes('network') || message.includes('fetch')) {
            userMessage = 'Network error. Please check your connection.'
        } else if (message.includes('timeout')) {
            userMessage = 'Request timed out. Please try again.'
        }
    }

    if (showToast && typeof window !== 'undefined' && (window as any).showToast) {
        ;(window as any).showToast({
            type: 'error',
            message: userMessage
        })
    }

    return userMessage
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
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    context: string,
    options: ErrorDisplayOptions = {}
): T {
    return (async (...args: Parameters<T>) => {
        try {
            return await fn(...args)
        } catch (error) {
            handleError(error, context, options)
            throw error // Re-throw to allow caller to handle if needed
        }
    }) as T
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
export function createSafeHandler<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    defaultValue: Awaited<ReturnType<T>>,
    context: string
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
    return async (...args: Parameters<T>) => {
        try {
            return await fn(...args)
        } catch (error) {
            handleError(error, context, { logToConsole: true, showToast: false })
            return defaultValue
        }
    }
}
