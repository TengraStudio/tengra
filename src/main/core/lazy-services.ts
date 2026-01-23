import { Container } from '@main/core/container'
import { appLogger } from '@main/logging/logger'

/**
 * Lazy service registry for services that should only be loaded when first accessed
 */
class LazyServiceRegistry {
    private readonly lazyServices = new Map<string, () => Promise<any>>()
    private readonly loadedServices = new Map<string, any>()
    private readonly loadingPromises = new Map<string, Promise<any>>()

    /**
     * Register a service for lazy loading
     */
    register<T>(name: string, factory: () => Promise<T>): void {
        this.lazyServices.set(name, factory)
    }

    /**
     * Get a service, loading it if necessary
     */
    async get<T>(name: string): Promise<T> {
        // Return cached service if already loaded
        if (this.loadedServices.has(name)) {
            return this.loadedServices.get(name)
        }

        // Return existing loading promise if currently loading
        if (this.loadingPromises.has(name)) {
            return await this.loadingPromises.get(name)
        }

        // Check if service is registered for lazy loading
        const factory = this.lazyServices.get(name)
        if (!factory) {
            throw new Error(`Lazy service '${name}' not registered`)
        }

        // Start loading the service
        const loadingPromise = this.loadService(name, factory)
        this.loadingPromises.set(name, loadingPromise)

        try {
            const service = await loadingPromise
            this.loadedServices.set(name, service)
            this.loadingPromises.delete(name)
            return service
        } catch (error) {
            this.loadingPromises.delete(name)
            throw error
        }
    }

    private async loadService<T>(name: string, factory: () => Promise<T>): Promise<T> {
        const startTime = Date.now()
        appLogger.info('LazyServices', `Loading service '${name}'...`)
        
        try {
            const service = await factory()
            const loadTime = Date.now() - startTime
            appLogger.info('LazyServices', `Service '${name}' loaded in ${loadTime}ms`)
            return service
        } catch (error) {
            appLogger.error('LazyServices', `Failed to load service '${name}': ${error}`)
            throw error
        }
    }

    /**
     * Check if a service is currently loaded
     */
    isLoaded(name: string): boolean {
        return this.loadedServices.has(name)
    }

    /**
     * Get list of registered lazy services
     */
    getRegisteredServices(): string[] {
        return Array.from(this.lazyServices.keys())
    }

    /**
     * Get list of loaded services
     */
    getLoadedServices(): string[] {
        return Array.from(this.loadedServices.keys())
    }
}

export const lazyServiceRegistry = new LazyServiceRegistry()

/**
 * Lazy service proxy that loads the service on first access
 */
export function createLazyServiceProxy<T>(serviceName: string): T {
    return new Proxy({} as T, {
        get(target, prop, receiver) {
            // Handle async service loading
            if (prop === 'then') {
                // If accessed via await/Promise, return the actual service
                return (resolve: (value: T) => void, reject: (reason: any) => void) => {
                    lazyServiceRegistry.get<T>(serviceName).then(resolve).catch(reject)
                }
            }

            // For any other property access, load the service and forward the call
            return (...args: any[]) => {
                return lazyServiceRegistry.get<T>(serviceName).then(service => {
                    const method = (service as any)[prop]
                    if (typeof method === 'function') {
                        return method.apply(service, args)
                    }
                    return method
                })
            }
        }
    })
}