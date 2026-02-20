import { beforeEach, describe, expect, it } from 'vitest';

import {
    __resetSettingsPageHealthForTests,
    getSettingsPageHealthSnapshot,
    recordSettingsPageHealthEvent,
} from '@/store/settings-page-health.store';

describe('settings-page-health.store', () => {
    beforeEach(() => {
        __resetSettingsPageHealthForTests();
    });

    it('records successful save events', () => {
        recordSettingsPageHealthEvent({
            channel: 'settings.save',
            status: 'success',
            durationMs: 120,
        });

        const snapshot = getSettingsPageHealthSnapshot();
        expect(snapshot.metrics.totalCalls).toBe(1);
        expect(snapshot.metrics.totalFailures).toBe(0);
        expect(snapshot.status).toBe('healthy');
    });

    it('tracks validation failures', () => {
        recordSettingsPageHealthEvent({
            channel: 'settings.update',
            status: 'validation-failure',
            durationMs: 80,
            errorCode: 'SETTINGS_PAGE_VALIDATION_ERROR',
        });

        const snapshot = getSettingsPageHealthSnapshot();
        expect(snapshot.metrics.validationFailures).toBe(1);
        expect(snapshot.metrics.totalFailures).toBe(1);
        expect(snapshot.metrics.lastErrorCode).toBe('SETTINGS_PAGE_VALIDATION_ERROR');
        expect(snapshot.status).toBe('degraded');
    });

    it('counts budget exceedance for load channel', () => {
        recordSettingsPageHealthEvent({
            channel: 'settings.load',
            status: 'success',
            durationMs: 5000,
        });

        const snapshot = getSettingsPageHealthSnapshot();
        expect(snapshot.metrics.budgetExceeded).toBe(1);
        expect(snapshot.metrics.channels['settings.load'].budgetExceeded).toBe(1);
    });
});
