/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock appLogger before importing the module
vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

// Re-import after mock setup — dynamic import to get fresh modules each test
let lazyServiceRegistry: typeof import('@main/core/lazy-services').lazyServiceRegistry;
let createLazyServiceProxy: typeof import('@main/core/lazy-services').createLazyServiceProxy;

describe('LazyServiceRegistry', () => {
    beforeEach(async () => {
        vi.resetModules();
        const mod = await import('@main/core/lazy-services');
        lazyServiceRegistry = mod.lazyServiceRegistry;
        createLazyServiceProxy = mod.createLazyServiceProxy;
    });

    it('should register and load a service on first get()', async () => {
        const mockService = { greet: () => 'hello' };
        const factory = vi.fn().mockResolvedValue(mockService);

        lazyServiceRegistry.register('testService', factory);
        const result = await lazyServiceRegistry.get<typeof mockService>('testService');

        expect(result).toBe(mockService);
        expect(factory).toHaveBeenCalledOnce();
    });

    it('should return cached service on subsequent get() calls', async () => {
        const mockService = { value: 42 };
        const factory = vi.fn().mockResolvedValue(mockService);

        lazyServiceRegistry.register('cached', factory);
        const first = await lazyServiceRegistry.get('cached');
        const second = await lazyServiceRegistry.get('cached');

        expect(first).toBe(second);
        expect(factory).toHaveBeenCalledOnce();
    });

    it('should throw for unregistered service', async () => {
        await expect(lazyServiceRegistry.get('nonexistent'))
            .rejects.toThrow("Lazy service 'nonexistent' not registered");
    });

    it('should deduplicate concurrent get() calls', async () => {
        const mockService = { id: 'dedup' };
        const factory = vi.fn().mockImplementation(
            () => new Promise(resolve => setTimeout(() => resolve(mockService), 50))
        );

        lazyServiceRegistry.register('dedup', factory);

        const [r1, r2] = await Promise.all([
            lazyServiceRegistry.get('dedup'),
            lazyServiceRegistry.get('dedup')
        ]);

        expect(r1).toBe(r2);
        expect(factory).toHaveBeenCalledOnce();
    });

    it('should report isLoaded correctly', async () => {
        const factory = vi.fn().mockResolvedValue({});

        lazyServiceRegistry.register('loadCheck', factory);
        expect(lazyServiceRegistry.isLoaded('loadCheck')).toBe(false);

        await lazyServiceRegistry.get('loadCheck');
        expect(lazyServiceRegistry.isLoaded('loadCheck')).toBe(true);
    });

    it('should list registered and loaded services', async () => {
        const factory1 = vi.fn().mockResolvedValue({});
        const factory2 = vi.fn().mockResolvedValue({});

        lazyServiceRegistry.register('svc1', factory1);
        lazyServiceRegistry.register('svc2', factory2);

        expect(lazyServiceRegistry.getRegisteredServices()).toEqual(['svc1', 'svc2']);
        expect(lazyServiceRegistry.getLoadedServices()).toEqual([]);

        await lazyServiceRegistry.get('svc1');
        expect(lazyServiceRegistry.getLoadedServices()).toEqual(['svc1']);
    });

    it('should propagate factory errors and allow retry', async () => {
        const factory = vi.fn()
            .mockRejectedValueOnce(new Error('init failed'))
            .mockResolvedValueOnce({ recovered: true });

        lazyServiceRegistry.register('flaky', factory);

        await expect(lazyServiceRegistry.get('flaky')).rejects.toThrow('init failed');

        // After failure, loading promise should be cleared, allowing retry
        const result = await lazyServiceRegistry.get('flaky');
        expect(result).toEqual({ recovered: true });
        expect(factory).toHaveBeenCalledTimes(2);
    });
});

describe('createLazyServiceProxy', () => {
    beforeEach(async () => {
        vi.resetModules();
        const mod = await import('@main/core/lazy-services');
        lazyServiceRegistry = mod.lazyServiceRegistry;
        createLazyServiceProxy = mod.createLazyServiceProxy;
    });

    it('should forward method calls to the loaded service', async () => {
        interface TestService {
            add(a: number, b: number): number;
        }

        const realService: TestService = { add: (a: number, b: number) => a + b };
        lazyServiceRegistry.register('math', vi.fn().mockResolvedValue(realService));

        const proxy = createLazyServiceProxy<TestService>('math');
        const result = await (proxy.add as never as (a: number, b: number) => Promise<number>)(2, 3);
        expect(result).toBe(5);
    });

    it('should resolve via await (thenable protocol)', async () => {
        const realService = { name: 'awaited' };
        lazyServiceRegistry.register('awaitable', vi.fn().mockResolvedValue(realService));

        const proxy = createLazyServiceProxy<typeof realService>('awaitable');
        const resolved = await (proxy as never as Promise<typeof realService>);
        expect(resolved.name).toBe('awaited');
    });
});
