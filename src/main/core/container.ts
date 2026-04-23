/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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

    registerInstance<T extends ServiceValue>(name: string, instance: T): void {
        this.services.set(name, {
            name,
            factory: () => instance,
            dependencies: [],
            scope: Scope.SINGLETON,
            instance
        });
    }

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
     * Initialize all critical singleton services in parallel.
     */
    async init(): Promise<void> {
        if (this.initialized) { return; }

        const singletons = Array.from(this.services.values())
            .filter(def => def.scope === Scope.SINGLETON);
        const criticalSingletons = singletons.filter(def => !this.deferredServices.has(def.name));

        // Instantiate critical singletons
        for (const def of criticalSingletons) {
            this.resolve(def.name);
        }

        // Initialize critical services in parallel
        await Promise.all(criticalSingletons.map(async (def) => {
            const instance = def.instance as LifecycleAware;
            if (typeof instance.initialize === 'function') {
                try {
                    const start = Date.now();
                    await instance.initialize();
                    const duration = Date.now() - start;
                    if (duration > 150) {
                        appLogger.debug('Container', `Slow critical init: ${def.name} (${duration}ms)`);
                    }
                } catch (error) {
                    appLogger.error('Container', `Critical init failed for ${def.name}`, error as Error);
                }
            }
        }));

        this.initialized = true;
    }

    /**
     * Initialize deferred services in parallel.
     */
    async initDeferred(): Promise<void> {
        if (this.deferredInitialized) { return; }

        const deferred = Array.from(this.services.values())
            .filter(def => def.scope === Scope.SINGLETON && this.deferredServices.has(def.name));

        await Promise.all(deferred.map(async (def) => {
            try {
                const instance = this.resolve<LifecycleAware>(def.name);
                if (typeof instance?.initialize === 'function') {
                    const start = Date.now();
                    await instance.initialize();
                    appLogger.debug('Container', `Deferred init ${def.name} in ${Date.now() - start}ms`);
                }
            } catch (error) {
                appLogger.error('Container', `Deferred init failed for ${def.name}`, error as Error);
            }
        }));

        this.deferredInitialized = true;
    }

    async dispose(): Promise<void> {
        const singletons = Array.from(this.services.values())
            .filter(def => def.scope === Scope.SINGLETON && def.instance)
            .reverse();

        for (const def of singletons) {
            const instance = def.instance as LifecycleAware;
            if (typeof instance.cleanup === 'function') {
                let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
                try {
                    await Promise.race([
                        instance.cleanup(),
                        new Promise((_, reject) => {
                            timeoutHandle = setTimeout(
                                () => reject(new Error('Cleanup timed out')),
                                OPERATION_TIMEOUTS.SERVICE_CLEANUP
                            );
                            if (timeoutHandle?.unref) { timeoutHandle.unref(); }
                        })
                    ]);
                } catch (error) {
                    appLogger.error('Container', `Cleanup failed for ${def.name}`, error as Error);
                } finally {
                    if (timeoutHandle !== null) { clearTimeout(timeoutHandle); }
                }
            }
        }

        this.services.clear();
        this.initialized = false;
        this.deferredInitialized = false;
    }

    private instantiate<T extends ServiceValue>(definition: ServiceDefinition<T>): T {
        try {
            const deps = definition.dependencies.map(depName => this.resolve(depName));
            return definition.factory(...deps);
        } catch (error) {
            throw new ValidationError(`Failed to resolve ${definition.name}: ${getErrorMessage(error as Error)}`);
        }
    }

    markDeferred(names: string[]): void {
        for (const name of names) {
            this.deferredServices.add(name);
        }
    }

    has(name: string): boolean {
        return this.services.has(name);
    }

    getServiceEntries(): Array<{ name: string; dependencies: string[] }> {
        return Array.from(this.services.values()).map(def => ({
            name: def.name,
            dependencies: def.dependencies
        }));
    }

    clear(): void {
        this.services.clear();
        this.initialized = false;
        this.deferredInitialized = false;
    }
}
