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
 * Correlation ID utility for request tracing (IDEA-062)
 * Provides AsyncLocalStorage-based context propagation for correlation IDs.
 */

import { randomUUID } from 'crypto';

import { AsyncLocalStorage } from 'async_hooks';

/** Correlation context stored per async execution chain */
interface CorrelationContext {
    correlationId: string;
    startedAt: number;
}

const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

/**
 * Creates a new correlation ID (UUID v4).
 * @returns A new unique correlation ID string.
 */
export function createCorrelationId(): string {
    return randomUUID();
}

/**
 * Gets the current correlation ID from the async context.
 * Returns undefined if no correlation context is active.
 * @returns The current correlation ID or undefined.
 */
export function getCorrelationId(): string | undefined {
    return correlationStorage.getStore()?.correlationId;
}

/**
 * Gets the current correlation context start time.
 * @returns The start timestamp or undefined if no context is active.
 */
export function getCorrelationStartedAt(): number | undefined {
    return correlationStorage.getStore()?.startedAt;
}

/**
 * Runs a function within a correlation ID context.
 * All async operations within the callback will have access to the correlation ID.
 * @param fn - The function to execute within the correlation context.
 * @param correlationId - Optional specific correlation ID; generates one if omitted.
 * @returns The return value of the wrapped function.
 */
export function withCorrelationId<T>(fn: () => T, correlationId?: string): T {
    const ctx: CorrelationContext = {
        correlationId: correlationId ?? createCorrelationId(),
        startedAt: Date.now(),
    };
    return correlationStorage.run(ctx, fn);
}
