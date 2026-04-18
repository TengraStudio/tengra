/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * @fileoverview Error handling, retry policy, and fallback behavior for Workspace Explorer
 * @description Provides standardized error codes, retry mechanisms, and fallback strategies
 */

import React from 'react';

import { useTranslation } from '@/i18n';
import { appLogger } from '@/utils/renderer-logger';

import {
    WorkspaceExplorerError,
    WorkspaceExplorerErrorCode,
    WorkspaceExplorerErrorCodes,
} from './workspace-explorer-validation';

/**
 * Retry configuration for workspace operations
 */
export const WorkspaceRetryConfig = {
    maxRetries: 3,
    initialDelayMs: 200,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
} as const;

/**
 * Result type for operations with retry support
 */
export interface WorkspaceRetryResult<T> {
    success: boolean;
    data?: T;
    error?: WorkspaceExplorerError;
    attempts: number;
}

/**
 * Calculates delay for exponential backoff
 * @param attempt - Current attempt number (0-indexed)
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(attempt: number): number {
    const delay = WorkspaceRetryConfig.initialDelayMs * Math.pow(WorkspaceRetryConfig.backoffMultiplier, attempt);
    return Math.min(delay, WorkspaceRetryConfig.maxDelayMs);
}

/**
 * Sleeps for a specified duration
 * @param ms - Duration in milliseconds
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
        const timer = setTimeout(resolve, ms);
        if (typeof timer.unref === 'function') {
            timer.unref();
        }
    });
}

/**
 * Executes an operation with retry logic
 * @param operation - The async operation to execute
 * @param shouldRetry - Function to determine if retry should occur
 * @param maxRetries - Maximum number of retries
 * @returns Retry result with data or error
 */
export async function withWorkspaceRetry<T>(
    operation: () => Promise<T>,
    shouldRetry: (error: Error) => boolean = () => true,
    maxRetries: number = WorkspaceRetryConfig.maxRetries
): Promise<WorkspaceRetryResult<T>> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const data = await operation();
            return {
                success: true,
                data,
                attempts: attempt + 1,
            };
        } catch (error) {
            lastError = error as Error;

            if (attempt < maxRetries && shouldRetry(lastError)) {
                const delay = calculateBackoffDelay(attempt);
                await sleep(delay);
            }
        }
    }

    return {
        success: false,
        error:
            lastError instanceof WorkspaceExplorerError
                ? lastError
                : new WorkspaceExplorerError(
                    lastError?.message ?? 'Operation failed',
                    WorkspaceExplorerErrorCodes.VALIDATION_ERROR,
                    { originalError: lastError }
                ),
        attempts: maxRetries + 1,
    };
}

/**
 * Non-retryable error codes
 */
const NON_RETRYABLE_CODES: readonly WorkspaceExplorerErrorCode[] = [
    WorkspaceExplorerErrorCodes.INVALID_MOUNT_ID,
    WorkspaceExplorerErrorCodes.INVALID_ENTRY_PATH,
    WorkspaceExplorerErrorCodes.PERMISSION_DENIED,
    WorkspaceExplorerErrorCodes.UNSUPPORTED_OPERATION,
    WorkspaceExplorerErrorCodes.VALIDATION_ERROR,
] as const;

/**
 * Determines if an error is retryable
 * @param error - The error to check
 * @returns True if the operation should be retried
 */
export function isRetryableError(error: Error): boolean {
    // Network errors are retryable
    if (error.message.includes('network') || error.message.includes('timeout')) {
        return true;
    }

    // SSH connection errors are retryable
    if (error.message.includes('SSH') || error.message.includes('connection')) {
        return true;
    }

    // Workspace explorer specific errors that are not retryable
    if (error instanceof WorkspaceExplorerError) {
        return !NON_RETRYABLE_CODES.includes(error.code as typeof NON_RETRYABLE_CODES[number]);
    }

    return false;
}

/**
 * Fallback strategies for workspace operations
 */
export const WorkspaceFallbackStrategies = {
    /**
     * Falls back to the first connected mount
     */
    firstConnected: <T extends { id: string }>(
        mounts: T[],
        status: Record<string, string>
    ): T | undefined => {
        for (const mount of mounts) {
            if (status[mount.id] === 'connected') {
                return mount;
            }
        }
        return undefined;
    },

    /**
     * Falls back to a default mount if specified
     */
    defaultMount: <T extends { id: string }>(
        mounts: T[],
        defaultId: string
    ): T | undefined => {
        return mounts.find(m => m.id === defaultId);
    },

    /**
     * Falls back to local mount if available
     */
    localMount: <T extends { type: string }>(mounts: T[]): T | undefined => {
        return mounts.find(m => m.type === 'local');
    },
} as const;

/**
 * Error messages for user display
 */
export const WorkspaceErrorMessages: Record<string, string> = {
    [WorkspaceExplorerErrorCodes.INVALID_MOUNT_ID]: 'workspace.errors.explorer.invalidMountSelected',
    [WorkspaceExplorerErrorCodes.INVALID_ENTRY_PATH]: 'workspace.errors.explorer.invalidFilePath',
    [WorkspaceExplorerErrorCodes.MOUNT_NOT_FOUND]: 'workspace.errors.explorer.mountNotFound',
    [WorkspaceExplorerErrorCodes.ENTRY_NOT_FOUND]: 'workspace.errors.explorer.entryNotFound',
    [WorkspaceExplorerErrorCodes.INVALID_PATH]: 'workspace.errors.explorer.invalidPath',
    [WorkspaceExplorerErrorCodes.PERMISSION_DENIED]: 'workspace.errors.explorer.permissionDenied',
    [WorkspaceExplorerErrorCodes.VALIDATION_ERROR]: 'workspace.errors.explorer.validationError',
    [WorkspaceExplorerErrorCodes.UNSUPPORTED_OPERATION]: 'workspace.errors.explorer.unsupportedOperation',
};

/**
 * Gets a user-friendly error message
 * @param code - The error code
 * @returns User-friendly error message
 */
export function getUserErrorMessage(code: string, resolveMessage: (key: string) => string): string {
    const messageKey = WorkspaceErrorMessages[code];
    if (!messageKey) {
        return resolveMessage('workspace.errors.explorer.unexpected');
    }
    return resolveMessage(messageKey);
}

/**
 * Logs an error for debugging
 * @param error - The error to log
 * @param context - Additional context
 */
export function logWorkspaceError(error: Error, context?: Record<string, RendererDataValue>): void {
    const errorInfo = {
        message: error.message,
        name: error.name,
        stack: error.stack,
        ...context,
    };

    appLogger.error('WorkspaceExplorer', JSON.stringify(errorInfo));
}

/**
 * Creates a standardized error response
 */
export interface WorkspaceErrorResponse {
    code: string;
    message: string;
    details?: Record<string, RendererDataValue>;
    recoverable: boolean;
}

/**
 * Creates an error response from a WorkspaceExplorerError
 * @param error - The error to convert
 * @returns Standardized error response
 */
export function createErrorResponse(error: WorkspaceExplorerError): WorkspaceErrorResponse {
    return {
        code: error.code,
        message: error.message,
        details: error.details,
        recoverable: isRetryableError(error),
    };
}

/**
 * Error boundary fallback props type
 */
export interface WorkspaceErrorBoundaryFallbackProps {
    error: Error;
    resetErrorBoundary: () => void;
}

/**
 * Default error boundary fallback component
 */
export function WorkspaceErrorFallback({
    error,
    resetErrorBoundary,
}: WorkspaceErrorBoundaryFallbackProps): React.ReactElement {
    const { t } = useTranslation();
    const message =
        error instanceof WorkspaceExplorerError
            ? getUserErrorMessage(error.code, t)
            : t('workspace.errors.explorer.unexpected');

    return (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">{message}</p>
            <button
                onClick={resetErrorBoundary}
                className="mt-2 px-3 py-1 typo-caption bg-destructive text-destructive-foreground rounded hover:bg-destructive/90"
            >
                {t('common.retry')}
            </button>
        </div>
    );
}

/**
 * Debounce configuration for file operations
 */
export const FileDebounceConfig = {
    delayMs: 200,
    maxWaitMs: 1000,
} as const;

/**
 * Creates a debounced function
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: RendererDataValue[]) => RendererDataValue>(
    fn: T,
    delay: number = FileDebounceConfig.delayMs
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    return (...args: Parameters<T>) => {
        if (timeoutId !== undefined) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            fn(...args);
            timeoutId = undefined;
        }, delay);
    };
}

/**
 * Throttle configuration for rapid operations
 */
export const FileThrottleConfig = {
    intervalMs: 100,
} as const;

/**
 * Creates a throttled function
 * @param fn - Function to throttle
 * @param interval - Minimum interval between calls
 * @returns Throttled function
 */
export function throttle<T extends (...args: RendererDataValue[]) => RendererDataValue>(
    fn: T,
    interval: number = FileThrottleConfig.intervalMs
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

/**
 * File operation types for error context
 */
export type FileOperationType =
    | 'read'
    | 'write'
    | 'delete'
    | 'rename'
    | 'create'
    | 'move'
    | 'copy'
    | 'list';

/**
 * Creates a detailed error for file operations
 * @param operation - The operation type
 * @param path - The file path
 * @param cause - The underlying cause
 * @returns A WorkspaceExplorerError with context
 */
export function createFileOperationError(
    operation: FileOperationType,
    path: string,
    cause?: Error,
    resolveMessage?: (key: string) => string
): WorkspaceExplorerError {
    const messageKeys: Record<FileOperationType, string> = {
        read: 'workspace.errors.fileOps.read',
        write: 'workspace.errors.fileOps.write',
        delete: 'workspace.errors.fileOps.delete',
        rename: 'workspace.errors.fileOps.rename',
        create: 'workspace.errors.fileOps.create',
        move: 'workspace.errors.fileOps.move',
        copy: 'workspace.errors.fileOps.copy',
        list: 'workspace.errors.fileOps.list',
    };
    const baseMessage = resolveMessage
        ? resolveMessage(messageKeys[operation])
        : messageKeys[operation];

    return new WorkspaceExplorerError(
        `${baseMessage}: ${path}`,
        WorkspaceExplorerErrorCodes.VALIDATION_ERROR,
        { operation, path, cause: cause?.message }
    );
}
