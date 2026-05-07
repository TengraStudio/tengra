/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { AdvancedMemoryService } from '@main/services/llm/advanced-memory.service';
import { MemoryContextService } from '@main/services/llm/memory-context.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface ResolutionMatch {
    content: string;
}

interface Deferred<T> {
    promise: Promise<T>;
    resolve: (value: T) => void;
}

function createDeferred<T>(): Deferred<T> {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(res => {
        resolve = res;
    });
    return { promise, resolve };
}

function createMockAdvancedMemory() {
    const findResolutionMemories = vi.fn<(query: string, limit: number) => Promise<ResolutionMatch[]>>(async () => []);
    const rememberExplicit = vi.fn(async () => ({ id: 'm1' }));
    return {
        findResolutionMemories,
        rememberExplicit,
    };
}

describe('MemoryContextService', () => {
    let mockAdvanced: ReturnType<typeof createMockAdvancedMemory>;
    let service: MemoryContextService;

    beforeEach(() => {
        vi.restoreAllMocks();
        MemoryContextService.resetStatsForTests();
        mockAdvanced = createMockAdvancedMemory();
        service = new MemoryContextService(mockAdvanced as never as AdvancedMemoryService);
    });

    it('caches resolution context by query and limit', async () => {
        mockAdvanced.findResolutionMemories.mockResolvedValueOnce([
            { content: 'Fix with command IconX' },
        ]);

        const first = await service.getResolutionContext('npm run dev fails', { timeoutMs: 300, limit: 3 });
        const second = await service.getResolutionContext('npm run dev fails', { timeoutMs: 300, limit: 3 });

        expect(first).toContain('Fix with command IconX');
        expect(second).toContain('Fix with command IconX');
        expect(mockAdvanced.findResolutionMemories).toHaveBeenCalledTimes(1);
    });

    it('deduplicates in-flight lookups for same query and limit', async () => {
        const deferred = createDeferred<ResolutionMatch[]>();
        mockAdvanced.findResolutionMemories.mockImplementationOnce(() => deferred.promise);

        const firstPromise = service.getResolutionContext('TypeError in parser', { timeoutMs: 500, limit: 3 });
        const secondPromise = service.getResolutionContext('TypeError in parser', { timeoutMs: 500, limit: 3 });

        deferred.resolve([{ content: 'Normalize input before parse' }]);
        const [first, second] = await Promise.all([firstPromise, secondPromise]);

        expect(first).toContain('Normalize input before parse');
        expect(second).toContain('Normalize input before parse');
        expect(mockAdvanced.findResolutionMemories).toHaveBeenCalledTimes(1);
    });

    it('caches misses briefly to avoid repeated empty lookups', async () => {
        mockAdvanced.findResolutionMemories.mockResolvedValue([]);

        const first = await service.getResolutionContext('totally-unknown-issue', { timeoutMs: 300, limit: 2 });
        const second = await service.getResolutionContext('totally-unknown-issue', { timeoutMs: 300, limit: 2 });

        expect(first).toBeUndefined();
        expect(second).toBeUndefined();
        expect(mockAdvanced.findResolutionMemories).toHaveBeenCalledTimes(1);
    });

    it('invalidates lookup cache after rememberInsight writes', async () => {
        mockAdvanced.findResolutionMemories
            .mockResolvedValueOnce([{ content: 'old resolution' }])
            .mockResolvedValueOnce([{ content: 'new resolution' }]);

        const first = await service.getResolutionContext('docker build error', { timeoutMs: 300, limit: 3 });
        const cached = await service.getResolutionContext('docker build error', { timeoutMs: 300, limit: 3 });

        service.rememberInsight({
            content: 'Issue signature: docker build error Resolution: update Dockerfile base image',
            sourceId: 'test-source',
            category: 'technical',
            tags: ['resolution']
        });
        await new Promise(resolve => setTimeout(resolve, 0));

        const afterWrite = await service.getResolutionContext('docker build error', { timeoutMs: 300, limit: 3 });

        expect(first).toContain('old resolution');
        expect(cached).toContain('old resolution');
        expect(afterWrite).toContain('new resolution');
        expect(mockAdvanced.findResolutionMemories).toHaveBeenCalledTimes(2);
        expect(mockAdvanced.rememberExplicit).toHaveBeenCalledTimes(1);
    });

    it('tracks lookup stats for cache and in-flight behavior', async () => {
        const deferred = createDeferred<ResolutionMatch[]>();
        mockAdvanced.findResolutionMemories.mockImplementationOnce(() => deferred.promise);

        const firstPromise = service.getResolutionContext('failed lint command', { timeoutMs: 500, limit: 2 });
        const secondPromise = service.getResolutionContext('failed lint command', { timeoutMs: 500, limit: 2 });

        deferred.resolve([{ content: 'Run eslint --fix first' }]);
        await Promise.all([firstPromise, secondPromise]);
        await service.getResolutionContext('failed lint command', { timeoutMs: 500, limit: 2 });

        const stats = MemoryContextService.getStats();
        expect(stats.lookupCount).toBe(3);
        expect(stats.cacheMisses).toBe(2);
        expect(stats.inflightReuseCount).toBe(1);
        expect(stats.cacheHits).toBe(1);
        expect(stats.lookupFailureCount).toBe(0);
        expect(stats.lookupTimeoutCount).toBe(0);
    });
});

