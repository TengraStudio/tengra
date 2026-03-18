import { LifecycleAware } from '@main/core/container';
import { appLogger } from '@main/logging/logger';

/**
 * Abstract base class for all application services.
 * Enforces the LifecycleAware interface for consistent initialization and cleanup.
 */
export abstract class BaseService implements LifecycleAware {
    /** @param name - The display name of the service, used in log messages. */
    constructor(protected readonly name: string) { }

    /**
     * Initialize the service.
     * Override this method to perform async setup (DB connection, file loading, etc).
     */
    async initialize(): Promise<void> {
        // Optional override
    }

    /**
     * Cleanup the service.
     * Override this method to perform resource release (closing sockets, saving state, etc).
     */
    async cleanup(): Promise<void> {
        // Optional override
    }

    /**
     * Log an informational message.
     * @param message - The log message.
     * @param args - Additional context values or errors.
     */
    protected logInfo<T>(message: string, ...args: readonly T[]): void {
        const payload = args.length <= 1 ? args[0] : args;
        appLogger.info(this.name, message, payload);
    }

    /**
     * Log an error message.
     * @param message - The log message.
     * @param error - Optional error object for stack trace context.
     */
    protected logError<T>(message: string, error?: T): void {
        appLogger.error(this.name, message, error);
    }

    /**
     * Log a warning message.
     * @param message - The log message.
     * @param args - Additional context values or errors.
     */
    protected logWarn<T>(message: string, ...args: readonly T[]): void {
        const payload = args.length <= 1 ? args[0] : args;
        appLogger.warn(this.name, message, payload);
    }

    /**
     * Log a debug message.
     * @param message - The log message.
     * @param args - Additional context values or errors.
     */
    protected logDebug<T>(message: string, ...args: readonly T[]): void {
        const payload = args.length <= 1 ? args[0] : args;
        appLogger.debug(this.name, message, payload);
    }
}
