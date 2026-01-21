import { appLogger } from '@main/logging/logger';
import { ValidationError } from '@main/utils/error.util';
import { getErrorMessage } from '@shared/utils/error.util';



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

    /**
     * Register a service factory.
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
     * Resolve a service by name.
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
     */
    async init(): Promise<void> {
        if (this.initialized) { return; }

        const singletons = Array.from(this.services.values())
            .filter(def => def.scope === Scope.SINGLETON);

        // Instantiate all singletons first
        for (const def of singletons) {
            try {
                appLogger.info('Container', `Instantiating ${def.name}...`);
                this.resolve(def.name);
                appLogger.info('Container', `Instantiated ${def.name}`);
            } catch (error) {
                appLogger.error('Container', `Failed to instantiate ${def.name}`, error as Error);
                throw error;
            }
        }

        // Run initialize() on them
        for (const def of singletons) {
            const instance = def.instance as LifecycleAware;
            if (typeof instance.initialize === 'function') {
                try {
                    appLogger.info('Container', `Initializing ${def.name}...`);
                    await instance.initialize();
                    appLogger.info('Container', `Initialized ${def.name}`);
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
     */
    async dispose(): Promise<void> {
        const singletons = Array.from(this.services.values())
            .filter(def => def.scope === Scope.SINGLETON && def.instance)
            .reverse(); // Dispose in reverse order of registration/creation roughly

        for (const def of singletons) {
            const instance = def.instance as LifecycleAware;
            if (typeof instance.cleanup === 'function') {
                try {
                    await instance.cleanup();
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
                { originalError: error instanceof Error ? error : String(error) }
            );
        }
    }

    /**
     * Check if a service is registered.
     */
    has(name: string): boolean {
        return this.services.has(name);
    }

    /**
     * Clear all registered services.
     */
    clear(): void {
        this.services.clear();
        this.initialized = false;
    }
}
