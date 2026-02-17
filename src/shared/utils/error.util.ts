import { AppError, CatchError } from '@/types/common';

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
    NETWORK_ERROR = 'NETWORK_ERROR',
    API_ERROR = 'API_ERROR',
    AUTH_ERROR = 'AUTH_ERROR',
    TIMEOUT = 'TIMEOUT',
    RATE_LIMIT = 'RATE_LIMIT',
    PERMISSION_DENIED = 'PERMISSION_DENIED'
}

export class TandemError extends Error {
    public readonly timestamp: string;
    public readonly code: string;
    public readonly context?: Record<string, unknown>;

    constructor(
        message: string,
        code: string = AppErrorCode.UNKNOWN,
        context?: Record<string, unknown>
    ) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.timestamp = new Date().toISOString();
        this.context = context;

        // Restore prototype chain for proper instanceof checks
        Object.setPrototypeOf(this, new.target.prototype);
    }

    public toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            timestamp: this.timestamp,
            context: this.context,
            stack: this.stack
        };
    }
}

/**
 * Thrown when an external API call fails (e.g., OpenAI, GitHub).
 */
export class ApiError extends TandemError {
    public readonly statusCode?: number;
    public readonly provider: string;
    public readonly retryable: boolean;

    constructor(message: string, provider: string, statusCode?: number, retryable: boolean = true, context?: Record<string, unknown>) {
        super(message, AppErrorCode.API_ERROR, context);
        this.provider = provider;
        this.statusCode = statusCode;
        this.retryable = retryable;
    }
}

export class ValidationTandemError extends TandemError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, AppErrorCode.VALIDATION_ERROR, context);
    }
}

// Alias for compatibility with main process code
export class ValidationError extends ValidationTandemError { }

export class NetworkTandemError extends TandemError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, AppErrorCode.NETWORK_ERROR, context);
    }
}

// Alias for compatibility with main process code
export class NetworkError extends NetworkTandemError { }

export class NotFoundTandemError extends TandemError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, AppErrorCode.NOT_FOUND, context);
    }
}

export class UnauthorizedTandemError extends TandemError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, AppErrorCode.UNAUTHORIZED, context);
    }
}

// Alias for compatibility with main process code
export class AuthenticationError extends UnauthorizedTandemError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, context);
        // Ensure code is AUTH_ERROR if preferred, or generic UNAUTHORIZED
        // For now, mapping to UNAUTHORIZED via super call is safer for existing logic
    }
}

export interface ErrorRecoveryStrategy {
    code: string;
    retryable: boolean;
    userAction: 'retry' | 'reauthenticate' | 'check-input' | 'contact-support';
}

const RECOVERY_BY_CODE: Record<string, ErrorRecoveryStrategy> = {
    [AppErrorCode.NETWORK_ERROR]: { code: AppErrorCode.NETWORK_ERROR, retryable: true, userAction: 'retry' },
    [AppErrorCode.VALIDATION_ERROR]: { code: AppErrorCode.VALIDATION_ERROR, retryable: false, userAction: 'check-input' },
    [AppErrorCode.UNAUTHORIZED]: { code: AppErrorCode.UNAUTHORIZED, retryable: false, userAction: 'reauthenticate' },
    [AppErrorCode.NOT_FOUND]: { code: AppErrorCode.NOT_FOUND, retryable: false, userAction: 'contact-support' },
    [AppErrorCode.INTERNAL_ERROR]: { code: AppErrorCode.INTERNAL_ERROR, retryable: true, userAction: 'retry' },
    [AppErrorCode.UNKNOWN]: { code: AppErrorCode.UNKNOWN, retryable: false, userAction: 'contact-support' }
};

export function getErrorRecoveryStrategy(error: unknown): ErrorRecoveryStrategy {
    const code = getErrorCode(error) ?? AppErrorCode.UNKNOWN;
    return RECOVERY_BY_CODE[code] ?? RECOVERY_BY_CODE[AppErrorCode.UNKNOWN];
}

/**
 * Extracts error message from an object if present
 */
const getMessageFromObject = (obj: Record<string, unknown>): string | null => {
    if (typeof obj.message === 'string') {
        return obj.message;
    }
    if (typeof obj.error === 'string') {
        return obj.error;
    }

    if (obj.error && typeof obj.error === 'object') {
        const nested = obj.error as Record<string, unknown>;
        if (typeof nested.message === 'string') {
            return nested.message;
        }
    }

    return null;
};

/**
 * Safely extracts error message from any caught value
 * Usage: catch (e) { const msg = getErrorMessage(e) }
 */
export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }

    if (error && typeof error === 'object') {
        const msg = getMessageFromObject(error as Record<string, unknown>);
        if (msg) {
            return msg;
        }
    }

    const str = String(error);
    return str === '[object Object]' ? 'Unknown error' : str;
}

/**
 * Normalizes any caught error into a structured AppError
 */
export function toAppError(error: CatchError, defaultCode = 'UNKNOWN_ERROR'): AppError {
    // 1. Check if it's already an AppError
    if (isAppError(error)) {
        return error as AppError;
    }

    // 2. Extract message and code
    const message = getErrorMessage(error);
    const code = getErrorCode(error) ?? defaultCode;

    const appError: AppError = { message, code };

    // 3. Add stack if available
    if (error instanceof Error && error.stack) {
        appError.stack = error.stack;
    }

    return appError;
}

/**
 * Type guard for AppError
 */
function isAppError(error: unknown): boolean {
    return !!(
        error &&
        typeof error === 'object' &&
        'message' in error &&
        'code' in error &&
        typeof (error as Record<string, unknown>).message === 'string'
    );
}

/**
 * Extracts error code from error object
 */
function getErrorCode(error: unknown): string | null {
    if (error && typeof error === 'object' && 'code' in error) {
        return String((error as Record<string, unknown>).code);
    }
    return null;
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
 * Helper to check if an error is a TandemError.
 */
export function isTandemError(error: CatchError): error is TandemError {
    return error instanceof TandemError;
}

/**
 * Creates a standardized error response object
 */
export function createErrorResponse(error: CatchError): { success: false; error: string } {
    return { success: false, error: getErrorMessage(error) };
}
