import { EventEmitter } from 'events';

import { appLogger } from '@main/logging/logger';

export interface ServiceMetadata {
    id: string;
    version: string;
    tags: string[];
    description?: string;
}

/**
 * Dynamic Service Registry for decoupling service lookups and enabling plugin architectures.
 */
export class ServiceRegistry extends EventEmitter {
    private services: Map<string, unknown> = new Map();
    private metadata: Map<string, ServiceMetadata> = new Map();

    private static instance?: ServiceRegistry;

    private constructor() {
        super();
    }

    public static getInstance(): ServiceRegistry {
        return ServiceRegistry.instance ??= new ServiceRegistry();
    }

    /**
     * Registers a service instance.
     * @param id Unique service identifier (e.g., 'llm-provider:openai')
     * @param instance The service instance
     * @param metadata Optional metadata
     */
    register<T = unknown>(id: string, instance: T, metadata?: Partial<ServiceMetadata>) {
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
     * Unregisters a service.
     */
    unregister(id: string) {
        if (this.services.delete(id)) {
            this.metadata.delete(id);
            appLogger.info('ServiceRegistry', `Unregistered service: ${id}`);
            this.emit('service:unregistered', id);
        }
    }

    /**
     * Retrieves a service by ID.
     */
    get<T>(id: string): T | undefined {
        return this.services.get(id) as T;
    }

    /**
     * Finds services matching a predicate on their metadata.
     */
    find<T = unknown>(predicate: (meta: ServiceMetadata) => boolean): T[] {
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
     */
    findByTag<T = unknown>(tag: string): T[] {
        return this.find<T>(meta => meta.tags.includes(tag));
    }
}
