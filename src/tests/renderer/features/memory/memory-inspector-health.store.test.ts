/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
    __resetMemoryInspectorHealthForTests,
    getMemoryInspectorHealthSnapshot,
    recordMemoryInspectorHealthEvent,
    recordMemoryInspectorRuntimeHealth,
} from '@/features/memory/store/memory-inspector-health.store';

describe('memory-inspector-health.store', () => {
    beforeEach(() => {
        __resetMemoryInspectorHealthForTests();
    });

    it('records successful load event', () => {
        recordMemoryInspectorHealthEvent({
            channel: 'memory.loadData',
            status: 'success',
            durationMs: 180,
        });

        const snapshot = getMemoryInspectorHealthSnapshot();
        expect(snapshot.metrics.totalCalls).toBe(1);
        expect(snapshot.metrics.totalFailures).toBe(0);
        expect(snapshot.status).toBe('healthy');
    });

    it('degrades on validation failures', () => {
        recordMemoryInspectorHealthEvent({
            channel: 'memory.import',
            status: 'validation-failure',
            errorCode: 'MEMORY_INSPECTOR_IMPORT_INVALID_PAYLOAD',
        });

        const snapshot = getMemoryInspectorHealthSnapshot();
        expect(snapshot.metrics.validationFailures).toBe(1);
        expect(snapshot.metrics.lastErrorCode).toBe('MEMORY_INSPECTOR_IMPORT_INVALID_PAYLOAD');
        expect(snapshot.status).toBe('degraded');
    });

    it('tracks operation budget overruns', () => {
        recordMemoryInspectorHealthEvent({
            channel: 'memory.operation',
            status: 'success',
            durationMs: 1000,
        });

        const snapshot = getMemoryInspectorHealthSnapshot();
        expect(snapshot.metrics.budgetExceeded).toBe(1);
        expect(snapshot.metrics.channels['memory.operation'].budgetExceeded).toBe(1);
        expect(snapshot.status).toBe('degraded');
    });

    it('tracks runtime lookup health and keeps healthy when within budget', () => {
        recordMemoryInspectorRuntimeHealth({
            status: 'healthy',
            uiState: 'ready',
            budgets: { fastMs: 40, standardMs: 120, heavyMs: 250 },
            metrics: {
                totalCalls: 10,
                totalFailures: 0,
                totalRetries: 0,
                validationFailures: 0,
                budgetExceededCount: 0,
                errorRate: 0,
            },
            memoryContext: {
                cacheHits: 8,
                cacheMisses: 2,
                inflightReuseCount: 1,
                lookupCount: 10,
                lookupTimeoutCount: 0,
                lookupFailureCount: 0,
                lastLookupDurationMs: 20,
                averageLookupDurationMs: 95,
                cacheSize: 6,
                inflightSize: 0,
            }
        });

        const snapshot = getMemoryInspectorHealthSnapshot();
        expect(snapshot.runtime.status).toBe('healthy');
        expect(snapshot.runtime.cacheHitRate).toBe(80);
        expect(snapshot.status).toBe('healthy');
    });

    it('degrades when runtime lookup has timeout/failure or high latency', () => {
        recordMemoryInspectorRuntimeHealth({
            status: 'healthy',
            uiState: 'ready',
            budgets: { fastMs: 40, standardMs: 120, heavyMs: 250 },
            metrics: {
                totalCalls: 4,
                totalFailures: 0,
                totalRetries: 0,
                validationFailures: 0,
                budgetExceededCount: 0,
                errorRate: 0,
            },
            memoryContext: {
                cacheHits: 1,
                cacheMisses: 3,
                inflightReuseCount: 0,
                lookupCount: 4,
                lookupTimeoutCount: 1,
                lookupFailureCount: 0,
                lastLookupDurationMs: 450,
                averageLookupDurationMs: 320,
                cacheSize: 2,
                inflightSize: 1,
            }
        });

        const snapshot = getMemoryInspectorHealthSnapshot();
        expect(snapshot.runtime.status).toBe('degraded');
        expect(snapshot.status).toBe('degraded');
    });
});

