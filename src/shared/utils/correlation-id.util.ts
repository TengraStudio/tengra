import { randomUUID } from 'crypto';

import { AsyncLocalStorage } from 'async_hooks';

/**
 * Generates a correlation ID for tracing requests across service calls.
 * Uses crypto.randomUUID() prefixed with "cor-" for easy identification.
 *
 * @returns A correlation ID string (e.g., "cor-550e8400-e29b-41d4-a716-446655440000")
 */
export function generateCorrelationId(): string {
    return `cor-${randomUUID()}`;
}

/** Shape of data stored in correlation context */
interface CorrelationStore {
    correlationId: string;
}

/**
 * Propagates correlation IDs through async service call chains
 * using Node.js AsyncLocalStorage. Wrap an async operation with
 * {@link run} to make the correlation ID available to all nested calls.
 */
export class CorrelationContext {
    private storage = new AsyncLocalStorage<CorrelationStore>();

    /**
     * Runs a callback within a correlation context.
     * A new correlation ID is generated if none is provided.
     *
     * @param fn - The async function to execute within the context
     * @param correlationId - Optional existing correlation ID to reuse
     * @returns The result of the callback
     */
    run<T>(fn: () => T, correlationId?: string): T {
        const id = correlationId ?? generateCorrelationId();
        return this.storage.run({ correlationId: id }, fn);
    }

    /**
     * Retrieves the current correlation ID from the active context.
     *
     * @returns The correlation ID, or undefined if outside a context
     */
    getId(): string | undefined {
        return this.storage.getStore()?.correlationId;
    }
}

/** Shared singleton instance for application-wide correlation tracking */
export const correlationContext = new CorrelationContext();
