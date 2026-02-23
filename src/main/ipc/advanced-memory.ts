/**
 * IPC Handlers for the Advanced Memory System
 *
 * Provides renderer access to:
 * - Pending memories (staging buffer)
 * - Memory validation (confirm/reject)
 * - Advanced recall with context
 * - Memory statistics
 * - Decay maintenance
 */

import { appLogger } from '@main/logging/logger';
import { AdvancedMemoryService } from '@main/services/llm/advanced-memory.service';
import { createIpcHandler } from '@main/utils/ipc-wrapper.util';
import { MemoryCategory, RecallContext, SharedMemorySyncRequest } from '@shared/types/advanced-memory';
import { getErrorMessage } from '@shared/utils/error.util';
import { ipcMain } from 'electron';




const LOG_TAG = 'AdvancedMemoryIPC';
const MAX_ADVANCED_MEMORY_TELEMETRY_EVENTS = 250;

const ADVANCED_MEMORY_ERROR_CODE = {
    VALIDATION: 'ADVANCED_MEMORY_VALIDATION_ERROR',
    OPERATION_FAILED: 'ADVANCED_MEMORY_OPERATION_FAILED',
    TRANSIENT: 'ADVANCED_MEMORY_TRANSIENT_ERROR',
} as const;

const ADVANCED_MEMORY_MESSAGE_KEY = {
    VALIDATION_FAILED: 'errors.unexpected',
    OPERATION_FAILED: 'errors.unexpected',
    EXPORT_FAILED: 'memory.errors.exportFailed',
    IMPORT_FAILED: 'memory.errors.importFailed',
} as const;

const ADVANCED_MEMORY_PERFORMANCE_BUDGET_MS = {
    FAST: 40,
    STANDARD: 120,
    HEAVY: 250,
} as const;

type AdvancedMemoryUiState = 'ready' | 'empty' | 'failure';

interface AdvancedMemoryResponseEnvelope {
    success: boolean;
    data?: unknown;
    error?: string;
    errorCode?: string;
    messageKey?: string;
    retryable?: boolean;
    uiState?: AdvancedMemoryUiState | string;
    fallbackUsed?: boolean;
    [key: string]: unknown;
}

type TelemetryAwareHandler<T extends AdvancedMemoryResponseEnvelope> = {
    bivarianceHack(event: Electron.IpcMainInvokeEvent, ...args: unknown[]): Promise<T>;
}['bivarianceHack'];

interface AdvancedMemoryTelemetryEvent {
    channel: string;
    event: 'success' | 'failure' | 'retry';
    timestamp: number;
    durationMs?: number;
    code?: string;
}

interface AdvancedMemoryChannelMetrics {
    calls: number;
    failures: number;
    retries: number;
    validationFailures: number;
    budgetExceededCount: number;
    lastDurationMs: number;
    lastErrorCode: string | null;
    lastUiState: AdvancedMemoryUiState | null;
}

const advancedMemoryTelemetry = {
    totalCalls: 0,
    totalFailures: 0,
    totalRetries: 0,
    validationFailures: 0,
    budgetExceededCount: 0,
    lastErrorCode: null as string | null,
    channels: {} as Record<string, AdvancedMemoryChannelMetrics>,
    events: [] as AdvancedMemoryTelemetryEvent[]
};

const getChannelMetric = (channel: string): AdvancedMemoryChannelMetrics => {
    if (!advancedMemoryTelemetry.channels[channel]) {
        advancedMemoryTelemetry.channels[channel] = {
            calls: 0,
            failures: 0,
            retries: 0,
            validationFailures: 0,
            budgetExceededCount: 0,
            lastDurationMs: 0,
            lastErrorCode: null,
            lastUiState: null,
        };
    }
    return advancedMemoryTelemetry.channels[channel];
};

const trackAdvancedMemoryEvent = (
    channel: string,
    event: 'success' | 'failure' | 'retry',
    details: { durationMs?: number; code?: string } = {}
): void => {
    advancedMemoryTelemetry.events = [...advancedMemoryTelemetry.events, {
        channel,
        event,
        timestamp: Date.now(),
        durationMs: details.durationMs,
        code: details.code
    }].slice(-MAX_ADVANCED_MEMORY_TELEMETRY_EVENTS);
};

const getBudgetForChannel = (channel: string): number => {
    if (
        channel === 'advancedMemory:getPending'
        || channel === 'advancedMemory:getSearchHistory'
        || channel === 'advancedMemory:getSearchSuggestions'
        || channel === 'advancedMemory:health'
    ) {
        return ADVANCED_MEMORY_PERFORMANCE_BUDGET_MS.FAST;
    }
    if (
        channel === 'advancedMemory:search'
        || channel === 'advancedMemory:recall'
        || channel === 'advancedMemory:getStats'
        || channel === 'advancedMemory:getSearchAnalytics'
    ) {
        return ADVANCED_MEMORY_PERFORMANCE_BUDGET_MS.STANDARD;
    }
    return ADVANCED_MEMORY_PERFORMANCE_BUDGET_MS.HEAVY;
};

const isRetryableError = (error: Error): boolean => {
    const normalized = getErrorMessage(error).toLowerCase();
    const fragments = [
        'timeout',
        'timed out',
        'temporar',
        'busy',
        'database is locked',
        'econnreset',
        'econnrefused',
        'network'
    ];
    return fragments.some(fragment => normalized.includes(fragment));
};

const isValidationError = (error: Error): boolean => {
    const normalized = getErrorMessage(error).toLowerCase();
    return normalized.includes('must be')
        || normalized.includes('invalid')
        || normalized.includes('required')
        || normalized.includes('out of range');
};

const waitFor = async (delayMs: number): Promise<void> => {
    await new Promise<void>(resolve => {
        setTimeout(resolve, delayMs);
    });
};

const buildAdvancedMemoryError = (
    error: Error,
    messageKeyOverride?: string
): Pick<AdvancedMemoryResponseEnvelope, 'error' | 'errorCode' | 'messageKey' | 'retryable'> => {
    const validationFailure = isValidationError(error);
    const retryable = !validationFailure && isRetryableError(error);
    const errorCode = validationFailure
        ? ADVANCED_MEMORY_ERROR_CODE.VALIDATION
        : retryable
            ? ADVANCED_MEMORY_ERROR_CODE.TRANSIENT
            : ADVANCED_MEMORY_ERROR_CODE.OPERATION_FAILED;

    return {
        error: getErrorMessage(error),
        errorCode,
        retryable,
        messageKey: messageKeyOverride ?? (
            validationFailure
                ? ADVANCED_MEMORY_MESSAGE_KEY.VALIDATION_FAILED
                : ADVANCED_MEMORY_MESSAGE_KEY.OPERATION_FAILED
        )
    };
};

const withAdvancedMemoryErrorMetadata = <T extends AdvancedMemoryResponseEnvelope>(
    base: T,
    error: Error,
    messageKeyOverride?: string
): T => {
    const payload = buildAdvancedMemoryError(error, messageKeyOverride);
    return {
        ...base,
        ...payload,
        uiState: 'failure',
        fallbackUsed: true
    } as T;
};

const trackAdvancedMemorySuccess = (
    channel: string,
    durationMs: number,
    uiState: AdvancedMemoryUiState = 'ready'
): void => {
    const channelMetric = getChannelMetric(channel);
    const budgetMs = getBudgetForChannel(channel);

    advancedMemoryTelemetry.totalCalls += 1;
    channelMetric.calls += 1;
    channelMetric.lastDurationMs = durationMs;
    channelMetric.lastUiState = uiState;
    if (durationMs > budgetMs) {
        advancedMemoryTelemetry.budgetExceededCount += 1;
        channelMetric.budgetExceededCount += 1;
    }

    trackAdvancedMemoryEvent(channel, 'success', { durationMs });
};

const trackAdvancedMemoryFailure = (channel: string, durationMs: number, error: Error): void => {
    const errorPayload = buildAdvancedMemoryError(error);
    const channelMetric = getChannelMetric(channel);

    advancedMemoryTelemetry.totalCalls += 1;
    advancedMemoryTelemetry.totalFailures += 1;
    advancedMemoryTelemetry.lastErrorCode = errorPayload.errorCode ?? ADVANCED_MEMORY_ERROR_CODE.OPERATION_FAILED;
    channelMetric.calls += 1;
    channelMetric.failures += 1;
    channelMetric.lastDurationMs = durationMs;
    channelMetric.lastErrorCode = errorPayload.errorCode ?? ADVANCED_MEMORY_ERROR_CODE.OPERATION_FAILED;
    channelMetric.lastUiState = 'failure';

    if (errorPayload.errorCode === ADVANCED_MEMORY_ERROR_CODE.VALIDATION) {
        advancedMemoryTelemetry.validationFailures += 1;
        channelMetric.validationFailures += 1;
    }

    trackAdvancedMemoryEvent(channel, 'failure', {
        durationMs,
        code: errorPayload.errorCode
    });
};

const trackAdvancedMemoryRetry = (channel: string): void => {
    const channelMetric = getChannelMetric(channel);
    advancedMemoryTelemetry.totalRetries += 1;
    channelMetric.retries += 1;
    trackAdvancedMemoryEvent(channel, 'retry', { code: ADVANCED_MEMORY_ERROR_CODE.TRANSIENT });
};

const executeWithAdvancedMemoryRetry = async <T>(
    channel: string,
    operation: () => Promise<T>,
    maxAttempts: number = 1,
    retryDelayMs: number = 35
): Promise<T> => {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            return await operation();
        } catch (caughtError) {
            const error = caughtError instanceof Error ? caughtError : new Error(String(caughtError));
            lastError = error;
            if (!isRetryableError(error) || attempt >= maxAttempts) {
                break;
            }
            trackAdvancedMemoryRetry(channel);
            await waitFor(retryDelayMs);
        }
    }

    throw (lastError ?? new Error('Unknown advanced memory IPC failure'));
};

const createAdvancedMemoryHealthPayload = () => {
    const errorRate = advancedMemoryTelemetry.totalCalls === 0
        ? 0
        : advancedMemoryTelemetry.totalFailures / advancedMemoryTelemetry.totalCalls;
    const status = errorRate > 0.05 || advancedMemoryTelemetry.budgetExceededCount > 0
        ? 'degraded'
        : 'healthy';

    return {
        status,
        uiState: status === 'healthy' ? 'ready' : 'failure',
        budgets: {
            fastMs: ADVANCED_MEMORY_PERFORMANCE_BUDGET_MS.FAST,
            standardMs: ADVANCED_MEMORY_PERFORMANCE_BUDGET_MS.STANDARD,
            heavyMs: ADVANCED_MEMORY_PERFORMANCE_BUDGET_MS.HEAVY
        },
        metrics: {
            ...advancedMemoryTelemetry,
            errorRate
        }
    };
};

const inferUiStateFromResult = (result: Record<string, unknown>): AdvancedMemoryUiState => {
    const explicitUiState = result.uiState;
    if (explicitUiState === 'ready' || explicitUiState === 'empty' || explicitUiState === 'failure') {
        return explicitUiState;
    }

    if (result.success === false) {
        return 'failure';
    }

    if (Array.isArray(result.data)) {
        return result.data.length === 0 ? 'empty' : 'ready';
    }

    const dataValue = result.data;
    if (typeof dataValue === 'object' && dataValue !== null && 'memories' in dataValue) {
        const memoriesValue = (dataValue as { memories?: unknown[] }).memories;
        if (Array.isArray(memoriesValue)) {
            return memoriesValue.length === 0 ? 'empty' : 'ready';
        }
    }

    return 'ready';
};

const createTelemetryAwareHandler = <T extends AdvancedMemoryResponseEnvelope = AdvancedMemoryResponseEnvelope>(
    channel: string,
    handler: TelemetryAwareHandler<T>,
    options: {
        retries?: number;
        retryDelayMs?: number;
        onError?: (error: Error) => AdvancedMemoryResponseEnvelope;
        messageKey?: string;
    } = {}
) => {
    return createIpcHandler(channel, async (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => {
        const startedAt = Date.now();
        try {
            const result = await executeWithAdvancedMemoryRetry(
                channel,
                () => handler(event, ...args),
                options.retries ?? 1,
                options.retryDelayMs ?? 35
            );
            const resultRecord = result as unknown as Record<string, unknown>;
            const uiState = inferUiStateFromResult(resultRecord);
            const durationMs = Date.now() - startedAt;
            if (uiState === 'failure') {
                const errorMessage = typeof resultRecord.error === 'string'
                    ? resultRecord.error
                    : 'Advanced memory IPC operation failed';
                trackAdvancedMemoryFailure(channel, durationMs, new Error(errorMessage));
            } else {
                trackAdvancedMemorySuccess(channel, durationMs, uiState);
            }
            if (!result || typeof result !== 'object') {
                return { success: false, uiState } as T;
            }
            return {
                ...(result as Record<string, unknown>),
                uiState
            } as T;
        } catch (caughtError) {
            const error = caughtError instanceof Error ? caughtError : new Error(String(caughtError));
            trackAdvancedMemoryFailure(channel, Date.now() - startedAt, error);
            throw error;
        }
    }, {
        onError: (error: Error) => {
            if (options.onError) {
                return withAdvancedMemoryErrorMetadata(options.onError(error), error, options.messageKey);
            }
            return withAdvancedMemoryErrorMetadata({
                success: false
            }, error, options.messageKey);
        }
    });
};

const normalizeSearchLimit = (limit?: number): number => {
    if (typeof limit !== 'number' || !Number.isFinite(limit)) {
        return 10;
    }
    return Math.max(1, Math.min(200, Math.floor(limit)));
};

const normalizeOptionalQuery = (query?: string): string | undefined => {
    if (typeof query !== 'string') {
        return undefined;
    }
    const trimmed = query.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};

export function registerAdvancedMemoryIpc(advancedMemoryService: AdvancedMemoryService): void {
    registerPendingHandlers(advancedMemoryService);
    registerExplicitHandlers(advancedMemoryService);
    registerRecallHandlers(advancedMemoryService);
    registerMaintenanceHandlers(advancedMemoryService);
    registerExtractionHandlers(advancedMemoryService);
    registerManagementHandlers(advancedMemoryService);
    registerVisualizationHandlers(advancedMemoryService);
    registerHealthHandlers();

    appLogger.info(LOG_TAG, 'Advanced memory IPC handlers registered');
}

function registerPendingHandlers(advancedMemoryService: AdvancedMemoryService): void {
    const handleListError = () => ({ success: true, data: [], uiState: 'empty' });
    const handleBasicError = () => ({ success: false, uiState: 'failure' });
    const handleBulkError = () => ({ success: false, confirmed: 0, uiState: 'failure' });
    const handleBulkRejectError = () => ({ success: false, rejected: 0, uiState: 'failure' });

    ipcMain.handle('advancedMemory:getPending', createTelemetryAwareHandler('advancedMemory:getPending', async () => {
        const pending = advancedMemoryService.getPendingMemories();
        return {
            success: true,
            data: pending,
            uiState: pending.length === 0 ? 'empty' : 'ready'
        };
    }, {
        onError: handleListError,
        retries: 2
    }));

    ipcMain.handle('advancedMemory:confirm', createTelemetryAwareHandler('advancedMemory:confirm', async (
        _event,
        id: string,
        adjustments?: {
            content?: string;
            category?: MemoryCategory;
            tags?: string[];
            importance?: number;
        }
    ) => {
        const memory = await advancedMemoryService.confirmPendingMemory(id, 'user', adjustments);
        return { success: true, data: memory };
    }, {
        onError: handleBasicError,
        retries: 2
    }));

    ipcMain.handle('advancedMemory:reject', createTelemetryAwareHandler('advancedMemory:reject', async (_event, id: string, reason?: string) => {
        await advancedMemoryService.rejectPendingMemory(id, reason);
        return { success: true };
    }, {
        onError: handleBasicError,
        retries: 2
    }));

    ipcMain.handle('advancedMemory:confirmAll', createTelemetryAwareHandler('advancedMemory:confirmAll', async () => {
        const pending = advancedMemoryService.getPendingMemories();
        let confirmed = 0;

        for (const p of pending) {
            if (!p.requiresUserValidation) {
                await advancedMemoryService.confirmPendingMemory(p.id, 'user');
                confirmed++;
            }
        }

        return {
            success: true,
            confirmed,
            uiState: confirmed === 0 ? 'empty' : 'ready'
        };
    }, {
        onError: handleBulkError,
        retries: 2
    }));

    ipcMain.handle('advancedMemory:rejectAll', createTelemetryAwareHandler('advancedMemory:rejectAll', async () => {
        const pending = advancedMemoryService.getPendingMemories();

        for (const p of pending) {
            await advancedMemoryService.rejectPendingMemory(p.id, 'Bulk rejection');
        }

        return {
            success: true,
            rejected: pending.length,
            uiState: pending.length === 0 ? 'empty' : 'ready'
        };
    }, {
        onError: handleBulkRejectError,
        retries: 2
    }));
}


function registerExplicitHandlers(advancedMemoryService: AdvancedMemoryService): void {
    ipcMain.handle('advancedMemory:remember', createTelemetryAwareHandler('advancedMemory:remember', async (
        _event,
        content: string,
        options?: {
            category?: MemoryCategory;
            tags?: string[];
            projectId?: string;
        }
    ) => {
        const memory = await advancedMemoryService.rememberExplicit(
            content,
            'user-explicit',
            options?.category ?? 'fact',
            options?.tags ?? [],
            options?.projectId
        );
        return { success: true, data: memory };
    }, {
        onError: () => ({ success: false, uiState: 'failure' }),
        retries: 2
    }));
}

function registerRecallHandlers(advancedMemoryService: AdvancedMemoryService): void {
    ipcMain.handle('advancedMemory:recall', createTelemetryAwareHandler('advancedMemory:recall', async (_event, context: RecallContext) => {
        const result = await advancedMemoryService.recall(context);
        return {
            success: true,
            data: {
                memories: result.memories,
                totalMatches: result.totalMatches
            },
            uiState: result.memories.length === 0 ? 'empty' : 'ready'
        };
    }, {
        onError: () => ({ success: true, data: { memories: [], totalMatches: 0 }, uiState: 'empty' }),
        retries: 2
    }));

    ipcMain.handle('advancedMemory:search', createTelemetryAwareHandler('advancedMemory:search', async (_event, query: string, limit?: number) => {
        const normalizedQuery = normalizeOptionalQuery(query);
        if (!normalizedQuery) {
            return { success: true, data: [], uiState: 'empty' };
        }
        const memories = await advancedMemoryService.searchMemoriesHybrid(normalizedQuery, normalizeSearchLimit(limit));
        return { success: true, data: memories, uiState: memories.length === 0 ? 'empty' : 'ready' };
    }, {
        onError: () => ({ success: true, data: [], uiState: 'empty' }),
        retries: 2
    }));

    ipcMain.handle('advancedMemory:getSearchAnalytics', createTelemetryAwareHandler('advancedMemory:getSearchAnalytics', async () => {
        return { success: true, data: advancedMemoryService.getSearchAnalytics() };
    }, {
        onError: () => ({
            success: true,
            data: {
                totalQueries: 0,
                semanticQueries: 0,
                textQueries: 0,
                hybridQueries: 0,
                averageResults: 0,
                topQueries: []
            },
            uiState: 'empty'
        }),
        retries: 2
    }));

    ipcMain.handle('advancedMemory:getSearchHistory', createTelemetryAwareHandler('advancedMemory:getSearchHistory', async (_event, limit?: number) => {
        const history = advancedMemoryService.getSearchHistory(limit ?? 25);
        return {
            success: true,
            data: history,
            uiState: history.length === 0 ? 'empty' : 'ready'
        };
    }, {
        onError: () => ({ success: true, data: [], uiState: 'empty' }),
        retries: 2
    }));

    ipcMain.handle('advancedMemory:getSearchSuggestions', createTelemetryAwareHandler('advancedMemory:getSearchSuggestions', async (
        _event,
        prefix?: string,
        limit?: number
    ) => {
        const suggestions = advancedMemoryService.getSearchSuggestions(prefix, limit ?? 8);
        return {
            success: true,
            data: suggestions,
            uiState: suggestions.length === 0 ? 'empty' : 'ready'
        };
    }, {
        onError: () => ({ success: true, data: [], uiState: 'empty' }),
        retries: 2
    }));

    ipcMain.handle('advancedMemory:export', createTelemetryAwareHandler('advancedMemory:export', async (
        _event,
        query?: string,
        limit?: number
    ) => {
        const exported = await advancedMemoryService.exportMemories(normalizeOptionalQuery(query), normalizeSearchLimit(limit));
        return { success: true, data: exported };
    }, {
        onError: () => ({ success: false, uiState: 'failure' }),
        retries: 2,
        messageKey: ADVANCED_MEMORY_MESSAGE_KEY.EXPORT_FAILED
    }));

    ipcMain.handle('advancedMemory:import', createTelemetryAwareHandler('advancedMemory:import', async (
        _event,
        payload: {
            memories?: Array<Partial<import('@shared/types/advanced-memory').AdvancedSemanticFragment>>;
            pendingMemories?: Array<Partial<import('@shared/types/advanced-memory').PendingMemory>>;
            replaceExisting?: boolean;
        }
    ) => {
        const result = await advancedMemoryService.importMemories(payload ?? {});
        return { success: true, data: result };
    }, {
        onError: () => ({ success: false, uiState: 'failure' }),
        retries: 2,
        messageKey: ADVANCED_MEMORY_MESSAGE_KEY.IMPORT_FAILED
    }));
}

function registerMaintenanceHandlers(advancedMemoryService: AdvancedMemoryService): void {
    const handleBasicError = () => ({ success: false, uiState: 'failure' });

    ipcMain.handle('advancedMemory:getStats', createTelemetryAwareHandler('advancedMemory:getStats', async () => {
        const stats = await advancedMemoryService.getStatistics();
        return { success: true, data: stats };
    }, {
        onError: handleBasicError,
        retries: 2
    }));

    ipcMain.handle('advancedMemory:runDecay', createTelemetryAwareHandler('advancedMemory:runDecay', async () => {
        await advancedMemoryService.runDecayMaintenance();
        return { success: true };
    }, {
        onError: handleBasicError,
        retries: 2
    }));

    ipcMain.handle('advancedMemory:recategorize', createTelemetryAwareHandler('advancedMemory:recategorize', async (_event, ids?: string[]) => {
        await advancedMemoryService.recategorizeMemories(ids);
        return { success: true };
    }, {
        onError: handleBasicError,
        retries: 2
    }));
}

function registerExtractionHandlers(advancedMemoryService: AdvancedMemoryService): void {
    ipcMain.handle('advancedMemory:extractFromMessage', createTelemetryAwareHandler('advancedMemory:extractFromMessage', async (
        _event,
        content: string,
        sourceId: string,
        projectId?: string
    ) => {
        const pending = await advancedMemoryService.extractAndStageFromMessage(
            content,
            sourceId,
            projectId
        );
        return {
            success: true,
            data: pending,
            uiState: pending.length === 0 ? 'empty' : 'ready'
        };
    }, {
        onError: () => ({ success: true, data: [], uiState: 'empty' }),
        retries: 2
    }));
}


function registerManagementHandlers(advancedMemoryService: AdvancedMemoryService): void {
    const handleBasicError = () => ({ success: false, uiState: 'failure' });

    ipcMain.handle('advancedMemory:delete', createTelemetryAwareHandler<{ success: boolean }>('advancedMemory:delete', async (_event, id: string) => {
        const success = await advancedMemoryService.deleteMemory(id);
        return { success };
    }, {
        onError: handleBasicError,
        retries: 2
    }));

    ipcMain.handle('advancedMemory:deleteMany', createTelemetryAwareHandler('advancedMemory:deleteMany', async (_, ids: string[]) => {
        try {
            const result = await advancedMemoryService.deleteMemories(ids);
            return { success: true, ...result };
        } catch (error) {
            const handledError = error instanceof Error ? error : new Error(String(error));
            appLogger.error(LOG_TAG, `Error deleting memories: ${getErrorMessage(handledError)}`, handledError);
            return {
                success: false,
                error: getErrorMessage(handledError),
                errorCode: ADVANCED_MEMORY_ERROR_CODE.OPERATION_FAILED,
                messageKey: ADVANCED_MEMORY_MESSAGE_KEY.OPERATION_FAILED,
                retryable: false,
                uiState: 'failure',
                deleted: 0,
                failed: ids
            };
        }
    }, {
        onError: () => ({ success: false, deleted: 0, failed: [], uiState: 'failure' }),
        retries: 2
    }));

    ipcMain.handle('advancedMemory:edit', createTelemetryAwareHandler('advancedMemory:edit', async (
        _event,
        id: string,
        updates: {
            content?: string;
            category?: MemoryCategory;
            tags?: string[];
            importance?: number;
            projectId?: string | null;
        }
    ) => {
        const memory = await advancedMemoryService.editMemory(id, updates);
        return { success: !!memory, data: memory };
    }, {
        onError: handleBasicError,
        retries: 2
    }));

    ipcMain.handle('advancedMemory:archive', createTelemetryAwareHandler<{ success: boolean }>('advancedMemory:archive', async (_event, id: string) => {
        const success = await advancedMemoryService.archiveMemory(id);
        return { success };
    }, {
        onError: handleBasicError,
        retries: 2
    }));

    ipcMain.handle('advancedMemory:archiveMany', createTelemetryAwareHandler('advancedMemory:archiveMany', async (_, ids: string[]) => {
        try {
            const result = await advancedMemoryService.archiveMemories(ids);
            return { success: true, ...result };
        } catch (error) {
            const handledError = error instanceof Error ? error : new Error(String(error));
            appLogger.error(LOG_TAG, `Error archiving memories: ${getErrorMessage(handledError)}`, handledError);
            return {
                success: false,
                error: getErrorMessage(handledError),
                errorCode: ADVANCED_MEMORY_ERROR_CODE.OPERATION_FAILED,
                messageKey: ADVANCED_MEMORY_MESSAGE_KEY.OPERATION_FAILED,
                retryable: false,
                uiState: 'failure',
                archived: 0,
                failed: ids
            };
        }
    }, {
        onError: () => ({ success: false, archived: 0, failed: [], uiState: 'failure' }),
        retries: 2
    }));

    ipcMain.handle('advancedMemory:restore', createTelemetryAwareHandler<{ success: boolean }>('advancedMemory:restore', async (_event, id: string) => {
        const success = await advancedMemoryService.restoreMemory(id);
        return { success };
    }, {
        onError: handleBasicError,
        retries: 2
    }));


    ipcMain.handle('advancedMemory:get', createTelemetryAwareHandler('advancedMemory:get', async (_event, id: string) => {
        const memory = await advancedMemoryService.getMemory(id);
        return { success: !!memory, data: memory };
    }, {
        onError: handleBasicError,
        retries: 2
    }));

    ipcMain.handle('advancedMemory:shareWithProject', createTelemetryAwareHandler('advancedMemory:shareWithProject', async (_event, memoryId: string, targetProjectId: string) => {
        const shared = await advancedMemoryService.shareMemoryWithProject(memoryId, targetProjectId);
        return { success: !!shared, data: shared };
    }, {
        onError: handleBasicError,
        retries: 2
    }));

    ipcMain.handle('advancedMemory:createSharedNamespace', createTelemetryAwareHandler('advancedMemory:createSharedNamespace', async (
        _event,
        payload: { id: string; name: string; projectIds: string[]; accessControl?: Record<string, string[]> }
    ) => {
        const namespace = advancedMemoryService.createSharedNamespace(payload);
        return { success: true, data: namespace };
    }, {
        onError: handleBasicError,
        retries: 2
    }));

    ipcMain.handle('advancedMemory:syncSharedNamespace', createTelemetryAwareHandler('advancedMemory:syncSharedNamespace', async (
        _event,
        request: SharedMemorySyncRequest
    ) => {
        const result = await advancedMemoryService.syncSharedNamespace(request);
        return { success: true, data: result };
    }, {
        onError: handleBasicError,
        retries: 2
    }));

    ipcMain.handle('advancedMemory:getSharedNamespaceAnalytics', createTelemetryAwareHandler('advancedMemory:getSharedNamespaceAnalytics', async (
        _event,
        namespaceId: string
    ) => {
        const analytics = await advancedMemoryService.getSharedNamespaceAnalytics(namespaceId);
        return { success: true, data: analytics };
    }, {
        onError: handleBasicError,
        retries: 2
    }));

    ipcMain.handle('advancedMemory:searchAcrossProjects', createTelemetryAwareHandler('advancedMemory:searchAcrossProjects', async (
        _event,
        payload: { namespaceId: string; query: string; projectId: string; limit?: number }
    ) => {
        const result = await advancedMemoryService.searchAcrossProjects(payload);
        return {
            success: true,
            data: result,
            uiState: result.length === 0 ? 'empty' : 'ready'
        };
    }, {
        onError: () => ({ success: true, data: [], uiState: 'empty' }),
        retries: 2
    }));

    ipcMain.handle('advancedMemory:getHistory', createTelemetryAwareHandler('advancedMemory:getHistory', async (_event, id: string) => {
        const history = await advancedMemoryService.getMemoryHistory(id);
        return {
            success: true,
            data: history,
            uiState: history.length === 0 ? 'empty' : 'ready'
        };
    }, {
        onError: () => ({ success: true, data: [], uiState: 'empty' }),
        retries: 2
    }));

    ipcMain.handle('advancedMemory:rollback', createTelemetryAwareHandler('advancedMemory:rollback', async (_event, id: string, versionIndex: number) => {
        const memory = await advancedMemoryService.rollbackMemory(id, versionIndex);
        return { success: !!memory, data: memory };
    }, {
        onError: handleBasicError,
        retries: 2
    }));
}

function registerVisualizationHandlers(advancedMemoryService: AdvancedMemoryService): void {
    const handleListError = () => ({ success: true, data: [], uiState: 'empty' });

    ipcMain.handle('advancedMemory:getAllEntityKnowledge', createTelemetryAwareHandler('advancedMemory:getAllEntityKnowledge', async () => {
        const data = await advancedMemoryService.getAllEntityFacts();
        return { success: true, data, uiState: data.length === 0 ? 'empty' : 'ready' };
    }, {
        onError: handleListError,
        retries: 2
    }));

    ipcMain.handle('advancedMemory:getAllEpisodes', createTelemetryAwareHandler('advancedMemory:getAllEpisodes', async () => {
        const data = await advancedMemoryService.getAllEpisodes();
        return { success: true, data, uiState: data.length === 0 ? 'empty' : 'ready' };
    }, {
        onError: handleListError,
        retries: 2
    }));

    ipcMain.handle('advancedMemory:getAllAdvancedMemories', createTelemetryAwareHandler('advancedMemory:getAllAdvancedMemories', async () => {
        const data = await advancedMemoryService.getAllAdvancedMemories();
        return { success: true, data, uiState: data.length === 0 ? 'empty' : 'ready' };
    }, {
        onError: handleListError,
        retries: 2
    }));
}

function registerHealthHandlers(): void {
    ipcMain.handle('advancedMemory:health', createTelemetryAwareHandler('advancedMemory:health', async () => {
        return {
            success: true,
            data: createAdvancedMemoryHealthPayload(),
            uiState: 'ready'
        };
    }, {
        onError: () => ({
            success: false,
            data: {
                status: 'degraded',
                uiState: 'failure',
                budgets: {
                    fastMs: ADVANCED_MEMORY_PERFORMANCE_BUDGET_MS.FAST,
                    standardMs: ADVANCED_MEMORY_PERFORMANCE_BUDGET_MS.STANDARD,
                    heavyMs: ADVANCED_MEMORY_PERFORMANCE_BUDGET_MS.HEAVY
                },
                metrics: {
                    ...advancedMemoryTelemetry,
                    errorRate: 1
                }
            },
            uiState: 'failure'
        })
    }));
}
