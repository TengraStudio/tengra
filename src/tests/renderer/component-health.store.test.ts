import { createComponentHealthStore } from '@renderer/store/component-health.store';
import { describe, expect, it } from 'vitest';

describe('component health store', () => {
    it('tracks success, retry, fallback, and failure counters', () => {
        const store = createComponentHealthStore('test-component', 100);

        store.recordSuccess(120);
        store.recordRetry();
        store.recordFallback();
        store.recordFailure('TEST_FAILURE', 40);

        const snapshot = store.getSnapshot();
        expect(snapshot.successCount).toBe(1);
        expect(snapshot.retryCount).toBe(1);
        expect(snapshot.fallbackCount).toBe(1);
        expect(snapshot.failureCount).toBe(1);
        expect(snapshot.budgetExceededCount).toBe(1);
        expect(snapshot.lastErrorCode).toBe('TEST_FAILURE');
    });
});
