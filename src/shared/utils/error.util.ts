import { CatchError, AppError } from '../types/common';

/**
 * Error handling utilities
 * Use these helpers in catch blocks instead of type annotations
 */

export enum AppErrorCode {
    UNKNOWN = 'UNKNOWN',
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    NOT_FOUND = 'NOT_FOUND',
    UNAUTHORIZED = 'UNAUTHORIZED',
    INTERNAL_ERROR = 'INTERNAL_ERROR',
    NETWORK_ERROR = 'NETWORK_ERROR'
}

export class OrbitError extends Error {
    constructor(
        message: string,
        public code: string = AppErrorCode.UNKNOWN,
        public context?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'OrbitError';
    }
}

/**
 * Safely extracts error message from any caught value
 * Usage: catch (e) { const msg = getErrorMessage(e) }
 */
export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object') {
        const err = error as Record<string, unknown>;
        if (typeof err.message === 'string') return err.message;
        if (typeof err.error === 'string') return err.error;
        if (err.error && typeof err.error === 'object' && typeof (err.error as Record<string, unknown>).message === 'string') {
            return (err.error as Record<string, unknown>).message as string;
        }
    }
    return String(error || 'Unknown error');
}

/**
 * Normalizes any caught error into a structured AppError
 */
export function toAppError(error: CatchError, defaultCode = 'UNKNOWN_ERROR'): AppError {
    if (error && typeof error === 'object' && 'message' in error && 'code' in error && typeof (error as Record<string, unknown>).message === 'string') {
        return error as AppError;
    }

    const message = getErrorMessage(error);
    const code = (error && typeof error === 'object' && 'code' in error && typeof (error as Record<string, unknown>).code === 'string')
        ? (error as Record<string, unknown>).code as string
        : defaultCode;

    const appError: AppError = { message, code };

    if (error instanceof Error && error.stack) {
        appError.stack = error.stack;
    }

    return appError;
}

/**
 * Type guard to check if error is an Error instance
 */
export function isError(error: CatchError): error is Error {
    return error instanceof Error;
}

/**
 * Type guard for Node.js system errors (ENOENT, EACCES, etc.)
 */
export function isNodeError(error: CatchError): error is NodeJS.ErrnoException {
    return error instanceof Error && 'code' in error;
}

/**
 * Creates a standardized error response object
 */
export function createErrorResponse(error: CatchError): { success: false; error: string } {
    return { success: false, error: getErrorMessage(error) };
}
