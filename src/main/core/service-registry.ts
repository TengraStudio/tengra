/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { EventEmitter } from 'events';

import { appLogger } from '@main/logging/logger';

/**
 * Metadata describing a registered service.
 * @property id - Unique service identifier (e.g., 'llm-provider:openai')
 * @property version - Semantic version string (default: '1.0.0')
 * @property tags - Categorization tags for service discovery
 * @property description - Optional human-readable description
 */
export interface ServiceMetadata {
    id: string;
    version: string;
    tags: string[];
    description?: string;
}

/**
 * Dynamic Service Registry for decoupling service lookups and enabling plugin architectures.
 * Uses the Singleton pattern — access via `ServiceRegistry.getInstance()`.
 * Emits `service:registered` and `service:unregistered` events.
 *
 * Services map uses `RuntimeValue` values intentionally since this registry stores
 * heterogeneous service types accessed via typed generic getters.
 */
export class ServiceRegistry extends EventEmitter {
    /** Service instances keyed by ID. Typed as RuntimeValue since registry is generic. */
    private services: Map<string, RuntimeValue> = new Map();
    private metadata: Map<string, ServiceMetadata> = new Map();

    private static instance?: ServiceRegistry;

    private constructor() {
        super();
    }

    /** @returns The singleton ServiceRegistry instance. */
    public static getInstance(): ServiceRegistry {
        return ServiceRegistry.instance ??= new ServiceRegistry();
    }

    /**
     * Registers a service instance.
     * @param id - Unique service identifier (e.g., 'llm-provider:openai')
     * @param instance - The service instance
     * @param metadata - Optional metadata (version, tags, description)
     */
    register<T extends RuntimeValue = RuntimeValue>(id: string, instance: T, metadata?: Partial<ServiceMetadata>): void {
        if (this.services.has(id)) {
            appLogger.warn('ServiceRegistry', `Overwriting existing service: ${id}`);
        }

        this.services.set(id, instance);
        this.metadata.set(id, {
            id,
            version: metadata?.version ?? '1.0.0',
            tags: metadata?.tags ?? [],
            description: metadata?.description
        });

        appLogger.info('ServiceRegistry', `Registered service: ${id}`);
        this.emit('service:registered', id);
    }

    /**
     * Unregisters a service and emits a removal event.
     * @param id - The service identifier to remove
     */
    unregister(id: string): void {
        if (this.services.delete(id)) {
            this.metadata.delete(id);
            appLogger.info('ServiceRegistry', `Unregistered service: ${id}`);
            this.emit('service:unregistered', id);
        }
    }

    /**
     * Retrieves a service by ID.
     * @param id - The service identifier
     * @returns The service instance, or undefined if not found
     */
    get<T extends RuntimeValue = RuntimeValue>(id: string): T | undefined {
        return this.services.get(id) as T;
    }

    /**
     * Finds services matching a predicate on their metadata.
     * @param predicate - Filter function applied to each service's metadata
     * @returns Array of matching service instances
     */
    find<T extends RuntimeValue = RuntimeValue>(predicate: (meta: ServiceMetadata) => boolean): T[] {
        const results: T[] = [];
        for (const [id, meta] of this.metadata) {
            if (predicate(meta)) {
                const service = this.services.get(id);
                if (service !== undefined) {
                    results.push(service as T);
                }
            }
        }
        return results;
    }

    /**
     * Finds services by tag.
     * @param tag - The tag to search for
     * @returns Array of service instances that have the specified tag
     */
    findByTag<T extends RuntimeValue = RuntimeValue>(tag: string): T[] {
        return this.find<T>(meta => meta.tags.includes(tag));
    }
}
