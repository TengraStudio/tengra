import { appLogger } from '@main/logging/logger';

/**
 * Factory function for lazily loaded services.
 * @template T The service type to be created
 */
type LazyServiceFactory<T> = () => Promise<T>

/**
 * Registry that manages lazy-loaded services.
 * Services are only instantiated when first accessed, reducing startup time.
 * Handles concurrent load requests by deduplicating via a loading promise cache.
 */
class LazyServiceRegistry {
    private readonly lazyServices = new Map<string, LazyServiceFactory<unknown>>();
    private readonly loadedServices = new Map<string, unknown>();
    private readonly loadingPromises = new Map<string, Promise<unknown>>();

    /**
     * Register a service for lazy loading
     */
    register<T>(name: string, factory: LazyServiceFactory<T>): void {
        this.lazyServices.set(name, factory);
    }

    /**
     * Get a service, loading it if necessary
     */
    async get<T>(name: string): Promise<T> {
        // Return cached service if already loaded
        if (this.loadedServices.has(name)) {
            return this.loadedServices.get(name) as T;
        }

        // Return existing loading promise if currently loading
        if (this.loadingPromises.has(name)) {
            return await this.loadingPromises.get(name) as T;
        }

        // Check if service is registered for lazy loading
        const factory = this.lazyServices.get(name);
        if (!factory) {
            throw new Error(`Lazy service '${name}' not registered`);
        }

        // Start loading the service
        const loadingPromise = this.loadService(name, factory);
        this.loadingPromises.set(name, loadingPromise);

        try {
            const service = await loadingPromise;
            this.loadedServices.set(name, service);
            this.loadingPromises.delete(name);
            return service as T;
        } catch (error) {
            this.loadingPromises.delete(name);
            throw error;
        }
    }

    private async loadService<T>(name: string, factory: LazyServiceFactory<T>): Promise<T> {
        const startTime = Date.now();

        try {
            const service = await factory();
            const loadTime = Date.now() - startTime;
            appLogger.info('LazyServices', `Loaded service '${name}' in ${loadTime}ms`);
            return service;
        } catch (error) {
            appLogger.error('LazyServices', `Failed to load service '${name}': ${error}`);
            throw error;
        }
    }

    /**
     * Check if a service is currently loaded
     */
    isLoaded(name: string): boolean {
        return this.loadedServices.has(name);
    }

    /**
     * Get list of registered lazy services
     */
    getRegisteredServices(): string[] {
        return Array.from(this.lazyServices.keys());
    }

    /**
     * Get list of loaded services
     */
    getLoadedServices(): string[] {
        return Array.from(this.loadedServices.keys());
    }

    /**
     * Get list of services that are currently loading.
     */
    getLoadingServices(): string[] {
        return Array.from(this.loadingPromises.keys());
    }

    /**
     * Get a snapshot summary for diagnostics and UI indicators.
     */
    getStatus(): {
        registered: string[];
        loaded: string[];
        loading: string[];
    } {
        return {
            registered: this.getRegisteredServices(),
            loaded: this.getLoadedServices(),
            loading: this.getLoadingServices(),
        };
    }
}

/** Singleton instance of the lazy service registry. */
export const lazyServiceRegistry = new LazyServiceRegistry();

/**
 * Creates a Proxy that lazily loads a service on first property access.
 * Any method call on the proxy will trigger async service loading and then
 * forward the call to the real service instance.
 *
 * @template T The service interface type
 * @param serviceName - Name of the service registered in the lazy registry
 * @returns A proxy object that behaves like T but loads on demand
 */
export function createLazyServiceProxy<T extends object>(serviceName: string): T {
    return new Proxy({} as T, {
        get(_target: T, prop: string | symbol, _receiver: T): unknown {
            // Handle async service loading
            if (prop === 'then') {
                // If accessed via await/Promise, return the actual service
                return (resolve: (value: T) => void, reject: (reason: unknown) => void) => {
                    lazyServiceRegistry.get<T>(serviceName).then(resolve).catch(reject);
                };
            }

            // For any other property access, load the service and forward the call
            return (...args: unknown[]) => {
                return lazyServiceRegistry.get<T>(serviceName).then(service => {
                    const method = (service as Record<string | symbol, unknown>)[prop];
                    if (typeof method === 'function') {
                        return (method as (...methodArgs: unknown[]) => unknown).apply(service, args);
                    }
                    return method;
                });
            };
        }
    });
}
