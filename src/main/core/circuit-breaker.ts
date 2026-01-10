import { appLogger } from '../logging/logger';

export enum CircuitState {
    CLOSED = 'CLOSED',
    OPEN = 'OPEN',
    HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerOptions {
    failureThreshold: number;
    resetTimeoutMs: number;
    serviceName?: string;
}

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

    private onSuccess() {
        if (this.state === CircuitState.HALF_OPEN) {
            this.transitionTo(CircuitState.CLOSED);
        }
        this.failureCount = 0;
    }

    private onFailure(_error: unknown) {
        if (this.state === CircuitState.CLOSED) {
            this.failureCount++;
            if (this.failureCount >= this.options.failureThreshold) {
                this.transitionTo(CircuitState.OPEN);
            }
        } else if (this.state === CircuitState.HALF_OPEN) {
            this.transitionTo(CircuitState.OPEN);
        }
    }

    private transitionTo(newState: CircuitState) {
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

    getState(): CircuitState {
        return this.state;
    }
}
