import { appLogger } from '@main/logging/logger';

/**
 * Lazy service registry for services that should only be loaded when first accessed
 */
type LazyServiceFactory<T> = () => Promise<T>

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
        appLogger.info('LazyServices', `Loading service '${name}'...`);

        try {
            const service = await factory();
            const loadTime = Date.now() - startTime;
            appLogger.info('LazyServices', `Service '${name}' loaded in ${loadTime}ms`);
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
}

export const lazyServiceRegistry = new LazyServiceRegistry();

/**
 * Lazy service proxy that loads the service on first access
 */
export function createLazyServiceProxy<T extends object>(serviceName: string): T {
    return new Proxy({} as T, {
        get(_target, prop, _receiver) {
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
