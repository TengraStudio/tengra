import {
    __resetMemoryInspectorHealthForTests,
    getMemoryInspectorHealthSnapshot,
    recordMemoryInspectorHealthEvent,
} from '@/store/memory-inspector-health.store';
import { beforeEach, describe, expect, it } from 'vitest';

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
});
