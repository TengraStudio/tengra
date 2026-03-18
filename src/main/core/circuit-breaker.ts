import { appLogger } from '@main/logging/logger';

export enum CircuitState {
    CLOSED = 'CLOSED',
    OPEN = 'OPEN',
    HALF_OPEN = 'HALF_OPEN'
}

/**
 * Configuration options for the CircuitBreaker.
 * @property failureThreshold - Number of consecutive failures before the circuit opens
 * @property resetTimeoutMs - Time in milliseconds before attempting to close the circuit again
 * @property serviceName - Identifier used in log messages (defaults to 'UnknownService')
 */
export interface CircuitBreakerOptions {
    failureThreshold: number;
    resetTimeoutMs: number;
    serviceName?: string;
}

/**
 * Implements the Circuit Breaker resilience pattern.
 *
 * Tracks failures and opens the circuit when the threshold is reached,
 * blocking further requests until a reset timeout elapses. After timeout,
 * transitions to HALF_OPEN, allowing one test request to determine recovery.
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 5000 });
 * const result = await breaker.execute(() => fetch('/api/data'));
 * ```
 */
export class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failureCount = 0;
    private nextAttemptTimestamp = 0;
    private readonly options: Required<CircuitBreakerOptions>;

    constructor(options: CircuitBreakerOptions) {
        this.options = {
            serviceName: 'UnknownService',
            ...options
        };
    }

    /**
     * Execute an action through the circuit breaker.
     * @param action - Async function to execute if the circuit allows it
     * @returns The result of the action
     * @throws Error if the circuit is OPEN and the reset timeout has not elapsed
     * @throws Re-throws any error from the action itself
     */
    async execute<T>(action: () => Promise<T>): Promise<T> {
        if (this.state === CircuitState.OPEN) {
            if (Date.now() >= this.nextAttemptTimestamp) {
                this.transitionTo(CircuitState.HALF_OPEN);
            } else {
                throw new Error(`Circuit Breaker for ${this.options.serviceName} is OPEN. Request blocked.`);
            }
        }

        try {
            const result = await action();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure(error);
            throw error;
        }
    }

    /** Reset failure count and transition to CLOSED if currently HALF_OPEN. */
    private onSuccess(): void {
        if (this.state === CircuitState.HALF_OPEN) {
            this.transitionTo(CircuitState.CLOSED);
        }
        this.failureCount = 0;
    }

    /** Increment failure count or re-open circuit based on current state. */
    private onFailure<T>(_error: T): void {
        if (this.state === CircuitState.CLOSED) {
            this.failureCount++;
            if (this.failureCount >= this.options.failureThreshold) {
                this.transitionTo(CircuitState.OPEN);
            }
        } else if (this.state === CircuitState.HALF_OPEN) {
            this.transitionTo(CircuitState.OPEN);
        }
    }

    /** Transition to a new circuit state and log the change. */
    private transitionTo(newState: CircuitState): void {
        this.state = newState;

        switch (newState) {
            case CircuitState.OPEN:
                this.nextAttemptTimestamp = Date.now() + this.options.resetTimeoutMs;
                appLogger.warn('CircuitBreaker', `Circuit for ${this.options.serviceName} is now OPEN. Resetting in ${this.options.resetTimeoutMs}ms.`);
                break;
            case CircuitState.HALF_OPEN:
                appLogger.info('CircuitBreaker', `Circuit for ${this.options.serviceName} is now HALF_OPEN. Testing next request.`);
                break;
            case CircuitState.CLOSED:
                this.failureCount = 0;
                appLogger.info('CircuitBreaker', `Circuit for ${this.options.serviceName} is now CLOSED. Service recovered.`);
                break;
        }
    }

    /** @returns The current state of the circuit breaker. */
    getState(): CircuitState {
        return this.state;
    }
}
