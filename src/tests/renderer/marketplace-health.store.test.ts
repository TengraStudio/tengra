import { beforeEach, describe, expect, it } from 'vitest';

import {
    __resetMarketplaceHealthForTests,
    getMarketplaceHealthSnapshot,
    recordMarketplaceHealthEvent,
} from '@/store/marketplace-health.store';

describe('marketplace-health.store', () => {
    beforeEach(() => {
        __resetMarketplaceHealthForTests();
    });

    it('records successful marketplace load within budget', () => {
        recordMarketplaceHealthEvent({
            channel: 'marketplace.load',
            status: 'success',
            durationMs: 500,
        });

        const snapshot = getMarketplaceHealthSnapshot();
        expect(snapshot.metrics.totalCalls).toBe(1);
        expect(snapshot.metrics.totalFailures).toBe(0);
        expect(snapshot.metrics.budgetExceeded).toBe(0);
        expect(snapshot.status).toBe('healthy');
    });

    it('marks degraded state when install budget is exceeded', () => {
        recordMarketplaceHealthEvent({
            channel: 'marketplace.install',
            status: 'success',
            durationMs: 5000,
        });

        const snapshot = getMarketplaceHealthSnapshot();
        expect(snapshot.metrics.budgetExceeded).toBe(1);
        expect(snapshot.metrics.channels['marketplace.install'].budgetExceeded).toBe(1);
        expect(snapshot.status).toBe('degraded');
    });

    it('tracks failures with error code', () => {
        recordMarketplaceHealthEvent({
            channel: 'marketplace.search',
            status: 'failure',
            durationMs: 80,
            errorCode: 'MCP_MARKETPLACE_SEARCH_FAILED',
        });

        const snapshot = getMarketplaceHealthSnapshot();
        expect(snapshot.metrics.totalFailures).toBe(1);
        expect(snapshot.metrics.lastErrorCode).toBe('MCP_MARKETPLACE_SEARCH_FAILED');
        expect(snapshot.status).toBe('degraded');
    });
});
