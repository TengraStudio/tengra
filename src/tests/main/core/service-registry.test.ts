import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock appLogger
vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

import { ServiceRegistry } from '@main/core/service-registry';

describe('ServiceRegistry', () => {
    let registry: ServiceRegistry;

    beforeEach(() => {
        // Get singleton and clear it before each test
        registry = ServiceRegistry.getInstance();
        // Clear internal state by unregistering known services
        // Using the public API since internal maps are private
    });

    it('should return the same singleton instance', () => {
        const instance1 = ServiceRegistry.getInstance();
        const instance2 = ServiceRegistry.getInstance();
        expect(instance1).toBe(instance2);
    });

    it('should register and retrieve a service', () => {
        const myService = { execute: () => 'result' };
        registry.register('test:service-1', myService, {
            tags: ['test'],
            description: 'A test service'
        });

        const retrieved = registry.get<typeof myService>('test:service-1');
        expect(retrieved).toBe(myService);

        // Cleanup
        registry.unregister('test:service-1');
    });

    it('should return undefined for unregistered service', () => {
        const result = registry.get('nonexistent:service');
        expect(result).toBeUndefined();
    });

    it('should unregister a service', () => {
        const svc = { id: 'remove-me' };
        registry.register('test:remove', svc);

        registry.unregister('test:remove');
        expect(registry.get('test:remove')).toBeUndefined();
    });

    it('should emit service:registered event', () => {
        const listener = vi.fn();
        registry.on('service:registered', listener);

        registry.register('test:event-reg', { val: 1 });
        expect(listener).toHaveBeenCalledWith('test:event-reg');

        // Cleanup
        registry.off('service:registered', listener);
        registry.unregister('test:event-reg');
    });

    it('should emit service:unregistered event', () => {
        const listener = vi.fn();
        registry.on('service:unregistered', listener);

        registry.register('test:event-unreg', { val: 2 });
        registry.unregister('test:event-unreg');

        expect(listener).toHaveBeenCalledWith('test:event-unreg');

        // Cleanup
        registry.off('service:unregistered', listener);
    });

    it('should find services by predicate', () => {
        const svc1 = { name: 'alpha' };
        const svc2 = { name: 'beta' };

        registry.register('test:alpha', svc1, { tags: ['group-a'] });
        registry.register('test:beta', svc2, { tags: ['group-b'] });

        const results = registry.find<typeof svc1>(
            meta => meta.tags.includes('group-a')
        );

        expect(results).toHaveLength(1);
        expect(results[0]).toBe(svc1);

        // Cleanup
        registry.unregister('test:alpha');
        registry.unregister('test:beta');
    });

    it('should find services by tag', () => {
        const svcA = { type: 'A' };
        const svcB = { type: 'B' };
        const svcC = { type: 'C' };

        registry.register('test:tag-a', svcA, { tags: ['provider'] });
        registry.register('test:tag-b', svcB, { tags: ['provider', 'premium'] });
        registry.register('test:tag-c', svcC, { tags: ['utility'] });

        const providers = registry.findByTag<typeof svcA>('provider');
        expect(providers).toHaveLength(2);

        const premiums = registry.findByTag<typeof svcB>('premium');
        expect(premiums).toHaveLength(1);
        expect(premiums[0]).toBe(svcB);

        // Cleanup
        registry.unregister('test:tag-a');
        registry.unregister('test:tag-b');
        registry.unregister('test:tag-c');
    });

    it('should overwrite existing service on re-register', () => {
        const original = { version: 1 };
        const updated = { version: 2 };

        registry.register('test:overwrite', original);
        registry.register('test:overwrite', updated);

        const result = registry.get<typeof updated>('test:overwrite');
        expect(result).toBe(updated);

        // Cleanup
        registry.unregister('test:overwrite');
    });

    it('should default metadata fields when not provided', () => {
        const svc = { id: 'defaults' };
        registry.register('test:defaults', svc);

        // Verify by using find with version predicate
        const found = registry.find<typeof svc>(meta => meta.version === '1.0.0');
        const match = found.find(s => s === svc);
        expect(match).toBeDefined();

        // Cleanup
        registry.unregister('test:defaults');
    });
});
