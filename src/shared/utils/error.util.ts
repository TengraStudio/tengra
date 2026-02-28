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
    PERMISSION_DENIED = 'PERMISSION_DENIED',
    // SSH IPC Error Codes (BACKLOG-0054)
    SSH_CONNECTION_FAILED = 'SSH_CONNECTION_FAILED',
    SSH_AUTH_INVALID = 'SSH_AUTH_INVALID',
    SSH_TIMEOUT = 'SSH_TIMEOUT',
    SSH_HOST_UNREACHABLE = 'SSH_HOST_UNREACHABLE',
    SSH_KEY_REJECTED = 'SSH_KEY_REJECTED',
    SSH_SESSION_NOT_FOUND = 'SSH_SESSION_NOT_FOUND',
    SSH_COMMAND_FAILED = 'SSH_COMMAND_FAILED',
    SSH_TRANSFER_FAILED = 'SSH_TRANSFER_FAILED',
    SSH_TUNNEL_FAILED = 'SSH_TUNNEL_FAILED',
    SSH_PROFILE_NOT_FOUND = 'SSH_PROFILE_NOT_FOUND',
    SSH_PROFILE_SAVE_FAILED = 'SSH_PROFILE_SAVE_FAILED',
    SSH_PROFILE_DELETE_FAILED = 'SSH_PROFILE_DELETE_FAILED',
    // Terminal IPC Error Codes (BACKLOG-0064)
    TERMINAL_SESSION_NOT_FOUND = 'TERMINAL_SESSION_NOT_FOUND',
    TERMINAL_PROCESS_FAILED = 'TERMINAL_PROCESS_FAILED',
    TERMINAL_SPAWN_FAILED = 'TERMINAL_SPAWN_FAILED',
    TERMINAL_INVALID_PROFILE = 'TERMINAL_INVALID_PROFILE',
    TERMINAL_PROFILE_NOT_FOUND = 'TERMINAL_PROFILE_NOT_FOUND',
    TERMINAL_PROFILE_SAVE_FAILED = 'TERMINAL_PROFILE_SAVE_FAILED',
    TERMINAL_EXPORT_FAILED = 'TERMINAL_EXPORT_FAILED',
    TERMINAL_IMPORT_FAILED = 'TERMINAL_IMPORT_FAILED',
    TERMINAL_RATE_LIMITED = 'TERMINAL_RATE_LIMITED',
    // Git-Advanced IPC Error Codes (BACKLOG-0074)
    GIT_CONFLICT = 'GIT_CONFLICT',
    GIT_REBASE_IN_PROGRESS = 'GIT_REBASE_IN_PROGRESS',
    GIT_MERGE_FAILED = 'GIT_MERGE_FAILED',
    GIT_STASH_FAILED = 'GIT_STASH_FAILED',
    GIT_HOOK_FAILED = 'GIT_HOOK_FAILED',
    GIT_SUBMODULE_FAILED = 'GIT_SUBMODULE_FAILED',
    GIT_INVALID_REF = 'GIT_INVALID_REF',
    GIT_WORKTREE_FAILED = 'GIT_WORKTREE_FAILED',
    GIT_FLOW_FAILED = 'GIT_FLOW_FAILED',
    GIT_REMOTE_FAILED = 'GIT_REMOTE_FAILED',
    GIT_COMMAND_TIMEOUT = 'GIT_COMMAND_TIMEOUT',
    // Database Service Error Codes (BACKLOG-0494)
    DB_CONNECTION_FAILED = 'DB_CONNECTION_FAILED',
    DB_QUERY_TIMEOUT = 'DB_QUERY_TIMEOUT',
    DB_MIGRATION_FAILED = 'DB_MIGRATION_FAILED',
    DB_VALIDATION_FAILED = 'DB_VALIDATION_FAILED',
    DB_CONSTRAINT_VIOLATION = 'DB_CONSTRAINT_VIOLATION',
    DB_NOT_INITIALIZED = 'DB_NOT_INITIALIZED',
    DB_SHARDING_ERROR = 'DB_SHARDING_ERROR',
    DB_COMPRESSION_ERROR = 'DB_COMPRESSION_ERROR',
    // Proxy Service Error Codes (BACKLOG-0414)
    PROXY_NOT_INITIALIZED = 'PROXY_NOT_INITIALIZED',
    PROXY_START_FAILED = 'PROXY_START_FAILED',
    PROXY_STOP_FAILED = 'PROXY_STOP_FAILED',
    PROXY_AUTH_FAILED = 'PROXY_AUTH_FAILED',
    PROXY_REQUEST_FAILED = 'PROXY_REQUEST_FAILED',
    PROXY_INVALID_CONFIG = 'PROXY_INVALID_CONFIG',
    PROXY_CONNECTION_FAILED = 'PROXY_CONNECTION_FAILED',
    PROXY_TIMEOUT = 'PROXY_TIMEOUT',
    PROXY_PORT_IN_USE = 'PROXY_PORT_IN_USE',
    PROXY_BINARY_NOT_FOUND = 'PROXY_BINARY_NOT_FOUND'
}

export class TengraError extends Error {
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
export class ApiError extends TengraError {
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

export class ValidationTengraError extends TengraError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, AppErrorCode.VALIDATION_ERROR, context);
    }
}

// Alias for compatibility with main process code
export class ValidationError extends ValidationTengraError { }

export class NetworkTengraError extends TengraError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, AppErrorCode.NETWORK_ERROR, context);
    }
}

// Alias for compatibility with main process code
export class NetworkError extends NetworkTengraError { }

export class NotFoundTengraError extends TengraError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, AppErrorCode.NOT_FOUND, context);
    }
}

export class UnauthorizedTengraError extends TengraError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, AppErrorCode.UNAUTHORIZED, context);
    }
}

// Alias for compatibility with main process code
export class AuthenticationError extends UnauthorizedTengraError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, context);
        // Ensure code is AUTH_ERROR if preferred, or generic UNAUTHORIZED
        // For now, mapping to UNAUTHORIZED via super call is safer for existing logic
    }
}

/**
 * Proxy-specific error with typed error code for startup/connection/request failures.
 */
export class ProxyServiceError extends TengraError {
    public readonly retryable: boolean;

    constructor(
        message: string,
        code: string = AppErrorCode.PROXY_REQUEST_FAILED,
        retryable: boolean = true,
        context?: Record<string, unknown>
    ) {
        super(message, code, context);
        this.retryable = retryable;
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
    [AppErrorCode.UNKNOWN]: { code: AppErrorCode.UNKNOWN, retryable: false, userAction: 'contact-support' },
    // SSH Error Recovery Strategies
    [AppErrorCode.SSH_CONNECTION_FAILED]: { code: AppErrorCode.SSH_CONNECTION_FAILED, retryable: true, userAction: 'retry' },
    [AppErrorCode.SSH_AUTH_INVALID]: { code: AppErrorCode.SSH_AUTH_INVALID, retryable: false, userAction: 'reauthenticate' },
    [AppErrorCode.SSH_TIMEOUT]: { code: AppErrorCode.SSH_TIMEOUT, retryable: true, userAction: 'retry' },
    [AppErrorCode.SSH_HOST_UNREACHABLE]: { code: AppErrorCode.SSH_HOST_UNREACHABLE, retryable: true, userAction: 'retry' },
    [AppErrorCode.SSH_KEY_REJECTED]: { code: AppErrorCode.SSH_KEY_REJECTED, retryable: false, userAction: 'reauthenticate' },
    [AppErrorCode.SSH_SESSION_NOT_FOUND]: { code: AppErrorCode.SSH_SESSION_NOT_FOUND, retryable: false, userAction: 'contact-support' },
    [AppErrorCode.SSH_COMMAND_FAILED]: { code: AppErrorCode.SSH_COMMAND_FAILED, retryable: true, userAction: 'retry' },
    [AppErrorCode.SSH_TRANSFER_FAILED]: { code: AppErrorCode.SSH_TRANSFER_FAILED, retryable: true, userAction: 'retry' },
    [AppErrorCode.SSH_TUNNEL_FAILED]: { code: AppErrorCode.SSH_TUNNEL_FAILED, retryable: true, userAction: 'retry' },
    [AppErrorCode.SSH_PROFILE_NOT_FOUND]: { code: AppErrorCode.SSH_PROFILE_NOT_FOUND, retryable: false, userAction: 'contact-support' },
    [AppErrorCode.SSH_PROFILE_SAVE_FAILED]: { code: AppErrorCode.SSH_PROFILE_SAVE_FAILED, retryable: true, userAction: 'retry' },
    [AppErrorCode.SSH_PROFILE_DELETE_FAILED]: { code: AppErrorCode.SSH_PROFILE_DELETE_FAILED, retryable: true, userAction: 'retry' },
    // Terminal Error Recovery Strategies
    [AppErrorCode.TERMINAL_SESSION_NOT_FOUND]: { code: AppErrorCode.TERMINAL_SESSION_NOT_FOUND, retryable: false, userAction: 'contact-support' },
    [AppErrorCode.TERMINAL_PROCESS_FAILED]: { code: AppErrorCode.TERMINAL_PROCESS_FAILED, retryable: true, userAction: 'retry' },
    [AppErrorCode.TERMINAL_SPAWN_FAILED]: { code: AppErrorCode.TERMINAL_SPAWN_FAILED, retryable: true, userAction: 'retry' },
    [AppErrorCode.TERMINAL_INVALID_PROFILE]: { code: AppErrorCode.TERMINAL_INVALID_PROFILE, retryable: false, userAction: 'check-input' },
    [AppErrorCode.TERMINAL_PROFILE_NOT_FOUND]: { code: AppErrorCode.TERMINAL_PROFILE_NOT_FOUND, retryable: false, userAction: 'contact-support' },
    [AppErrorCode.TERMINAL_PROFILE_SAVE_FAILED]: { code: AppErrorCode.TERMINAL_PROFILE_SAVE_FAILED, retryable: true, userAction: 'retry' },
    [AppErrorCode.TERMINAL_EXPORT_FAILED]: { code: AppErrorCode.TERMINAL_EXPORT_FAILED, retryable: true, userAction: 'retry' },
    [AppErrorCode.TERMINAL_IMPORT_FAILED]: { code: AppErrorCode.TERMINAL_IMPORT_FAILED, retryable: false, userAction: 'check-input' },
    [AppErrorCode.TERMINAL_RATE_LIMITED]: { code: AppErrorCode.TERMINAL_RATE_LIMITED, retryable: true, userAction: 'retry' },
    // Git-Advanced Error Recovery Strategies
    [AppErrorCode.GIT_CONFLICT]: { code: AppErrorCode.GIT_CONFLICT, retryable: false, userAction: 'check-input' },
    [AppErrorCode.GIT_REBASE_IN_PROGRESS]: { code: AppErrorCode.GIT_REBASE_IN_PROGRESS, retryable: false, userAction: 'check-input' },
    [AppErrorCode.GIT_MERGE_FAILED]: { code: AppErrorCode.GIT_MERGE_FAILED, retryable: true, userAction: 'retry' },
    [AppErrorCode.GIT_STASH_FAILED]: { code: AppErrorCode.GIT_STASH_FAILED, retryable: true, userAction: 'retry' },
    [AppErrorCode.GIT_HOOK_FAILED]: { code: AppErrorCode.GIT_HOOK_FAILED, retryable: false, userAction: 'check-input' },
    [AppErrorCode.GIT_SUBMODULE_FAILED]: { code: AppErrorCode.GIT_SUBMODULE_FAILED, retryable: true, userAction: 'retry' },
    [AppErrorCode.GIT_INVALID_REF]: { code: AppErrorCode.GIT_INVALID_REF, retryable: false, userAction: 'check-input' },
    [AppErrorCode.GIT_WORKTREE_FAILED]: { code: AppErrorCode.GIT_WORKTREE_FAILED, retryable: true, userAction: 'retry' },
    [AppErrorCode.GIT_FLOW_FAILED]: { code: AppErrorCode.GIT_FLOW_FAILED, retryable: true, userAction: 'retry' },
    [AppErrorCode.GIT_REMOTE_FAILED]: { code: AppErrorCode.GIT_REMOTE_FAILED, retryable: true, userAction: 'retry' },
    [AppErrorCode.GIT_COMMAND_TIMEOUT]: { code: AppErrorCode.GIT_COMMAND_TIMEOUT, retryable: true, userAction: 'retry' },
    // Database Error Recovery Strategies (BACKLOG-0494)
    [AppErrorCode.DB_CONNECTION_FAILED]: { code: AppErrorCode.DB_CONNECTION_FAILED, retryable: true, userAction: 'retry' },
    [AppErrorCode.DB_QUERY_TIMEOUT]: { code: AppErrorCode.DB_QUERY_TIMEOUT, retryable: true, userAction: 'retry' },
    [AppErrorCode.DB_MIGRATION_FAILED]: { code: AppErrorCode.DB_MIGRATION_FAILED, retryable: false, userAction: 'contact-support' },
    [AppErrorCode.DB_VALIDATION_FAILED]: { code: AppErrorCode.DB_VALIDATION_FAILED, retryable: false, userAction: 'check-input' },
    [AppErrorCode.DB_CONSTRAINT_VIOLATION]: { code: AppErrorCode.DB_CONSTRAINT_VIOLATION, retryable: false, userAction: 'check-input' },
    [AppErrorCode.DB_NOT_INITIALIZED]: { code: AppErrorCode.DB_NOT_INITIALIZED, retryable: true, userAction: 'retry' },
    [AppErrorCode.DB_SHARDING_ERROR]: { code: AppErrorCode.DB_SHARDING_ERROR, retryable: false, userAction: 'contact-support' },
    [AppErrorCode.DB_COMPRESSION_ERROR]: { code: AppErrorCode.DB_COMPRESSION_ERROR, retryable: true, userAction: 'retry' },
    // Proxy Error Recovery Strategies (BACKLOG-0414)
    [AppErrorCode.PROXY_NOT_INITIALIZED]: { code: AppErrorCode.PROXY_NOT_INITIALIZED, retryable: true, userAction: 'retry' },
    [AppErrorCode.PROXY_START_FAILED]: { code: AppErrorCode.PROXY_START_FAILED, retryable: true, userAction: 'retry' },
    [AppErrorCode.PROXY_STOP_FAILED]: { code: AppErrorCode.PROXY_STOP_FAILED, retryable: true, userAction: 'retry' },
    [AppErrorCode.PROXY_AUTH_FAILED]: { code: AppErrorCode.PROXY_AUTH_FAILED, retryable: false, userAction: 'reauthenticate' },
    [AppErrorCode.PROXY_REQUEST_FAILED]: { code: AppErrorCode.PROXY_REQUEST_FAILED, retryable: true, userAction: 'retry' },
    [AppErrorCode.PROXY_INVALID_CONFIG]: { code: AppErrorCode.PROXY_INVALID_CONFIG, retryable: false, userAction: 'check-input' },
    [AppErrorCode.PROXY_CONNECTION_FAILED]: { code: AppErrorCode.PROXY_CONNECTION_FAILED, retryable: true, userAction: 'retry' },
    [AppErrorCode.PROXY_TIMEOUT]: { code: AppErrorCode.PROXY_TIMEOUT, retryable: true, userAction: 'retry' },
    [AppErrorCode.PROXY_PORT_IN_USE]: { code: AppErrorCode.PROXY_PORT_IN_USE, retryable: true, userAction: 'check-input' },
    [AppErrorCode.PROXY_BINARY_NOT_FOUND]: { code: AppErrorCode.PROXY_BINARY_NOT_FOUND, retryable: false, userAction: 'contact-support' }
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
 * Helper to check if an error is a TengraError.
 */
export function isTengraError(error: CatchError): error is TengraError {
    return error instanceof TengraError;
}

/**
 * Creates a standardized error response object
 */
export function createErrorResponse(error: CatchError): { success: false; error: string } {
    return { success: false, error: getErrorMessage(error) };
}

