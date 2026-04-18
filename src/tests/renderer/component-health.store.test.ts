/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
