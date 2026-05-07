/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ipc } from '@main/core/ipc-decorators';
import { appLogger } from '@main/logging/logger';
import { LAZY_CHANNELS } from '@shared/constants/ipc-channels';

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
    private readonly lazyServices = new Map<string, LazyServiceFactory<object>>();
    private readonly loadedServices = new Map<string, object>();
    private readonly loadingPromises = new Map<string, Promise<object>>();

    /**
     * Register a service for lazy loading
     */
    register<T extends object>(name: string, factory: LazyServiceFactory<T>): void {
        this.lazyServices.set(name, factory as LazyServiceFactory<object>);
    }

    /**
     * Get a service, loading it if necessary
     */
    async get<T extends object>(name: string): Promise<T> {
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

    private async loadService<T extends object>(name: string, factory: LazyServiceFactory<T>): Promise<T> {
        const startTime = Date.now();
        const { getIpcMethodsForService, registerServiceIpc } = await import('@main/core/ipc-decorators');

        try {
            const service = await factory();
            
            const ipcMethods = getIpcMethodsForService(service);
            if (ipcMethods.length === 0) {
                appLogger.warn('IPC', `Skipping IPC registration for lazy service without @ipc methods: ${name}`);
            } else {
                registerServiceIpc(service);
            }

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
    @ipc(LAZY_CHANNELS.GET_STATUS)
    getStatus(): {
        registered: string[];
        loaded: string[];
        loading: string[];
    } {
        const registered = this.getRegisteredServices();
        const loaded = this.getLoadedServices();
        const loading = this.getLoadingServices();

        return {
            registered,
            loaded,
            loading,
        };
    }
}

/** Singleton instance of the lazy service registry. */
export const lazyServiceRegistry = new LazyServiceRegistry();

/**
 * Explicit lazy dependency boundary used by consumers that should opt into
 * controlled async resolution rather than transparent proxies.
 */
export interface LazyServiceDependency<T extends object> {
    serviceName: string;
    resolve: () => Promise<T>;
    isLoaded: () => boolean;
}

/**
 * Creates an explicit lazy dependency handle for dependency injection boundaries.
 */
export function createLazyServiceDependency<T extends object>(serviceName: string): LazyServiceDependency<T> {
    return {
        serviceName,
        resolve: () => lazyServiceRegistry.get<T>(serviceName),
        isLoaded: () => lazyServiceRegistry.isLoaded(serviceName),
    };
}

/**
 * Creates a Proxy that lazily loads a service on first property access.
 * Any method call on the proxy will trigger async service loading and then
 * forward the call to the real service instance.
 *
 * @template T The service interface type
 * @param serviceName - Name of the service registered in the lazy registry
 * @param serviceClass - Optional constructor function for metadata discovery
 * @returns A proxy object that behaves like T but loads on demand
 */
export function createLazyServiceProxy<T extends object>(serviceName: string, serviceClass?: any): T {
    return new Proxy({} as T, {
        get(_target: T, prop: string | symbol, _receiver: T): RuntimeValue {
            // Handle constructor access for metadata/IPC decorators
            if (prop === 'constructor' && serviceClass) {
                return serviceClass;
            }

            // Handle async service loading
            if (prop === 'then') {
                // If accessed via await/Promise, return the actual service
                return (resolve: (value: T) => void, reject: (reason: RuntimeValue) => void) => {
                    lazyServiceRegistry.get<T>(serviceName).then(resolve).catch(reject);
                };
            }

            // For any other property access, load the service and forward the call
            return (...args: RuntimeValue[]) => {
                return lazyServiceRegistry.get<T>(serviceName).then(service => {
                    const method = (service as Record<string | symbol, RuntimeValue>)[prop];
                    if (typeof method === 'function') {
                        return (method as (...methodArgs: RuntimeValue[]) => RuntimeValue).apply(service, args);
                    }
                    return method;
                });
            };
        }
    });
}

