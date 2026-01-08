import { ValidationError } from '../utils/error.util';


/**
 * Service lifecycle scope.
 */
export enum Scope {
    /** Single shared instance per application */
    SINGLETON = 'SINGLETON',
    /** New instance per resolution */
    TRANSIENT = 'TRANSIENT'
}

interface ServiceDefinition<T> {
    name: string;
    factory: (...args: any[]) => T;
    dependencies: string[];
    scope: Scope;
    instance?: T;
}

/**
 * Lightweight Dependency Injection Container.
 * Manages service registration, resolution, and lifecycle.
 */
export class Container {
    private services: Map<string, ServiceDefinition<any>> = new Map();

    /**
     * Register a service factory.
     */
    register<T>(
        name: string,
        factory: (...args: any[]) => T,
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
    registerInstance<T>(name: string, instance: T): void {
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
    resolve<T>(name: string): T {
        const definition = this.services.get(name);
        if (!definition) {
            throw new ValidationError(`Service not found: ${name}`);
        }

        switch (definition.scope) {
            case Scope.SINGLETON:
                if (!definition.instance) {
                    definition.instance = this.instantiate(definition);
                }
                return definition.instance;

            case Scope.TRANSIENT:
                return this.instantiate(definition);

            default:
                throw new ValidationError(`Unknown scope: ${definition.scope}`);
        }
    }

    private instantiate<T>(definition: ServiceDefinition<T>): T {
        try {
            const deps = definition.dependencies.map(depName => this.resolve(depName));
            return definition.factory(...deps);
        } catch (error: any) {
            throw new ValidationError(
                `Failed to resolve service ${definition.name}: ${error.message}`,
                { originalError: error }
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
    }
}
