import { appLogger } from '@main/logging/logger';
import { OPERATION_TIMEOUTS } from '@shared/constants/timeouts';
import { getErrorMessage, ValidationError } from '@shared/utils/error.util';



/**
 * Interface for services that require initialization and cleanup.
 */
export interface LifecycleAware {
    initialize?(): Promise<void> | void;
    cleanup?(): Promise<void> | void;
}

/**
 * Service lifecycle scope.
 */
export enum Scope {
    /** Single shared instance per application */
    SINGLETON = 'SINGLETON',
    /** New instance per resolution */
    TRANSIENT = 'TRANSIENT'
}

type ServiceValue = object | string | number | boolean | symbol | bigint | null | undefined;
type ServiceFactory<T extends ServiceValue> = (...args: ServiceValue[]) => T;

interface ServiceDefinition<T extends ServiceValue> {
    name: string;
    factory: ServiceFactory<T>;
    dependencies: string[];
    scope: Scope;
    instance?: T;
}

/**
 * Lightweight Dependency Injection Container.
 * Manages service registration, resolution, and lifecycle.
 */
export class Container {
    private services: Map<string, ServiceDefinition<ServiceValue>> = new Map();
    private initialized = false;
    private deferredServices: Set<string> = new Set();
    private deferredInitialized = false;

    /**
     * Register a service factory.
     * @param name - Unique service identifier
     * @param factory - Factory function that creates the service instance
     * @param dependencies - Names of services to inject as factory arguments
     * @param scope - Lifecycle scope (SINGLETON or TRANSIENT)
     */
    register<T extends ServiceValue>(
        name: string,
        factory: ServiceFactory<T>,
        dependencies: string[] = [],
        scope: Scope = Scope.SINGLETON
    ): void {
        this.services.set(name, {
            name,
            factory,
            dependencies,
            scope
        });
    }

    /**
     * Register a pre-existing instance as a singleton.
     * @param name - Unique service identifier
     * @param instance - The pre-created service instance to register
     */
    registerInstance<T extends ServiceValue>(name: string, instance: T): void {
        this.services.set(name, {
            name,
            factory: () => instance,
            dependencies: [],
            scope: Scope.SINGLETON,
            instance
        });
    }

    /**
     * Resolve a service by name. Singletons are cached after first resolution.
     * @param name - The registered service name
     * @returns The resolved service instance
     * @throws ValidationError if the service is not registered or scope is unknown
     */
    resolve<T extends ServiceValue>(name: string): T {
        const definition = this.services.get(name) as ServiceDefinition<T> | undefined;
        if (!definition) {
            throw new ValidationError(`Service not found: ${name}`);
        }

        switch (definition.scope) {
            case Scope.SINGLETON:
                definition.instance ??= this.instantiate(definition);
                return definition.instance;

            case Scope.TRANSIENT:
                return this.instantiate(definition);

            default:
                throw new ValidationError(`Unknown scope: ${definition.scope}`);
        }
    }

    /**
     * Initialize all singleton services that implement LifecycleAware.
     * Instantiates all singletons first, then calls `initialize()` on each.
     * Continues past initialization errors to allow the app to launch.
     */
    async init(): Promise<void> {
        if (this.initialized) { return; }

        const singletons = Array.from(this.services.values())
            .filter(def => def.scope === Scope.SINGLETON);

        // Instantiate all singletons first
        for (const def of singletons) {
            try {
                this.resolve(def.name);
            } catch (error) {
                appLogger.error('Container', `Failed to instantiate ${def.name}`, error as Error);
                throw error;
            }
        }

        // Run initialize() on them (skip deferred services)
        for (const def of singletons) {
            if (this.deferredServices.has(def.name)) {
                appLogger.info('Container', `Deferring initialization of ${def.name}`);
                continue;
            }
            // Cast to LifecycleAware to check for optional initialize() method
            const instance = def.instance as LifecycleAware;
            if (typeof instance.initialize === 'function') {
                try {
                    await instance.initialize();
                } catch (error) {
                    appLogger.error('Container', `Failed to initialize ${def.name}`, error as Error);
                    // Continue despite error to allow app to launch
                    // throw error; 
                }
            }
        }

        this.initialized = true;
    }

    /**
     * Dispose all singleton services that implement LifecycleAware.
     * Disposes in reverse registration order. Each cleanup has a 2s timeout.
     */
    async dispose(): Promise<void> {
        const singletons = Array.from(this.services.values())
            .filter(def => def.scope === Scope.SINGLETON && def.instance)
            .reverse(); // Dispose in reverse order of registration/creation roughly

        for (const def of singletons) {
            // Cast to LifecycleAware to check for optional cleanup() method
            const instance = def.instance as LifecycleAware;
            if (typeof instance.cleanup === 'function') {
                try {
                    appLogger.info('Container', `Cleaning up ${def.name}...`);
                    const start = Date.now();

                    await Promise.race([
                        instance.cleanup(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Cleanup timed out')), OPERATION_TIMEOUTS.SERVICE_CLEANUP))
                    ]);

                    appLogger.info('Container', `Cleaned up ${def.name} in ${Date.now() - start}ms`);
                } catch (error) {
                    appLogger.error('Container', `Failed to cleanup ${def.name}`, error as Error);
                }
            }
        }

        this.services.clear();
        this.initialized = false;
    }

    private instantiate<T extends ServiceValue>(definition: ServiceDefinition<T>): T {
        try {
            const deps = definition.dependencies.map(depName => this.resolve(depName));
            return definition.factory(...deps);
        } catch (error) {
            throw new ValidationError(
                `Failed to resolve service ${definition.name}: ${getErrorMessage(error as Error)}`,
                { originalError: (error instanceof Error ? error.message : String(error)) }
            );
        }
    }

    /**
     * Mark service names as deferred so their initialize() runs in initDeferred() instead of init().
     * @param names - Service names to defer initialization for
     */
    markDeferred(names: string[]): void {
        for (const name of names) {
            this.deferredServices.add(name);
        }
    }

    /**
     * Initialize deferred services that were skipped during init().
     * Should be called after the main window is shown to optimize startup time.
     */
    async initDeferred(): Promise<void> {
        if (this.deferredInitialized) { return; }

        const deferred = Array.from(this.services.values())
            .filter(def => def.scope === Scope.SINGLETON && this.deferredServices.has(def.name));

        for (const def of deferred) {
            const instance = def.instance as LifecycleAware;
            if (typeof instance?.initialize === 'function') {
                try {
                    const start = Date.now();
                    await instance.initialize();
                    appLogger.info('Container', `Deferred init ${def.name} in ${Date.now() - start}ms`);
                } catch (error) {
                    appLogger.error('Container', `Failed deferred init ${def.name}`, error as Error);
                }
            }
        }

        this.deferredInitialized = true;
    }

    /**
     * Check if a service is registered.
     * @param name - The service name to check
     * @returns True if a service with the given name is registered
     */
    has(name: string): boolean {
        return this.services.has(name);
    }

    /**
     * Returns an iterable of service entries with name and dependency info.
     */
    getServiceEntries(): Array<{ name: string; dependencies: string[] }> {
        return Array.from(this.services.values()).map(def => ({
            name: def.name,
            dependencies: def.dependencies
        }));
    }

    /**
     * Clear all registered services and reset initialization state.
     */
    clear(): void {
        this.services.clear();
        this.initialized = false;
    }
}
