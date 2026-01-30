import { CatchError, JsonValue } from '@shared/types/common';

export enum AppErrorCode {
    UNKNOWN = 'UNKNOWN',
    NETWORK_ERROR = 'NETWORK_ERROR',
    API_ERROR = 'API_ERROR',
    AUTH_ERROR = 'AUTH_ERROR',
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    TIMEOUT = 'TIMEOUT',
    RATE_LIMIT = 'RATE_LIMIT',
    NOT_FOUND = 'NOT_FOUND',
    PERMISSION_DENIED = 'PERMISSION_DENIED'
}

/**
 * Base error class for all application-specific errors.
 */
export abstract class TandemError extends Error {
    public readonly timestamp: string;
    public readonly code: AppErrorCode;
    public readonly context?: Record<string, JsonValue | Error>;

    constructor(message: string, code: AppErrorCode = AppErrorCode.UNKNOWN, context?: Record<string, JsonValue | Error>) {
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

    constructor(message: string, provider: string, statusCode?: number, retryable: boolean = true, context?: Record<string, JsonValue | Error>) {
        super(message, AppErrorCode.API_ERROR, context);
        this.provider = provider;
        this.statusCode = statusCode;
        this.retryable = retryable;
    }
}

/**
 * Thrown when a network request fails due to connectivity issues.
 */
export class NetworkError extends TandemError {
    constructor(message: string, context?: Record<string, JsonValue | Error>) {
        super(message, AppErrorCode.NETWORK_ERROR, context);
    }
}

/**
 * Thrown when authentication fails (local or remote).
 */
export class AuthenticationError extends TandemError {
    constructor(message: string, context?: Record<string, JsonValue | Error>) {
        super(message, AppErrorCode.AUTH_ERROR, context);
    }
}

/**
 * Thrown when input validation or configuration check fails.
 */
export class ValidationError extends TandemError {
    constructor(message: string, context?: Record<string, JsonValue | Error>) {
        super(message, AppErrorCode.VALIDATION_ERROR, context);
    }
}

/**
 * Helper to check if an error is an TandemError.
 */
export function isTandemError(error: CatchError): error is TandemError {
    return error instanceof TandemError;
}

